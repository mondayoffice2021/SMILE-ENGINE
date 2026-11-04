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
 * Normalizes input domain into a clean domain name
 */
export function cleanDomainName(raw: string): string {
  if (!raw) return '';
  let str = raw.trim().toLowerCase();
  str = str.replace(/^(?:https?:\/\/)?(?:www\.)?/, '');
  str = str.split('/')[0];
  str = str.split('?')[0];
  str = str.split('#')[0];
  str = str.split(':')[0]; // Port
  str = str.replace(/[^a-z0-9.-]/g, '');
  return str;
}

/**
 * Parses domain names from plain text, CSV, or lines
 */
export function parseDomainsFromText(text: string): { totalRaw: number; uniqueDomains: string[] } {
  if (!text || !text.trim()) return { totalRaw: 0, uniqueDomains: [] };

  const lines = text
    .split(/[\r\n,;]+/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  const validDomains: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // If line has an email, extract its domain
    if (line.includes('@')) {
      const part = line.split('@')[1];
      const d = cleanDomainName(part);
      if (d && d.includes('.') && !seen.has(d)) {
        seen.add(d);
        validDomains.push(d);
      }
      continue;
    }

    // Try extracting domain from URL or word
    const matches = line.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
    if (matches) {
      for (const m of matches) {
        const d = cleanDomainName(m);
        if (d && d.includes('.') && !seen.has(d)) {
          seen.add(d);
          validDomains.push(d);
        }
      }
    } else {
      const d = cleanDomainName(line);
      if (d && d.includes('.') && d.length >= 4 && !seen.has(d)) {
        seen.add(d);
        validDomains.push(d);
      }
    }
  }

  return {
    totalRaw: lines.length,
    uniqueDomains: validDomains
  };
}

/**
 * Parses domains from TXT, CSV, XLSX, XLS file
 */
export async function parseDomainsFromFile(file: File): Promise<{ totalRaw: number; uniqueDomains: string[]; filename: string }> {
  const filename = file.name;
  const ext = filename.split('.').pop()?.toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const collectedStrings: string[] = [];

    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
      rows.forEach((row: any) => {
        if (Array.isArray(row)) {
          row.forEach(cell => {
            if (cell !== undefined && cell !== null) {
              collectedStrings.push(String(cell));
            }
          });
        }
      });
    });

    const parsed = parseDomainsFromText(collectedStrings.join('\n'));
    return { ...parsed, filename };
  } else {
    // TXT or CSV
    const text = await file.text();
    const parsed = parseDomainsFromText(text);
    return { ...parsed, filename };
  }
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
