/**
 * Country & Language Detection Engine
 * 
 * Accurately analyzes email domains, ccTLDs, country names, and returns:
 * - Country name (e.g., Germany, France, Japan)
 * - Country Code (e.g., DE, FR, JP)
 * - Standard Business Language (e.g., German, French, Japanese)
 * - Defaulting to English if international or unknown
 */

export interface CountryLanguageInfo {
  country: string;
  countryCode: string;
  language: string;
  isEnglishDefault: boolean;
}

// Country to official business language mapping
export const COUNTRY_TO_LANGUAGE_MAP: Record<string, { language: string; code: string }> = {
  // Germanic
  'germany': { language: 'German', code: 'DE' },
  'deutschland': { language: 'German', code: 'DE' },
  'austria': { language: 'German', code: 'AT' },
  'österreich': { language: 'German', code: 'AT' },
  'oesterreich': { language: 'German', code: 'AT' },
  'switzerland': { language: 'German', code: 'CH' },
  'schweiz': { language: 'German', code: 'CH' },
  'suisse': { language: 'French', code: 'CH' },
  'liechtenstein': { language: 'German', code: 'LI' },

  // Francophone
  'france': { language: 'French', code: 'FR' },
  'belgium': { language: 'French', code: 'BE' },
  'belgique': { language: 'French', code: 'BE' },
  'luxembourg': { language: 'French', code: 'LU' },
  'monaco': { language: 'French', code: 'MC' },

  // Hispanophone
  'spain': { language: 'Spanish', code: 'ES' },
  'españa': { language: 'Spanish', code: 'ES' },
  'espana': { language: 'Spanish', code: 'ES' },
  'mexico': { language: 'Spanish', code: 'MX' },
  'méxico': { language: 'Spanish', code: 'MX' },
  'argentina': { language: 'Spanish', code: 'AR' },
  'colombia': { language: 'Spanish', code: 'CO' },
  'chile': { language: 'Spanish', code: 'CL' },
  'peru': { language: 'Spanish', code: 'PE' },
  'perú': { language: 'Spanish', code: 'PE' },
  'venezuela': { language: 'Spanish', code: 'VE' },
  'ecuador': { language: 'Spanish', code: 'EC' },
  'guatemala': { language: 'Spanish', code: 'GT' },
  'cuba': { language: 'Spanish', code: 'CU' },
  'bolivia': { language: 'Spanish', code: 'BO' },
  'uruguay': { language: 'Spanish', code: 'UY' },
  'paraguay': { language: 'Spanish', code: 'PY' },
  'costa rica': { language: 'Spanish', code: 'CR' },
  'panama': { language: 'Spanish', code: 'PA' },

  // Italophone
  'italy': { language: 'Italian', code: 'IT' },
  'italia': { language: 'Italian', code: 'IT' },
  'san marino': { language: 'Italian', code: 'IT' },

  // Lusophone
  'portugal': { language: 'Portuguese', code: 'PT' },
  'brazil': { language: 'Portuguese', code: 'BR' },
  'brasil': { language: 'Portuguese', code: 'BR' },

  // Dutch
  'netherlands': { language: 'Dutch', code: 'NL' },
  'nederland': { language: 'Dutch', code: 'NL' },
  'holland': { language: 'Dutch', code: 'NL' },

  // Polish
  'poland': { language: 'Polish', code: 'PL' },
  'polska': { language: 'Polish', code: 'PL' },

  // Russian / Slavic
  'russia': { language: 'Russian', code: 'RU' },
  'ukraine': { language: 'Ukrainian', code: 'UA' },
  'belarus': { language: 'Russian', code: 'BY' },
  'kazakhstan': { language: 'Russian', code: 'KZ' },

  // Nordic
  'sweden': { language: 'Swedish', code: 'SE' },
  'sverige': { language: 'Swedish', code: 'SE' },
  'norway': { language: 'Norwegian', code: 'NO' },
  'norge': { language: 'Norwegian', code: 'NO' },
  'denmark': { language: 'Danish', code: 'DK' },
  'danmark': { language: 'Danish', code: 'DK' },
  'finland': { language: 'Finnish', code: 'FI' },
  'suomi': { language: 'Finnish', code: 'FI' },
  'iceland': { language: 'Icelandic', code: 'IS' },

  // Eastern & Southern Europe
  'czech republic': { language: 'Czech', code: 'CZ' },
  'czechia': { language: 'Czech', code: 'CZ' },
  'slovakia': { language: 'Slovak', code: 'SK' },
  'hungary': { language: 'Hungarian', code: 'HU' },
  'romania': { language: 'Romanian', code: 'RO' },
  'bulgaria': { language: 'Bulgarian', code: 'BG' },
  'greece': { language: 'Greek', code: 'GR' },

  // Asian
  'china': { language: 'Chinese', code: 'CN' },
  'taiwan': { language: 'Chinese', code: 'TW' },
  'hong kong': { language: 'Chinese', code: 'HK' },
  'japan': { language: 'Japanese', code: 'JP' },
  'nippon': { language: 'Japanese', code: 'JP' },
  'south korea': { language: 'Korean', code: 'KR' },
  'korea': { language: 'Korean', code: 'KR' },
  'vietnam': { language: 'Vietnamese', code: 'VN' },
  'thailand': { language: 'Thai', code: 'TH' },
  'indonesia': { language: 'Indonesian', code: 'ID' },
  'turkey': { language: 'Turkish', code: 'TR' },
  'türkiye': { language: 'Turkish', code: 'TR' },

  // Middle East / Arabic
  'saudi arabia': { language: 'Arabic', code: 'SA' },
  'uae': { language: 'Arabic', code: 'AE' },
  'united arab emirates': { language: 'Arabic', code: 'AE' },
  'egypt': { language: 'Arabic', code: 'EG' },
  'qatar': { language: 'Arabic', code: 'QA' },
  'kuwait': { language: 'Arabic', code: 'KW' },
  'israel': { language: 'Hebrew', code: 'IL' },

  // English-speaking
  'united states': { language: 'English', code: 'US' },
  'usa': { language: 'English', code: 'US' },
  'united kingdom': { language: 'English', code: 'GB' },
  'uk': { language: 'English', code: 'GB' },
  'great britain': { language: 'English', code: 'GB' },
  'england': { language: 'English', code: 'GB' },
  'canada': { language: 'English', code: 'CA' },
  'australia': { language: 'English', code: 'AU' },
  'new zealand': { language: 'English', code: 'NZ' },
  'ireland': { language: 'English', code: 'IE' },
  'singapore': { language: 'English', code: 'SG' },
  'india': { language: 'English', code: 'IN' },
  'south africa': { language: 'English', code: 'ZA' }
};

