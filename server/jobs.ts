import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dns from 'dns';
import { promisify } from 'util';
import multer from 'multer';
import type express from 'express';
import * as XLSX from 'xlsx';
import {
  dbJobs,
  dbLeads,
  dbUsers,
  type BackgroundJobRecord,
  type StoredLead,
  UPLOADS_DIR,
  EXPORTS_DIR
} from './db';
import type { AuthRequest } from './auth';
import { requireAuth } from './auth';
import {
  extractLeadsUnified,
  crawlWebsiteForLeads,
  cleanEmail,
  cleanCompanyName
} from '../services/multiEngineCrawler';
import { buildExhaustiveQueryMatrix } from '../services/leadCrawlerService';
import { classifyCountryOffline } from '../services/offlineClassifier';
import { resolveBatchDomainsDeeply } from '../services/deepCountryResolver';
import { filterBusinessEmailsBulk, DEFAULT_BUSINESS_FILTER_OPTIONS } from '../services/businessEmailFilter';

const resolveMx = promisify(dns.resolveMx);

// Active abort controllers for running jobs
const activeJobControllers = new Map<string, { abort: () => void }>();

// Configure Multer for server disk uploads
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const userId = req.user?.id || 'guest';
    const userDir = path.join(UPLOADS_DIR, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}_${cleanOriginalName}`);
  }
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 500 // 500 MB upload limit on server
  }
});

// Regular expressions for server-side entity extraction
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}/g;
const URL_REGEX = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

// Cache for DNS MX lookups during jobs
const dnsMxCache = new Map<string, { valid: boolean; provider?: string }>();

async function checkMxFast(domain: string): Promise<{ valid: boolean; provider?: string }> {
  const d = domain.toLowerCase().trim();
  if (dnsMxCache.has(d)) return dnsMxCache.get(d)!;
  try {
    const mx = await resolveMx(d).catch(() => []);
    if (mx && mx.length > 0) {
      const top = mx[0]?.exchange || '';
      const res = { valid: true, provider: top };
      dnsMxCache.set(d, res);
      return res;
    }
    const res = { valid: false };
    dnsMxCache.set(d, res);
    return res;
  } catch {
    const res = { valid: false };
    dnsMxCache.set(d, res);
    return res;
  }
}

// Background Worker: Process File Extraction Line-by-Line / Chunk-by-Chunk
async function runFileExtractionJob(job: BackgroundJobRecord): Promise<void> {
  const filePath = job.config.filePath;
  if (!filePath || !fs.existsSync(filePath)) {
    dbJobs.update(job.id, {
      status: 'failed',
      error: 'Uploaded file could not be found on server disk',
      completedAt: new Date().toISOString()
    });
    return;
  }

  const stat = fs.statSync(filePath);
  const totalBytes = stat.size;
  const isExcel = filePath.endsWith('.xlsx') || filePath.endsWith('.xls');

  let isAborted = false;
  activeJobControllers.set(job.id, {
    abort: () => {
      isAborted = true;
    }
  });

  dbJobs.update(job.id, {
    status: 'running',
    startedAt: new Date().toISOString(),
    progress: {
      percent: 0,
      processed: 0,
      total: totalBytes,
      leadsFound: 0,
      speedPerSec: 0,
      currentStage: `Streaming ${path.basename(filePath)} (${(totalBytes / (1024 * 1024)).toFixed(2)} MB)...`,
      bytesProcessed: 0,
      totalBytes
    }
  });

  const startTime = Date.now();
  const seenEmails = new Set<string>();
  const pendingLeads: StoredLead[] = [];
  let totalExtracted = 0;
  let validMxCount = 0;
  let phoneCount = 0;
  let websiteCount = 0;

  const flushBatch = () => {
    if (pendingLeads.length > 0) {
      const savedCount = dbLeads.appendLeadsForUser(job.userId, [...pendingLeads]);
      totalExtracted += savedCount;
      pendingLeads.length = 0;
    }
  };

  try {
    if (isExcel) {
      // Process Excel Workbook
      const workbook = XLSX.readFile(filePath, { dense: true });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const totalRows = rows.length;
      let rowIndex = 0;

      for (const row of rows) {
        if (isAborted) break;
        rowIndex++;

        const rowStr = Array.isArray(row) ? row.join(' ') : String(row);
        const emailsFound = rowStr.match(EMAIL_REGEX) || [];
        const phonesFound = job.config.extractPhone ? (rowStr.match(PHONE_REGEX) || []) : [];
        const urlsFound = job.config.extractWeb ? (rowStr.match(URL_REGEX) || []) : [];

        for (const rawEmail of emailsFound) {
          const em = cleanEmail(rawEmail);
          if (!em || seenEmails.has(em)) continue;
          seenEmails.add(em);

          const domain = em.split('@')[1];
          let mxStatus: 'valid' | 'invalid' | 'unknown' = 'unknown';
          let mxProvider: string | undefined;

          if (job.config.verifyMx && domain) {
            const check = await checkMxFast(domain);
            mxStatus = check.valid ? 'valid' : 'invalid';
            mxProvider = check.provider;
            if (check.valid) validMxCount++;
          } else {
            mxStatus = 'valid';
          }

          pendingLeads.push({
            id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            userId: job.userId,
            jobId: job.id,
            email: em,
            companyName: cleanCompanyName(domain?.split('.')[0] || 'Direct Company', domain),
            sourceUrl: `https://${domain}`,
            country: job.config.country || 'N/A',
            phone: phonesFound[0] || undefined,
            isValid: mxStatus === 'valid',
            mxStatus,
            mxProvider,
            contactType: 'email',
            extractedAt: new Date().toISOString()
          });

          if (pendingLeads.length >= 50) {
            flushBatch();
          }
        }

        if (rowIndex % 50 === 0 || rowIndex === totalRows) {
          const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
          const percent = Math.min(99, Math.round((rowIndex / totalRows) * 100));
          dbJobs.update(job.id, {
            progress: {
              percent,
              processed: rowIndex,
              total: totalRows,
              leadsFound: totalExtracted + pendingLeads.length,
              speedPerSec: Math.round((totalExtracted + pendingLeads.length) / elapsedSec),
              currentStage: `Processing Excel row ${rowIndex.toLocaleString()} of ${totalRows.toLocaleString()}...`
            }
          });
        }
      }
    } else {
      // Process Plain Text / CSV / TSV / Log files via streaming readLine
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let bytesRead = 0;
      let lineCount = 0;

      for await (const line of rl) {
        if (isAborted) {
          rl.close();
          fileStream.destroy();
          break;
        }

        lineCount++;
        bytesRead += Buffer.byteLength(line, 'utf-8') + 1;

        const emails = line.match(EMAIL_REGEX) || [];
        for (const rawEmail of emails) {
          const em = cleanEmail(rawEmail);
          if (!em || seenEmails.has(em)) continue;
          seenEmails.add(em);

          const domain = em.split('@')[1];
          let mxStatus: 'valid' | 'invalid' | 'unknown' = 'unknown';
          let mxProvider: string | undefined;

          if (job.config.verifyMx && domain) {
            const check = await checkMxFast(domain);
            mxStatus = check.valid ? 'valid' : 'invalid';
            mxProvider = check.provider;
            if (check.valid) validMxCount++;
          } else {
            mxStatus = 'valid';
          }

          pendingLeads.push({
            id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            userId: job.userId,
            jobId: job.id,
            email: em,
            companyName: cleanCompanyName(domain?.split('.')[0] || 'Discovered Lead', domain),
            sourceUrl: `https://${domain}`,
            country: job.config.country || 'N/A',
            isValid: mxStatus === 'valid',
            mxStatus,
            mxProvider,
            contactType: 'email',
            extractedAt: new Date().toISOString()
          });

          if (pendingLeads.length >= 50) {
            flushBatch();
          }
        }

        // Periodic progress update
        if (lineCount % 200 === 0) {
          const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
          const percent = Math.min(99, Math.round((bytesRead / totalBytes) * 100));
          dbJobs.update(job.id, {
            progress: {
              percent,
              processed: bytesRead,
              total: totalBytes,
              bytesProcessed: bytesRead,
              totalBytes,
              leadsFound: totalExtracted + pendingLeads.length,
              speedPerSec: Math.round((totalExtracted + pendingLeads.length) / elapsedSec),
              currentStage: `Extracted ${(totalExtracted + pendingLeads.length).toLocaleString()} leads from line ${lineCount.toLocaleString()} (${(bytesRead / (1024 * 1024)).toFixed(1)} MB processed)...`
            }
          });
        }
      }
    }

    // Final flush of remaining batch
    flushBatch();

    activeJobControllers.delete(job.id);
    const durationMs = Date.now() - startTime;

    if (isAborted) {
      dbJobs.update(job.id, {
        status: 'cancelled',
        completedAt: new Date().toISOString(),
        resultSummary: {
          totalLeads: totalExtracted,
          validMxCount,
          phoneCount,
          websiteCount,
          durationMs,
          fileSizeMb: Number((totalBytes / (1024 * 1024)).toFixed(2))
        }
      });
    } else {
      dbJobs.update(job.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        progress: {
          percent: 100,
          processed: totalBytes,
          total: totalBytes,
          leadsFound: totalExtracted,
          speedPerSec: Math.round(totalExtracted / Math.max(0.1, durationMs / 1000)),
          currentStage: `Completed: Saved ${totalExtracted.toLocaleString()} leads to your internal database.`
        },
        resultSummary: {
          totalLeads: totalExtracted,
          validMxCount,
          phoneCount,
          websiteCount,
          durationMs,
          fileSizeMb: Number((totalBytes / (1024 * 1024)).toFixed(2))
        }
      });
    }
  } catch (err: any) {
    activeJobControllers.delete(job.id);
    console.error(`[Job Error ${job.id}]:`, err);
    dbJobs.update(job.id, {
      status: 'failed',
      error: err.message || 'Error occurred during background extraction',
      completedAt: new Date().toISOString()
    });
  }
}

