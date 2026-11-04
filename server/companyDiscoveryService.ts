import dns from 'dns';
import crypto from 'crypto';
import { promisify } from 'util';
import type { DiscoveredEmailRecord, DomainCrawlStatusRecord } from './db';
import {
  searchMultiEnginePaginated,
  searchGoogleEngine,
  searchDuckDuckGoEngine,
  type SearchHit
} from '../services/multiEngineCrawler';

const resolve4 = promisify(dns.resolve4);

// User-Agent pool for polite web crawling
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (EnterpriseContactFinder/1.0; +https://discovery.internal)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (EnterpriseContactFinder/1.0)',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (EnterpriseContactFinder/1.0)'
];

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Subpage prioritization keywords across global multilingual enterprise websites
const PRIORITY_KEYWORDS = [
  'contact', 'kontakt', 'contacto', 'contatti', 'contato', 'reach-us', 'get-in-touch', 'inquiry', 'enquiry',
  'sales', 'commercial', 'order', 'vertrieb', 'ventes', 'export', 'international', 'overseas', 'global',
  'procurement', 'sourcing', 'supplier', 'purchasing', 'einkauf', 'achats', 'vendor',
  'distributor', 'distributors', 'partner', 'partners', 'dealers', 'where-to-buy',
  'about', 'about-us', 'uber-uns', 'a-propos', 'quienes-somos', 'company', 'profile', 'corporate',
  'management', 'leadership', 'team', 'our-team', 'board', 'directors', 'executives', 'vorstand', 'geschaeftsfuehrung',
  'impressum', 'legal', 'mentions-legales', 'legal-notice', 'aviso-legal', 'imprint',
  'support', 'customer-service', 'helpdesk', 'kundendienst'
];

// File extensions and non-HTML assets to strictly avoid spidering
const ASSET_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar',
  '.tar', '.gz', '.7z', '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.webm',
  '.css', '.js', '.json', '.xml', '.rss', '.woff', '.woff2', '.ttf', '.eot'
];

// Disallowed image/asset extensions in extracted emails (e.g. icon@2x.png)
const INVALID_EMAIL_EXTS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff',
  '.css', '.js', '.json', '.map', '.woff', '.woff2', '.ttf', '.eot',
  '.mp4', '.mp3', '.pdf', '.zip', '.rar', '.gz', '.xml', '.txt', '.scss', '.less'
];

// Third-party tracker, CDN, analytics, framework, and ad junk domains embedded in websites
const THIRD_PARTY_JUNK_DOMAINS = [
  // Analytics & Tracking
  'google-analytics.com', 'googletagmanager.com', 'google.com', 'googleapis.com', 'gstatic.com',
  'doubleclick.net', 'adnxs.com', 'criteo.com', 'hotjar.com', 'clarity.ms', 'segment.io',
  'mixpanel.com', 'optimizely.com', 'newrelic.com', 'datadog.com', 'sentry.io', 'bugsnag.com',
  // CMS, Theme & Site Builders
  'wordpress.org', 'wordpress.com', 'wp.com', 'wix.com', 'squarespace.com', 'shopify.com',
  'weebly.com', 'webflow.io', 'elementor.com', 'gravatar.com', 'automattic.com',
  // Social Platforms & Media embeds
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
  'youtube.com', 'vimeo.com', 'tiktok.com', 'pinterest.com',
  // Web standards, schema & CDNs
  'w3.org', 'schema.org', 'cloudflare.com', 'jsdelivr.net', 'cdnjs.com', 'unpkg.com',
  'github.com', 'gitlab.com', 'bitbucket.org', 'npm.com', 'npmjs.org', 'fontawesome.com',
  // Marketing & chat widgets
  'intercom.io', 'zendesk.com', 'hubspot.com', 'mailchimp.com', 'sendgrid.net',
  'cookiebot.com', 'onetrust.com', 'usercentrics.eu', 'trustpilot.com', 'recaptcha.net',
  'polyfill.io', 'fastly.net', 'akamai.net', 'stripe.com', 'paypal.com'
];

// Bot, automated system, transactional, and machine prefixes to strictly filter out
const BOT_SYSTEM_PREFIXES = [
  'noreply', 'no-reply', 'no_reply', 'donotreply', 'do-not-reply', 'do_not_reply',
  'mailer-daemon', 'mail-daemon', 'mailerdaemon', 'postmaster', 'hostmaster', 'webmaster',
  'bounce', 'bounces', 'return', 'returns',
  'notification', 'notifications', 'notify', 'alert', 'alerts',
  'bot', 'robot', 'crawler', 'spider', 'cron', 'daemon', 'system', 'automated', 'automatic',
  'auto-confirm', 'confirm', 'confirmation', 'auto',
  'newsletter', 'newsletters', 'subscription', 'subscribe', 'unsubscribe',
  'abuse', 'security', 'spam', 'noc', 'cert', 'dpo',
  'pingback', 'track', 'tracking', 'logger', 'log', 'telemetry', 'analytics', 'metrics', 'monitoring', 'status',
  'git', 'github', 'gitlab', 'bitbucket', 'svn', 'devnull', 'nobody', 'null', 'root',
  'sentry', 'cloudflare', 'aws', 'reply', 'incoming', 'outbox', 'catchall', 'dummy', 'tester'
];