export function getLanguageForCountry(countryName?: string): string | null {
  if (!countryName) return null;
  const norm = countryName.toLowerCase().trim();
  if (COUNTRY_TO_LANGUAGE_MAP[norm]) return COUNTRY_TO_LANGUAGE_MAP[norm].language;
  for (const [key, val] of Object.entries(COUNTRY_TO_LANGUAGE_MAP)) {
    if (norm === key || norm.includes(key) || key.includes(norm)) {
      return val.language;
    }
  }
  return null;
}

/// Registry of specific popular international email providers and their languages
export const SPECIFIC_DOMAIN_LANGUAGE_MAP: Record<string, { country: string; code: string; language: string }> = {
  // Germany / Austria / Switzerland
  'gmx.de': { country: 'Germany', code: 'DE', language: 'German' },
  'gmx.net': { country: 'Germany', code: 'DE', language: 'German' },
  'gmx.at': { country: 'Austria', code: 'AT', language: 'German' },
  'gmx.ch': { country: 'Switzerland', code: 'CH', language: 'German' },
  'web.de': { country: 'Germany', code: 'DE', language: 'German' },
  't-online.de': { country: 'Germany', code: 'DE', language: 'German' },
  'freenet.de': { country: 'Germany', code: 'DE', language: 'German' },
  'posteo.de': { country: 'Germany', code: 'DE', language: 'German' },
  'arcor.de': { country: 'Germany', code: 'DE', language: 'German' },

  // France / Francophone
  'orange.fr': { country: 'France', code: 'FR', language: 'French' },
  'free.fr': { country: 'France', code: 'FR', language: 'French' },
  'sfr.fr': { country: 'France', code: 'FR', language: 'French' },
  'laposte.net': { country: 'France', code: 'FR', language: 'French' },
  'bbox.fr': { country: 'France', code: 'FR', language: 'French' },
  'wanadoo.fr': { country: 'France', code: 'FR', language: 'French' },

  // Italy
  'libero.it': { country: 'Italy', code: 'IT', language: 'Italian' },
  'virgilio.it': { country: 'Italy', code: 'IT', language: 'Italian' },
  'tim.it': { country: 'Italy', code: 'IT', language: 'Italian' },
  'alice.it': { country: 'Italy', code: 'IT', language: 'Italian' },
  'tiscali.it': { country: 'Italy', code: 'IT', language: 'Italian' },
  'fastwebnet.it': { country: 'Italy', code: 'IT', language: 'Italian' },

  // Spain / Hispanophone
  'terra.es': { country: 'Spain', code: 'ES', language: 'Spanish' },
  'telefonica.es': { country: 'Spain', code: 'ES', language: 'Spanish' },
  'movistar.es': { country: 'Spain', code: 'ES', language: 'Spanish' },
  'ya.com': { country: 'Spain', code: 'ES', language: 'Spanish' },

  // Russia / CIS
  'yandex.ru': { country: 'Russia', code: 'RU', language: 'Russian' },
  'yandex.com': { country: 'Russia', code: 'RU', language: 'Russian' },
  'ya.ru': { country: 'Russia', code: 'RU', language: 'Russian' },
  'mail.ru': { country: 'Russia', code: 'RU', language: 'Russian' },
  'rambler.ru': { country: 'Russia', code: 'RU', language: 'Russian' },
  'inbox.ru': { country: 'Russia', code: 'RU', language: 'Russian' },
  'bk.ru': { country: 'Russia', code: 'RU', language: 'Russian' },
  'list.ru': { country: 'Russia', code: 'RU', language: 'Russian' },

  // Poland
  'wp.pl': { country: 'Poland', code: 'PL', language: 'Polish' },
  'onet.pl': { country: 'Poland', code: 'PL', language: 'Polish' },
  'interia.pl': { country: 'Poland', code: 'PL', language: 'Polish' },
  'o2.pl': { country: 'Poland', code: 'PL', language: 'Polish' },
  'gazeta.pl': { country: 'Poland', code: 'PL', language: 'Polish' },

  // China
  '163.com': { country: 'China', code: 'CN', language: 'Chinese' },
  '126.com': { country: 'China', code: 'CN', language: 'Chinese' },
  'qq.com': { country: 'China', code: 'CN', language: 'Chinese' },
  'sina.com': { country: 'China', code: 'CN', language: 'Chinese' },
  'sina.cn': { country: 'China', code: 'CN', language: 'Chinese' },
  'sohu.com': { country: 'China', code: 'CN', language: 'Chinese' },

  // Japan
  'yahoo.co.jp': { country: 'Japan', code: 'JP', language: 'Japanese' },

  // Korea
  'naver.com': { country: 'South Korea', code: 'KR', language: 'Korean' },
  'daum.net': { country: 'South Korea', code: 'KR', language: 'Korean' },
  'hanmail.net': { country: 'South Korea', code: 'KR', language: 'Korean' },

  // Brazil / Lusophone
  'uol.com.br': { country: 'Brazil', code: 'BR', language: 'Portuguese' },
  'bol.com.br': { country: 'Brazil', code: 'BR', language: 'Portuguese' },
  'terra.com.br': { country: 'Brazil', code: 'BR', language: 'Portuguese' },
  'ig.com.br': { country: 'Brazil', code: 'BR', language: 'Portuguese' },
  'globo.com': { country: 'Brazil', code: 'BR', language: 'Portuguese' },

  // Netherlands
  'ziggo.nl': { country: 'Netherlands', code: 'NL', language: 'Dutch' },
  'kpnmail.nl': { country: 'Netherlands', code: 'NL', language: 'Dutch' },

  // Czech Republic
  'seznam.cz': { country: 'Czech Republic', code: 'CZ', language: 'Czech' },
  'centrum.cz': { country: 'Czech Republic', code: 'CZ', language: 'Czech' },

  // Turkey
  'mynet.com': { country: 'Turkey', code: 'TR', language: 'Turkish' }
};