// Background Worker: Autonomous Multi-Engine Dork Search Crawler
async function runDorkCrawlJob(job: BackgroundJobRecord): Promise<void> {
  const query = String(job.config.query || '').trim();
  const country = String(job.config.country || 'N/A').trim();
  const targetCount = Math.min(5000, Math.max(10, parseInt(String(job.config.targetCount || '500'), 10)));
  const emailPrefix = String(job.config.emailPrefix || 'info@').trim();

  let isAborted = false;
  activeJobControllers.set(job.id, {
    abort: () => {
      isAborted = true;
    }
  });

  dbJobs.update(job.id, {
    status: 'running',
    startedAt: new Date().toISOString(),
    progress: {
      percent: 0,
      processed: 0,
      total: targetCount,
      leadsFound: 0,
      speedPerSec: 0,
      currentStage: `Initializing server-side search matrix for "${query}" (${country})...`
    }
  });

  const startTime = Date.now();
  const queryMatrix = buildExhaustiveQueryMatrix(country, query, emailPrefix);
  const seenEmails = new Set<string>();
  const pendingLeads: StoredLead[] = [];
  let totalExtracted = 0;
  let validMxCount = 0;

  const flushBatch = () => {
    if (pendingLeads.length > 0) {
      const saved = dbLeads.appendLeadsForUser(job.userId, [...pendingLeads]);
      totalExtracted += saved;
      pendingLeads.length = 0;
    }
  };

  try {
    for (let i = 0; i < queryMatrix.length; i++) {
      if (isAborted || totalExtracted >= targetCount) break;

      const currentQ = queryMatrix[i];
      const percent = Math.min(99, Math.round((totalExtracted / targetCount) * 100));

      dbJobs.update(job.id, {
        progress: {
          percent,
          processed: totalExtracted,
          total: targetCount,
          leadsFound: totalExtracted,
          speedPerSec: Math.round(totalExtracted / Math.max(0.1, (Date.now() - startTime) / 1000)),
          currentStage: `Spidering "${currentQ.slice(0, 45)}..." (${totalExtracted}/${targetCount} leads)`
        }
      });

      try {
        const outcome = await extractLeadsUnified(currentQ, country, 25, true);
        for (const item of outcome.results) {
          if (isAborted || totalExtracted + pendingLeads.length >= targetCount) break;

          const em = cleanEmail(item.email);
          if (!em || seenEmails.has(em)) continue;
          seenEmails.add(em);

          const domain = em.split('@')[1];
          let mxStatus: 'valid' | 'invalid' | 'unknown' = 'unknown';
          let mxProvider: string | undefined;

          if (job.config.verifyMx && domain) {
            const check = await checkMxFast(domain);
            mxStatus = check.valid ? 'valid' : 'invalid';
            mxProvider = check.provider;
            if (check.valid) validMxCount++;
          } else {
            mxStatus = 'valid';
          }

          pendingLeads.push({
            id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            userId: job.userId,
            jobId: job.id,
            email: em,
            companyName: cleanCompanyName(item.companyName, domain),
            sourceUrl: item.sourceUrl || `https://${domain}`,
            country: item.country || country,
            phone: item.phone,
            contactPerson: (item as any).contactPerson || item.fullName || item.firstName,
            role: item.role,
            isValid: mxStatus === 'valid',
            mxStatus,
            mxProvider,
            contactType: 'email',
            extractedAt: new Date().toISOString()
          });

          if (pendingLeads.length >= 25) {
            flushBatch();
          }
        }
      } catch (err: any) {
        console.warn(`[Crawl Round Warning]:`, err.message);
      }

      // Small pacing delay
      await new Promise(r => setTimeout(r, 800));
    }

    flushBatch();
    activeJobControllers.delete(job.id);

    const durationMs = Date.now() - startTime;
    dbJobs.update(job.id, {
      status: isAborted ? 'cancelled' : 'completed',
      completedAt: new Date().toISOString(),
      progress: {
        percent: 100,
        processed: totalExtracted,
        total: targetCount,
        leadsFound: totalExtracted,
        speedPerSec: Math.round(totalExtracted / Math.max(0.1, durationMs / 1000)),
        currentStage: `Completed: Saved ${totalExtracted.toLocaleString()} leads to internal database.`
      },
      resultSummary: {
        totalLeads: totalExtracted,
        validMxCount,
        phoneCount: 0,
        websiteCount: 0,
        durationMs
      }
    });
  } catch (err: any) {
    activeJobControllers.delete(job.id);
    dbJobs.update(job.id, {
      status: 'failed',
      error: err.message,
      completedAt: new Date().toISOString()
    });
  }
}

