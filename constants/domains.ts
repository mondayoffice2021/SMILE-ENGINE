// Public consumer email providers registry
// Covers global, national, and regional webmail services across all ccTLDs (.com, .co, .fr, .de, .it, .es, .co.uk, .ca, etc.)

export const PUBLIC_PROVIDER_ROOTS = new Set([
  // Google
  'gmail', 'googlemail',
  // Yahoo & subsidiaries
  'yahoo', 'ymail', 'rocketmail',
  // Microsoft
  'hotmail', 'outlook', 'live', 'msn', 'windowslive', 'passport',
  // Apple
  'icloud', 'me', 'mac',
  // AOL
  'aol', 'aim',
  // Privacy & Encrypted Webmail
  'protonmail', 'proton', 'pm', 'tutanota', 'tuta', 'mailfence', 'disroot',
  // Zoho & Mail.com
  'zoho', 'zohomail', 'mail', 'email', 'inbox', 'usa', 'writeme',
  // German & Central European Webmail
  'gmx', 'web', 'freenet', 't-online', 'posteo', 'mailbox', 'arcor', 'vodafone',
  // French Webmail & Telcos
  'wanadoo', 'orange', 'sfr', 'free', 'laposte', 'numericable', 'neuf', 'aliceadsl', 'club-internet', 'bbox', 'voila', 'tele2', 'noos', 'libertysurf', 'infonie', 'cegetel', 'dartybox',
  // Italian Webmail & Telcos
  'libero', 'virgilio', 'alice', 'tin', 'fastwebnet', 'tiscali',
  // Spanish & Latin American Webmail
  'terra', 'uol', 'bol', 'ig', 'globo', 'globomail', 'telefonica', 'movistar',
  // Russian & CIS Webmail
  'yandex', 'ya', 'rambler', 'list', 'bk', 'lenta',
  // British & Irish ISPs
  'btinternet', 'virginmedia', 'sky', 'talktalk', 'plus', 'blueyonder', 'ntlworld',
  // Asian Webmail
  'qq', '163', '126', 'yeah', 'sina', 'sohu', 'aliyun', 'foxmail',
  'naver', 'daum', 'hanmail', 'nate', 'rediffmail', 'indiatimes',
  // Polish & Eastern Europe
  'wp', 'onet', 'interia', 'o2', 'seznam', 'centrum', 'abv', 'ukr', 'i',
  // North American Telcos & Cable
  'comcast', 'sbcglobal', 'verizon', 'att', 'bellsouth', 'cox', 'charter',
  'earthlink', 'optonline', 'frontier', 'windstream', 'centurytel', 'roadrunner',
  'shaw', 'rogers', 'sympatico', 'telus', 'bell'
]);

// Specific exact domain matches
export const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'gmail.co', 'gmail.fr', 'gmail.de', 'gmail.it', 'gmail.es', 'gmail.co.uk', 'gmail.ca', 'gmail.com.br', 'gmail.in', 'gmail.net', 'gmail.org',
  'yahoo.com', 'ymail.com', 'rocketmail.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.es', 'yahoo.it', 'yahoo.de', 'yahoo.co',
  'yahoo.com.br', 'yahoo.com.ar', 'yahoo.com.mx', 'yahoo.co.jp', 'yahoo.com.au', 'yahoo.com.ph', 'yahoo.co.in', 'yahoo.ca',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.es', 'hotmail.it', 'hotmail.de', 'hotmail.co',
  'outlook.com', 'outlook.co.uk', 'outlook.fr', 'outlook.es', 'outlook.de', 'outlook.jp', 'outlook.com.au', 'outlook.co',
  'live.com', 'live.co.uk', 'live.fr', 'live.it', 'live.de', 'live.ca', 'live.co', 'windowslive.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'aim.com', 'aol.co.uk', 'aol.de', 'aol.fr', 'aol.co',
  'protonmail.com', 'proton.me', 'pm.me', 'tutanota.com', 'tuta.io', 'tuta.com', 'mailfence.com',
  'zoho.com', 'zohomail.com', 'mail.com', 'email.com', 'usa.com',
  'gmx.com', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch', 'gmx.fr', 'gmx.co', 'web.de', 'freenet.de', 't-online.de', 'posteo.de',
  'yandex.com', 'yandex.ru', 'ya.ru', 'mail.ru', 'rambler.ru', 'list.ru', 'bk.ru', 'inbox.ru',
  'libero.it', 'virgilio.it', 'alice.it', 'tin.it', 'fastwebnet.it',
  // French Webmail & Telcos
  'wanadoo.fr', 'orange.fr', 'sfr.fr', 'free.fr', 'laposte.net', 'laposte.fr', 'numericable.fr', 'neuf.fr', 'aliceadsl.fr', 'club-internet.fr', 'bbox.fr', 'voila.fr', 'tele2.fr', 'noos.fr', 'libertysurf.fr', 'infonie.fr', 'cegetel.net', 'dartybox.com',
  'comcast.net', 'sbcglobal.net', 'verizon.net', 'att.net', 'bellsouth.net', 'cox.net', 'charter.net',
  'earthlink.net', 'optonline.net', 'frontier.com', 'windstream.net', 'centurytel.net',
  'shaw.ca', 'rogers.com', 'sympatico.ca', 'telus.net', 'bell.net',
  'btinternet.com', 'virginmedia.com', 'sky.com', 'talktalk.net', 'plus.net',
  'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br', 'globo.com', 'globomail.com',
  'qq.com', '163.com', '126.com', 'yeah.net', 'sina.com', 'sina.cn', 'sohu.com', 'aliyun.com', 'foxmail.com',
  'naver.com', 'daum.net', 'hanmail.net', 'nate.com',
  'rediffmail.com', 'indiatimes.com',
  'wp.pl', 'onet.pl', 'interia.pl', 'o2.pl', 'seznam.cz', 'centrum.cz', 'abv.bg', 'mail.bg', 'ukr.net', 'i.ua',
  'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.es', 'amazon.in', 'amazon.ca'
]);