// Placeholder, example, and template email prefixes
const PLACEHOLDER_PREFIXES = [
  'test', 'test1', 'test2', 'demo', 'example', 'sample', 'yourname', 'your-name',
  'your-email', 'youremail', 'yourdomain', 'your-domain', 'fake', 'dummy', 'placeholder',
  'temp', 'temporary', 'xxx', 'asdf', 'qwerty', 'myemail'
];

/**
 * Normalizes input domain string into a clean hostname
 */
export function normalizeDomain(input: string): string {
  if (!input) return '';
  let clean = input.trim().toLowerCase();
  clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?/, '');
  clean = clean.split('/')[0];
  clean = clean.split('?')[0];
  clean = clean.split('#')[0];
  clean = clean.split(':')[0]; // remove port
  clean = clean.replace(/[^a-z0-9.-]/g, '');
  return clean;
}

/**
 * Validates if a local-part is computer-generated, a hash, random alphanumeric, or a bot
 */
export function isComputerGeneratedOrBotEmail(localPart: string): boolean {
  const lp = localPart.toLowerCase().trim();

  // 1. Length check: genuine corporate email prefixes or human names rarely exceed 32 chars
  if (lp.length > 32 || lp.length < 2) return true;

  // 2. Purely numeric local parts (e.g. 1928374981@... or 888888@...)
  if (/^\d+$/.test(lp)) return true;

  // 3. Hexadecimal hash check (e.g. 12+ consecutive hex chars: a8f3b9c1d2e4 or UUID format)
  if (/^[0-9a-f]{12,}$/i.test(lp) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(lp)) return true;

  // 4. High digit ratio: if length >= 6 and > 30% numbers (e.g. user938472 or a1b2c3d4e5)
  const digitCount = (lp.match(/\d/g) || []).length;
  if (lp.length >= 6 && digitCount / lp.length > 0.3) {
    return true;
  }

  // 5. 4 or more consecutive digits, unless matching a standard recent birth/founding year (1950 - 2030)
  const consecDigitsMatch = lp.match(/\d{4,}/);
  if (consecDigitsMatch) {
    const val = parseInt(consecDigitsMatch[0]);
    if (consecDigitsMatch[0].length > 4 || val < 1950 || val > 2030) {
      return true;
    }
  }

  // 6. Alphanumeric hash signatures with underscores or hyphens: e.g. token_38f01a, id-948192
  if (/^(?:token|id|uuid|hash|uid|track|msg|sid|gid)[-_0-9a-f]{6,}/i.test(lp)) {
    return true;
  }

  // 7. No vowels in a word of 5+ characters (e.g. xrtqpl, bdfghjk) - pure consonant gibberish
  // Well-known corporate acronyms like 'csr', 'hr', 'pr' are 2-4 chars.
  if (lp.length >= 5 && !/[aeiouy]/i.test(lp)) {
    return true;
  }

  // 8. Bot or system prefixes
  for (const prefix of BOT_SYSTEM_PREFIXES) {
    if (
      lp === prefix ||
      lp.startsWith(`${prefix}.`) ||
      lp.startsWith(`${prefix}-`) ||
      lp.startsWith(`${prefix}_`) ||
      lp.endsWith(`.${prefix}`) ||
      lp.endsWith(`-${prefix}`)
    ) {
      return true;
    }
  }

  // 9. Placeholder / dummy prefixes
  for (const dummy of PLACEHOLDER_PREFIXES) {
    if (lp === dummy || lp.startsWith(`${dummy}@`) || lp === `${dummy}1` || lp === `${dummy}2`) {
      return true;
    }
  }

  return false;
}

/**
 * Validates if an email is a legitimate corporate/company address
 * Filters out junk, bots, hashes, image filenames, and unrelated third-party tracker domains
 */