// Background Worker: Server-Side Country Sorter Engine
async function runCountrySortJob(job: BackgroundJobRecord): Promise<void> {
  let isAborted = false;
  activeJobControllers.set(job.id, { abort: () => { isAborted = true; } });

  const startTime = Date.now();
  try {
    let emailsToProcess: string[] = [];
    if (Array.isArray(job.config.emails) && job.config.emails.length > 0) {
      emailsToProcess = job.config.emails;
    } else {
      const existing = dbLeads.getAllForUser(job.userId);
      emailsToProcess = existing.map(l => l.email);
    }

    // Clean & unique
    const unique = Array.from(new Set(emailsToProcess.map(cleanEmail).filter(Boolean))) as string[];
    const total = unique.length;

    dbJobs.update(job.id, {
      status: 'running',
      startedAt: new Date().toISOString(),
      progress: {
        percent: 0,
        processed: 0,
        total,
        leadsFound: total,
        speedPerSec: 0,
        currentStage: `Server Country Sorter: Initializing ${total.toLocaleString()} emails...`
      }
    });

    if (total === 0) {
      activeJobControllers.delete(job.id);
      dbJobs.update(job.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        progress: {
          percent: 100,
          processed: 0,
          total: 0,
          leadsFound: 0,
          speedPerSec: 0,
          currentStage: 'No emails provided to sort'
        }
      });
      return;
    }

    // Optional business filter
    let filteredList = unique;
    if (job.config.cleanBusiness) {
      const summary = filterBusinessEmailsBulk(unique, DEFAULT_BUSINESS_FILTER_OPTIONS);
      filteredList = summary.businessEmails;
    }

    const domainToEmails = new Map<string, string[]>();
    for (const em of filteredList) {
      const d = em.split('@')[1]?.toLowerCase().trim();
      if (!d) continue;
      if (!domainToEmails.has(d)) domainToEmails.set(d, []);
      domainToEmails.get(d)!.push(em);
    }

    const allDomains = Array.from(domainToEmails.keys());
    const domainCountryMap = new Map<string, string>();
    const unresolved: string[] = [];

    // Step 1: Fast Offline Pre-classification
    for (const d of allDomains) {
      const c = classifyCountryOffline(d);
      if (c) {
        domainCountryMap.set(d, c);
      } else {
        unresolved.push(d);
      }
    }

    // Step 2: Deep Resolution for unresolved domains in chunks
    const BATCH_SIZE = 25;
    for (let i = 0; i < unresolved.length; i += BATCH_SIZE) {
      if (isAborted) break;
      const chunk = unresolved.slice(i, i + BATCH_SIZE);
      const percent = Math.min(95, Math.round(((i + domainCountryMap.size) / allDomains.length) * 100));

      dbJobs.update(job.id, {
        progress: {
          percent,
          processed: domainCountryMap.size,
          total: allDomains.length,
          leadsFound: filteredList.length,
          speedPerSec: Math.round(domainCountryMap.size / Math.max(0.1, (Date.now() - startTime) / 1000)),
          currentStage: `Deep country resolution: ${domainCountryMap.size}/${allDomains.length} domains classified...`
        }
      });

      try {
        const resolved = await resolveBatchDomainsDeeply(chunk);
        for (const item of resolved) {
          if (item.country) {
            domainCountryMap.set(item.domain.toLowerCase(), item.country);
          }
        }
      } catch (err: any) {
        console.warn('[Server Country Sorter Warning]:', err.message);
      }
    }

    // Prepare leads for upsert
    const leadsToSave: Partial<StoredLead>[] = [];
    for (const [domain, emails] of domainToEmails.entries()) {
      const country = domainCountryMap.get(domain) || 'Unknown';
      for (const em of emails) {
        leadsToSave.push({
          email: em,
          country,
          companyName: cleanCompanyName(domain.split('.')[0], domain),
          sourceUrl: `https://${domain}`
        });
      }
    }

    dbLeads.upsertLeadsForUser(job.userId, leadsToSave);
    activeJobControllers.delete(job.id);

    const durationMs = Date.now() - startTime;
    const countriesDiscovered = new Set(Array.from(domainCountryMap.values())).size;

    dbJobs.update(job.id, {
      status: isAborted ? 'cancelled' : 'completed',
      completedAt: new Date().toISOString(),
      progress: {
        percent: 100,
        processed: total,
        total,
        leadsFound: leadsToSave.length,
        speedPerSec: Math.round(total / Math.max(0.1, durationMs / 1000)),
        currentStage: `Completed: Sorted ${total.toLocaleString()} emails across ${countriesDiscovered} countries.`
      },
      resultSummary: {
        totalLeads: leadsToSave.length,
        validMxCount: 0,
        phoneCount: 0,
        websiteCount: allDomains.length,
        durationMs
      }
    });
  } catch (err: any) {
    activeJobControllers.delete(job.id);
    dbJobs.update(job.id, {
      status: 'failed',
      error: err.message,
      completedAt: new Date().toISOString()
    });
  }
}

