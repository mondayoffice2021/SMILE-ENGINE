import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import type { DiscoveredEmailRecord, DomainCrawlStatusRecord, CompanyDiscoverySessionRecord } from '../server/db';
import { safeFetchJson } from './safeFetch';

export interface DomainDiscoveryResult {
  domain: string;
  website: string;
  companyName: string;
  status: 'success' | 'no_emails' | 'unavailable';
  statusCode?: number;
  pagesScanned: number;
  emailsCount: number;
  error?: string;
  records: DiscoveredEmailRecord[];
  crawledPages: Array<{ url: string; title?: string; emailsFound: number }>;
}

export interface DiscoveryCrawlerConfig {
  concurrency: number;
  maxPagesPerDomain: number;
  timeoutMs: number;
  politeDelayMs: number;
  searchGoogleIfNoEmail: boolean;
  strictCorporateFilter: boolean;
}

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryCrawlerConfig = {
  concurrency: 3,
  maxPagesPerDomain: 5,
  timeoutMs: 8000,
  politeDelayMs: 250,
  searchGoogleIfNoEmail: true,
  strictCorporateFilter: true
};

export const EMAIL_CATEGORIES_LIST = [
  'General Information',
  'Sales',
  'Export',
  'Procurement',
  'Purchasing',
  'Management',
  'Administration',
  'Commercial',
  'Customer Support',
  'Other Business Contacts'
] as const;

export type EmailCategoryType = (typeof EMAIL_CATEGORIES_LIST)[number];

/**
 * Common free / public webmail providers that should NEVER be mistaken as company websites.
 */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.es', 'yahoo.it', 'yahoo.ca',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.es', 'hotmail.it',
  'outlook.com', 'outlook.fr', 'outlook.de', 'outlook.es', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'aim.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'mail.com', 'gmx.com', 'gmx.de', 'gmx.net', 'web.de', 't-online.de', 'freenet.de',
  'yandex.com', 'yandex.ru', 'mail.ru', 'rambler.ru', 'inbox.ru', 'list.ru', 'bk.ru',
  'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'neuf.fr',
  'libero.it', 'virgilio.it', 'tiscali.it', 'alice.it', 'fastwebnet.it',
  'terra.com.br', 'uol.com.br', 'bol.com.br', 'ig.com.br',
  'qq.com', '163.com', '126.com', 'sina.com', 'sohu.com', 'aliyun.com',
  'rediffmail.com', 'naver.com', 'daum.net', 'hanmail.net',
  'comcast.net', 'sbcglobal.net', 'att.net', 'verizon.net', 'cox.net', 'charter.net', 'earthlink.net',
  'bellsouth.net', 'shaw.ca', 'sympatico.ca', 'rogers.com', 'telus.net', 'btinternet.com', 'virginmedia.com',
  'sky.com', 'talktalk.net'
]);

/**
 * File extensions that should NOT be mistaken as web domain names when parsing words.
 */
export const IGNORE_FILE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico', 'psd',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'tsv', 'txt', 'rtf', 'odt',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'tgz',
  'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'html', 'htm', 'xhtml', 'php', 'asp', 'aspx', 'jsp',
  'json', 'xml', 'yaml', 'yml', 'sql', 'db', 'sqlite',
  'mp3', 'mp4', 'wav', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'ogg',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'exe', 'dmg', 'apk', 'bin', 'iso', 'map', 'lock'
]);

/**
 * Common social media networks that should be excluded when user wants company websites.
 */
export const SOCIAL_MEDIA_DOMAINS = new Set([
  'facebook.com', 'fb.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com',
  'youtube.com', 'tiktok.com', 'pinterest.com', 'reddit.com', 'github.com', 'gitlab.com',
  'medium.com', 'whatsapp.com', 'telegram.org', 't.me', 'discord.com', 'discord.gg',
  'threads.net', 'tumblr.com', 'flickr.com', 'snapchat.com', 'wikipedia.org'
]);