/**
 * Checks if an email address or domain is a public/consumer webmail provider.
 * Accurately detects:
 * - Emails with @ (e.g. user@gmail.co, user@gmail.fr, user@wanadoo.fr)
 * - Any domain starting with or containing gmail (gmail.co, gmail.fr, gmail.anything, sub.gmail.com)
 * - Any provider ending with .fr, .co, .de, or any ccTLD/TLD (.anything)
 * - Specific regional webmail providers (orange.fr, wanadoo.fr, free.fr, sfr.fr, laposte.net, laposte.fr, etc.)
 */
export const isPublicDomain = (rawInput: string): boolean => {
  if (!rawInput) return false;
  let str = rawInput.toLowerCase().trim().replace(/^[<"'\(\[]+|[>"'\)\];,]+$/g, '');
  if (!str) return false;

  // Handle email addresses by extracting the domain part
  if (str.includes('@')) {
    const parts = str.split('@');
    str = parts[parts.length - 1].trim();
  }

  // Strip protocol, www, port, and trailing path
  const d = str.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0].split(':')[0].trim();
  if (!d || !d.includes('.')) return false;

  // 1. Direct match in explicit registry
  if (PUBLIC_DOMAINS.has(d)) return true;

  // 2. Direct match with subdomains (e.g. mail.gmail.com, webmail.orange.fr)
  for (const pub of PUBLIC_DOMAINS) {
    if (d === pub || d.endsWith('.' + pub)) return true;
  }

  // 3. Any gmail domain variation: gmail.co, gmail.fr, gmail.de, gmail.anything
  if (d === 'gmail' || d.startsWith('gmail.') || d.includes('.gmail.')) {
    return true;
  }

  // 4. Provider root check across ANY extension (.co, .fr, .de, .it, .es, .co.uk, .com.br, etc.)
  // Handles: gmail.co, gmail.fr, yahoo.fr, hotmail.fr, orange.fr, wanadoo.fr, free.fr, etc.
  const parts = d.split('.');
  if (parts.length >= 2) {
    // Root as first label (e.g. yahoo.fr, orange.fr)
    const rootName = parts[0];
    if (PUBLIC_PROVIDER_ROOTS.has(rootName)) {
      return true;
    }

    // Root in any position before TLD (e.g. webmail.orange.fr, imap.sfr.fr)
    for (let i = 0; i < parts.length - 1; i++) {
      if (PUBLIC_PROVIDER_ROOTS.has(parts[i])) {
        return true;
      }
    }
  }

  // 5. Universal regex for known webmail prefixes followed by any TLD/ccTLD
  if (/^(?:gmail|googlemail|yahoo|ymail|rocketmail|hotmail|outlook|live|msn|windowslive|icloud|aol|wanadoo|orange|laposte|sfr|free|bbox|numericable|neuf|aliceadsl|voila|tele2|noos|cegetel|gmx|web|freenet|t-online|posteo|mailbox|protonmail|proton|pm|tutanota|tuta|mailfence|zoho|zohomail|yandex|ya|rambler|libero|virgilio|fastwebnet|tiscali|uol|bol|terra|qq|163|126)\.[a-z0-9.-]+$/i.test(d)) {
    return true;
  }

  return false;
};