// Background Worker: Server-Side Email Validator Engine
async function runValidationJob(job: BackgroundJobRecord): Promise<void> {
  let isAborted = false;
  activeJobControllers.set(job.id, { abort: () => { isAborted = true; } });

  const startTime = Date.now();
  try {
    let emailsToProcess: string[] = [];
    if (Array.isArray(job.config.emails) && job.config.emails.length > 0) {
      emailsToProcess = job.config.emails;
    } else {
      const existing = dbLeads.getAllForUser(job.userId);
      emailsToProcess = existing.map(l => l.email);
    }

    const unique = Array.from(new Set(emailsToProcess.map(cleanEmail).filter(Boolean))) as string[];
    const total = unique.length;

    dbJobs.update(job.id, {
      status: 'running',
      startedAt: new Date().toISOString(),
      progress: {
        percent: 0,
        processed: 0,
        total,
        leadsFound: 0,
        speedPerSec: 0,
        currentStage: `Server Validator: Initializing DNS MX validation for ${total.toLocaleString()} emails...`
      }
    });

    let validCount = 0;
    let invalidCount = 0;
    const updates: Partial<StoredLead>[] = [];

    for (let i = 0; i < unique.length; i++) {
      if (isAborted) break;

      const em = unique[i];
      const domain = em.split('@')[1]?.toLowerCase().trim();
      let isValid = false;
      let mxStatus: 'valid' | 'invalid' | 'unknown' = 'unknown';
      let mxProvider: string | undefined;

      if (domain) {
        const mxCheck = await checkMxFast(domain);
        isValid = mxCheck.valid;
        mxStatus = mxCheck.valid ? 'valid' : 'invalid';
        mxProvider = mxCheck.provider;
      }

      if (isValid) validCount++;
      else invalidCount++;

      updates.push({
        email: em,
        isValid,
        mxStatus,
        mxProvider
      });

      if (updates.length >= 50 || i === unique.length - 1) {
        dbLeads.upsertLeadsForUser(job.userId, updates);
        updates.length = 0;
      }

      if ((i + 1) % 25 === 0 || i === unique.length - 1) {
        const percent = Math.min(99, Math.round(((i + 1) / total) * 100));
        const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
        dbJobs.update(job.id, {
          progress: {
            percent,
            processed: i + 1,
            total,
            leadsFound: validCount,
            speedPerSec: Math.round((i + 1) / elapsedSec),
            currentStage: `Verified ${i + 1}/${total} (${validCount} valid MX, ${invalidCount} bounces)...`
          }
        });
      }
    }

    activeJobControllers.delete(job.id);
    const durationMs = Date.now() - startTime;

    dbJobs.update(job.id, {
      status: isAborted ? 'cancelled' : 'completed',
      completedAt: new Date().toISOString(),
      progress: {
        percent: 100,
        processed: total,
        total,
        leadsFound: validCount,
        speedPerSec: Math.round(total / Math.max(0.1, durationMs / 1000)),
        currentStage: `Completed: ${validCount.toLocaleString()} valid MX verified, ${invalidCount.toLocaleString()} invalid.`
      },
      resultSummary: {
        totalLeads: total,
        validMxCount: validCount,
        phoneCount: 0,
        websiteCount: 0,
        durationMs
      }
    });
  } catch (err: any) {
    activeJobControllers.delete(job.id);
    dbJobs.update(job.id, {
      status: 'failed',
      error: err.message,
      completedAt: new Date().toISOString()
    });
  }
}