export interface WebsiteSeparatorOptions {
  cleanToRootDomain?: boolean; // Return clean domain e.g. "acme.com" vs full URL "https://www.acme.com" (default: true)
  excludeFreeEmailDomains?: boolean; // Exclude gmail.com, yahoo.com, etc. (default: true)
  excludeSocialMedia?: boolean; // Exclude facebook, linkedin, twitter, etc. (default: true)
  extractFromCorporateEmail?: boolean; // Extract company domain from corporate emails if no website in field (default: false)
  removeDuplicates?: boolean; // Deduplicate output list (default: true)
  selectedColumn?: string; // If parsing tabular data, optionally isolate this column
}

export interface ExtractedWebsiteItem {
  cleanDomain: string;          // e.g. "acme.com"
  fullWebsite: string;          // e.g. "https://www.acme.com"
  sourceText: string;           // the original raw field, sentence, or word where it was discovered
  fieldName?: string;           // if from a multi-field table (e.g. "Website", "Homepage", "Column 3")
  rowIndex?: number;            // row number in file/text
  isFromEmailDomain?: boolean;  // whether it was derived from a corporate email address
}

export interface WebsiteExtractionResult {
  totalItemsFound: number;
  uniqueWebsites: string[];             // array of distinct websites (clean domains or URLs depending on cleanToRootDomain)
  uniqueDomains: string[];              // strictly deduplicated clean domains (e.g. "acme.com")
  items: ExtractedWebsiteItem[];        // detailed record for each discovered item
  detectedColumns?: string[];           // columns detected if CSV/Excel/Tabular data
  detectedWebsiteColumn?: string;       // column name identified as containing websites
  filteredOutCount: number;             // count of non-website fields/words skipped (names, phones, text, junk)
  publicEmailDomainsSkipped: string[];  // public email domains safely ignored (e.g. gmail.com)
  rawTotalFields: number;               // total fields/tokens/lines analyzed
}

/**
 * Normalizes an input string, URL, or word into a clean company domain name
 */
export function cleanDomainName(raw: string): string {
  if (!raw) return '';
  let str = raw.trim().toLowerCase();
  // Strip mailto:, http://, https://, www.
  str = str.replace(/^mailto:/i, '');
  str = str.replace(/^(?:https?:\/\/)?(?:www\.)?/, '');
  str = str.split('/')[0];
  str = str.split('?')[0];
  str = str.split('#')[0];
  str = str.split(':')[0]; // Strip port
  // Strip leading and trailing punctuation (quotes, brackets, periods)
  str = str.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
  str = str.replace(/[^a-z0-9.-]/g, '');
  return str;
}

/**
 * Tests if a candidate string looks like a valid website / domain
 */
export function isValidWebsiteCandidate(candidate: string, options?: WebsiteSeparatorOptions): boolean {
  if (!candidate || candidate.length < 4 || candidate.length > 255) return false;
  const clean = cleanDomainName(candidate);
  if (!clean || !clean.includes('.')) return false;

  const parts = clean.split('.');
  if (parts.length < 2) return false;

  const tld = parts[parts.length - 1];
  // TLD must be alpha and 2 to 24 characters
  if (!/^[a-z]{2,24}$/i.test(tld)) return false;

  // Must not be an ignored file extension
  if (IGNORE_FILE_EXTENSIONS.has(tld)) return false;

  // Must not be a numeric IP address
  if (parts.every(p => /^\d+$/.test(p))) return false;

  // Check public email providers
  const excludeFreeEmails = options?.excludeFreeEmailDomains ?? true;
  if (excludeFreeEmails && PUBLIC_EMAIL_DOMAINS.has(clean)) {
    return false;
  }

  // Check social media
  const excludeSocial = options?.excludeSocialMedia ?? true;
  if (excludeSocial && SOCIAL_MEDIA_DOMAINS.has(clean)) {
    return false;
  }

  return true;
}

/**
 * Comprehensive Website & Domain Separator:
 * Isolates and extracts only websites/domains from mixed text, unstructured paragraphs,
 * words, or multi-field delimited rows (CSV, TSV, pipes, tabs).
 */