// Registry of ccTLDs and associated business languages
const CCTLD_LANGUAGE_MAP: Record<string, { country: string; code: string; language: string }> = {
  // Western & Central Europe
  'de': { country: 'Germany', code: 'DE', language: 'German' },
  'at': { country: 'Austria', code: 'AT', language: 'German' },
  'ch': { country: 'Switzerland', code: 'CH', language: 'German' },
  'fr': { country: 'France', code: 'FR', language: 'French' },
  'es': { country: 'Spain', code: 'ES', language: 'Spanish' },
  'it': { country: 'Italy', code: 'IT', language: 'Italian' },
  'nl': { country: 'Netherlands', code: 'NL', language: 'Dutch' },
  'be': { country: 'Belgium', code: 'BE', language: 'French' },
  'lu': { country: 'Luxembourg', code: 'LU', language: 'French' },
  'pt': { country: 'Portugal', code: 'PT', language: 'Portuguese' },
  'pl': { country: 'Poland', code: 'PL', language: 'Polish' },
  'cz': { country: 'Czech Republic', code: 'CZ', language: 'Czech' },
  'sk': { country: 'Slovakia', code: 'SK', language: 'Slovak' },
  'hu': { country: 'Hungary', code: 'HU', language: 'Hungarian' },
  'ro': { country: 'Romania', code: 'RO', language: 'Romanian' },
  'bg': { country: 'Bulgaria', code: 'BG', language: 'Bulgarian' },
  'gr': { country: 'Greece', code: 'GR', language: 'Greek' },

  // Nordics
  'se': { country: 'Sweden', code: 'SE', language: 'Swedish' },
  'no': { country: 'Norway', code: 'NO', language: 'Norwegian' },
  'dk': { country: 'Denmark', code: 'DK', language: 'Danish' },
  'fi': { country: 'Finland', code: 'FI', language: 'Finnish' },
  'is': { country: 'Iceland', code: 'IS', language: 'Icelandic' },

  // Americas
  'br': { country: 'Brazil', code: 'BR', language: 'Portuguese' },
  'mx': { country: 'Mexico', code: 'MX', language: 'Spanish' },
  'ar': { country: 'Argentina', code: 'AR', language: 'Spanish' },
  'cl': { country: 'Chile', code: 'CL', language: 'Spanish' },
  'co': { country: 'Colombia', code: 'CO', language: 'Spanish' },
  'pe': { country: 'Peru', code: 'PE', language: 'Spanish' },
  'uy': { country: 'Uruguay', code: 'UY', language: 'Spanish' },
  've': { country: 'Venezuela', code: 'VE', language: 'Spanish' },
  'ec': { country: 'Ecuador', code: 'EC', language: 'Spanish' },
  'cr': { country: 'Costa Rica', code: 'CR', language: 'Spanish' },
  'pa': { country: 'Panama', code: 'PA', language: 'Spanish' },

  // Asia / Middle East / Others
  'jp': { country: 'Japan', code: 'JP', language: 'Japanese' },
  'kr': { country: 'South Korea', code: 'KR', language: 'Korean' },
  'cn': { country: 'China', code: 'CN', language: 'Chinese' },
  'tw': { country: 'Taiwan', code: 'TW', language: 'Chinese' },
  'hk': { country: 'Hong Kong', code: 'HK', language: 'Chinese' },
  'vn': { country: 'Vietnam', code: 'VN', language: 'Vietnamese' },
  'th': { country: 'Thailand', code: 'TH', language: 'Thai' },
  'id': { country: 'Indonesia', code: 'ID', language: 'Indonesian' },
  'tr': { country: 'Turkey', code: 'TR', language: 'Turkish' },
  'ru': { country: 'Russia', code: 'RU', language: 'Russian' },
  'ua': { country: 'Ukraine', code: 'UA', language: 'Ukrainian' },
  'ae': { country: 'United Arab Emirates', code: 'AE', language: 'Arabic' },
  'sa': { country: 'Saudi Arabia', code: 'SA', language: 'Arabic' },
  'eg': { country: 'Egypt', code: 'EG', language: 'Arabic' },
  'il': { country: 'Israel', code: 'IL', language: 'Hebrew' },

  // English-speaking
  'uk': { country: 'United Kingdom', code: 'GB', language: 'English' },
  'us': { country: 'United States', code: 'US', language: 'English' },
  'ca': { country: 'Canada', code: 'CA', language: 'English' },
  'au': { country: 'Australia', code: 'AU', language: 'English' },
  'nz': { country: 'New Zealand', code: 'NZ', language: 'English' },
  'ie': { country: 'Ireland', code: 'IE', language: 'English' },
  'za': { country: 'South Africa', code: 'ZA', language: 'English' },
  'sg': { country: 'Singapore', code: 'SG', language: 'English' },
  'in': { country: 'India', code: 'IN', language: 'English' },
};