// Background Worker: Server-Side MX Sorter Engine
async function runMxSortJob(job: BackgroundJobRecord): Promise<void> {
  let isAborted = false;
  activeJobControllers.set(job.id, { abort: () => { isAborted = true; } });

  const startTime = Date.now();
  try {
    let emailsToProcess: string[] = [];
    if (Array.isArray(job.config.emails) && job.config.emails.length > 0) {
      emailsToProcess = job.config.emails;
    } else {
      const existing = dbLeads.getAllForUser(job.userId);
      emailsToProcess = existing.map(l => l.email);
    }

    const unique = Array.from(new Set(emailsToProcess.map(cleanEmail).filter(Boolean))) as string[];
    const total = unique.length;

    dbJobs.update(job.id, {
      status: 'running',
      startedAt: new Date().toISOString(),
      progress: {
        percent: 0,
        processed: 0,
        total,
        leadsFound: 0,
        speedPerSec: 0,
        currentStage: `Server MX Sorter: Resolving mailservers for ${total.toLocaleString()} emails...`
      }
    });

    const updates: Partial<StoredLead>[] = [];
    let resolvedCount = 0;

    for (let i = 0; i < unique.length; i++) {
      if (isAborted) break;

      const em = unique[i];
      const domain = em.split('@')[1]?.toLowerCase().trim();
      let mxProvider = 'Unknown MX';
      let isValid = true;

      if (domain) {
        const mxCheck = await checkMxFast(domain);
        isValid = mxCheck.valid;
        mxProvider = mxCheck.provider || (mxCheck.valid ? 'Active MX' : 'No MX');
        if (mxCheck.valid) resolvedCount++;
      }

      updates.push({
        email: em,
        isValid,
        mxStatus: isValid ? 'valid' : 'invalid',
        mxProvider
      });

      if (updates.length >= 50 || i === unique.length - 1) {
        dbLeads.upsertLeadsForUser(job.userId, updates);
        updates.length = 0;
      }

      if ((i + 1) % 25 === 0 || i === unique.length - 1) {
        const percent = Math.min(99, Math.round(((i + 1) / total) * 100));
        const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
        dbJobs.update(job.id, {
          progress: {
            percent,
            processed: i + 1,
            total,
            leadsFound: resolvedCount,
            speedPerSec: Math.round((i + 1) / elapsedSec),
            currentStage: `MX resolved: ${i + 1}/${total} emails clustered...`
          }
        });
      }
    }

    activeJobControllers.delete(job.id);
    const durationMs = Date.now() - startTime;

    dbJobs.update(job.id, {
      status: isAborted ? 'cancelled' : 'completed',
      completedAt: new Date().toISOString(),
      progress: {
        percent: 100,
        processed: total,
        total,
        leadsFound: resolvedCount,
        speedPerSec: Math.round(total / Math.max(0.1, durationMs / 1000)),
        currentStage: `Completed: Clustered ${total.toLocaleString()} emails across mail host providers.`
      },
      resultSummary: {
        totalLeads: total,
        validMxCount: resolvedCount,
        phoneCount: 0,
        websiteCount: 0,
        durationMs
      }
    });
  } catch (err: any) {
    activeJobControllers.delete(job.id);
    dbJobs.update(job.id, {
      status: 'failed',
      error: err.message,
      completedAt: new Date().toISOString()
    });
  }
}