export function extractWebsitesFromMixedText(
  text: string,
  options?: WebsiteSeparatorOptions
): WebsiteExtractionResult {
  if (!text || !text.trim()) {
    return {
      totalItemsFound: 0,
      uniqueWebsites: [],
      uniqueDomains: [],
      items: [],
      filteredOutCount: 0,
      publicEmailDomainsSkipped: [],
      rawTotalFields: 0
    };
  }

  const cleanToRoot = options?.cleanToRootDomain ?? true;
  const excludeFreeEmails = options?.excludeFreeEmailDomains ?? true;
  const excludeSocial = options?.excludeSocialMedia ?? true;
  const extractEmailDomain = options?.extractFromCorporateEmail ?? false;

  const items: ExtractedWebsiteItem[] = [];
  const publicEmailDomainsSkipped = new Set<string>();
  let filteredOutCount = 0;
  let rawTotalFields = 0;

  // Split into raw lines
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // Check if text is tabular (CSV, TSV, or delimiter-separated)
  let detectedDelimiter: string | null = null;
  const sampleLines = lines.slice(0, 5);
  for (const delim of ['\t', ',', ';', '|']) {
    const counts = sampleLines.map(l => l.split(delim).length);
    if (counts.length > 0 && counts[0] > 1 && counts.every(c => c === counts[0])) {
      detectedDelimiter = delim;
      break;
    }
  }

  let detectedColumns: string[] | undefined;
  let detectedWebsiteColIndex = -1;
  let detectedWebsiteColumn: string | undefined;

  // If tabular delimiter detected, inspect header row
  if (detectedDelimiter && lines.length > 1) {
    const headerFields = lines[0].split(detectedDelimiter).map(h => h.replace(/^["']|["']$/g, '').trim());
    const websiteKeywords = /^(website|web|url|site|domain|homepage|company_url|web_site|link|page)$/i;

    const matchedIndex = headerFields.findIndex(h => websiteKeywords.test(h));
    if (matchedIndex >= 0) {
      detectedColumns = headerFields;
      detectedWebsiteColIndex = matchedIndex;
      detectedWebsiteColumn = headerFields[matchedIndex];
    }
  }

  // Regex to discover URLs and domains within any text or word
  // 1. Full URLs: https?://...
  const urlRegex = /https?:\/\/[^\s"'<>,;|\(\)\[\]\{\}]+/gi;
  // 2. www sites: www.domain.tld/...
  const wwwRegex = /\bwww\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+(?:\/[^\s"'<>,;|\(\)\[\]\{\}]*)?/gi;
  // 3. Domain pattern: words with valid dot and TLD
  const domainPatternRegex = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,24}(?:\/[^\s"'<>,;|\(\)\[\]\{\}]*)?/gi;

  lines.forEach((line, lineIndex) => {
    // Skip comment lines
    if (line.startsWith('#') || line.startsWith('//')) {
      return;
    }

    // Tabular row processing if delimiter found
    if (detectedDelimiter) {
      const cells = line.split(detectedDelimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
      rawTotalFields += cells.length;

      // If this is row 0 and it matches our header, skip processing as data
      if (lineIndex === 0 && detectedWebsiteColIndex >= 0) {
        return;
      }

      let websiteFoundInRow = false;

      // Check specific website column first if detected
      if (detectedWebsiteColIndex >= 0 && cells[detectedWebsiteColIndex]) {
        const val = cells[detectedWebsiteColIndex];
        const clean = cleanDomainName(val);
        if (isValidWebsiteCandidate(val, options)) {
          items.push({
            cleanDomain: clean,
            fullWebsite: val.startsWith('http') ? val : `https://${clean}`,
            sourceText: val,
            fieldName: detectedWebsiteColumn,
            rowIndex: lineIndex + 1
          });
          websiteFoundInRow = true;
        }
      }

      // Scan all other cells in the row for any other embedded websites
      cells.forEach((cell, cellIdx) => {
        if (cellIdx === detectedWebsiteColIndex && websiteFoundInRow) return;
        if (!cell) return;

        // If cell is an email
        if (cell.includes('@') && !cell.startsWith('http')) {
          const emailDomain = cleanDomainName(cell.split('@')[1] || '');
          if (PUBLIC_EMAIL_DOMAINS.has(emailDomain)) {
            publicEmailDomainsSkipped.add(emailDomain);
            filteredOutCount++;
            return;
          }
          if (extractEmailDomain && !websiteFoundInRow && isValidWebsiteCandidate(emailDomain, options)) {
            items.push({
              cleanDomain: emailDomain,
              fullWebsite: `https://${emailDomain}`,
              sourceText: cell,
              fieldName: detectedColumns ? detectedColumns[cellIdx] : `Column ${cellIdx + 1}`,
              rowIndex: lineIndex + 1,
              isFromEmailDomain: true
            });
            websiteFoundInRow = true;
            return;
          }
          filteredOutCount++;
          return;
        }

        // Check if cell is a URL or domain
        const clean = cleanDomainName(cell);
        if (isValidWebsiteCandidate(cell, options)) {
          items.push({
            cleanDomain: clean,
            fullWebsite: cell.startsWith('http') ? cell : `https://${clean}`,
            sourceText: cell,
            fieldName: detectedColumns ? detectedColumns[cellIdx] : `Column ${cellIdx + 1}`,
            rowIndex: lineIndex + 1
          });
          websiteFoundInRow = true;
        } else {
          filteredOutCount++;
        }
      });

      return;
    }

    // Free-form text / mixed word processing
    const words = line.split(/\s+/).filter(Boolean);
    rawTotalFields += words.length;

    const seenCleanInLine = new Set<string>();

    // 1. Scan for full URLs: https?://... and www....
    const urlMatches = line.match(urlRegex) || [];
    const wwwMatches = line.match(wwwRegex) || [];
    const allMatches = Array.from(new Set([...urlMatches, ...wwwMatches]));

    for (const match of allMatches) {
      const clean = cleanDomainName(match);
      if (clean && isValidWebsiteCandidate(clean, options) && !seenCleanInLine.has(clean)) {
        seenCleanInLine.add(clean);
        items.push({
          cleanDomain: clean,
          fullWebsite: match.startsWith('http') ? match : `https://${match}`,
          sourceText: match,
          rowIndex: lineIndex + 1
        });
      }
    }

    // 2. Scan all tokens / words for naked domains
    const domainMatches = line.match(domainPatternRegex) || [];
    for (const rawMatch of domainMatches) {
      // Strip trailing punctuation
      const cleanedRaw = rawMatch.replace(/[.,;:!?)\]}"']+$/, '');
      const clean = cleanDomainName(cleanedRaw);
      if (!clean || seenCleanInLine.has(clean)) continue;

      // Check if match is immediately followed by @ (meaning it's an email username like john.doe@...)
      const isEmailUser = new RegExp(cleanedRaw.replace(/\./g, '\\.') + '@', 'i').test(line);
      if (isEmailUser) {
        filteredOutCount++;
        continue;
      }

      // Check if preceded by @ in original line (meaning it was an email domain)
      const isEmailDomain = new RegExp('@' + cleanedRaw.replace(/\./g, '\\.'), 'i').test(line);
      if (isEmailDomain) {
        if (PUBLIC_EMAIL_DOMAINS.has(clean)) {
          publicEmailDomainsSkipped.add(clean);
          filteredOutCount++;
          continue;
        }
        if (extractEmailDomain && isValidWebsiteCandidate(clean, options)) {
          seenCleanInLine.add(clean);
          items.push({
            cleanDomain: clean,
            fullWebsite: `https://${clean}`,
            sourceText: cleanedRaw,
            rowIndex: lineIndex + 1,
            isFromEmailDomain: true
          });
        } else {
          filteredOutCount++;
        }
        continue;
      }

      if (isValidWebsiteCandidate(clean, options)) {
        seenCleanInLine.add(clean);
        items.push({
          cleanDomain: clean,
          fullWebsite: `https://${clean}`,
          sourceText: cleanedRaw,
          rowIndex: lineIndex + 1
        });
      } else {
        filteredOutCount++;
      }
    }

    if (seenCleanInLine.size === 0) {
      filteredOutCount += words.length;
    }
  });

  // Deduplicate
  const seenDomains = new Set<string>();
  const uniqueItems: ExtractedWebsiteItem[] = [];

  for (const item of items) {
    const key = cleanToRoot ? item.cleanDomain.toLowerCase() : item.fullWebsite.toLowerCase();
    if (!seenDomains.has(key)) {
      seenDomains.add(key);
      uniqueItems.push(item);
    }
  }

  const finalItems = options?.removeDuplicates === false ? items : uniqueItems;
  const uniqueDomains = Array.from(new Set(finalItems.map(i => i.cleanDomain))).filter(Boolean);
  const uniqueWebsites = cleanToRoot
    ? uniqueDomains
    : Array.from(new Set(finalItems.map(i => i.fullWebsite))).filter(Boolean);

  return {
    totalItemsFound: items.length,
    uniqueWebsites,
    uniqueDomains,
    items: finalItems,
    detectedColumns,
    detectedWebsiteColumn,
    filteredOutCount,
    publicEmailDomainsSkipped: Array.from(publicEmailDomainsSkipped),
    rawTotalFields
  };
}

/**
 * Extracts websites and domains from uploaded files (TXT, CSV, XLSX, XLS)
 */
export async function extractWebsitesFromFile(
  file: File,
  options?: WebsiteSeparatorOptions
): Promise<WebsiteExtractionResult & { filename: string }> {
  const filename = file.name;
  const ext = filename.split('.').pop()?.toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const collectedRows: string[] = [];

    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
      rows.forEach((row: any) => {
        if (Array.isArray(row)) {
          const cells = row.map(c => (c !== undefined && c !== null ? String(c).trim() : ''));
          if (cells.some(c => c.length > 0)) {
            collectedRows.push(cells.join('\t'));
          }
        }
      });
    });

    const parsed = extractWebsitesFromMixedText(collectedRows.join('\n'), options);
    return { ...parsed, filename };
  } else {
    // TXT, CSV, TSV
    const text = await file.text();
    const parsed = extractWebsitesFromMixedText(text, options);
    return { ...parsed, filename };
  }
}

/**
 * Default domain parsing entry point (uses smart website separator)
 */
export function parseDomainsFromText(text: string): { totalRaw: number; uniqueDomains: string[] } {
  const res = extractWebsitesFromMixedText(text, { cleanToRootDomain: true, removeDuplicates: true });
  return {
    totalRaw: res.rawTotalFields || res.uniqueDomains.length,
    uniqueDomains: res.uniqueDomains
  };
}

/**
 * Default file domain parsing entry point (uses smart website separator)
 */
export async function parseDomainsFromFile(file: File): Promise<{ totalRaw: number; uniqueDomains: string[]; filename: string }> {
  const res = await extractWebsitesFromFile(file, { cleanToRootDomain: true, removeDuplicates: true });
  return {
    totalRaw: res.rawTotalFields || res.uniqueDomains.length,
    uniqueDomains: res.uniqueDomains,
    filename: res.filename
  };
}

/**
 * API call to crawl single domain
 */
export async function crawlDomainApi(
  domain: string,
  config: DiscoveryCrawlerConfig,
  signal?: AbortSignal
): Promise<DomainDiscoveryResult> {
  const res = await safeFetchJson<any>('/api/company-discovery/crawl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      domain,
      maxPages: config.maxPagesPerDomain,
      timeoutMs: config.timeoutMs,
      politeDelayMs: config.politeDelayMs,
      searchGoogleIfNoEmail: config.searchGoogleIfNoEmail,
      strictCorporateFilter: config.strictCorporateFilter
    })
  });

  if (!res.ok || !res.data?.result) {
    throw new Error(res.error || 'Failed to crawl domain');
  }

  return res.data.result;
}

/**
 * API call to search Google for company emails when website yielded no email
 */
export async function searchGoogleForDomainApi(
  domain: string,
  companyName?: string,
  signal?: AbortSignal
): Promise<{ domain: string; companyName: string; records: DiscoveredEmailRecord[]; emailsFound: number }> {
  const res = await safeFetchJson<any>('/api/company-discovery/google-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ domain, companyName })
  });

  if (!res.ok || !res.data) {
    throw new Error(res.error || 'Google search fallback failed');
  }

  return res.data;
}

