import type express from 'express';
import {
  crawlCompanyDomain,
  searchGoogleForCompanyEmails,
  normalizeDomain,
  findOfficialWebsiteForCompany,
  findOfficialWebsitesBatch,
  type CrawlDomainOptions,
  type CompanySearchQuery
} from './companyDiscoveryService';
import { dbCompanyDiscoveries, type CompanyDiscoverySessionRecord } from './db';
import type { AuthRequest } from './auth';

export function registerCompanyDiscoveryRoutes(app: express.Express): void {
  // 1. Crawl Single Domain
  app.post('/api/company-discovery/crawl', async (req, res) => {
    try {
      const { domain, maxPages, timeoutMs, politeDelayMs, searchGoogleIfNoEmail, strictCorporateFilter } = req.body || {};
      if (!domain || typeof domain !== 'string' || !domain.trim()) {
        return res.status(400).json({ error: 'Valid domain is required' });
      }

      const options: CrawlDomainOptions = {
        maxPages: Math.min(15, Math.max(1, parseInt(maxPages) || 6)),
        timeoutMs: Math.min(15000, Math.max(3000, parseInt(timeoutMs) || 8000)),
        politeDelayMs: Math.min(2000, Math.max(50, parseInt(politeDelayMs) || 200)),
        searchGoogleIfNoEmail: searchGoogleIfNoEmail !== false,
        strictCorporateFilter: strictCorporateFilter !== false
      };

      const result = await crawlCompanyDomain(domain, options);
      res.json({
        success: true,
        result
      });
    } catch (err: any) {
      console.error('[Company Discovery] Crawl error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'Failed to crawl domain' });
    }
  });

  // 2. Dedicated Google Search Fallback Endpoint
  app.post('/api/company-discovery/google-search', async (req, res) => {
    try {
      const { domain, companyName } = req.body || {};
      if (!domain || typeof domain !== 'string' || !domain.trim()) {
        return res.status(400).json({ error: 'Valid domain is required' });
      }

      const cleanDomain = normalizeDomain(domain);
      const records = await searchGoogleForCompanyEmails(cleanDomain, companyName);

      res.json({
        success: true,
        domain: cleanDomain,
        companyName: companyName || cleanDomain.split('.')[0].toUpperCase(),
        records,
        emailsFound: records.length
      });
    } catch (err: any) {
      console.error('[Company Discovery] Google search endpoint error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'Google search fallback failed' });
    }
  });

  // 3. Crawl Batch of Domains with Controlled Concurrency
  app.post('/api/company-discovery/batch', async (req, res) => {
    try {
      const { domains, maxPages, timeoutMs, politeDelayMs, concurrency, searchGoogleIfNoEmail, strictCorporateFilter } = req.body || {};
      if (!Array.isArray(domains) || domains.length === 0) {
        return res.status(400).json({ error: 'Array of domains is required' });
      }

      const cleanDomains = domains
        .map(d => typeof d === 'string' ? d.trim() : '')
        .filter(d => d.length > 0)
        .slice(0, 500); // Max 500 in single HTTP request

      const options: CrawlDomainOptions = {
        maxPages: Math.min(15, Math.max(1, parseInt(maxPages) || 5)),
        timeoutMs: Math.min(12000, Math.max(3000, parseInt(timeoutMs) || 7000)),
        politeDelayMs: Math.min(1500, Math.max(50, parseInt(politeDelayMs) || 150)),
        searchGoogleIfNoEmail: searchGoogleIfNoEmail !== false,
        strictCorporateFilter: strictCorporateFilter !== false
      };

      const workerCount = Math.min(10, Math.max(1, parseInt(concurrency) || 3));
      const results: any[] = [];
      let currentIndex = 0;

      const worker = async () => {
        while (currentIndex < cleanDomains.length) {
          const idx = currentIndex++;
          const targetDomain = cleanDomains[idx];
          try {
            const domainRes = await crawlCompanyDomain(targetDomain, options);
            results.push(domainRes);
          } catch (err: any) {
            results.push({
              domain: targetDomain,
              website: `https://${targetDomain}`,
              companyName: targetDomain,
              status: 'unavailable',
              pagesScanned: 0,
              emailsCount: 0,
              error: err?.message || 'Worker error',
              records: [],
              crawledPages: []
            });
          }
        }
      };

      const workers = Array.from({ length: Math.min(workerCount, cleanDomains.length) }, () => worker());
      await Promise.all(workers);

      res.json({
        success: true,
        results
      });
    } catch (err: any) {
      console.error('[Company Discovery] Batch crawl error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'Failed to execute batch crawl' });
    }
  });

  // 4. Find Official Website for Company Name & Product (Single)
  app.post('/api/company-discovery/find-website', async (req, res) => {
    try {
      const { companyName, productsOrServices, countryOrLocation, industry, discoverEmails } = req.body || {};
      if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
        return res.status(400).json({ error: 'Company name is required' });
      }

      const result = await findOfficialWebsiteForCompany(
        {
          companyName: companyName.trim(),
          productsOrServices: typeof productsOrServices === 'string' ? productsOrServices.trim() : undefined,
          countryOrLocation: typeof countryOrLocation === 'string' ? countryOrLocation.trim() : undefined,
          industry: typeof industry === 'string' ? industry.trim() : undefined
        },
        {
          discoverEmails: discoverEmails !== false
        }
      );

      res.json({
        success: true,
        result
      });
    } catch (err: any) {
      console.error('[Company Discovery] Find website error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'Failed to find company website' });
    }
  });

  // 5. Batch Find Official Websites for Multiple Companies
  app.post('/api/company-discovery/find-websites-batch', async (req, res) => {
    try {
      const { companies, discoverEmails, concurrency } = req.body || {};
      if (!Array.isArray(companies) || companies.length === 0) {
        return res.status(400).json({ error: 'Array of company queries is required' });
      }

      const cleanQueries: CompanySearchQuery[] = companies
        .filter(c => c && (typeof c === 'string' || typeof c.companyName === 'string'))
        .map((c, i) => {
          if (typeof c === 'string') {
            return { id: `comp_${i}`, companyName: c.trim() };
          }
          return {
            id: c.id || `comp_${i}`,
            companyName: (c.companyName || '').trim(),
            productsOrServices: c.productsOrServices ? String(c.productsOrServices).trim() : undefined,
            countryOrLocation: c.countryOrLocation ? String(c.countryOrLocation).trim() : undefined,
            industry: c.industry ? String(c.industry).trim() : undefined
          };
        })
        .filter(c => c.companyName.length > 0)
        .slice(0, 300);

      const results = await findOfficialWebsitesBatch(
        cleanQueries,
        {
          discoverEmails: discoverEmails !== false,
          concurrency: Math.min(5, Math.max(1, parseInt(concurrency) || 2))
        }
      );

      res.json({
        success: true,
        results
      });
    } catch (err: any) {
      console.error('[Company Discovery] Batch find websites error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'Failed to batch search company websites' });
    }
  });

  // 6. Save Project / Session to Database
  app.post('/api/company-discovery/save', (req: AuthRequest, res) => {
    try {
      const payload = req.body?.session ? req.body.session : req.body;
      const { title, totalDomains, websitesAccessed, websitesUnavailable, totalPagesScanned, totalEmailsFound, uniqueEmailsFound, companiesWithoutEmails, domains, records, config } = payload || {};

      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Project title is required' });
      }

      const userId = req.user?.id || 'anonymous';
      const session = dbCompanyDiscoveries.saveSession({
        title: title.trim(),
        totalDomains: totalDomains || 0,
        websitesAccessed: websitesAccessed || 0,
        websitesUnavailable: websitesUnavailable || 0,
        totalPagesScanned: totalPagesScanned || 0,
        totalEmailsFound: totalEmailsFound || 0,
        uniqueEmailsFound: uniqueEmailsFound || 0,
        companiesWithoutEmails: companiesWithoutEmails || 0,
        domains: Array.isArray(domains) ? domains : [],
        records: Array.isArray(records) ? records : [],
        config,
        userId
      });

      res.json({
        success: true,
        session
      });
    } catch (err: any) {
      console.error('[Company Discovery] Save error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'Failed to save discovery project' });
    }
  });

  // 4. List Saved Discovery Sessions
  app.get('/api/company-discovery/sessions', (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      const sessions = dbCompanyDiscoveries.listSessions(userId).map(s => ({
        id: s.id,
        title: s.title,
        totalDomains: s.totalDomains,
        websitesAccessed: s.websitesAccessed,
        websitesUnavailable: s.websitesUnavailable,
        totalPagesScanned: s.totalPagesScanned,
        totalEmailsFound: s.totalEmailsFound,
        uniqueEmailsFound: s.uniqueEmailsFound,
        companiesWithoutEmails: s.companiesWithoutEmails,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        recordsCount: s.records?.length || 0
      }));

      res.json({
        success: true,
        sessions
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list discovery sessions' });
    }
  });

  // 5. Get Discovery Session Details
  app.get('/api/company-discovery/sessions/:id', (req, res) => {
    try {
      const session = dbCompanyDiscoveries.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'Discovery project not found' });
      }
      res.json({
        success: true,
        session
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to get discovery session' });
    }
  });

  // 6. Delete Discovery Session
  app.delete('/api/company-discovery/sessions/:id', (req, res) => {
    try {
      const deleted = dbCompanyDiscoveries.deleteSession(req.params.id);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete discovery session' });
    }
  });
}