// Register Job Routes
export function registerJobRoutes(app: express.Express) {
  // 1. Upload File for Server-Side Extraction
  app.post('/api/server-jobs/upload', requireAuth, uploadMiddleware.single('file'), (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      return res.json({
        success: true,
        message: 'File successfully uploaded to server disk storage',
        file: {
          originalName: req.file.originalname,
          size: req.file.size,
          path: req.file.path,
          filename: req.file.filename
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'File upload failed' });
    }
  });

  // 2. Start a New Server-Side Background Job
  app.post('/api/server-jobs/start', requireAuth, (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { type, title, config } = req.body;

      if (!type || !title) {
        return res.status(400).json({ error: 'Job type and title are required' });
      }

      // Check user concurrent job limit
      const userActiveJobs = dbJobs.getByUser(user.id).filter(j => j.status === 'running' || j.status === 'pending');
      if (userActiveJobs.length >= user.maxConcurrentJobs) {
        return res.status(429).json({
          error: `Concurrent job limit reached (${user.maxConcurrentJobs} max for ${user.licenseTier.toUpperCase()} license). Wait for existing jobs to complete or upgrade your license.`
        });
      }

      const job = dbJobs.create(
        user.id,
        user.email,
        type,
        title,
        config || {}
      );

      // Launch background worker without awaiting it (so HTTP returns immediately!)
      setImmediate(() => {
        if (type === 'file_extraction') {
          runFileExtractionJob(job).catch(console.error);
        } else if (type === 'dork_crawl') {
          runDorkCrawlJob(job).catch(console.error);
        } else if (type === 'country_sort') {
          runCountrySortJob(job).catch(console.error);
        } else if (type === 'email_validation') {
          runValidationJob(job).catch(console.error);
        } else if (type === 'mx_sort') {
          runMxSortJob(job).catch(console.error);
        }
      });

      return res.json({
        success: true,
        message: 'Background job started on server engine',
        job
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to start background job' });
    }
  });

  // 3. List User Jobs
  app.get('/api/server-jobs', requireAuth, (req: AuthRequest, res) => {
    const jobs = dbJobs.getByUser(req.user!.id);
    return res.json({ jobs });
  });

  // 4. Get Single Job Status & Progress
  app.get('/api/server-jobs/:id', requireAuth, (req: AuthRequest, res) => {
    const job = dbJobs.get(String(req.params.id));
    if (!job || (job.userId !== req.user!.id && req.user!.role !== 'admin')) {
      return res.status(404).json({ error: 'Job not found' });
    }
    return res.json({ job });
  });

  // 5. Cancel Running Job
  app.post('/api/server-jobs/:id/cancel', requireAuth, (req: AuthRequest, res) => {
    const job = dbJobs.get(String(req.params.id));
    if (!job || (job.userId !== req.user!.id && req.user!.role !== 'admin')) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const controller = activeJobControllers.get(job.id);
    if (controller) {
      controller.abort();
    }

    dbJobs.update(job.id, {
      status: 'cancelled',
      completedAt: new Date().toISOString()
    });

    return res.json({ success: true, message: 'Job cancellation requested' });
  });

  // 6. Delete Job
  app.delete('/api/server-jobs/:id', requireAuth, (req: AuthRequest, res) => {
    try {
      const deleteLeads = req.query.deleteLeads === 'true';
      const job = dbJobs.get(String(req.params.id));
      if (!job || (job.userId !== req.user!.id && req.user!.role !== 'admin')) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (deleteLeads) {
        dbLeads.deleteForJob(req.user!.id, job.id);
      }

      dbJobs.delete(job.id, req.user!.role === 'admin' ? undefined : req.user!.id);
      return res.json({ success: true, message: 'Job deleted' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 7. Query User Leads (Paginated from Internal DB)
  app.get('/api/server-leads', requireAuth, (req: AuthRequest, res) => {
    const page = parseInt(String(req.query.page || '1'), 10);
    const pageSize = parseInt(String(req.query.pageSize || '50'), 10);
    const jobId = req.query.jobId ? String(req.query.jobId) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const country = req.query.country ? String(req.query.country) : undefined;
    const validOnly = req.query.validOnly === 'true';

    const result = dbLeads.getPaginated(req.user!.id, {
      page,
      pageSize,
      jobId,
      search,
      country,
      validOnly
    });

    return res.json(result);
  });

  // 8. Server-Side Export Leads (CSV, XLSX, TXT)
  app.get('/api/server-leads/export', requireAuth, (req: AuthRequest, res) => {
    const format = String(req.query.format || 'csv').toLowerCase();
    const jobId = req.query.jobId ? String(req.query.jobId) : undefined;
    const validOnly = req.query.validOnly === 'true';

    let all = dbLeads.getAllForUser(req.user!.id);
    if (jobId) {
      all = all.filter(l => l.jobId === jobId);
    }
    if (validOnly) {
      all = all.filter(l => l.isValid);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `Smile_Leads_${timestamp}.${format}`;

    if (format === 'txt') {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const body = all.map(l => l.email).join('\n');
      return res.send(body);
    } else if (format === 'xlsx') {
      const data = all.map(l => ({
        Email: l.email,
        Company: l.companyName,
        Country: l.country,
        Phone: l.phone || '',
        Website: l.sourceUrl,
        'MX Status': l.mxStatus,
        'MX Provider': l.mxProvider || '',
        'Extracted At': l.extractedAt
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buf);
    } else {
      // CSV format
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const headers = ['Email', 'Company', 'Country', 'Phone', 'Website', 'MX Status', 'MX Provider', 'Extracted At'];
      const rows = all.map(l => [
        `"${l.email.replace(/"/g, '""')}"`,
        `"${(l.companyName || '').replace(/"/g, '""')}"`,
        `"${(l.country || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.sourceUrl || '').replace(/"/g, '""')}"`,
        `"${l.mxStatus}"`,
        `"${(l.mxProvider || '').replace(/"/g, '""')}"`,
        `"${l.extractedAt}"`
      ].join(','));
      return res.send([headers.join(','), ...rows].join('\n'));
    }
  });

  // 9. Clear All Leads For User
  app.delete('/api/server-leads', requireAuth, (req: AuthRequest, res) => {
    dbLeads.clearAllForUser(req.user!.id);
    return res.json({ success: true, message: 'All leads cleared from your database' });
  });

  // 10. Direct Cloud Database Batch Upload (From Any Tab in System)
  app.post('/api/server-leads/batch-upload', requireAuth, (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { leads, source, jobId } = req.body;

      if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: 'Array of leads is required' });
      }

      // Check max lead limits for user's tier
      const currentStored = user.totalLeadsStored || 0;
      if (currentStored >= user.maxLeads) {
        return res.status(429).json({
          error: `Lead storage quota reached (${currentStored.toLocaleString()}/${user.maxLeads.toLocaleString()} leads for ${user.licenseTier.toUpperCase()} license). Please upgrade license or delete old records.`
        });
      }

      const normalizedLeads: Partial<StoredLead>[] = leads.map((item: any) => {
        let em = typeof item === 'string' ? item : item.email;
        em = cleanEmail(em);
        return {
          email: em,
          companyName: item.companyName || cleanCompanyName(em?.split('@')[1]?.split('.')[0], em?.split('@')[1]),
          country: item.country || 'N/A',
          phone: item.phone,
          sourceUrl: item.sourceUrl || (em?.split('@')[1] ? `https://${em.split('@')[1]}` : undefined),
          isValid: item.isValid !== undefined ? Boolean(item.isValid) : true,
          mxStatus: item.mxStatus || 'unknown',
          mxProvider: item.mxProvider,
          role: item.role || item.title,
          contactPerson: item.contactPerson || item.fullName || (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : undefined),
          contactType: item.contactType || 'email',
          jobId: jobId || (source ? `tab_${source}` : 'direct_upload')
        };
      }).filter(l => Boolean(l.email && l.email.includes('@')));

      const result = dbLeads.upsertLeadsForUser(user.id, normalizedLeads);

      return res.json({
        success: true,
        message: `Successfully synchronized ${result.added.toLocaleString()} new leads and updated ${result.updated.toLocaleString()} existing leads in your Cloud Database!`,
        addedCount: result.added,
        updatedCount: result.updated,
        totalStored: result.total
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to upload leads to database' });
    }
  });

  // 11. Retrieve All Leads / Emails for Instant Working in Tabs
  app.get('/api/server-leads/all', requireAuth, (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const country = req.query.country ? String(req.query.country).trim() : undefined;
      const validOnly = req.query.validOnly === 'true';
      const jobId = req.query.jobId ? String(req.query.jobId).trim() : undefined;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;

      let all = dbLeads.getAllForUser(user.id);

      if (jobId) {
        all = all.filter(l => l.jobId === jobId);
      }
      if (country && country !== 'all' && country !== 'All') {
        const cLower = country.toLowerCase();
        all = all.filter(l => l.country && l.country.toLowerCase().includes(cLower));
      }
      if (validOnly) {
        all = all.filter(l => l.isValid);
      }
      if (limit && limit > 0) {
        all = all.slice(0, limit);
      }

      return res.json({
        success: true,
        total: all.length,
        leads: all
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to query database leads' });
    }
  });

  // 12. Batch Update Existing Leads in DB (e.g. after Sorting or Validating in Tab)
  app.post('/api/server-leads/batch-update', requireAuth, (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: 'Array of updates required' });
      }

      const result = dbLeads.upsertLeadsForUser(user.id, updates);
      return res.json({
        success: true,
        message: `Updated ${result.updated} leads in Cloud Database`,
        updatedCount: result.updated,
        totalStored: result.total
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