export function isCompanyEmail(
  email: string,
  targetDomain: string,
  strictMode = true
): { valid: boolean; reason?: string } {
  let clean = email.trim().toLowerCase();
  clean = clean.replace(/^[<(\["']+|[>)\]"',.]+$/g, '');

  if (!clean.includes('@')) return { valid: false, reason: 'No @ symbol' };
  const [localPart, emailDomain] = clean.split('@');
  if (!localPart || !emailDomain || !emailDomain.includes('.')) {
    return { valid: false, reason: 'Malformed syntax' };
  }

  // Asset extension check
  for (const ext of INVALID_EMAIL_EXTS) {
    if (clean.endsWith(ext) || emailDomain.endsWith(ext) || localPart.endsWith(ext)) {
      return { valid: false, reason: 'Asset or file false positive' };
    }
  }

  // Image density suffix check like icon@2x or logo@3x
  if (/@\d+x\./i.test(clean) || /@\d+x$/i.test(localPart)) {
    return { valid: false, reason: 'Retina image asset' };
  }

  // Bot, automated, computer-generated alphanumeric check
  if (isComputerGeneratedOrBotEmail(localPart)) {
    return { valid: false, reason: 'Bot, system, or computer-generated address' };
  }

  // Third party junk domains check
  for (const tp of THIRD_PARTY_JUNK_DOMAINS) {
    if (emailDomain === tp || emailDomain.endsWith(`.${tp}`)) {
      return { valid: false, reason: 'Third-party tracker/framework domain' };
    }
  }

  // Government & Academic filtering (unless target domain is specifically that domain)
  if (emailDomain.endsWith('.gov') || emailDomain.endsWith('.mil') || emailDomain.endsWith('.edu')) {
    if (!targetDomain.endsWith(emailDomain)) {
      return { valid: false, reason: 'Government or academic non-corporate address' };
    }
  }

  // Company domain match heuristic:
  const cleanTarget = normalizeDomain(targetDomain);
  const targetBase = cleanTarget.replace(/^www\./, '');
  const emailBase = emailDomain.replace(/^www\./, '');

  // 1. Direct match: email domain is or ends with target domain (e.g. contact@acme.com for acme.com or sales@de.acme.com)
  const isDirectCompanyDomain =
    emailBase === targetBase ||
    emailBase.endsWith(`.${targetBase}`) ||
    targetBase.endsWith(`.${emailBase}`);

  if (isDirectCompanyDomain) {
    return { valid: true };
  }

  // 2. If email domain differs from target domain:
  // If targetDomain root matches (e.g. target is acme-group.com and email is @acme.com)
  const targetName = targetBase.split('.')[0];
  const emailName = emailBase.split('.')[0];
  if (targetName.length >= 4 && (emailName.includes(targetName) || targetName.includes(emailName))) {
    return { valid: true };
  }

  // 3. If reputable webmail (gmail/outlook/yahoo), ONLY accept if localPart references company or target domain
  // (e.g. acmesteel@gmail.com for acmesteel.com)
  const isPublicWebmail = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com'].includes(emailBase);
  if (isPublicWebmail) {
    if (targetName.length >= 3 && localPart.includes(targetName)) {
      return { valid: true };
    }
    // If strictMode is on, discard generic public webmails that don't match company name
    if (strictMode) {
      return { valid: false, reason: 'Non-company public webmail domain' };
    }
  }

  // 4. In strict corporate mode: reject any email belonging to an unrelated 3rd party domain
  if (strictMode) {
    return { valid: false, reason: `Domain ${emailDomain} does not match company domain ${targetDomain}` };
  }

  return { valid: true };
}

/**
 * Email Classification into 10 enterprise categories (Requirement 4)
 */
export function classifyDiscoveredEmail(email: string): string {
  const localPart = email.split('@')[0]?.toLowerCase() || '';

  // 1. Export
  if (
    localPart.startsWith('export') ||
    localPart.includes('international') ||
    localPart.includes('overseas') ||
    localPart.includes('foreign') ||
    localPart.includes('ausland') ||
    localPart.startsWith('global') ||
    localPart.startsWith('trade')
  ) {
    return 'Export';
  }

  // 2. Procurement
  if (
    localPart.startsWith('procure') ||
    localPart.includes('sourcing') ||
    localPart.includes('vendor') ||
    localPart.includes('supplier') ||
    localPart.includes('supplychain') ||
    localPart.includes('beschaffung')
  ) {
    return 'Procurement';
  }

  // 3. Purchasing
  if (
    localPart.startsWith('purchase') ||
    localPart.startsWith('purchasing') ||
    localPart.startsWith('buyer') ||
    localPart.includes('einkauf') ||
    localPart.includes('achats')
  ) {
    return 'Purchasing';
  }

  // 4. Sales
  if (
    localPart.startsWith('sale') ||
    localPart.startsWith('sales') ||
    localPart.startsWith('order') ||
    localPart.startsWith('orders') ||
    localPart.includes('commercial') ||
    localPart.includes('deals') ||
    localPart.includes('vertrieb') ||
    localPart.includes('ventes') ||
    localPart.startsWith('inquiry') ||
    localPart.startsWith('enquiry') ||
    localPart.startsWith('business')
  ) {
    return 'Sales';
  }

  // 5. Management / Executive
  if (
    localPart.startsWith('ceo') ||
    localPart.startsWith('director') ||
    localPart.startsWith('president') ||
    localPart.startsWith('management') ||
    localPart.includes('leadership') ||
    localPart.includes('executive') ||
    localPart.includes('board') ||
    localPart.includes('owner') ||
    localPart.includes('vorstand') ||
    localPart.includes('geschaeftsfuehrung')
  ) {
    return 'Management';
  }

  // 6. Administration
  if (
    localPart.startsWith('admin') ||
    localPart.startsWith('corporate') ||
    localPart.includes('finance') ||
    localPart.includes('accounting') ||
    localPart.includes('billing') ||
    localPart.includes('buchhaltung') ||
    localPart.includes('hr') ||
    localPart.includes('career') ||
    localPart.includes('legal')
  ) {
    return 'Administration';
  }

  // 7. Commercial & Marketing
  if (
    localPart.startsWith('marketing') ||
    localPart.startsWith('press') ||
    localPart.startsWith('media') ||
    localPart.startsWith('pr') ||
    localPart.startsWith('werbung')
  ) {
    return 'Commercial';
  }

  // 8. Customer Support
  if (
    localPart.startsWith('support') ||
    localPart.startsWith('help') ||
    localPart.startsWith('service') ||
    localPart.includes('customercare') ||
    localPart.includes('kundenservice') ||
    localPart.includes('assistance') ||
    localPart.includes('hotline')
  ) {
    return 'Customer Support';
  }

  // 9. General Information
  if (
    localPart.startsWith('info') ||
    localPart.startsWith('contact') ||
    localPart.startsWith('kontakt') ||
    localPart.startsWith('hello') ||
    localPart.startsWith('mail') ||
    localPart.startsWith('office') ||
    localPart.startsWith('general') ||
    localPart.startsWith('welcome') ||
    localPart.startsWith('frontdesk') ||
    localPart.startsWith('reception')
  ) {
    return 'General Information';
  }

  // 10. Other business contacts (e.g. named personnel: john.smith@company.com)
  return 'Other Business Contacts';
}

/**
 * Extracts phone numbers from text and HTML
 */
function extractPhoneFromHtml(html: string): string | undefined {
  const telMatch = html.match(/href=["']tel:([+0-9\s.-]+)["']/i);
  if (telMatch && telMatch[1]) {
    const raw = telMatch[1].trim();
    if (raw.length >= 8 && raw.length <= 25) return raw;
  }
  const phoneRegex = /(?:\+|00)(\d{1,3})[\s.-]?(?:\(?0\)?[\s.-]?)?(\d{1,4})[\s.-]?(\d{2,4})[\s.-]?(\d{2,6})/g;
  const match = html.match(phoneRegex);
  if (match && match.length > 0) {
    const p = match[0].trim();
    if (p.length >= 8 && p.length <= 25) return p;
  }
  return undefined;
}

/**
 * Extracts and deduces company name from title, meta tags, Schema.org, or domain
 */
function deduceCompanyName(html: string, domain: string): string {
  // 1. Schema.org Organization name
  const schemaMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (schemaMatch) {
    for (const sc of schemaMatch) {
      try {
        const rawJson = sc.replace(/<\/?script[^>]*>/gi, '').trim();
        const parsed = JSON.parse(rawJson);
        const org = Array.isArray(parsed) ? parsed.find(p => p['@type'] === 'Organization') : parsed;
        if (org && org.name && typeof org.name === 'string') {
          return org.name.trim();
        }
      } catch {}
    }
  }

  // 2. OpenGraph site_name
  const ogMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
                  html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  if (ogMatch && ogMatch[1]?.trim()) {
    return ogMatch[1].trim();
  }

  // 3. Page <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const rawTitle = titleMatch[1].replace(/<[^>]*>/g, '').trim();
    const splitTitle = rawTitle.split(/[-–—|•:]/)[0]?.trim();
    if (splitTitle && splitTitle.length >= 3 && splitTitle.length <= 60 && !splitTitle.toLowerCase().includes('welcome')) {
      return splitTitle;
    }
  }

  // 4. Fallback: clean domain name capitalized
  const base = domain.split('.')[0] || domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Extracts page title from HTML
 */
function extractTitle(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].replace(/<[^>]*>/g, '').trim().slice(0, 100);
  }
  return undefined;
}

/**
 * Extracts emails from HTML source with strict corporate filtering
 */
function extractEmailsWithContext(
  html: string,
  pageUrl: string,
  targetDomain: string,
  strictCorporateFilter = true
): Array<{ email: string; foundIn: string }> {
  const results: Array<{ email: string; foundIn: string }> = [];
  const seen = new Set<string>();

  const addEmail = (raw: string, foundIn: string) => {
    let clean = raw.trim().toLowerCase();
    clean = clean.replace(/^[<(\["']+|[>)\]"',.]+$/g, '');
    if (!clean.includes('@') || clean.length < 5 || clean.length > 80) return;

    // Strict corporate filtering: eliminate bots, hashes, machine generated, and junk domains
    const filterCheck = isCompanyEmail(clean, targetDomain, strictCorporateFilter);
    if (!filterCheck.valid) {
      return;
    }

    if (!seen.has(clean)) {
      seen.add(clean);
      results.push({ email: clean, foundIn });
    }
  };

  // 1. Mailto links (Highest fidelity)
  const mailtoMatches = Array.from(html.matchAll(/href=["']mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[^"']*["']/gi));
  for (const m of mailtoMatches) {
    if (m[1]) addEmail(m[1], 'Mailto link');
  }

  // 2. Footer disclosures
  const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/gi);
  if (footerMatch) {
    const footerText = footerMatch.join(' ');
    const footerEmails = footerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
    for (const em of footerEmails) {
      addEmail(em, 'Footer disclosure');
    }
  }

  // 3. Contact sections
  const contactSections = html.match(/<(?:section|div|article)[^>]*(?:id|class)=["'][^"']*(?:contact|kontakt|reach|about)[^"']*["'][\s\S]*?<\/(?:section|div|article)>/gi);
  if (contactSections) {
    const secText = contactSections.join(' ');
    const secEmails = secText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
    for (const em of secEmails) {
      addEmail(em, 'Contact section');
    }
  }

  // 4. Standard text & attribute regex
  const standardEmails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
  for (const em of standardEmails) {
    addEmail(em, 'Website page content');
  }

  // 5. Obfuscated email notations: info [at] domain [dot] com, contact(at)domain.com
  const obfuscatedRegex = /([a-zA-Z0-9._%+-]+)\s*(?:\[@\]|\[at\]|\(at\)|\{\s*at\s*\}|<\s*at\s*>|\[\s*at\s*\]|\(\s*at\s*\)|\s+at\s+|\s+AT\s+|&#64;|&commat;|&#x40;|%40)\s*([a-zA-Z0-9.-]+)\s*(?:\.|\s*(?:\[dot\]|\(dot\)|\{\s*dot\s*\}|\[\s*punkt\s*\]|\(\s*punkt\s*\)|\s+dot\s+|\s+DOT\s+))\s*([a-zA-Z]{2,})/gi;
  const obfMatches = Array.from(html.matchAll(obfuscatedRegex));
  for (const m of obfMatches) {
    if (m[1] && m[2] && m[3]) {
      const reconstructed = `${m[1]}@${m[2]}.${m[3]}`;
      addEmail(reconstructed, 'Obfuscated text');
    }
  }

  return results;
}

/**
 * Discovers and ranks internal subpage links from HTML
 */
function discoverPrioritizedInternalLinks(
  html: string,
  originUrl: string,
  host: string
): string[] {
  const linksMap = new Map<string, number>();

  const anchorMatches = Array.from(html.matchAll(/<a[^>]+href=["']([^"'#\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi));

  for (const m of anchorMatches) {
    const rawHref = m[1]?.trim();
    const anchorText = m[2]?.replace(/<[^>]*>/g, '').trim().toLowerCase() || '';
    if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
      continue;
    }

    try {
      const resolved = new URL(rawHref, originUrl);
      const linkHost = resolved.hostname.toLowerCase().replace(/^www\./, '');
      const cleanHost = host.toLowerCase().replace(/^www\./, '');

      // Must be same host
      if (linkHost !== cleanHost) continue;

      const pathname = resolved.pathname.toLowerCase();

      // Check if it's an excluded static asset
      const isAsset = ASSET_EXTENSIONS.some(ext => pathname.endsWith(ext));
      if (isAsset) continue;

      // Skip homepage link itself
      if (pathname === '/' || pathname === '') continue;

      const fullUrl = `${resolved.origin}${resolved.pathname}`;

      // Calculate priority score
      let score = 1;
      const combined = `${pathname} ${anchorText}`;

      for (const kw of PRIORITY_KEYWORDS) {
        if (combined.includes(kw)) {
          if (kw === 'contact' || kw === 'kontakt' || kw === 'impressum') score += 10;
          else if (kw === 'sales' || kw === 'export' || kw === 'procurement' || kw === 'purchasing') score += 8;
          else if (kw === 'about' || kw === 'team' || kw === 'management') score += 6;
          else score += 4;
        }
      }

      if (!linksMap.has(fullUrl) || (linksMap.get(fullUrl) || 0) < score) {
        linksMap.set(fullUrl, score);
      }
    } catch {}
  }

  // Sort descending by score
  return Array.from(linksMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
}

/**
 * Searches Google / Multi-Engine for company domain when no email was discovered on direct website crawl
 */
export async function searchGoogleForCompanyEmails(
  domain: string,
  companyName?: string,
  timeoutMs = 6000
): Promise<DiscoveredEmailRecord[]> {
  const cleanDomain = normalizeDomain(domain);
  if (!cleanDomain) return [];

  const foundRecords: DiscoveredEmailRecord[] = [];
  const seenEmails = new Set<string>();
  const derivedName = companyName || cleanDomain.split('.')[0].toUpperCase();

  // Targeted queries to find publicly listed emails indexed by search engines
  const queries = [
    `site:${cleanDomain} "email" OR "contact" OR "@${cleanDomain}" OR "info"`,
    `"${cleanDomain}" ("contact us" OR "sales" OR "email" OR "info@${cleanDomain}")`
  ];

  for (const query of queries) {
    try {
      let hits = await searchMultiEnginePaginated(query, 1, 'auto');
      if (!hits || hits.length === 0) {
        hits = await searchGoogleEngine(query, 1, 8);
      }
      if (!hits || hits.length === 0) {
        hits = await searchDuckDuckGoEngine(query, 1, 8);
      }

      for (const hit of (hits || [])) {
        const textToScan = `${hit.title || ''} ${hit.snippet || ''}`;
        
        // Extract emails from title and search snippet
        const matches = textToScan.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
        
        for (const rawEm of matches) {
          const filterRes = isCompanyEmail(rawEm, cleanDomain, true);
          if (filterRes.valid) {
            const cleanEm = rawEm.toLowerCase().trim();
            if (!seenEmails.has(cleanEm)) {
              seenEmails.add(cleanEm);
              foundRecords.push({
                id: `em_${crypto.randomUUID().slice(0, 10)}`,
                companyDomain: cleanDomain,
                companyWebsite: `https://${cleanDomain}`,
                companyName: derivedName,
                email: cleanEm,
                category: classifyDiscoveredEmail(cleanEm),
                sourcePageUrl: hit.url || `https://${cleanDomain}`,
                foundIn: 'Google Search Snippet',
                discoveredAt: new Date().toISOString(),
                discoveryStatus: 'Publicly Listed',
                pageTitle: hit.title || 'Google Search Result'
              });
            }
          }
        }

        // If hit URL is on the company domain and is a contact/about page, probe it if we haven't found emails yet
        try {
          const hitHost = new URL(hit.url).hostname.toLowerCase().replace(/^www\./, '');
          if (hitHost === cleanDomain.replace(/^www\./, '') && foundRecords.length === 0) {
            const pageRes = await fetch(hit.url, {
              headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html' },
              signal: AbortSignal.timeout(timeoutMs)
            });
            if (pageRes.ok) {
              const html = await pageRes.text();
              const emails = extractEmailsWithContext(html, hit.url, cleanDomain, true);
              for (const item of emails) {
                if (!seenEmails.has(item.email)) {
                  seenEmails.add(item.email);
                  foundRecords.push({
                    id: `em_${crypto.randomUUID().slice(0, 10)}`,
                    companyDomain: cleanDomain,
                    companyWebsite: `https://${cleanDomain}`,
                    companyName: derivedName,
                    email: item.email,
                    category: classifyDiscoveredEmail(item.email),
                    sourcePageUrl: hit.url,
                    foundIn: `Google Index Subpage (${item.foundIn})`,
                    discoveredAt: new Date().toISOString(),
                    discoveryStatus: 'Publicly Listed',
                    pageTitle: extractTitle(html) || hit.title
                  });
                }
              }
            }
          }
        } catch {}
      }

      if (foundRecords.length > 0) break;
    } catch (qErr: any) {
      console.warn(`[Google Search Fallback] Query error for ${cleanDomain}:`, qErr.message);
    }
  }

  return foundRecords;
}

export interface DomainCrawlResult {
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

export interface CrawlDomainOptions {
  maxPages?: number;
  timeoutMs?: number;
  politeDelayMs?: number;
  respectRobots?: boolean;
  searchGoogleIfNoEmail?: boolean;
  strictCorporateFilter?: boolean;
}

/**
 * Deep corporate crawler for a single company domain
 */
export async function crawlCompanyDomain(
  rawDomain: string,
  options: CrawlDomainOptions = {}
): Promise<DomainCrawlResult> {
  const maxPages = options.maxPages || 6;
  const timeoutMs = options.timeoutMs || 8000;
  const politeDelayMs = options.politeDelayMs || 250;
  const searchGoogleIfNoEmail = options.searchGoogleIfNoEmail !== false;
  const strictCorporateFilter = options.strictCorporateFilter !== false;
  const cleanDomain = normalizeDomain(rawDomain);

  if (!cleanDomain || !cleanDomain.includes('.')) {
    return {
      domain: rawDomain,
      website: `https://${rawDomain}`,
      companyName: rawDomain,
      status: 'unavailable',
      statusCode: 0,
      pagesScanned: 0,
      emailsCount: 0,
      error: 'Invalid domain syntax',
      records: [],
      crawledPages: []
    };
  }

  // Pre-flight DNS check to avoid waiting on dead domains
  try {
    await resolve4(cleanDomain);
  } catch (dnsErr: any) {
    return {
      domain: cleanDomain,
      website: `https://${cleanDomain}`,
      companyName: cleanDomain.split('.')[0].toUpperCase(),
      status: 'unavailable',
      statusCode: 0,
      pagesScanned: 0,
      emailsCount: 0,
      error: `DNS resolution failed: ${dnsErr?.code || 'Host not found'}`,
      records: [],
      crawledPages: []
    };
  }

  const records: DiscoveredEmailRecord[] = [];
  const crawledPages: Array<{ url: string; title?: string; emailsFound: number }> = [];
  const seenEmails = new Set<string>();

  let primaryWebsite = `https://${cleanDomain}`;
  let homepageHtml = '';
  let homepageStatusCode = 200;
  let companyName = cleanDomain.split('.')[0].toUpperCase();
  let defaultPhone: string | undefined;

  // 1. Fetch Homepage (Try HTTPS first, fallback to HTTP)
  try {
    let res = await fetch(primaryWebsite, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!res.ok && res.status >= 400 && res.status < 500) {
      primaryWebsite = `http://${cleanDomain}`;
      res = await fetch(primaryWebsite, {
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs)
      });
    }

    homepageStatusCode = res.status;
    if (!res.ok) {
      // If homepage was an HTTP error, check Google Search Fallback before declaring completely unavailable
      if (searchGoogleIfNoEmail) {
        const googleRecords = await searchGoogleForCompanyEmails(cleanDomain, companyName, timeoutMs);
        if (googleRecords.length > 0) {
          return {
            domain: cleanDomain,
            website: primaryWebsite,
            companyName,
            status: 'success',
            statusCode: res.status,
            pagesScanned: 1,
            emailsCount: googleRecords.length,
            records: googleRecords,
            crawledPages: [{
              url: `https://www.google.com/search?q=site:${cleanDomain}`,
              title: `Google Search Fallback (${googleRecords.length} emails discovered)`,
              emailsFound: googleRecords.length
            }]
          };
        }
      }

      return {
        domain: cleanDomain,
        website: primaryWebsite,
        companyName,
        status: 'unavailable',
        statusCode: res.status,
        pagesScanned: 0,
        emailsCount: 0,
        error: `HTTP error ${res.status}: ${res.statusText}`,
        records: [],
        crawledPages: []
      };
    }

    homepageHtml = await res.text();
  } catch (fetchErr: any) {
    try {
      primaryWebsite = `http://${cleanDomain}`;
      const res = await fetch(primaryWebsite, {
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs)
      });
      homepageStatusCode = res.status;
      if (res.ok) {
        homepageHtml = await res.text();
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (innerErr: any) {
      // If direct website failed, check Google search fallback
      if (searchGoogleIfNoEmail) {
        const googleRecords = await searchGoogleForCompanyEmails(cleanDomain, companyName, timeoutMs);
        if (googleRecords.length > 0) {
          return {
            domain: cleanDomain,
            website: primaryWebsite,
            companyName,
            status: 'success',
            statusCode: 200,
            pagesScanned: 1,
            emailsCount: googleRecords.length,
            records: googleRecords,
            crawledPages: [{
              url: `https://www.google.com/search?q=site:${cleanDomain}`,
              title: `Google Search Fallback (${googleRecords.length} emails discovered)`,
              emailsFound: googleRecords.length
            }]
          };
        }
      }

      return {
        domain: cleanDomain,
        website: primaryWebsite,
        companyName,
        status: 'unavailable',
        statusCode: 0,
        pagesScanned: 0,
        emailsCount: 0,
        error: fetchErr?.name === 'TimeoutError' || fetchErr?.message?.includes('timed out')
          ? `Connection timed out after ${timeoutMs}ms`
          : `Website unavailable: ${fetchErr?.message || 'Connection refused'}`,
        records: [],
        crawledPages: []
      };
    }
  }

  // Deduce company name & phone from homepage
  companyName = deduceCompanyName(homepageHtml, cleanDomain);
  defaultPhone = extractPhoneFromHtml(homepageHtml);
  const homeTitle = extractTitle(homepageHtml) || 'Homepage';

  // Extract homepage emails with strict corporate filtering
  const homeFound = extractEmailsWithContext(homepageHtml, primaryWebsite, cleanDomain, strictCorporateFilter);
  let homeEmailsCount = 0;

  for (const item of homeFound) {
    if (!seenEmails.has(item.email)) {
      seenEmails.add(item.email);
      homeEmailsCount++;
      records.push({
        id: `em_${crypto.randomUUID().slice(0, 10)}`,
        companyDomain: cleanDomain,
        companyWebsite: primaryWebsite,
        companyName,
        email: item.email,
        category: classifyDiscoveredEmail(item.email),
        sourcePageUrl: primaryWebsite,
        foundIn: item.foundIn,
        discoveredAt: new Date().toISOString(),
        discoveryStatus: 'Publicly Listed',
        pageTitle: homeTitle,
        phone: defaultPhone
      });
    }
  }

  crawledPages.push({
    url: primaryWebsite,
    title: homeTitle,
    emailsFound: homeEmailsCount
  });

  // 2. Discover and Spider Internal Subpages
  const discoveredSubLinks = discoverPrioritizedInternalLinks(homepageHtml, primaryWebsite, cleanDomain);
  const targetSubpages = discoveredSubLinks.slice(0, Math.max(1, maxPages - 1));

  if (targetSubpages.length < 3) {
    const defaultPaths = ['/contact', '/about', '/sales', '/export', '/impressum', '/team'];
    for (const p of defaultPaths) {
      const url = `${primaryWebsite.replace(/\/+$/, '')}${p}`;
      if (!targetSubpages.includes(url)) {
        targetSubpages.push(url);
      }
      if (targetSubpages.length >= maxPages - 1) break;
    }
  }

  // Polite crawling of internal subpages
  for (const subUrl of targetSubpages) {
    if (politeDelayMs > 0) {
      await new Promise(r => setTimeout(r, politeDelayMs));
    }

    try {
      const subRes = await fetch(subUrl, {
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!subRes.ok) continue;

      const subHtml = await subRes.text();
      const subTitle = extractTitle(subHtml) || subUrl;
      const subPhone = extractPhoneFromHtml(subHtml) || defaultPhone;
      const subFound = extractEmailsWithContext(subHtml, subUrl, cleanDomain, strictCorporateFilter);
      let pageNewEmails = 0;

      for (const item of subFound) {
        if (!seenEmails.has(item.email)) {
          seenEmails.add(item.email);
          pageNewEmails++;
          records.push({
            id: `em_${crypto.randomUUID().slice(0, 10)}`,
            companyDomain: cleanDomain,
            companyWebsite: primaryWebsite,
            companyName,
            email: item.email,
            category: classifyDiscoveredEmail(item.email),
            sourcePageUrl: subUrl,
            foundIn: item.foundIn,
            discoveredAt: new Date().toISOString(),
            discoveryStatus: 'Publicly Listed',
            pageTitle: subTitle,
            phone: subPhone
          });
        }
      }

      crawledPages.push({
        url: subUrl,
        title: subTitle,
        emailsFound: pageNewEmails
      });
    } catch {}
  }

  // 3. GOOGLE SEARCH FALLBACK: If website yielded 0 emails, search Google for company domain
  if (records.length === 0 && searchGoogleIfNoEmail) {
    try {
      const googleRecords = await searchGoogleForCompanyEmails(cleanDomain, companyName, timeoutMs);
      if (googleRecords.length > 0) {
        for (const gr of googleRecords) {
          if (!seenEmails.has(gr.email)) {
            seenEmails.add(gr.email);
            records.push(gr);
          }
        }
        crawledPages.push({
          url: `https://www.google.com/search?q=site:${cleanDomain}`,
          title: `Google Search Fallback (${googleRecords.length} emails discovered)`,
          emailsFound: googleRecords.length
        });
      }
    } catch (gErr: any) {
      console.warn(`[Company Discovery] Google search fallback error for ${cleanDomain}:`, gErr?.message || gErr);
    }
  }

  const finalStatus: DomainCrawlResult['status'] = records.length > 0 ? 'success' : 'no_emails';

  return {
    domain: cleanDomain,
    website: primaryWebsite,
    companyName,
    status: finalStatus,
    statusCode: homepageStatusCode,
    pagesScanned: crawledPages.length,
    emailsCount: records.length,
    records,
    crawledPages
  };
}