/**
 * API call to save discovery session to server database
 */
export async function saveDiscoverySessionApi(session: Partial<CompanyDiscoverySessionRecord> & { title: string }): Promise<CompanyDiscoverySessionRecord> {
  const res = await safeFetchJson<any>('/api/company-discovery/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session)
  });

  if (!res.ok || !res.data?.session) {
    throw new Error(res.error || 'Failed to save discovery project');
  }

  return res.data.session;
}

/**
 * API call to list saved discovery sessions
 */
export async function listDiscoverySessionsApi(): Promise<any[]> {
  const res = await safeFetchJson<any>('/api/company-discovery/sessions');
  return res.ok && Array.isArray(res.data?.sessions) ? res.data.sessions : [];
}

/**
 * API call to get a saved discovery session
 */
export async function getDiscoverySessionApi(id: string): Promise<CompanyDiscoverySessionRecord | null> {
  const res = await safeFetchJson<any>(`/api/company-discovery/sessions/${encodeURIComponent(id)}`);
  return res.ok && res.data?.session ? res.data.session : null;
}

/**
 * API call to delete a saved discovery session
 */
export async function deleteDiscoverySessionApi(id: string): Promise<boolean> {
  const res = await safeFetchJson<any>(`/api/company-discovery/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  return Boolean(res.ok && res.data?.success);
}

/**
 * Export results to Microsoft Excel (XLSX)
 */
export function exportDiscoveryToExcel(
  records: DiscoveredEmailRecord[],
  domains: DomainCrawlStatusRecord[],
  sessionName: string = 'Company_Email_Discovery'
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Discovered Corporate Emails
  const emailRows = records.map((r, i) => ({
    '#': i + 1,
    'Company Domain': r.companyDomain,
    'Company Website': r.companyWebsite,
    'Company Name': r.companyName,
    'Discovered Email': r.email,
    'Email Category': r.category,
    'Exact Source Page URL': r.sourcePageUrl,
    'Found In Context': r.foundIn,
    'Discovered At': r.discoveredAt,
    'Discovery Status': r.discoveryStatus || 'Publicly Listed',
    'Page Title': r.pageTitle || '',
    'Telephone / Phone': r.phone || ''
  }));
  const wsEmails = XLSX.utils.json_to_sheet(emailRows);
  XLSX.utils.book_append_sheet(wb, wsEmails, 'Discovered Emails');

  // Sheet 2: Companies & Websites Crawled Overview
  const domainRows = domains.map((d, i) => ({
    '#': i + 1,
    'Company Domain': d.domain,
    'Company Website': d.website,
    'Company Name': d.companyName,
    'Website Status': d.status === 'success' ? 'Accessed & Discovered' : d.status === 'no_emails' ? 'Accessed (No Public Emails)' : 'Unavailable / Failed',
    'HTTP Code': d.statusCode || 0,
    'Pages Scanned': d.pagesScanned,
    'Emails Discovered': d.emailsCount,
    'Error / Diagnostics': d.error || 'OK'
  }));
  const wsDomains = XLSX.utils.json_to_sheet(domainRows);
  XLSX.utils.book_append_sheet(wb, wsDomains, 'Companies Overview');

  // Sheet 3: Category Breakdown
  const categoryCounts = new Map<string, number>();
  records.forEach(r => {
    categoryCounts.set(r.category, (categoryCounts.get(r.category) || 0) + 1);
  });
  const summaryRows = Array.from(categoryCounts.entries()).map(([cat, count]) => ({
    'Corporate Category': cat,
    'Discovered Emails Count': count,
    'Percentage': records.length ? `${Math.round((count / records.length) * 100)}%` : '0%'
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Category Breakdown');

  const cleanName = sessionName.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `${cleanName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export results to CSV
 */
export function exportDiscoveryToCsv(
  records: DiscoveredEmailRecord[],
  filename: string = 'discovered_company_emails.csv'
): void {
  const headers = [
    'Domain',
    'Company Website',
    'Company Name',
    'Email Address',
    'Category',
    'Exact Source Page URL',
    'Found In Context',
    'Discovered At',
    'Discovery Status',
    'Page Title',
    'Phone'
  ];

  const rows = records.map(r => [
    `"${r.companyDomain.replace(/"/g, '""')}"`,
    `"${r.companyWebsite.replace(/"/g, '""')}"`,
    `"${r.companyName.replace(/"/g, '""')}"`,
    `"${r.email.replace(/"/g, '""')}"`,
    `"${r.category.replace(/"/g, '""')}"`,
    `"${r.sourcePageUrl.replace(/"/g, '""')}"`,
    `"${r.foundIn.replace(/"/g, '""')}"`,
    `"${r.discoveredAt.replace(/"/g, '""')}"`,
    `"${(r.discoveryStatus || 'Publicly Listed').replace(/"/g, '""')}"`,
    `"${(r.pageTitle || '').replace(/"/g, '""')}"`,
    `"${(r.phone || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export clean email list to TXT
 */
export function exportDiscoveryToTxt(
  records: DiscoveredEmailRecord[],
  filename: string = 'company_emails.txt',
  categoryFilter?: string
): void {
  const filtered = categoryFilter && categoryFilter !== 'all'
    ? records.filter(r => r.category.toLowerCase() === categoryFilter.toLowerCase())
    : records;

  const emails = Array.from(new Set(filtered.map(r => r.email.toLowerCase())));
  const content = emails.join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export ONLY clean emails to a minimal TXT file (one email per line, no extra columns)
 */
export function exportCleanEmailsTxt(
  records: DiscoveredEmailRecord[],
  filename: string = 'clean_company_emails.txt',
  selectedIds?: Set<string>
): void {
  const targetRecords = selectedIds && selectedIds.size > 0
    ? records.filter(r => selectedIds.has(r.id))
    : records;

  const emails = Array.from(new Set(targetRecords.map(r => r.email.toLowerCase().trim()))).filter(Boolean);
  const content = emails.join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export ONLY clean emails to a minimal CSV file (one email per row)
 */
export function exportCleanEmailsCsv(
  records: DiscoveredEmailRecord[],
  filename: string = 'clean_company_emails.csv',
  selectedIds?: Set<string>,
  includeDomain = false
): void {
  const targetRecords = selectedIds && selectedIds.size > 0
    ? records.filter(r => selectedIds.has(r.id))
    : records;

  const seen = new Set<string>();
  const rows: string[] = [];

  if (includeDomain) {
    rows.push('Email,Domain,Category');
    for (const r of targetRecords) {
      const em = r.email.toLowerCase().trim();
      if (!seen.has(em)) {
        seen.add(em);
        rows.push(`"${em}","${r.companyDomain}","${r.category}"`);
      }
    }
  } else {
    rows.push('Email');
    for (const r of targetRecords) {
      const em = r.email.toLowerCase().trim();
      if (!seen.has(em)) {
        seen.add(em);
        rows.push(`"${em}"`);
      }
    }
  }

  const content = rows.join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export Categorized ZIP with separated category text files and summary report
 */
export async function exportDiscoveryCategoriesZip(
  records: DiscoveredEmailRecord[],
  domains: DomainCrawlStatusRecord[],
  filenamePrefix: string = 'Company_Email_Discovery'
): Promise<void> {
  const zip = new JSZip();
  const dateStr = new Date().toISOString().slice(0, 10);

  // 1. Master List of all unique emails
  const allUnique = Array.from(new Set(records.map(r => r.email.toLowerCase())));
  zip.file(`0_MASTER_ALL_DISCOVERED_EMAILS_${allUnique.length}.txt`, allUnique.join('\n'));

  // 2. Individual Category Files
  const categoryGroups = new Map<string, string[]>();
  records.forEach(r => {
    if (!categoryGroups.has(r.category)) {
      categoryGroups.set(r.category, []);
    }
    categoryGroups.get(r.category)!.push(r.email.toLowerCase());
  });

  Array.from(categoryGroups.entries()).forEach(([cat, emails], idx) => {
    const uniqueCat = Array.from(new Set(emails));
    const safeCat = cat.replace(/[^a-zA-Z0-9_-]/g, '_');
    zip.file(`categories/${idx + 1}_${safeCat}_${uniqueCat.length}.txt`, uniqueCat.join('\n'));
  });

  // 3. Companies with No Emails List
  const noEmailCompanies = domains.filter(d => d.status === 'no_emails').map(d => `${d.domain} (${d.website})`);
  if (noEmailCompanies.length > 0) {
    zip.file(`audit/COMPANIES_WITH_NO_PUBLIC_EMAILS_${noEmailCompanies.length}.txt`, noEmailCompanies.join('\n'));
  }

  // 4. Unavailable Websites List
  const unavailableWebsites = domains.filter(d => d.status === 'unavailable').map(d => `${d.domain} - Error: ${d.error || 'Unavailable'}`);
  if (unavailableWebsites.length > 0) {
    zip.file(`audit/UNAVAILABLE_WEBSITES_${unavailableWebsites.length}.txt`, unavailableWebsites.join('\n'));
  }

  // 5. Detailed Source Attribution CSV
  const csvHeaders = ['CompanyDomain', 'Website', 'CompanyName', 'Email', 'Category', 'ExactSourcePageUrl', 'Context', 'DiscoveredAt', 'Status'];
  const csvRows = records.map(r => [
    `"${r.companyDomain}"`,
    `"${r.companyWebsite}"`,
    `"${r.companyName}"`,
    `"${r.email}"`,
    `"${r.category}"`,
    `"${r.sourcePageUrl}"`,
    `"${r.foundIn}"`,
    `"${r.discoveredAt}"`,
    `"${r.discoveryStatus || 'Publicly Listed'}"`
  ]);
  zip.file(`FULL_SOURCE_PAGE_ATTRIBUTION_${records.length}.csv`, [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\n'));

  // 6. Summary Readme
  const summaryText = [
    `========================================================================`,
    `       COMPANY WEBSITE EMAIL DISCOVERY SYSTEM - DISCOVERY REPORT`,
    `========================================================================`,
    `Discovery Date: ${new Date().toISOString()}`,
    `Total Domains Uploaded: ${domains.length}`,
    `Websites Successfully Accessed: ${domains.filter(d => d.status === 'success' || d.status === 'no_emails').length}`,
    `Websites Unavailable: ${domains.filter(d => d.status === 'unavailable').length}`,
    `Total Pages Scanned: ${domains.reduce((acc, d) => acc + d.pagesScanned, 0)}`,
    `Total Discovered Emails: ${records.length}`,
    `Unique Discovered Emails: ${allUnique.length}`,
    `Companies with No Publicly Available Emails: ${noEmailCompanies.length}`,
    ``,
    `------------------------------------------------------------------------`,
    `                        CATEGORY BREAKDOWN`,
    `------------------------------------------------------------------------`,
    ...Array.from(categoryGroups.entries()).map(([cat, list]) => {
      const u = Array.from(new Set(list)).length;
      return `- ${cat}: ${u} unique emails (${records.length ? Math.round((u / records.length) * 100) : 0}%)`;
    }),
    ``,
    `Note: All discovered emails are publicly listed corporate addresses found on company`,
    `websites and internal subpages (Contact, About, Sales, Export, Procurement, Management).`,
    `Emails are unverified for deliverability. Verify through the Email Validator before large campaigns.`
  ].join('\n');
  zip.file(`REPORT_SUMMARY.txt`, summaryText);

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_${dateStr}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