/**
 * Extracts country and language from an email address or domain, with optional country hint.
 * Defaults cleanly to English if not a specific non-English country.
 */
export function detectCountryAndLanguage(emailOrDomain: string, countryHint?: string): CountryLanguageInfo {
  // If country hint provided, resolve language from country name
  if (countryHint && countryHint !== 'N/A' && countryHint !== 'International' && countryHint !== 'Unknown') {
    const hintNorm = countryHint.toLowerCase().trim();
    if (COUNTRY_TO_LANGUAGE_MAP[hintNorm]) {
      const match = COUNTRY_TO_LANGUAGE_MAP[hintNorm];
      return {
        country: countryHint,
        countryCode: match.code,
        language: match.language,
        isEnglishDefault: match.language === 'English'
      };
    }
    const resolvedLang = getLanguageForCountry(countryHint);
    if (resolvedLang) {
      return {
        country: countryHint,
        countryCode: 'INTL',
        language: resolvedLang,
        isEnglishDefault: resolvedLang === 'English'
      };
    }
  }

  if (!emailOrDomain) {
    return {
      country: countryHint || 'International',
      countryCode: 'GLOBAL',
      language: 'English',
      isEnglishDefault: true
    };
  }

  const clean = emailOrDomain.toLowerCase().trim();
  const domain = clean.includes('@') ? clean.split('@')[1] : clean;

  // Check specific domain matches first (e.g. gmx.de, orange.fr, libero.it, 163.com, etc.)
  if (SPECIFIC_DOMAIN_LANGUAGE_MAP[domain]) {
    const match = SPECIFIC_DOMAIN_LANGUAGE_MAP[domain];
    return {
      country: countryHint || match.country,
      countryCode: match.code,
      language: match.language,
      isEnglishDefault: match.language === 'English'
    };
  }

  const parts = domain.split('.');

  if (parts.length >= 2) {
    const lastTld = parts[parts.length - 1];
    const secondTld = parts.length >= 3 ? parts[parts.length - 2] : '';

    // Check for last TLD match
    if (CCTLD_LANGUAGE_MAP[lastTld]) {
      const match = CCTLD_LANGUAGE_MAP[lastTld];
      return {
        country: countryHint || match.country,
        countryCode: match.code,
        language: match.language,
        isEnglishDefault: match.language === 'English'
      };
    }

    // Check for combined second-level TLD e.g. co.uk, com.au, com.de, etc.
    if (secondTld && CCTLD_LANGUAGE_MAP[secondTld]) {
      const match = CCTLD_LANGUAGE_MAP[secondTld];
      return {
        country: countryHint || match.country,
        countryCode: match.code,
        language: match.language,
        isEnglishDefault: match.language === 'English'
      };
    }
  }

  // Generic / Default (e.g. .com, .org, .net, .io, .ai, .biz, .co) -> English
  return {
    country: countryHint || 'International',
    countryCode: 'GLOBAL',
    language: 'English',
    isEnglishDefault: true
  };
}
