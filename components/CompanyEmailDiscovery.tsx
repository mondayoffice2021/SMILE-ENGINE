import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Globe,
  Search,
  Upload,
  FolderOpen,
  FileText,
  Play,
  Pause,
  Square,
  RotateCcw,
  Download,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Sparkles,
  Layers,
  Database,
  Building2,
  Phone,
  Link as LinkIcon,
  Clock,
  Settings2,
  Send,
  ShieldCheck,
  Trash2,
  Save,
  ChevronDown,
  ChevronRight,
  Eye,
  RefreshCw,
  Mail,
  CloudUpload,
  FileSpreadsheet,
  Wand2,
  ListFilter,
  SlidersHorizontal,
  Briefcase,
  Package,
  MapPin,
  ArrowRight,
  SearchCheck,
  FileCheck,
  CheckCheck
} from 'lucide-react';
import type { DiscoveredEmailRecord, DomainCrawlStatusRecord, CompanyDiscoverySessionRecord } from '../server/db';
import {
  parseDomainsFromText,
  parseDomainsFromFile,
  extractWebsitesFromMixedText,
  extractWebsitesFromFile,
  type WebsiteSeparatorOptions,
  type ExtractedWebsiteItem,
  type WebsiteExtractionResult,
  crawlDomainApi,
  saveDiscoverySessionApi,
  listDiscoverySessionsApi,
  getDiscoverySessionApi,
  deleteDiscoverySessionApi,
  exportDiscoveryToExcel,
  exportDiscoveryToCsv,
  exportDiscoveryToTxt,
  exportCleanEmailsTxt,
  exportCleanEmailsCsv,
  exportDiscoveryCategoriesZip,
  searchGoogleForDomainApi,
  DEFAULT_DISCOVERY_CONFIG,
  EMAIL_CATEGORIES_LIST,
  type DiscoveryCrawlerConfig,
  type DomainDiscoveryResult,
  type CompanySearchQuery,
  type CompanySearchResult,
  findOfficialWebsiteApi,
  findOfficialWebsitesBatchApi,
  parseCompanyNamesFromText,
  parseCompanyNamesFromFile,
  exportCompanySearchResultsToExcel,
  exportCompanySearchResultsToCsv,
  exportVerifiedWebsitesTxt,
  exportCompanyResearchEmailsTxt
} from '../services/companyDiscoveryClient';
import { CloudFileHubBar } from './CloudFileHubBar';
import { SessionRecoveryBanner } from './SessionRecoveryBanner';
import { saveSessionCheckpoint, clearSessionCheckpoint, type SessionCheckpoint } from '../services/checkpointClient';
import { uploadToCloudFiles, type CloudFileRecord } from '../services/cloudFilesClient';
import type { UserProfile } from '../services/serverApiClient';
import type { ExtractedEmail } from '../types';

interface CompanyEmailDiscoveryProps {
  showToast: (msg: string) => void;
  onSendToValidator?: (emails: string[]) => void;
  onSendToEmailSender?: (leads: ExtractedEmail[]) => void;
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  onNavigateToServerJobs?: () => void;
}

export const CompanyEmailDiscovery: React.FC<CompanyEmailDiscoveryProps> = ({
  showToast,
  onSendToValidator,
  onSendToEmailSender,
  currentUser,
  onOpenAuth,
  onNavigateToServerJobs
}) => {
  // Input & Upload State
  const [inputText, setInputText] = useState<string>('');
  const [totalRawInputCount, setTotalRawInputCount] = useState<number>(0);
  const [domainQueue, setDomainQueue] = useState<string[]>([]);
  const [projectName, setProjectName] = useState<string>('Company Email Discovery');

  // Cloud Hub & Checkpoint references
  const [activeCloudFileId, setActiveCloudFileId] = useState<string | null>(null);
  const [activeCloudFileName, setActiveCloudFileName] = useState<string | null>(null);
  const [checkpointRefreshKey, setCheckpointRefreshKey] = useState<number>(0);

  // Crawler Configuration State
  const [config, setConfig] = useState<DiscoveryCrawlerConfig>({ ...DEFAULT_DISCOVERY_CONFIG });
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  // Crawling Engine State
  const [isCrawling, setIsCrawling] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [processedIndex, setProcessedIndex] = useState<number>(0);
  const [activeWorkers, setActiveWorkers] = useState<string[]>([]);
  const [crawlStartTime, setCrawlStartTime] = useState<number | null>(null);
  const [crawlSpeed, setCrawlSpeed] = useState<string>('0');

  // Results State
  const [domainsStatus, setDomainsStatus] = useState<DomainCrawlStatusRecord[]>([]);
  const [discoveredRecords, setDiscoveredRecords] = useState<DiscoveredEmailRecord[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [companyStatusFilter, setCompanyStatusFilter] = useState<'all' | 'with_emails' | 'no_emails' | 'unavailable'>('all');
  const [deduplicateEmails, setDeduplicateEmails] = useState<boolean>(true);
  const [viewTab, setViewTab] = useState<'emails' | 'companies' | 'saved_sessions'>('emails');

  // Expanded inspection rows
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Saved Database Sessions State
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isSavingSession, setIsSavingSession] = useState<boolean>(false);

  // Google Search Fallback State
  const [searchingDomain, setSearchingDomain] = useState<string | null>(null);
  const [isBatchGoogleSearching, setIsBatchGoogleSearching] = useState<boolean>(false);

  // Email Selection & Save Modals State
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [saveModalTab, setSaveModalTab] = useState<'emails' | 'all'>('emails');
  const [isUploadingEmailsToCloud, setIsUploadingEmailsToCloud] = useState<boolean>(false);

  // Website Separator Studio State
  const [isSeparatorModalOpen, setIsSeparatorModalOpen] = useState<boolean>(false);
  const [separatorInputText, setSeparatorInputText] = useState<string>('');
  const [separatorOptions, setSeparatorOptions] = useState<WebsiteSeparatorOptions>({
    cleanToRootDomain: true,
    excludeFreeEmailDomains: true,
    excludeSocialMedia: true,
    extractFromCorporateEmail: false,
    removeDuplicates: true
  });
  const separatorFileInputRef = useRef<HTMLInputElement>(null);

  // Compute live extracted websites from separator input
  const separatorResult = useMemo(() => {
    return extractWebsitesFromMixedText(separatorInputText, separatorOptions);
  }, [separatorInputText, separatorOptions]);

  // Check if main input text contains mixed data/fields
  const hasMixedText = useMemo(() => {
    if (!inputText || inputText.trim().length === 0) return false;
    return /[,;\t|]|@|https?:\/\/|www\./.test(inputText) || inputText.split('\n').some(l => l.trim().split(/\s+/).length > 2);
  }, [inputText]);

  // Quick separate websites from main input
  const handleQuickSeparateWebsites = () => {
    const res = extractWebsitesFromMixedText(inputText, {
      cleanToRootDomain: true,
      excludeFreeEmailDomains: true,
      excludeSocialMedia: true,
      extractFromCorporateEmail: false,
      removeDuplicates: true
    });
    if (res.uniqueDomains.length === 0) {
      showToast("No company websites found in the input text.");
      return;
    }
    setInputText(res.uniqueDomains.join('\n'));
    setDomainQueue(res.uniqueDomains);
    setTotalRawInputCount(res.rawTotalFields);
    showToast(`✓ Extracted ${res.uniqueDomains.length.toLocaleString()} clean websites! Filtered out ${res.filteredOutCount.toLocaleString()} non-website fields.`);
  };

  // Upload file specifically to Separator Studio
  const handleSeparatorFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast(`Separating websites from ${file.name}...`);
      const res = await extractWebsitesFromFile(file, separatorOptions);
      if (res.uniqueDomains.length === 0) {
        showToast(`No company websites found in ${file.name}.`);
        return;
      }
      setSeparatorInputText(res.uniqueDomains.join('\n'));
      showToast(`✓ Extracted ${res.uniqueDomains.length.toLocaleString()} websites from ${file.name}! Filtered out ${res.filteredOutCount.toLocaleString()} other fields.`);
    } catch (err: any) {
      showToast(`Failed to parse file: ${err.message || 'Error'}`);
    } finally {
      if (separatorFileInputRef.current) separatorFileInputRef.current.value = '';
    }
  };

  // Apply Separator results to Crawler Queue
  const handleApplySeparatorToQueue = () => {
    const websites = separatorOptions.cleanToRootDomain ? separatorResult.uniqueDomains : separatorResult.uniqueWebsites;
    if (websites.length === 0) {
      showToast("No websites extracted to load.");
      return;
    }
    setInputText(websites.join('\n'));
    setDomainQueue(separatorResult.uniqueDomains);
    setTotalRawInputCount(separatorResult.rawTotalFields);
    setIsSeparatorModalOpen(false);
    showToast(`✓ Loaded ${websites.length.toLocaleString()} separated websites into crawler queue!`);
  };

  // Download extracted websites as clean TXT
  const handleDownloadExtractedWebsitesTxt = () => {
    const websites = separatorOptions.cleanToRootDomain ? separatorResult.uniqueDomains : separatorResult.uniqueWebsites;
    if (websites.length === 0) {
      showToast("No websites to export.");
      return;
    }
    const blob = new Blob([websites.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `separated_websites_${websites.length}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ Downloaded ${websites.length.toLocaleString()} extracted websites as TXT!`);
  };

  // Download extracted websites as CSV
  const handleDownloadExtractedWebsitesCsv = () => {
    if (separatorResult.items.length === 0) {
      showToast("No websites to export.");
      return;
    }
    const headers = ['#', 'Clean Domain', 'Full Website', 'Source Field', 'Original Raw Text'];
    const rows = separatorResult.items.map((item, idx) => [
      idx + 1,
      `"${item.cleanDomain}"`,
      `"${item.fullWebsite}"`,
      `"${(item.fieldName || '').replace(/"/g, '""')}"`,
      `"${(item.sourceText || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `separated_websites_${separatorResult.items.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ Downloaded ${separatorResult.items.length.toLocaleString()} extracted websites as CSV!`);
  };

  // Control Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ==========================================================================
  // COMPANY NAME & PRODUCT SEARCH ENGINE WEBSITE FINDER STATE & HANDLERS
  // ==========================================================================
  const [activeWorkspaceMode, setActiveWorkspaceMode] = useState<'crawler' | 'company_finder'>('crawler');
  const [companyInputText, setCompanyInputText] = useState<string>('');
  const [companyQueries, setCompanyQueries] = useState<CompanySearchQuery[]>([]);
  const [companyResults, setCompanyResults] = useState<CompanySearchResult[]>([]);
  const [isSearchingCompanies, setIsSearchingCompanies] = useState<boolean>(false);
  const [isCompanySearchPaused, setIsCompanySearchPaused] = useState<boolean>(false);
  const [companyProgressIndex, setCompanyProgressIndex] = useState<number>(0);
  const [companyActiveWorkers, setCompanyActiveWorkers] = useState<string[]>([]);
  const [companyDiscoverEmails, setCompanyDiscoverEmails] = useState<boolean>(true);
  const [companyConcurrency, setCompanyConcurrency] = useState<number>(2);
  const [companyFinderStatusFilter, setCompanyFinderStatusFilter] = useState<'all' | 'verified' | 'probable' | 'with_emails' | 'no_website'>('all');
  const [companySearchTerm, setCompanySearchTerm] = useState<string>('');
  const [companyDetectedColumns, setCompanyDetectedColumns] = useState<string[] | undefined>();
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const companyFileInputRef = useRef<HTMLInputElement>(null);
  const companyAbortControllerRef = useRef<AbortController | null>(null);
  const isCompanySearchPausedRef = useRef<boolean>(false);

  useEffect(() => {
    isCompanySearchPausedRef.current = isCompanySearchPaused;
  }, [isCompanySearchPaused]);

  // Company Name Text Input Handler
  const handleCompanyTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCompanyInputText(val);
    const parsed = parseCompanyNamesFromText(val);
    setCompanyQueries(parsed.queries);
    setCompanyDetectedColumns(parsed.detectedColumns);
  };

  // Company Name File Upload Handler (TXT, CSV, XLSX, XLS)
  const handleCompanyFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast(`Parsing company names & products from ${file.name}...`);
      const parsed = await parseCompanyNamesFromFile(file);

      // Auto-upload to central cloud storage
      uploadToCloudFiles(file, 'company-discovery').catch(() => {});

      if (parsed.queries.length === 0) {
        showToast(`No company names found in ${file.name}.`);
        return;
      }

      setCompanyQueries(parsed.queries);
      setCompanyDetectedColumns(parsed.detectedColumns);
      setCompanyInputText(
        parsed.queries.map(q => {
          let line = q.companyName;
          if (q.productsOrServices) line += ` - ${q.productsOrServices}`;
          if (q.countryOrLocation) line += ` - ${q.countryOrLocation}`;
          return line;
        }).join('\n')
      );

      const colMsg = parsed.detectedColumns && parsed.detectedColumns.length > 0
        ? ` (Mapped: ${parsed.detectedColumns.slice(0, 3).join(', ')})`
        : '';
      showToast(`✓ Loaded ${parsed.queries.length.toLocaleString()} companies from ${file.name}!${colMsg}`);
    } catch (err: any) {
      showToast(`Error parsing company file: ${err?.message || 'Failed to read file'}`);
    } finally {
      if (companyFileInputRef.current) companyFileInputRef.current.value = '';
    }
  };

  // Start Company Search Engine Research
  const handleStartCompanySearch = async () => {
    if (companyQueries.length === 0) {
      showToast("Please enter or upload company names to research.");
      return;
    }

    setIsSearchingCompanies(true);
    setIsCompanySearchPaused(false);
    isCompanySearchPausedRef.current = false;
    companyAbortControllerRef.current = new AbortController();

    const startIdx = companyProgressIndex >= companyQueries.length ? 0 : companyProgressIndex;
    if (startIdx === 0) {
      setCompanyProgressIndex(0);
    }

    showToast(`Searching Google & multi-engine for official websites across ${companyQueries.length - startIdx} companies...`);

    const queue = companyQueries.slice(startIdx);
    const workersCount = Math.min(companyConcurrency, queue.length);

    const runWorker = async (workerId: number) => {
      while (queue.length > 0 && !companyAbortControllerRef.current?.signal.aborted) {
        if (isCompanySearchPausedRef.current) {
          await new Promise(r => setTimeout(r, 300));
          continue;
        }

        const query = queue.shift();
        if (!query) break;

        setCompanyActiveWorkers(prev => [...prev.filter(w => !w.startsWith(`W${workerId}:`)), `W${workerId}: ${query.companyName}`]);

        try {
          const res = await findOfficialWebsiteApi(
            query,
            { discoverEmails: companyDiscoverEmails },
            companyAbortControllerRef.current?.signal
          );

          setCompanyResults(prev => {
            const idx = prev.findIndex(p => p.id === res.id || p.companyName.toLowerCase() === res.companyName.toLowerCase());
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = res;
              return copy;
            }
            return [...prev, res];
          });
        } catch (err: any) {
          if (err.name === 'AbortError') break;
          const fallbackRes: CompanySearchResult = {
            id: query.id || `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            companyName: query.companyName,
            productsOrServices: query.productsOrServices,
            countryOrLocation: query.countryOrLocation,
            industry: query.industry,
            confidenceScore: 0,
            verificationStatus: 'no_website_found',
            verificationReason: err?.message || 'Search timeout',
            discoveredEmails: [],
            searchedAt: new Date().toISOString()
          };
          setCompanyResults(prev => {
            const idx = prev.findIndex(p => p.companyName.toLowerCase() === query.companyName.toLowerCase());
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = fallbackRes;
              return copy;
            }
            return [...prev, fallbackRes];
          });
        }

        setCompanyProgressIndex(prev => prev + 1);
        setCompanyActiveWorkers(prev => prev.filter(w => !w.startsWith(`W${workerId}:`)));

        // Polite delay between queries
        await new Promise(r => setTimeout(r, 350));
      }
    };

    try {
      const workers = Array.from({ length: workersCount }, (_, i) => runWorker(i + 1));
      await Promise.all(workers);
      if (!companyAbortControllerRef.current?.signal.aborted) {
        showToast("✓ Search engine research completed for all company names!");
      }
    } finally {
      setIsSearchingCompanies(false);
      setCompanyActiveWorkers([]);
    }
  };

  const handleToggleCompanyPause = () => {
    setIsCompanySearchPaused(prev => !prev);
  };

  const handleStopCompanySearch = () => {
    if (companyAbortControllerRef.current) {
      companyAbortControllerRef.current.abort();
    }
    setIsSearchingCompanies(false);
    setIsCompanySearchPaused(false);
    setCompanyActiveWorkers([]);
    showToast("Search engine research stopped.");
  };

  const handleClearCompanySearch = () => {
    if (isSearchingCompanies) handleStopCompanySearch();
    setCompanyInputText('');
    setCompanyQueries([]);
    setCompanyResults([]);
    setCompanyProgressIndex(0);
    setCompanyDetectedColumns(undefined);
    showToast("Cleared company research workbench.");
  };

  // Transfer Verified Websites to Direct Domain Crawler
  const handleTransferVerifiedWebsitesToCrawler = () => {
    const verifiedDomains = companyResults
      .filter(r => r.cleanDomain && (r.verificationStatus === 'verified_official' || r.verificationStatus === 'probable_match'))
      .map(r => r.cleanDomain!.toLowerCase());

    const unique = Array.from(new Set(verifiedDomains));
    if (unique.length === 0) {
      showToast("No verified official company websites found to transfer.");
      return;
    }

    setDomainQueue(prev => Array.from(new Set([...prev, ...unique])));
    setInputText(prev => {
      const existing = prev ? prev.split('\n').map(s => s.trim()).filter(Boolean) : [];
      return Array.from(new Set([...existing, ...unique])).join('\n');
    });
    setActiveWorkspaceMode('crawler');
    showToast(`✓ Transferred ${unique.length.toLocaleString()} verified company websites into Deep Subpage Crawler!`);
  };

  // Save / Export Handlers for Company Finder
  const handleExportCompanyExcel = () => {
    if (companyResults.length === 0) {
      showToast("No researched company results to export.");
      return;
    }
    exportCompanySearchResultsToExcel(companyResults, `${projectName}_Companies_Websites_Report`);
    showToast(`✓ Exported ${companyResults.length.toLocaleString()} researched companies to Excel!`);
  };

  const handleExportCompanyCsv = () => {
    if (companyResults.length === 0) {
      showToast("No researched company results to export.");
      return;
    }
    exportCompanySearchResultsToCsv(companyResults, `${projectName}_companies.csv`);
    showToast(`✓ Exported ${companyResults.length.toLocaleString()} companies to CSV!`);
  };

  const handleExportCompanyWebsitesTxt = (cleanOnly = true) => {
    const verified = companyResults.filter(r => r.cleanDomain && (r.verificationStatus === 'verified_official' || r.verificationStatus === 'probable_match'));
    if (verified.length === 0) {
      showToast("No verified websites to export.");
      return;
    }
    exportVerifiedWebsitesTxt(companyResults, `${projectName}_verified_websites.txt`, cleanOnly);
    showToast(`✓ Exported ${verified.length.toLocaleString()} verified websites to TXT!`);
  };

  const handleExportCompanyEmailsTxt = () => {
    let count = 0;
    companyResults.forEach(r => { count += r.discoveredEmails.length; });
    if (count === 0) {
      showToast("No discovered corporate emails to export.");
      return;
    }
    exportCompanyResearchEmailsTxt(companyResults, `${projectName}_company_emails.txt`);
    showToast(`✓ Exported clean company emails to TXT!`);
  };

  const handleSaveCompanyEmailsToCloud = async () => {
    const emails = new Set<string>();
    companyResults.forEach(r => {
      r.discoveredEmails.forEach(e => {
        if (e.email) emails.add(e.email.toLowerCase().trim());
      });
    });

    if (emails.size === 0) {
      showToast("No discovered emails to save to Cloud.");
      return;
    }

    try {
      const blob = new Blob([Array.from(emails).join('\n')], { type: 'text/plain;charset=utf-8' });
      const filename = `company_emails_${emails.size}_${Date.now()}.txt`;
      const file = new File([blob], filename, { type: 'text/plain' });
      const uploaded = await uploadToCloudFiles(file, 'company-discovery');
      setActiveCloudFileId(uploaded.id);
      setActiveCloudFileName(uploaded.originalName);
      showToast(`✓ Saved ${emails.size.toLocaleString()} clean corporate emails to Cloud Vault!`);
    } catch (err: any) {
      showToast(`Cloud save error: ${err.message || 'Failed to save to cloud'}`);
    }
  };

  // Computed Company Finder Metrics
  const totalCompaniesCount = companyQueries.length || companyResults.length;
  const verifiedWebsitesCount = useMemo(() => companyResults.filter(r => r.verificationStatus === 'verified_official').length, [companyResults]);
  const probableWebsitesCount = useMemo(() => companyResults.filter(r => r.verificationStatus === 'probable_match').length, [companyResults]);
  const totalCompanyEmailsCount = useMemo(() => companyResults.reduce((acc, r) => acc + r.discoveredEmails.length, 0), [companyResults]);
  const uniqueCompanyEmailsCount = useMemo(() => {
    const set = new Set<string>();
    companyResults.forEach(r => r.discoveredEmails.forEach(e => { if (e.email) set.add(e.email.toLowerCase().trim()); }));
    return set.size;
  }, [companyResults]);
  const noWebsiteCompaniesCount = useMemo(() => companyResults.filter(r => r.verificationStatus === 'no_website_found').length, [companyResults]);

  // Filtered Company Search Results
  const filteredCompanyResults = useMemo(() => {
    let list = companyResults;
    if (companyFinderStatusFilter === 'verified') {
      list = list.filter(r => r.verificationStatus === 'verified_official');
    } else if (companyFinderStatusFilter === 'probable') {
      list = list.filter(r => r.verificationStatus === 'probable_match');
    } else if (companyFinderStatusFilter === 'with_emails') {
      list = list.filter(r => r.discoveredEmails && r.discoveredEmails.length > 0);
    } else if (companyFinderStatusFilter === 'no_website') {
      list = list.filter(r => r.verificationStatus === 'no_website_found');
    }

    if (companySearchTerm.trim()) {
      const q = companySearchTerm.toLowerCase().trim();
      list = list.filter(r =>
        r.companyName.toLowerCase().includes(q) ||
        (r.productsOrServices && r.productsOrServices.toLowerCase().includes(q)) ||
        (r.officialWebsite && r.officialWebsite.toLowerCase().includes(q)) ||
        (r.cleanDomain && r.cleanDomain.toLowerCase().includes(q)) ||
        r.discoveredEmails.some(e => e.email.toLowerCase().includes(q))
      );
    }

    return list;
  }, [companyResults, companyFinderStatusFilter, companySearchTerm]);

  const companyProgressPercent = companyQueries.length > 0
    ? Math.min(100, Math.round((companyProgressIndex / companyQueries.length) * 100))
    : 0;


  // Keep isPausedRef in sync
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Load saved sessions on mount
  const refreshSavedSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const list = await listDiscoverySessionsApi();
      setSavedSessions(list);
    } catch {}
    setIsLoadingSessions(false);
  }, []);

  useEffect(() => {
    refreshSavedSessions();
  }, [refreshSavedSessions]);

  // Handle Text Area change with domain normalization and deduplication
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    const parsed = parseDomainsFromText(val);
    setTotalRawInputCount(parsed.totalRaw);
    setDomainQueue(parsed.uniqueDomains);
  };

  // Handle File Upload (TXT, CSV, XLSX, XLS)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast(`Separating and extracting company websites from ${file.name}...`);
      const parsed = await extractWebsitesFromFile(file, { cleanToRootDomain: true, removeDuplicates: true });

      // Also auto-upload to central cloud file repository in background
      uploadToCloudFiles(file, 'company-discovery').catch(() => {});

      if (parsed.uniqueDomains.length === 0) {
        showToast(`No valid company websites found in ${file.name}.`);
        return;
      }

      setProjectName(`Discovery - ${file.name.replace(/\.[^/.]+$/, '')}`);
      setTotalRawInputCount(parsed.rawTotalFields);
      setDomainQueue(parsed.uniqueDomains);
      setInputText(parsed.uniqueDomains.join('\n'));
      setSeparatorInputText(parsed.uniqueDomains.join('\n'));

      const colInfo = parsed.detectedWebsiteColumn
        ? ` (Isolated '${parsed.detectedWebsiteColumn}' column from ${parsed.detectedColumns?.length || 'multi-field'} fields)`
        : parsed.filteredOutCount > 0
        ? ` (Separated from ${parsed.filteredOutCount.toLocaleString()} non-website fields)`
        : '';

      showToast(`✓ Extracted ${parsed.uniqueDomains.length.toLocaleString()} clean websites from ${file.name}!${colInfo}`);
    } catch (err: any) {
      showToast(`Error loading file: ${err?.message || 'Failed to parse file'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Folder Upload (multiple domain lists)
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    showToast(`Scanning folder with ${files.length} files for company domain lists...`);
    const allDomains: string[] = [];
    let rawTotal = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ext === 'txt' || ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
        try {
          const parsed = await parseDomainsFromFile(f);
          rawTotal += parsed.totalRaw;
          allDomains.push(...parsed.uniqueDomains);
          uploadToCloudFiles(f, 'company-discovery').catch(() => {});
        } catch {}
      }
    }

    const unique = Array.from(new Set(allDomains));
    if (unique.length === 0) {
      showToast("No domain lists found inside the selected folder.");
      return;
    }

    setProjectName(`Folder Discovery (${files.length} files)`);
    setTotalRawInputCount(rawTotal);
    setDomainQueue(unique);
    setInputText(unique.join('\n'));
    showToast(`Loaded ${unique.length.toLocaleString()} unique domains across ${files.length} files in folder!`);
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // Handle selection from central Cloud File Hub
  const handleSelectCloudFile = async (cloudFile: CloudFileRecord) => {
    setActiveCloudFileId(cloudFile.id);
    setActiveCloudFileName(cloudFile.originalName);
    showToast(`Loading domain list from Cloud File "${cloudFile.originalName}"...`);

    const raw = cloudFile.previewLines.join('\n');
    const parsed = parseDomainsFromText(raw);

    if (parsed.uniqueDomains.length > 0) {
      setProjectName(`Discovery - ${cloudFile.originalName.replace(/\.[^/.]+$/, '')}`);
      setDomainQueue(parsed.uniqueDomains);
      setTotalRawInputCount(cloudFile.totalLines);
      setInputText(parsed.uniqueDomains.join('\n'));
      showToast(`Loaded ${parsed.uniqueDomains.length.toLocaleString()} domains from Cloud File! Ready to crawl.`);
    }
  };

  // Resume checkpoint from crash / disconnect
  const handleResumeCheckpoint = (cp: SessionCheckpoint) => {
    if (cp.processedResults?.domains) {
      setDomainsStatus(cp.processedResults.domains);
    }
    if (cp.processedResults?.records) {
      setDiscoveredRecords(cp.processedResults.records);
    }
    if (cp.remainingItems && cp.remainingItems.length > 0) {
      setDomainQueue(cp.remainingItems);
      setProcessedIndex(cp.processedCount || 0);
    }
    showToast(`Resumed discovery checkpoint: ${cp.processedCount.toLocaleString()} domains restored!`);
  };

  // Download partial checkpoint ZIP
  const handleDownloadPartialCheckpointZip = async (cp: SessionCheckpoint) => {
    const records: DiscoveredEmailRecord[] = cp.processedResults?.records || [];
    const domains: DomainCrawlStatusRecord[] = cp.processedResults?.domains || [];
    if (records.length === 0 && domains.length === 0) {
      showToast("No processed discovery records available in checkpoint.");
      return;
    }
    await exportDiscoveryCategoriesZip(records, domains, `Interrupted_Company_Discovery`);
    showToast("Downloaded partial discovery results as ZIP archive!");
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    showToast(`Copied ${text}`);
  };

  // Core Crawler Engine: Parallel Controlled Workers
  const handleStartCrawling = async (domainsToCrawl?: string[]) => {
    const queue = domainsToCrawl || domainQueue;
    if (queue.length === 0) {
      showToast("Please upload or paste company domains to crawl first.");
      return;
    }

    setIsCrawling(true);
    setIsPaused(false);
    isPausedRef.current = false;
    abortControllerRef.current = new AbortController();
    setCrawlStartTime(Date.now());

    // If starting fresh (not retrying specific domains), reset previous outputs if user agrees
    if (!domainsToCrawl && domainsStatus.length > 0 && processedIndex === 0) {
      setDomainsStatus([]);
      setDiscoveredRecords([]);
    }

    const totalToProcess = queue.length;
    let nextIndex = 0;
    let completedCount = 0;

    // Track active workers
    const activeDomainMap = new Map<number, string>();

    const worker = async (workerId: number) => {
      while (nextIndex < totalToProcess) {
        if (abortControllerRef.current?.signal.aborted) break;

        // Handle pause loop
        while (isPausedRef.current) {
          if (abortControllerRef.current?.signal.aborted) break;
          await new Promise(r => setTimeout(r, 200));
        }

        const currentIndex = nextIndex++;
        const targetDomain = queue[currentIndex];
        activeDomainMap.set(workerId, targetDomain);
        setActiveWorkers(Array.from(activeDomainMap.values()));

        try {
          const res = await crawlDomainApi(targetDomain, config, abortControllerRef.current?.signal);

          // Update domain status record
          setDomainsStatus(prev => {
            const exists = prev.findIndex(d => d.domain === res.domain);
            const statusRec: DomainCrawlStatusRecord = {
              domain: res.domain,
              website: res.website,
              companyName: res.companyName,
              status: res.status,
              statusCode: res.statusCode,
              pagesScanned: res.pagesScanned,
              emailsCount: res.emailsCount,
              error: res.error,
              crawledPages: res.crawledPages
            };
            if (exists >= 0) {
              const updated = [...prev];
              updated[exists] = statusRec;
              return updated;
            }
            return [...prev, statusRec];
          });

          // Add newly discovered email records
          if (res.records && res.records.length > 0) {
            setDiscoveredRecords(prev => {
              const seen = new Set(prev.map(r => `${r.companyDomain}:${r.email}`));
              const fresh = res.records.filter(r => !seen.has(`${r.companyDomain}:${r.email}`));
              return [...prev, ...fresh];
            });
          }
        } catch (crawlErr: any) {
          if (abortControllerRef.current?.signal.aborted) break;
          setDomainsStatus(prev => [
            ...prev.filter(d => d.domain !== targetDomain),
            {
              domain: targetDomain,
              website: `https://${targetDomain}`,
              companyName: targetDomain.split('.')[0].toUpperCase(),
              status: 'unavailable',
              statusCode: 0,
              pagesScanned: 0,
              emailsCount: 0,
              error: crawlErr?.message || 'Crawl failed',
              crawledPages: []
            }
          ]);
        } finally {
          completedCount++;
          setProcessedIndex(completedCount);

          // Calculate crawling speed
          const elapsedSec = Math.max(1, (Date.now() - (crawlStartTime || Date.now())) / 1000);
          const speed = (completedCount / elapsedSec).toFixed(1);
          setCrawlSpeed(speed);

          // Progressive Checkpoint saving every 5 domains
          if (completedCount % 5 === 0 || completedCount === totalToProcess) {
            saveSessionCheckpoint({
              tab: 'company-discovery',
              title: projectName,
              sourceName: activeCloudFileName || 'Domain List',
              totalItems: totalToProcess,
              processedCount: completedCount,
              percent: Math.round((completedCount / totalToProcess) * 100),
              status: 'running',
              remainingItems: queue.slice(completedCount),
              processedResults: {
                domains: domainsStatus,
                records: discoveredRecords
              }
            });
          }
        }

        activeDomainMap.delete(workerId);
        setActiveWorkers(Array.from(activeDomainMap.values()));
      }
    };

    const workerPromises = Array.from(
      { length: Math.min(config.concurrency, queue.length) },
      (_, id) => worker(id + 1)
    );

    await Promise.all(workerPromises);

    setIsCrawling(false);
    setIsPaused(false);
    setActiveWorkers([]);
    abortControllerRef.current = null;

    // Clear session checkpoint on successful finish
    if (completedCount >= totalToProcess) {
      clearSessionCheckpoint('company-discovery');
      setCheckpointRefreshKey(prev => prev + 1);
      showToast(`Company website crawling completed! Finished all ${totalToProcess} domains.`);
    } else {
      showToast("Company crawling stopped.");
    }
  };

  // Pause / Resume
  const handleTogglePause = () => {
    setIsPaused(prev => {
      const next = !prev;
      isPausedRef.current = next;
      showToast(next ? "Paused crawling." : "Resumed crawling.");
      return next;
    });
  };

  // Stop Processing
  const handleStopCrawling = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsCrawling(false);
      setIsPaused(false);
      setActiveWorkers([]);
      showToast("Stopped crawler. Discovered emails and crawled pages retained.");
    }
  };

  // Retry Unsuccessful / Failed Websites (Requirement 7)
  const handleRetryFailed = () => {
    const failedDomains = domainsStatus
      .filter(d => d.status === 'unavailable')
      .map(d => d.domain);

    if (failedDomains.length === 0) {
      showToast("No unavailable websites to retry.");
      return;
    }

    showToast(`Retrying ${failedDomains.length} previously unavailable company websites...`);
    handleStartCrawling(failedDomains);
  };

  // Reprocess a single selected domain
  const handleReprocessDomain = (domain: string) => {
    showToast(`Reprocessing company website for ${domain}...`);
    handleStartCrawling([domain]);
  };

  // On-demand Google Search for a single company domain
  const handleSearchGoogleForDomain = async (domain: string, compName?: string) => {
    if (searchingDomain) return;
    setSearchingDomain(domain);
    showToast(`Searching Google for publicly indexed emails of ${domain}...`);

    try {
      const res = await searchGoogleForDomainApi(domain, compName);
      if (res.records && res.records.length > 0) {
        // Update domains status
        setDomainsStatus(prev => {
          const idx = prev.findIndex(d => d.domain === domain);
          const newStatusRec: DomainCrawlStatusRecord = {
            domain,
            website: `https://${domain}`,
            companyName: res.companyName || domain,
            status: 'success',
            statusCode: 200,
            pagesScanned: (idx >= 0 ? prev[idx].pagesScanned : 1) + 1,
            emailsCount: (idx >= 0 ? prev[idx].emailsCount : 0) + res.records.length,
            crawledPages: [
              ...(idx >= 0 ? prev[idx].crawledPages : []),
              {
                url: `https://www.google.com/search?q=site:${domain}`,
                title: `Google Search Fallback (${res.records.length} emails discovered)`,
                emailsFound: res.records.length
              }
            ]
          };
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = newStatusRec;
            return next;
          }
          return [...prev, newStatusRec];
        });

        // Add to discovered records with strict deduplication
        setDiscoveredRecords(prev => {
          const seen = new Set(prev.map(r => `${r.companyDomain}:${r.email}`));
          const fresh = res.records.filter(r => !seen.has(`${r.companyDomain}:${r.email}`));
          return [...prev, ...fresh];
        });

        showToast(`✓ Google Search found ${res.records.length} clean corporate emails for ${domain}!`);
      } else {
        showToast(`Google Search: No public emails discovered for ${domain}.`);
      }
    } catch (err: any) {
      showToast(`Google search fallback error: ${err.message || 'Failed to search'}`);
    } finally {
      setSearchingDomain(null);
    }
  };

  // Batch Google Search across all companies with 0 discovered emails
  const handleBatchGoogleSearchMissing = async () => {
    const missing = domainsStatus.filter(d => d.status === 'no_emails');
    if (missing.length === 0) {
      showToast("All crawled companies already have discovered emails!");
      return;
    }

    setIsBatchGoogleSearching(true);
    showToast(`Launching Google Search fallback across ${missing.length} companies with no emails...`);
    let totalFound = 0;

    try {
      for (let i = 0; i < missing.length; i++) {
        const target = missing[i];
        setSearchingDomain(target.domain);
        try {
          const res = await searchGoogleForDomainApi(target.domain, target.companyName);
          if (res.records && res.records.length > 0) {
            totalFound += res.records.length;
            setDomainsStatus(prev => {
              const idx = prev.findIndex(d => d.domain === target.domain);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = {
                  ...next[idx],
                  status: 'success',
                  emailsCount: next[idx].emailsCount + res.records.length,
                  pagesScanned: next[idx].pagesScanned + 1,
                  crawledPages: [
                    ...next[idx].crawledPages,
                    {
                      url: `https://www.google.com/search?q=site:${target.domain}`,
                      title: `Google Search Fallback (${res.records.length} emails discovered)`,
                      emailsFound: res.records.length
                    }
                  ]
                };
                return next;
              }
              return prev;
            });

            setDiscoveredRecords(prev => {
              const seen = new Set(prev.map(r => `${r.companyDomain}:${r.email}`));
              const fresh = res.records.filter(r => !seen.has(`${r.companyDomain}:${r.email}`));
              return [...prev, ...fresh];
            });
          }
        } catch {}

        await new Promise(r => setTimeout(r, 200));
      }

      showToast(`Google Search Fallback complete! Discovered ${totalFound} new corporate emails.`);
    } finally {
      setIsBatchGoogleSearching(false);
      setSearchingDomain(null);
    }
  };

  // Save current discovery project to server database (Requirement 9)
  const handleSaveToDatabase = async () => {
    if (domainsStatus.length === 0 && discoveredRecords.length === 0) {
      showToast("No discovery data available to save.");
      return;
    }

    setIsSavingSession(true);
    try {
      const totalDomains = domainsStatus.length;
      const websitesAccessed = domainsStatus.filter(d => d.status === 'success' || d.status === 'no_emails').length;
      const websitesUnavailable = domainsStatus.filter(d => d.status === 'unavailable').length;
      const totalPagesScanned = domainsStatus.reduce((acc, d) => acc + d.pagesScanned, 0);
      const totalEmailsFound = discoveredRecords.length;
      const uniqueEmailsFound = Array.from(new Set(discoveredRecords.map(r => r.email.toLowerCase()))).length;
      const companiesWithoutEmails = domainsStatus.filter(d => d.status === 'no_emails').length;

      await saveDiscoverySessionApi({
        title: projectName || `Company Discovery (${totalDomains} domains)`,
        totalDomains,
        websitesAccessed,
        websitesUnavailable,
        totalPagesScanned,
        totalEmailsFound,
        uniqueEmailsFound,
        companiesWithoutEmails,
        domains: domainsStatus,
        records: discoveredRecords,
        config
      });

      showToast(`Successfully saved discovery project "${projectName}" to Database!`);
      refreshSavedSessions();
    } catch (err: any) {
      showToast(`Save error: ${err?.message || 'Failed to save project'}`);
    } finally {
      setIsSavingSession(false);
    }
  };

  // Load a previously saved session
  const handleLoadSavedSession = async (sessionId: string) => {
    try {
      showToast("Loading discovery project from Database...");
      const session = await getDiscoverySessionApi(sessionId);
      if (!session) {
        showToast("Project not found.");
        return;
      }

      setProjectName(session.title);
      setDomainsStatus(session.domains || []);
      setDiscoveredRecords(session.records || []);
      setTotalRawInputCount(session.totalDomains);
      setDomainQueue((session.domains || []).map(d => d.domain));
      setViewTab('emails');
      showToast(`Loaded "${session.title}" with ${(session.records || []).length} discovered emails!`);
    } catch (err: any) {
      showToast(`Load error: ${err?.message || 'Failed to load project'}`);
    }
  };

  // Delete a saved session
  const handleDeleteSavedSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDiscoverySessionApi(sessionId);
      showToast("Deleted project from database.");
      refreshSavedSessions();
    } catch {}
  };

  // Email Selection Helpers
  const handleSelectAllEmails = () => {
    if (selectedEmailIds.size === filteredRecords.length && filteredRecords.length > 0) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const handleToggleSelectEmail = (id: string) => {
    setSelectedEmailIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Copy Clean Emails to Clipboard (Main focus)
  const handleCopyCleanEmails = (selectedOnly = false) => {
    const target = selectedOnly && selectedEmailIds.size > 0
      ? filteredRecords.filter(r => selectedEmailIds.has(r.id))
      : filteredRecords;

    const emails = Array.from(new Set(target.map(r => r.email.toLowerCase().trim()))).filter(Boolean);
    if (emails.length === 0) {
      showToast("No emails to copy.");
      return;
    }

    navigator.clipboard.writeText(emails.join('\n'));
    showToast(`✓ Copied ${emails.length.toLocaleString()} clean corporate emails to clipboard!`);
  };

  // Save Clean Emails Only (TXT format - 1 per line)
  const handleSaveEmailsTxt = (selectedOnly = false) => {
    const target = selectedOnly && selectedEmailIds.size > 0 ? selectedEmailIds : undefined;
    exportCleanEmailsTxt(filteredRecords, `${projectName}_clean_emails.txt`, target);
    const count = target ? target.size : uniqueEmailsCount;
    showToast(`✓ Saved ${count.toLocaleString()} clean company emails to TXT!`);
  };

  // Save Clean Emails Only (CSV format)
  const handleSaveEmailsCsv = (selectedOnly = false, includeDomain = false) => {
    const target = selectedOnly && selectedEmailIds.size > 0 ? selectedEmailIds : undefined;
    exportCleanEmailsCsv(filteredRecords, `${projectName}_clean_emails.csv`, target, includeDomain);
    const count = target ? target.size : uniqueEmailsCount;
    showToast(`✓ Saved ${count.toLocaleString()} clean company emails to CSV!`);
  };

  // Save Clean Emails List to Cloud Storage / DB
  const handleUploadEmailsToCloudVault = async (selectedOnly = false) => {
    const target = selectedOnly && selectedEmailIds.size > 0
      ? filteredRecords.filter(r => selectedEmailIds.has(r.id))
      : filteredRecords;

    const emails = Array.from(new Set(target.map(r => r.email.toLowerCase().trim()))).filter(Boolean);
    if (emails.length === 0) {
      showToast("No emails available to save to Cloud.");
      return;
    }

    setIsUploadingEmailsToCloud(true);
    showToast(`Saving ${emails.length.toLocaleString()} clean emails to Cloud Storage...`);

    try {
      const blob = new Blob([emails.join('\n')], { type: 'text/plain;charset=utf-8' });
      const filename = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_clean_emails_${emails.length}.txt`;
      const file = new File([blob], filename, { type: 'text/plain' });

      const uploaded = await uploadToCloudFiles(file, 'company-discovery');
      setActiveCloudFileId(uploaded.id);
      setActiveCloudFileName(uploaded.originalName);
      showToast(`✓ Clean email list "${uploaded.originalName}" saved to Cloud Storage! Ready to use across Sorter, Validator & Sender.`);
    } catch (err: any) {
      showToast(`Cloud save error: ${err.message || 'Failed to save to cloud'}`);
    } finally {
      setIsUploadingEmailsToCloud(false);
    }
  };

  // Transfer discovered emails to Email Validator tab
  const handleSendToValidator = (selectedOnly = false) => {
    if (!onSendToValidator) {
      showToast("Validator tab is not connected.");
      return;
    }
    const target = selectedOnly && selectedEmailIds.size > 0
      ? filteredRecords.filter(r => selectedEmailIds.has(r.id))
      : filteredRecords;

    const emails = Array.from(new Set(target.map(r => r.email)));
    if (emails.length === 0) {
      showToast("No discovered emails to send to Validator.");
      return;
    }
    onSendToValidator(emails);
    showToast(`Transferred ${emails.length.toLocaleString()} discovered emails to Sorter & Validator!`);
  };

  // Transfer discovered leads to Email Sender tab
  const handleSendToSender = (selectedOnly = false) => {
    if (!onSendToEmailSender) {
      showToast("Email Sender tab is not connected.");
      return;
    }
    const target = selectedOnly && selectedEmailIds.size > 0
      ? filteredRecords.filter(r => selectedEmailIds.has(r.id))
      : filteredRecords;

    const leads: ExtractedEmail[] = target.map(r => ({
      email: r.email,
      companyName: r.companyName,
      sourceUrl: r.sourcePageUrl,
      country: 'N/A',
      domain: r.companyDomain,
      phone: r.phone,
      role: r.category,
      isValid: true,
      mxStatus: 'unknown'
    }));

    if (leads.length === 0) {
      showToast("No discovered leads to send to Email Sender.");
      return;
    }
    onSendToEmailSender(leads);
    showToast(`Transferred ${leads.length.toLocaleString()} company leads to Email Sender!`);
  };

  // Computed Dashboard Metrics (Requirement 5)
  const totalDomainsCount = domainQueue.length || domainsStatus.length;
  const websitesAccessedCount = useMemo(() => domainsStatus.filter(d => d.status === 'success' || d.status === 'no_emails').length, [domainsStatus]);
  const websitesUnavailableCount = useMemo(() => domainsStatus.filter(d => d.status === 'unavailable').length, [domainsStatus]);
  const totalPagesScannedCount = useMemo(() => domainsStatus.reduce((acc, d) => acc + d.pagesScanned, 0), [domainsStatus]);
  const totalEmailsDiscoveredCount = discoveredRecords.length;
  const uniqueEmailsCount = useMemo(() => new Set(discoveredRecords.map(r => r.email.toLowerCase())).size, [discoveredRecords]);
  const companiesNoEmailsCount = useMemo(() => domainsStatus.filter(d => d.status === 'no_emails').length, [domainsStatus]);

  // Category counts breakdown
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    EMAIL_CATEGORIES_LIST.forEach(cat => map.set(cat, 0));
    discoveredRecords.forEach(r => {
      map.set(r.category, (map.get(r.category) || 0) + 1);
    });
    return map;
  }, [discoveredRecords]);

  // Filtered Records based on search query, category, and deduplication
  const filteredRecords = useMemo(() => {
    let list = discoveredRecords;

    if (selectedCategory !== 'all') {
      list = list.filter(r => r.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r =>
        r.email.toLowerCase().includes(q) ||
        r.companyDomain.toLowerCase().includes(q) ||
        r.companyName.toLowerCase().includes(q) ||
        r.sourcePageUrl.toLowerCase().includes(q)
      );
    }

    if (deduplicateEmails) {
      const seen = new Set<string>();
      list = list.filter(r => {
        const em = r.email.toLowerCase();
        if (seen.has(em)) return false;
        seen.add(em);
        return true;
      });
    }

    return list;
  }, [discoveredRecords, selectedCategory, searchQuery, deduplicateEmails]);

  // Filtered Domains based on company status filter and search query
  const filteredDomains = useMemo(() => {
    let list = domainsStatus;

    if (companyStatusFilter === 'with_emails') {
      list = list.filter(d => d.status === 'success');
    } else if (companyStatusFilter === 'no_emails') {
      list = list.filter(d => d.status === 'no_emails');
    } else if (companyStatusFilter === 'unavailable') {
      list = list.filter(d => d.status === 'unavailable');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(d =>
        d.domain.toLowerCase().includes(q) ||
        d.companyName.toLowerCase().includes(q) ||
        d.website.toLowerCase().includes(q)
      );
    }

    return list;
  }, [domainsStatus, companyStatusFilter, searchQuery]);

  // Progress percentage
  const progressPercent = domainQueue.length
    ? Math.min(100, Math.round((processedIndex / domainQueue.length) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Central Cloud File Hub (Cross-tab File Upload & Sharing) */}
      <CloudFileHubBar
        currentTabName="Company Email Finder"
        sourceTabId="company-discovery"
        activeFileId={activeCloudFileId}
        activeFileName={activeCloudFileName}
        onSelectFile={handleSelectCloudFile}
        showToast={showToast}
      />

      {/* Automatic Session Recovery Banner (Resume When Disconnected or Turned Off) */}
      <SessionRecoveryBanner
        tab="company-discovery"
        tabLabel="Company Email Finder"
        onResume={handleResumeCheckpoint}
        onDownloadPartialZip={handleDownloadPartialCheckpointZip}
        showToast={showToast}
        triggerRefreshKey={checkpointRefreshKey}
      />

      {/* HEADER HERO CARD */}
      <div className="bg-gradient-to-r from-gray-900 via-blue-950/40 to-gray-900 border border-blue-900/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                  Company Website Email Discovery System
                  <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    Deep Subpage Crawler
                  </span>
                </h1>
                <p className="text-gray-400 text-xs mt-1">
                  Automatically spider company websites, inspect homepages, and discover public corporate emails across Contact, About, Sales, Export, Procurement & Management subpages.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons on top right */}
          <div className="flex items-center gap-2 flex-wrap">
            {companiesNoEmailsCount > 0 && (
              <button
                type="button"
                onClick={handleBatchGoogleSearchMissing}
                disabled={isCrawling || isBatchGoogleSearching}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white border border-amber-400/40 flex items-center gap-1.5 transition-all shadow-sm shadow-amber-600/20"
                title="Search Google index for public emails for all companies that yielded 0 emails on website crawl"
              >
                <Search className="w-3.5 h-3.5" />
                {isBatchGoogleSearching ? 'Searching...' : `Google Search Missing (${companiesNoEmailsCount})`}
              </button>
            )}

            {/* Primary Action: Save Clean Emails (Main Focus) */}
            <button
              type="button"
              onClick={() => {
                setSaveModalTab('emails');
                setIsSaveModalOpen(true);
              }}
              disabled={discoveredRecords.length === 0}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white border border-emerald-400/50 flex items-center gap-2 transition-all shadow-lg shadow-emerald-700/25 ring-1 ring-emerald-400/30"
              title="Save clean, deduplicated corporate emails (1-per-line TXT, CSV, Cloud Vault, Outreach)"
            >
              <Mail className="w-4 h-4 text-emerald-100" />
              <span>Save Emails</span>
              {uniqueEmailsCount > 0 && (
                <span className="bg-emerald-950/90 text-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-mono border border-emerald-400/60 font-bold">
                  {uniqueEmailsCount.toLocaleString()}
                </span>
              )}
            </button>

            {/* Secondary Action: Save All Data (Complete Audit) */}
            <button
              type="button"
              onClick={() => {
                setSaveModalTab('all_data');
                setIsSaveModalOpen(true);
              }}
              disabled={domainsStatus.length === 0 && discoveredRecords.length === 0}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-600 flex items-center gap-1.5 transition-all shadow-sm"
              title="Save complete discovery audit dataset (Excel XLSX, full CSV, categorized ZIP archive, Database)"
            >
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>Save All Data</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex items-center gap-1.5 transition-all shadow-sm"
              title="Configure crawling workers, depth, and delays"
            >
              <Settings2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* WORKSPACE MODE SWITCHER */}
      <div className="flex items-center justify-between p-2 bg-gray-900/90 border border-gray-800 rounded-2xl shadow-xl flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveWorkspaceMode('crawler')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeWorkspaceMode === 'crawler'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Company Website Crawler (Direct Domains)</span>
            {domainQueue.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-900/80 text-blue-200 border border-blue-400/40 font-mono">
                {domainQueue.length.toLocaleString()}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkspaceMode('company_finder')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeWorkspaceMode === 'company_finder'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <Search className="w-4 h-4 text-purple-300" />
            <span>Search Engine Company & Website Finder</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 border border-purple-400/50 font-bold uppercase tracking-wider">
              Names + Products
            </span>
            {companyResults.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-900/80 text-purple-200 border border-purple-400/40 font-mono">
                {companyResults.length.toLocaleString()}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400 px-2">
          {activeWorkspaceMode === 'crawler' ? (
            <button
              type="button"
              onClick={() => setActiveWorkspaceMode('company_finder')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium underline"
            >
              Have company names without websites? Research on Google →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveWorkspaceMode('crawler')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium underline"
            >
              Already have websites? Switch to Direct Subpage Crawler →
            </button>
          )}
        </div>
      </div>

      {/* MODE 1: DIRECT DOMAIN WEBSITE CRAWLER */}
      {activeWorkspaceMode === 'crawler' && (
        <>
          {/* DASHBOARD METRICS CARDS (Requirement 5) */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Metric 1: Total Domains */}
        <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/70 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Domains Uploaded</span>
          <div className="text-2xl font-bold text-white mt-1">
            {totalDomainsCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-gray-400 mt-1">
            {totalRawInputCount > totalDomainsCount ? `${(totalRawInputCount - totalDomainsCount).toLocaleString()} duplicates stripped` : 'Clean domain list'}
          </span>
        </div>

        {/* Metric 2: Successfully Accessed */}
        <div className="bg-gray-800/60 backdrop-blur-sm border border-emerald-900/40 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Websites Accessed
          </span>
          <div className="text-2xl font-bold text-emerald-300 mt-1">
            {websitesAccessedCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-400/80 mt-1">
            {domainsStatus.length ? `${Math.round((websitesAccessedCount / domainsStatus.length) * 100)}% responsive` : '0%'}
          </span>
        </div>

        {/* Metric 3: Websites Unavailable */}
        <div className="bg-gray-800/60 backdrop-blur-sm border border-red-900/40 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-medium text-red-400 uppercase tracking-wider flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            Unavailable
          </span>
          <div className="text-2xl font-bold text-red-400 mt-1">
            {websitesUnavailableCount.toLocaleString()}
          </div>
          {websitesUnavailableCount > 0 ? (
            <button
              type="button"
              onClick={handleRetryFailed}
              disabled={isCrawling}
              className="text-[10px] text-red-300 hover:text-white underline text-left mt-1 disabled:opacity-50"
            >
              Retry failed websites
            </button>
          ) : (
            <span className="text-[10px] text-gray-400 mt-1">Zero downtime</span>
          )}
        </div>

        {/* Metric 4: Total Pages Scanned */}
        <div className="bg-gray-800/60 backdrop-blur-sm border border-blue-900/40 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Pages Scanned
          </span>
          <div className="text-2xl font-bold text-blue-300 mt-1">
            {totalPagesScannedCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-blue-400/80 mt-1">
            Avg {websitesAccessedCount ? (totalPagesScannedCount / websitesAccessedCount).toFixed(1) : 0} pages/site
          </span>
        </div>

        {/* Metric 5: Total Emails Discovered */}
        <div className="bg-gray-800/60 backdrop-blur-sm border border-purple-900/40 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-medium text-purple-400 uppercase tracking-wider">Total Emails</span>
          <div className="text-2xl font-bold text-purple-300 mt-1">
            {totalEmailsDiscoveredCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-purple-400/80 mt-1">Across all subpages</span>
        </div>

        {/* Metric 6: Unique Emails */}
        <div className="bg-gray-800/60 backdrop-blur-sm border border-teal-900/40 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-medium text-teal-400 uppercase tracking-wider">Unique Emails</span>
          <div className="text-2xl font-bold text-teal-300 mt-1">
            {uniqueEmailsCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-teal-400/80 mt-1">Deduplicated contacts</span>
        </div>

        {/* Metric 7: Companies With No Emails */}
        <div className="bg-gray-800/60 backdrop-blur-sm border border-amber-900/40 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">No Public Emails</span>
          <div className="text-2xl font-bold text-amber-300 mt-1">
            {companiesNoEmailsCount.toLocaleString()}
          </div>
          {companiesNoEmailsCount > 0 ? (
            <button
              type="button"
              onClick={handleBatchGoogleSearchMissing}
              disabled={isCrawling || isBatchGoogleSearching}
              className="text-[10px] text-amber-300 hover:text-white underline text-left mt-1 disabled:opacity-50 flex items-center gap-1 font-semibold"
            >
              <Search className="w-2.5 h-2.5" />
              {isBatchGoogleSearching ? 'Searching...' : `Search Google (${companiesNoEmailsCount})`}
            </button>
          ) : (
            <span className="text-[10px] text-amber-400/80 mt-1">Form-only or hidden</span>
          )}
        </div>
      </div>

      {/* INPUT ZONE & CONTROLS CARD */}
      <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/80 rounded-2xl p-6 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Text Area & Ingestion */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                Target Company Domains & URLs
                {domainQueue.length > 0 && (
                  <span className="text-xs font-normal text-gray-400">
                    ({domainQueue.length.toLocaleString()} unique domains loaded)
                  </span>
                )}
              </label>

              {/* Upload & Separator Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setSeparatorInputText(inputText || '');
                    setIsSeparatorModalOpen(true);
                  }}
                  disabled={isCrawling}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 text-white border border-teal-500/50 flex items-center gap-1.5 transition-all shadow-sm shadow-teal-900/30"
                  title="Extract only website URLs & company domains from mixed text, paragraphs, words, or multi-field files"
                >
                  <Wand2 className="w-3.5 h-3.5 text-teal-200" />
                  Website Separator Studio
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.csv,.xlsx,.xls"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCrawling}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 flex items-center gap-1.5 transition-all"
                  title="Upload TXT, CSV or Excel file containing company domains or multi-field records"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  Upload File (.txt, .csv, .xlsx)
                </button>

                <input
                  type="file"
                  ref={folderInputRef}
                  onChange={handleFolderUpload}
                  {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={isCrawling}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 flex items-center gap-1.5 transition-all"
                  title="Upload folder with multiple domain lists"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-teal-400" />
                  Upload Folder
                </button>
              </div>
            </div>

            <textarea
              rows={5}
              value={inputText}
              onChange={handleTextChange}
              disabled={isCrawling}
              placeholder="Paste company domains or website URLs, or paste messy mixed text, multi-field tables, CRM records, or words..."
              className="w-full p-3.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-200 font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />

            {/* Smart Mixed Text / Multiple Fields Detection Helper */}
            {hasMixedText && (
              <div className="p-3 bg-gradient-to-r from-teal-950/90 via-emerald-950/70 to-slate-900 border border-teal-500/50 rounded-xl flex items-center justify-between gap-3 text-xs animate-in fade-in flex-wrap">
                <div className="flex items-center gap-2 text-teal-200">
                  <Wand2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white">Mixed text or multi-field data detected:</span>{' '}
                    <span className="text-teal-300">
                      We found {domainQueue.length.toLocaleString()} company websites mixed with other text, names, emails, or phone numbers.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleQuickSeparateWebsites}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-700/30 transition-all"
                    title="Separate only websites and clean the input textarea"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Extract Websites Only ({domainQueue.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSeparatorInputText(inputText);
                      setIsSeparatorModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-teal-300 border border-teal-700/60 transition-all"
                  >
                    Open Studio...
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Automatically separates websites from mixed words, removes email usernames, and strips protocols.</span>
              {domainQueue.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setInputText('');
                    setDomainQueue([]);
                    setTotalRawInputCount(0);
                  }}
                  disabled={isCrawling}
                  className="text-red-400 hover:text-red-300 underline"
                >
                  Clear input
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: Crawling Control Deck */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-4 bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center justify-between">
                <span>Crawler Operations</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                  isCrawling
                    ? isPaused
                      ? 'bg-amber-950 text-amber-300 border-amber-600'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-600 animate-pulse'
                    : 'bg-gray-800 text-gray-400 border-gray-700'
                }`}>
                  {isCrawling ? (isPaused ? 'Paused' : 'Active Crawling') : 'Standby'}
                </span>
              </h3>

              <div className="mt-3 space-y-2 text-xs text-gray-300">
                <div className="flex justify-between py-1 border-b border-gray-800">
                  <span className="text-gray-400">Parallel Workers:</span>
                  <span className="font-semibold text-blue-400">{config.concurrency} concurrent domains</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-800">
                  <span className="text-gray-400">Max Subpages / Domain:</span>
                  <span className="font-semibold text-purple-400">{config.maxPagesPerDomain} pages</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-800">
                  <span className="text-gray-400">Priority Targets:</span>
                  <span className="font-semibold text-emerald-400">Contact, Sales, Export, Execs</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">Crawling Speed:</span>
                  <span className="font-mono text-gray-200">{crawlSpeed} sites/sec</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {!isCrawling ? (
                <button
                  type="button"
                  onClick={() => handleStartCrawling()}
                  disabled={domainQueue.length === 0}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Start Website Crawling ({domainQueue.length.toLocaleString()})
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 transition-all ${
                      isPaused
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400/40 shadow-lg shadow-amber-600/30'
                        : 'bg-gray-800 hover:bg-gray-700 text-amber-300 border-gray-600'
                    }`}
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>

                  <button
                    type="button"
                    onClick={handleStopCrawling}
                    className="py-2.5 px-3 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-500 text-white border border-red-400/40 shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Stop
                  </button>
                </div>
              )}

              {websitesUnavailableCount > 0 && !isCrawling && (
                <button
                  type="button"
                  onClick={handleRetryFailed}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800/60 flex items-center justify-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry {websitesUnavailableCount} Failed Sites
                </button>
              )}
            </div>
          </div>
        </div>

        {/* LIVE PROGRESS & ACTIVE WORKERS BAR */}
        {isCrawling && (
          <div className="mt-6 pt-5 border-t border-gray-700/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-blue-300 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
                Crawling domain {processedIndex} of {domainQueue.length} ({progressPercent}%)
              </div>
              <div className="text-gray-400 font-mono">
                Speed: {crawlSpeed} domains/sec • {discoveredRecords.length} emails discovered
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden border border-gray-700/80">
              <div
                className={`h-full transition-all duration-300 ${
                  isPaused
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-teal-400'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Active Workers Real-Time Display */}
            {activeWorkers.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[11px] text-gray-400 font-medium">Active Workers:</span>
                {activeWorkers.map((wDomain, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono bg-blue-950/80 border border-blue-700/60 text-blue-300 shadow-sm"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {wDomain}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* VIEW NAVIGATION & SEARCH/EXPORT BAR */}
      <div className="bg-gray-800/60 backdrop-blur-md border border-gray-700/80 rounded-2xl p-4 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800">
            <button
              type="button"
              onClick={() => setViewTab('emails')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                viewTab === 'emails'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Discovered Emails ({filteredRecords.length.toLocaleString()})
            </button>

            <button
              type="button"
              onClick={() => setViewTab('companies')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                viewTab === 'companies'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Companies Overview ({domainsStatus.length.toLocaleString()})
            </button>

            <button
              type="button"
              onClick={() => {
                setViewTab('saved_sessions');
                refreshSavedSessions();
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                viewTab === 'saved_sessions'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Saved Projects ({savedSessions.length})
            </button>
          </div>

          {/* Export & Save Action Center */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Group 1: Clean Emails Only (Main Focus) */}
            <div className="flex items-center gap-1.5 p-1 bg-emerald-950/40 border border-emerald-600/40 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-2 flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Emails (Main):
              </span>

              <button
                type="button"
                onClick={() => handleSaveEmailsTxt(false)}
                disabled={discoveredRecords.length === 0}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-all disabled:opacity-40 shadow-sm"
                title="Download clean, deduplicated company emails as 1-per-line TXT"
              >
                <Download className="w-3 h-3" />
                Save TXT
              </button>

              <button
                type="button"
                onClick={() => handleSaveEmailsCsv(false, false)}
                disabled={discoveredRecords.length === 0}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-600 text-white flex items-center gap-1 transition-all disabled:opacity-40 shadow-sm"
                title="Download clean company emails as CSV list"
              >
                Save CSV
              </button>

              <button
                type="button"
                onClick={() => handleCopyCleanEmails(false)}
                disabled={discoveredRecords.length === 0}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-200 border border-emerald-800/50 flex items-center gap-1 transition-all disabled:opacity-40"
                title="Copy all clean discovered emails to clipboard (1 per line)"
              >
                <Copy className="w-3 h-3" />
                Copy All
              </button>

              <button
                type="button"
                onClick={() => handleUploadEmailsToCloudVault(false)}
                disabled={discoveredRecords.length === 0 || isUploadingEmailsToCloud}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-600/50 flex items-center gap-1 transition-all disabled:opacity-40"
                title="Save clean email list directly into Cloud Storage & Vault (accessible across all tabs)"
              >
                <CloudUpload className="w-3 h-3" />
                {isUploadingEmailsToCloud ? 'Saving...' : 'To Cloud'}
              </button>
            </div>

            {/* Group 2: Complete Audit Data (Optional) */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-900/60 border border-slate-700/60 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1">
                <Database className="w-3 h-3 text-indigo-400" />
                All Data:
              </span>

              <button
                type="button"
                onClick={() => exportDiscoveryToExcel(filteredRecords, domainsStatus, projectName)}
                disabled={discoveredRecords.length === 0}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 flex items-center gap-1 transition-all disabled:opacity-40"
                title="Export complete discovery audit spreadsheet with multiple sheets to Excel"
              >
                <FileSpreadsheet className="w-3 h-3" />
                Excel (XLSX)
              </button>

              <button
                type="button"
                onClick={() => exportDiscoveryToCsv(filteredRecords, `${projectName}_complete_audit.csv`)}
                disabled={discoveredRecords.length === 0}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 flex items-center gap-1 transition-all disabled:opacity-40"
                title="Export complete CSV with domains, websites, phones, source URLs & timestamps"
              >
                Full CSV
              </button>

              <button
                type="button"
                onClick={() => exportDiscoveryCategoriesZip(discoveredRecords, domainsStatus, projectName)}
                disabled={discoveredRecords.length === 0}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 flex items-center gap-1 transition-all disabled:opacity-40"
                title="Download categorized ZIP archive (Sales, Export, Procurement, Management)"
              >
                <Download className="w-3 h-3" />
                ZIP Archive
              </button>

              <button
                type="button"
                onClick={handleSaveToDatabase}
                disabled={isSavingSession || (domainsStatus.length === 0 && discoveredRecords.length === 0)}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 transition-all disabled:opacity-40"
                title="Save discovery project and records into persistent PostgreSQL database"
              >
                <Save className="w-3 h-3" />
                {isSavingSession ? 'Saving...' : 'Save DB'}
              </button>
            </div>
          </div>
        </div>

        {/* SEARCH, CATEGORY FILTER, & PIPELINE DISPATCH */}
        {viewTab !== 'saved_sessions' && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-gray-700/60">
            {/* Live Search Bar */}
            <div className="relative flex-grow max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by domain, email, company, or source URL..."
                className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category / Status Filter Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              {viewTab === 'emails' ? (
                <>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Category:</span>
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Categories ({discoveredRecords.length})</option>
                    {EMAIL_CATEGORIES_LIST.map(cat => (
                      <option key={cat} value={cat}>
                        {cat} ({categoryCounts.get(cat) || 0})
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-1.5 text-xs text-gray-300 ml-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deduplicateEmails}
                      onChange={e => setDeduplicateEmails(e.target.checked)}
                      className="rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Remove Duplicate Emails</span>
                  </label>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filter Companies:</span>
                  </div>
                  <select
                    value={companyStatusFilter}
                    onChange={e => setCompanyStatusFilter(e.target.value as any)}
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Companies ({domainsStatus.length})</option>
                    <option value="with_emails">With Emails ({websitesAccessedCount - companiesNoEmailsCount})</option>
                    <option value="no_emails">No Public Emails Found ({companiesNoEmailsCount})</option>
                    <option value="unavailable">Unavailable / Failed ({websitesUnavailableCount})</option>
                  </select>
                </>
              )}

              {/* Cross-Tab Dispatch Buttons */}
              <button
                type="button"
                onClick={() => handleSendToValidator(selectedEmailIds.size > 0)}
                disabled={filteredRecords.length === 0}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-950/80 hover:bg-orange-900/80 text-orange-300 border border-orange-700/60 flex items-center gap-1.5 transition-all ml-2 disabled:opacity-40"
                title="Send discovered emails to Email Validator for SMTP handshake testing"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Send to Validator{selectedEmailIds.size > 0 ? ` (${selectedEmailIds.size})` : ''}
              </button>

              <button
                type="button"
                onClick={() => handleSendToSender(selectedEmailIds.size > 0)}
                disabled={filteredRecords.length === 0}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-950/80 hover:bg-blue-900/80 text-blue-300 border border-blue-700/60 flex items-center gap-1.5 transition-all disabled:opacity-40"
                title="Send discovered company leads to Email Sender"
              >
                <Send className="w-3.5 h-3.5" />
                Send to Outreach{selectedEmailIds.size > 0 ? ` (${selectedEmailIds.size})` : ''}
              </button>
            </div>
          </div>
        )}

        {/* CATEGORY PILL CHIPS (Requirement 4) */}
        {viewTab === 'emails' && discoveredRecords.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              All Categories ({discoveredRecords.length})
            </button>
            {EMAIL_CATEGORIES_LIST.map(cat => {
              const count = categoryCounts.get(cat) || 0;
              if (count === 0 && selectedCategory !== cat) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-900 text-gray-300 hover:text-white border border-gray-800'
                  }`}
                >
                  {cat}: <strong className="text-white ml-1">{count}</strong>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* FLOATING SELECTION ACTION BAR (Save & Export Selected) */}
      {viewTab === 'emails' && selectedEmailIds.size > 0 && (
        <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border border-emerald-500/60 rounded-2xl p-3 shadow-2xl flex items-center justify-between flex-wrap gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-emerald-200">
              {selectedEmailIds.size} {selectedEmailIds.size === 1 ? 'Email' : 'Emails'} Selected
            </span>
            <span className="text-[11px] text-emerald-400/80">
              (out of {filteredRecords.length.toLocaleString()} displayed)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleSaveEmailsTxt(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all shadow-sm"
              title="Save selected emails as 1-per-line clean text file"
            >
              <Download className="w-3.5 h-3.5" />
              Save Selected (TXT)
            </button>

            <button
              type="button"
              onClick={() => handleSaveEmailsCsv(true, false)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-600 text-white flex items-center gap-1.5 transition-all shadow-sm"
              title="Save selected emails as clean CSV list"
            >
              <Download className="w-3.5 h-3.5" />
              Save Selected (CSV)
            </button>

            <button
              type="button"
              onClick={() => handleCopyCleanEmails(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 flex items-center gap-1.5 transition-all"
              title="Copy selected emails to clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Selected
            </button>

            <button
              type="button"
              onClick={() => handleUploadEmailsToCloudVault(true)}
              disabled={isUploadingEmailsToCloud}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/50 flex items-center gap-1.5 transition-all"
              title="Save selected emails to Cloud Storage & Vault"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              Save Selected to Cloud
            </button>

            <button
              type="button"
              onClick={() => setSelectedEmailIds(new Set())}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-all ml-1"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: DISCOVERED EMAILS TABLE (Requirement 6) */}
      {viewTab === 'emails' && (
        <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/80 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-900/90 text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-700/80">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredRecords.length > 0 && selectedEmailIds.size === filteredRecords.length}
                      onChange={handleSelectAllEmails}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                      title="Select or deselect all displayed emails"
                    />
                  </th>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-4">Company & Website</th>
                  <th className="py-3 px-4">Discovered Email</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Exact Source Page URL</th>
                  <th className="py-3 px-4">Found In</th>
                  <th className="py-3 px-4">Discovered At</th>
                  <th className="py-3 px-4">Discovery Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/70 text-gray-300">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-gray-400">
                      {isCrawling ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          <span>Actively crawling company websites for emails...</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Globe className="w-8 h-8 text-gray-500 mx-auto" />
                          <p className="font-semibold text-gray-300">No discovered emails to display yet.</p>
                          <p className="text-xs text-gray-500">
                            Upload company domains above and click "Start Website Crawling" to begin discovering emails.
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => {
                    const isCopied = copiedKey === `email_${record.id}`;
                    const isSelected = selectedEmailIds.has(record.id);
                    return (
                      <tr
                        key={record.id || index}
                        className={`transition-colors group ${
                          isSelected ? 'bg-emerald-950/30 hover:bg-emerald-950/40' : 'hover:bg-gray-800/60'
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectEmail(record.id)}
                            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 text-gray-500 font-mono text-[11px]">
                          {index + 1}
                        </td>

                        {/* Company Domain & Website */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">
                            {record.companyName || record.companyDomain}
                          </div>
                          <a
                            href={record.companyWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5"
                          >
                            <span>{record.companyDomain}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        </td>

                        {/* Discovered Email */}
                        <td className="py-3 px-4 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-300 select-all">
                              {record.email}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(record.email, `email_${record.id}`)}
                              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
                              title="Copy email address"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          {record.phone && (
                            <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 font-sans">
                              <Phone className="w-2.5 h-2.5 text-gray-500" />
                              <span>{record.phone}</span>
                            </div>
                          )}
                        </td>

                        {/* Category Badge */}
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            record.category === 'Sales'
                              ? 'bg-blue-950 text-blue-300 border-blue-700/60'
                              : record.category === 'Export'
                              ? 'bg-purple-950 text-purple-300 border-purple-700/60'
                              : record.category === 'Procurement' || record.category === 'Purchasing'
                              ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                              : record.category === 'Management'
                              ? 'bg-violet-950 text-violet-300 border-violet-700/60'
                              : record.category === 'Customer Support'
                              ? 'bg-teal-950 text-teal-300 border-teal-700/60'
                              : 'bg-gray-800 text-gray-300 border-gray-700'
                          }`}>
                            {record.category}
                          </span>
                        </td>

                        {/* Exact Source Page URL with direct link */}
                        <td className="py-3 px-4 max-w-xs">
                          <a
                            href={record.sourcePageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-300 hover:text-blue-300 font-mono text-[11px] truncate block flex items-center gap-1"
                            title={record.sourcePageUrl}
                          >
                            <LinkIcon className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="truncate">{record.sourcePageUrl.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60 flex-shrink-0" />
                          </a>
                          {record.pageTitle && (
                            <div className="text-[10px] text-gray-500 truncate mt-0.5">
                              {record.pageTitle}
                            </div>
                          )}
                        </td>

                        {/* Found In Context */}
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${
                            record.foundIn.includes('Google')
                              ? 'bg-indigo-950 text-indigo-300 border-indigo-700/60 font-semibold'
                              : 'bg-gray-900 text-gray-300 border-gray-800'
                          }`}>
                            {record.foundIn}
                          </span>
                        </td>

                        {/* Discovered At Date */}
                        <td className="py-3 px-4 text-gray-400 font-mono text-[10px]">
                          {new Date(record.discoveredAt).toLocaleString()}
                        </td>

                        {/* Discovery Status (Distinguishing Publicly Listed from Verified Deliverability) */}
                        <td className="py-3 px-4">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60"
                            title="Discovered as publicly listed on company website. Deliverability not independently verified."
                          >
                            {record.discoveryStatus || 'Publicly Listed'}
                          </span>
                        </td>

                        {/* Row Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleReprocessDomain(record.companyDomain)}
                            className="text-gray-400 hover:text-blue-300 p-1 rounded hover:bg-gray-800"
                            title="Reprocess this domain"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: COMPANIES & WEBSITES OVERVIEW (Requirement 5 & 7) */}
      {viewTab === 'companies' && (
        <div className="space-y-3">
          {filteredDomains.length === 0 ? (
            <div className="bg-gray-800/40 border border-gray-700/80 rounded-2xl p-12 text-center text-gray-400">
              <Building2 className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-300">No companies crawled yet.</p>
              <p className="text-xs text-gray-500">
                Load company domains above and click "Start Website Crawling" to view company breakdowns.
              </p>
            </div>
          ) : (
            filteredDomains.map((comp, idx) => {
              const isExpanded = expandedDomain === comp.domain;
              const companyEmails = discoveredRecords.filter(r => r.companyDomain === comp.domain);

              return (
                <div
                  key={comp.domain || idx}
                  className="bg-gray-800/40 border border-gray-700/80 rounded-xl overflow-hidden shadow-lg transition-all"
                >
                  {/* Company Summary Bar */}
                  <div
                    onClick={() => setExpandedDomain(isExpanded ? null : comp.domain)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-gray-800/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button type="button" className="text-gray-400 hover:text-white">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{comp.companyName || comp.domain}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            comp.status === 'success'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : comp.status === 'no_emails'
                              ? 'bg-amber-950 text-amber-300 border-amber-700'
                              : 'bg-red-950 text-red-300 border-red-700'
                          }`}>
                            {comp.status === 'success'
                              ? `${comp.emailsCount} Emails Found`
                              : comp.status === 'no_emails'
                              ? 'No Public Emails'
                              : 'Unavailable'}
                          </span>
                        </div>

                        <a
                          href={comp.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5 font-mono"
                        >
                          <span>{comp.domain}</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <div>
                        Pages Scanned: <strong className="text-white">{comp.pagesScanned}</strong>
                      </div>
                      {comp.error && (
                        <div className="text-red-400 text-xs">
                          {comp.error}
                        </div>
                      )}

                      {/* Search on Google button if no emails found */}
                      {comp.status === 'no_emails' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSearchGoogleForDomain(comp.domain, comp.companyName);
                          }}
                          disabled={searchingDomain === comp.domain}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-gradient-to-r from-amber-700 to-orange-700 hover:from-amber-600 hover:to-orange-600 text-white border border-amber-500/40 flex items-center gap-1 shadow-sm"
                          title="Search Google & search engine index for publicly listed emails"
                        >
                          <Search className="w-3 h-3" />
                          {searchingDomain === comp.domain ? 'Searching...' : 'Search Google'}
                        </button>
                      )}

                      <a
                        href={`https://www.google.com/search?q=site:${encodeURIComponent(comp.domain)}+("contact"+OR+"email"+OR+"@${encodeURIComponent(comp.domain)}")`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-blue-300 border border-gray-700 flex items-center gap-1"
                        title="Open Google Dork in new browser tab"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Google Dork
                      </a>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReprocessDomain(comp.domain);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reprocess
                      </button>
                    </div>
                  </div>

                  {/* Expanded Subpages & Discovered Emails Accordion */}
                  {isExpanded && (
                    <div className="p-4 bg-gray-900/80 border-t border-gray-700/80 space-y-4">
                      {/* Discovered Emails for this company */}
                      <div>
                        <h5 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          Discovered Emails ({companyEmails.length})
                        </h5>

                        {companyEmails.length === 0 ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-amber-950/20 border border-amber-700/40 rounded-xl">
                            <p className="text-xs text-amber-200/90 italic">
                              No publicly displayed emails found on scanned website pages.
                            </p>
                            <button
                              type="button"
                              onClick={() => handleSearchGoogleForDomain(comp.domain, comp.companyName)}
                              disabled={searchingDomain === comp.domain}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white flex items-center gap-1.5 w-fit shadow-md shadow-amber-950/40"
                            >
                              <Search className="w-3.5 h-3.5" />
                              {searchingDomain === comp.domain ? 'Searching Google...' : 'Search Google for Company Emails'}
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {companyEmails.map(em => (
                              <div
                                key={em.id}
                                className="p-3 bg-gray-800/80 border border-gray-700 rounded-xl flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-mono text-xs font-bold text-emerald-300 select-all">
                                    {em.email}
                                  </div>
                                  <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-1">
                                    <span className="text-blue-300 font-semibold">{em.category}</span>
                                    <span>•</span>
                                    <span className="truncate max-w-[200px]" title={em.sourcePageUrl}>
                                      {em.sourcePageUrl.replace(/^https?:\/\//, '')}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(em.email, em.id)}
                                  className="text-gray-400 hover:text-white p-1"
                                >
                                  {copiedKey === em.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Scanned Internal Subpages */}
                      {comp.crawledPages && comp.crawledPages.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-purple-400" />
                            Scanned Internal Website Pages ({comp.crawledPages.length})
                          </h5>
                          <div className="space-y-1">
                            {comp.crawledPages.map((pg, pIdx) => (
                              <div
                                key={pIdx}
                                className="flex items-center justify-between text-xs py-1.5 px-3 bg-gray-800/50 rounded-lg font-mono text-gray-300"
                              >
                                <a
                                  href={pg.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-blue-300 truncate max-w-lg flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3 text-gray-500" />
                                  <span className="truncate">{pg.url}</span>
                                </a>
                                <span className="text-[11px] text-emerald-400 font-sans">
                                  {pg.emailsFound} emails found
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 3: SAVED DATABASE PROJECTS (Requirement 9) */}
      {viewTab === 'saved_sessions' && (
        <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-700">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                Persistent Discovery Projects Database
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Saved email discovery projects stored securely in the server database. Open and resume any project anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshSavedSessions}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {isLoadingSessions ? (
            <div className="py-8 text-center text-gray-400">Loading saved sessions...</div>
          ) : savedSessions.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Database className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-300">No saved discovery projects yet.</p>
              <p className="text-xs text-gray-500">
                After crawling company websites, click "Save to DB" to store the project permanently.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedSessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => handleLoadSavedSession(session.id)}
                  className="p-5 bg-gray-900 border border-gray-700/80 hover:border-indigo-500/80 rounded-xl cursor-pointer transition-all hover:shadow-xl space-y-3 group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {session.title}
                      </h4>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-gray-500" />
                        {new Date(session.updatedAt).toLocaleString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSavedSession(session.id, e)}
                      className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-800 transition-colors"
                      title="Delete saved project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800 text-xs text-gray-300 font-mono">
                    <div>
                      <span className="text-[10px] text-gray-500 block uppercase">Domains</span>
                      <strong>{session.totalDomains}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block uppercase">Emails Found</span>
                      <strong className="text-emerald-400">{session.totalEmailsFound}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block uppercase">Pages Scanned</span>
                      <strong>{session.totalPagesScanned}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* MODE 2: SEARCH ENGINE COMPANY & WEBSITE FINDER */}
      {activeWorkspaceMode === 'company_finder' && (
        <div className="space-y-6">
          {/* COMPANY FINDER DASHBOARD METRICS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Metric 1: Total Companies */}
            <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/70 rounded-xl p-4 shadow-lg flex flex-col justify-between">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                Companies
              </span>
              <div className="text-2xl font-bold text-white mt-1">
                {totalCompaniesCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">
                {companyQueries.length > 0 ? `${companyQueries.length} loaded in queue` : 'Enter names or upload file'}
              </span>
            </div>

            {/* Metric 2: Verified Official Websites */}
            <div className="bg-gray-800/60 backdrop-blur-sm border border-emerald-900/40 rounded-xl p-4 shadow-lg flex flex-col justify-between">
              <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified Websites
              </span>
              <div className="text-2xl font-bold text-emerald-300 mt-1">
                {verifiedWebsitesCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-400/80 mt-1">
                {companyResults.length ? `${Math.round((verifiedWebsitesCount / companyResults.length) * 100)}% high confidence (≥70%)` : 'Strict accuracy filter'}
              </span>
            </div>

            {/* Metric 3: Probable Matches */}
            <div className="bg-gray-800/60 backdrop-blur-sm border border-amber-900/40 rounded-xl p-4 shadow-lg flex flex-col justify-between">
              <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Probable Matches
              </span>
              <div className="text-2xl font-bold text-amber-300 mt-1">
                {probableWebsitesCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-amber-400/80 mt-1">
                40% - 69% confidence score
              </span>
            </div>

            {/* Metric 4: Discovered Corporate Emails */}
            <div className="bg-gray-800/60 backdrop-blur-sm border border-blue-900/40 rounded-xl p-4 shadow-lg flex flex-col justify-between">
              <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Corporate Emails
              </span>
              <div className="text-2xl font-bold text-blue-300 mt-1">
                {totalCompanyEmailsCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-blue-300/80 mt-1 font-mono">
                {uniqueCompanyEmailsCount.toLocaleString()} unique addresses
              </span>
            </div>

            {/* Metric 5: No Website Found */}
            <div className="bg-gray-800/60 backdrop-blur-sm border border-red-900/40 rounded-xl p-4 shadow-lg flex flex-col justify-between">
              <span className="text-[11px] font-medium text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                No Website Found
              </span>
              <div className="text-2xl font-bold text-red-300 mt-1">
                {noWebsiteCompaniesCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-red-400/80 mt-1">
                Directories bypassed / no site
              </span>
            </div>
          </div>

          {/* INPUT ZONE & SEARCH ENGINE CONTROL DECK */}
          <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/80 rounded-2xl p-6 shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT: Company Names & Products Text Area */}
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-sm font-semibold text-white flex items-center gap-2">
                    <Search className="w-4 h-4 text-purple-400" />
                    Company Names & Optional Products/Services
                    {companyQueries.length > 0 && (
                      <span className="text-xs font-normal text-purple-300 bg-purple-950/70 border border-purple-700/50 px-2 py-0.5 rounded-full font-mono">
                        {companyQueries.length.toLocaleString()} companies parsed
                      </span>
                    )}
                  </label>

                  {/* Actions & File Upload */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      ref={companyFileInputRef}
                      type="file"
                      accept=".txt,.csv,.xlsx,.xls"
                      onChange={handleCompanyFileUpload}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => companyFileInputRef.current?.click()}
                      disabled={isSearchingCompanies}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 flex items-center gap-1.5 transition-all shadow-sm"
                      title="Upload Excel (XLSX, XLS), CSV, or TXT file with company names and products"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-300" />
                      Upload File (.xlsx, .csv, .txt)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const sampleText = [
                          'Siemens - Industrial Automation & Drives - Germany',
                          'Bosch - Automotive Parts & Mobility - Germany',
                          'Pfizer - Bio-Pharmaceuticals & Vaccines - USA',
                          'Novartis - Healthcare & Oncology - Switzerland',
                          'Maersk - Container Logistics & Shipping - Denmark',
                          'ABB - Robotics & Electrification - Switzerland',
                          'Schneider Electric - Energy Management & Automation - France',
                          'Caterpillar - Heavy Construction Machinery - USA'
                        ].join('\n');
                        setCompanyInputText(sampleText);
                        const parsed = parseCompanyNamesFromText(sampleText);
                        setCompanyQueries(parsed.queries);
                        showToast(`✓ Loaded ${parsed.queries.length} sample companies with products!`);
                      }}
                      disabled={isSearchingCompanies}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex items-center gap-1 transition-all"
                      title="Load sample global enterprise list with products and locations"
                    >
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      Sample
                    </button>

                    {companyInputText && (
                      <button
                        type="button"
                        onClick={handleClearCompanySearch}
                        disabled={isSearchingCompanies}
                        className="px-2 py-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors"
                        title="Clear input and results"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Auto Column Mapping Banner */}
                {companyDetectedColumns && companyDetectedColumns.length > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-950/60 border border-indigo-600/40 text-[11px] text-indigo-300">
                    <CheckCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>
                      Smart Column Mapping Active: <strong>{companyDetectedColumns.join(' • ')}</strong>
                    </span>
                  </div>
                )}

                <div className="relative">
                  <textarea
                    value={companyInputText}
                    onChange={handleCompanyTextChange}
                    placeholder={`Enter company names to research on Google & search engines:\n\nAcme Corporation\nSiemens - Industrial Automation - Germany\nNovartis - Pharmaceuticals\nGeneral Electric - Aviation & Power\nMaersk - Container Shipping\n\nSupports 1 company per line, or CSV/TSV table with 'Company Name', 'Product/Service', and 'Country' columns.`}
                    rows={8}
                    className="w-full bg-gray-900/90 border border-gray-700 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-mono resize-y"
                    disabled={isSearchingCompanies}
                  />
                  <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                    <span>Format: Plain company names, CSV columns, or 'Company - Product - Country'</span>
                    <span>{companyQueries.length.toLocaleString()} companies ready</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: Search Engine Control Deck */}
              <div className="lg:col-span-4 flex flex-col justify-between space-y-4 bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center justify-between">
                    <span>Search Engine Research</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                      isSearchingCompanies
                        ? isCompanySearchPaused
                          ? 'bg-amber-950 text-amber-300 border-amber-600'
                          : 'bg-purple-950 text-purple-300 border-purple-500 animate-pulse'
                        : 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}>
                      {isSearchingCompanies ? (isCompanySearchPaused ? 'Paused' : 'Searching Engines') : 'Standby'}
                    </span>
                  </h3>

                  <div className="mt-3 space-y-2.5 text-xs text-gray-300">
                    {/* Concurrency Selector */}
                    <div className="py-1 border-b border-gray-800 flex items-center justify-between">
                      <span className="text-gray-400">Parallel Workers:</span>
                      <select
                        value={companyConcurrency}
                        onChange={e => setCompanyConcurrency(Math.min(4, Math.max(1, parseInt(e.target.value) || 2)))}
                        disabled={isSearchingCompanies}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-purple-300 font-semibold"
                      >
                        <option value={1}>1 Worker (Polite)</option>
                        <option value={2}>2 Workers (Optimal)</option>
                        <option value={3}>3 Workers (Fast)</option>
                        <option value={4}>4 Workers (Max)</option>
                      </select>
                    </div>

                    {/* Email Discovery Checkbox */}
                    <div className="py-1 border-b border-gray-800">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={companyDiscoverEmails}
                          onChange={e => setCompanyDiscoverEmails(e.target.checked)}
                          disabled={isSearchingCompanies}
                          className="w-3.5 h-3.5 accent-purple-500 rounded cursor-pointer"
                        />
                        <span className="text-xs text-gray-200 font-medium">Discover Corporate Emails</span>
                      </label>
                      <p className="text-[10px] text-gray-400 pl-5.5 mt-0.5">
                        Crawls verified official website & Google search index for clean corporate emails (sales@, info@, export@).
                      </p>
                    </div>

                    {/* Strict Directory Filter Note */}
                    <div className="py-1 text-[11px] text-emerald-400/90 flex items-start gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                      <span>
                        Strict Anti-Directory Filtering active: automatically bypasses Wikipedia, Yelp, LinkedIn, YellowPages, Facebook & catalog scrapers.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div className="space-y-2 pt-2">
                  {!isSearchingCompanies ? (
                    <button
                      type="button"
                      onClick={handleStartCompanySearch}
                      disabled={companyQueries.length === 0}
                      className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-600/30 border border-purple-400/40 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Search className="w-4 h-4" />
                      Find Websites on Google ({companyQueries.length.toLocaleString()})
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleToggleCompanyPause}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 transition-all ${
                          isCompanySearchPaused
                            ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400/40 shadow-lg shadow-amber-600/30'
                            : 'bg-gray-800 hover:bg-gray-700 text-amber-300 border-gray-600'
                        }`}
                      >
                        {isCompanySearchPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                        {isCompanySearchPaused ? 'Resume' : 'Pause'}
                      </button>

                      <button
                        type="button"
                        onClick={handleStopCompanySearch}
                        className="py-2.5 px-3 rounded-xl font-bold text-xs bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/50 flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        Stop
                      </button>
                    </div>
                  )}

                  {companyResults.length > 0 && !isSearchingCompanies && (
                    <button
                      type="button"
                      onClick={handleTransferVerifiedWebsitesToCrawler}
                      disabled={verifiedWebsitesCount + probableWebsitesCount === 0}
                      className="w-full py-2 px-3 rounded-xl font-semibold text-xs bg-gradient-to-r from-blue-700 to-teal-700 hover:from-blue-600 hover:to-teal-600 text-white border border-teal-400/40 flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Transfer {verifiedWebsitesCount + probableWebsitesCount} Verified Websites to Deep Crawler
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* LIVE SEARCH ENGINE PROGRESS BAR & WORKERS */}
            {isSearchingCompanies && (
              <div className="mt-4 pt-4 border-t border-gray-700/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                    Searching Google & Multi-Engine:
                  </span>
                  <span className="font-mono text-gray-300">
                    {companyProgressIndex} / {companyQueries.length} companies ({companyProgressPercent}%)
                  </span>
                </div>

                <div className="w-full h-2.5 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-400 transition-all duration-300"
                    style={{ width: `${companyProgressPercent}%` }}
                  />
                </div>

                {companyActiveWorkers.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[11px] text-gray-400 font-medium">Active Workers:</span>
                    {companyActiveWorkers.map((wName, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono bg-purple-950/80 border border-purple-700/60 text-purple-300 shadow-sm"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {wName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ACTION & EXPORT BAR FOR COMPANY FINDER */}
          <div className="bg-gray-800/60 backdrop-blur-md border border-gray-700/80 rounded-2xl p-4 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCompanyFinderStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    companyFinderStatusFilter === 'all'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  All Researched ({companyResults.length})
                </button>

                <button
                  type="button"
                  onClick={() => setCompanyFinderStatusFilter('verified')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    companyFinderStatusFilter === 'verified'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-gray-900 text-emerald-400 hover:text-white border border-gray-800'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified Official ({verifiedWebsitesCount})
                </button>

                <button
                  type="button"
                  onClick={() => setCompanyFinderStatusFilter('probable')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    companyFinderStatusFilter === 'probable'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'bg-gray-900 text-amber-400 hover:text-white border border-gray-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Probable ({probableWebsitesCount})
                </button>

                <button
                  type="button"
                  onClick={() => setCompanyFinderStatusFilter('with_emails')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    companyFinderStatusFilter === 'with_emails'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-gray-900 text-blue-400 hover:text-white border border-gray-800'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Has Emails ({companyResults.filter(r => r.discoveredEmails.length > 0).length})
                </button>

                <button
                  type="button"
                  onClick={() => setCompanyFinderStatusFilter('no_website')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    companyFinderStatusFilter === 'no_website'
                      ? 'bg-red-700 text-white shadow-md shadow-red-700/30'
                      : 'bg-gray-900 text-red-400 hover:text-white border border-gray-800'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  No Website ({noWebsiteCompaniesCount})
                </button>
              </div>

              {/* Action Buttons: 1-Click Pipeline Transfer & Exports */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Primary: Transfer to Crawler */}
                <button
                  type="button"
                  onClick={handleTransferVerifiedWebsitesToCrawler}
                  disabled={verifiedWebsitesCount + probableWebsitesCount === 0}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 disabled:opacity-40 text-white border border-teal-400/50 flex items-center gap-1.5 shadow-md shadow-teal-700/30 transition-all cursor-pointer"
                  title="Send all verified official websites into the Deep Subpage Crawler queue"
                >
                  <Globe className="w-3.5 h-3.5 text-teal-200" />
                  <span>Send to Domain Crawler</span>
                  {verifiedWebsitesCount + probableWebsitesCount > 0 && (
                    <span className="bg-teal-950 px-1.5 py-0.5 rounded-full text-[10px] font-mono border border-teal-400/50">
                      {verifiedWebsitesCount + probableWebsitesCount}
                    </span>
                  )}
                </button>

                {/* Clean Emails Exports */}
                <button
                  type="button"
                  onClick={handleExportCompanyEmailsTxt}
                  disabled={totalCompanyEmailsCount === 0}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-500/50 flex items-center gap-1.5 disabled:opacity-40 transition-all shadow-sm"
                  title="Export discovered corporate emails as clean 1-per-line TXT"
                >
                  <Mail className="w-3.5 h-3.5 text-emerald-200" />
                  Save Emails (TXT)
                </button>

                {/* Clean Websites Exports */}
                <button
                  type="button"
                  onClick={() => handleExportCompanyWebsitesTxt(true)}
                  disabled={verifiedWebsitesCount + probableWebsitesCount === 0}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-gray-800 hover:bg-gray-750 text-gray-200 border border-gray-700 flex items-center gap-1.5 disabled:opacity-40 transition-all"
                  title="Save clean verified company websites/domains as TXT"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  Save Websites (TXT)
                </button>

                {/* Full Excel Export */}
                <button
                  type="button"
                  onClick={handleExportCompanyExcel}
                  disabled={companyResults.length === 0}
                  className="px-3 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white border border-emerald-400/40 flex items-center gap-1.5 disabled:opacity-40 transition-all shadow-sm"
                  title="Download complete research report with Companies, Verified Websites, and Discovered Emails sheets"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
                  Excel Report (.xlsx)
                </button>

                <button
                  type="button"
                  onClick={handleExportCompanyCsv}
                  disabled={companyResults.length === 0}
                  className="px-2.5 py-2 text-xs font-semibold rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex items-center gap-1 disabled:opacity-40 transition-all"
                  title="Download company research results as CSV"
                >
                  CSV
                </button>
              </div>
            </div>

            {/* Search Filter input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={companySearchTerm}
                onChange={e => setCompanySearchTerm(e.target.value)}
                placeholder="Search researched companies by name, products, website domain, or email..."
                className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* RESEARCHED COMPANIES RESULTS TABLE */}
          <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/80 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-900/90 text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-700/80">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4 min-w-[200px]">Company Name & Products</th>
                    <th className="py-3 px-4 min-w-[220px]">Official Website (Verified)</th>
                    <th className="py-3 px-4 min-w-[130px]">Accuracy Score</th>
                    <th className="py-3 px-4 min-w-[240px]">Discovered Corporate Emails</th>
                    <th className="py-3 px-4 min-w-[150px]">Verification Reason</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-gray-200">
                  {filteredCompanyResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/50 text-purple-400 flex items-center justify-center mx-auto">
                            <Search className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-semibold text-gray-300">
                            {companyResults.length === 0
                              ? "No companies researched yet"
                              : "No companies match the selected filter"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {companyResults.length === 0
                              ? "Upload or enter company names (with or without products) above and click 'Find Websites on Google' to automatically locate authentic official websites and corporate emails."
                              : "Try adjusting your search query or switching to 'All Researched'."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCompanyResults.map((result, idx) => {
                      const isHighConf = result.confidenceScore >= 70;
                      const isProbable = result.confidenceScore >= 40 && result.confidenceScore < 70;
                      const isExpanded = expandedCompanyId === result.id;

                      return (
                        <tr
                          key={result.id || idx}
                          className="hover:bg-gray-800/50 transition-colors group"
                        >
                          <td className="py-3 px-4 text-center text-gray-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Company Name, Products & Country */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <span className="font-bold text-white text-sm block">
                                {result.companyName}
                              </span>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {result.productsOrServices && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-purple-950/70 border border-purple-700/50 text-purple-300">
                                    <Package className="w-2.5 h-2.5" />
                                    {result.productsOrServices}
                                  </span>
                                )}
                                {result.countryOrLocation && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-950/70 border border-blue-700/50 text-blue-300">
                                    <MapPin className="w-2.5 h-2.5" />
                                    {result.countryOrLocation}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Official Website */}
                          <td className="py-3 px-4">
                            {result.cleanDomain && result.officialWebsite ? (
                              <div className="space-y-1">
                                <a
                                  href={result.officialWebsite}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono font-semibold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 text-xs"
                                >
                                  <span>{result.cleanDomain}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                                {result.pageTitle && (
                                  <span className="text-[11px] text-gray-400 block truncate max-w-xs" title={result.pageTitle}>
                                    {result.pageTitle}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-gray-500 italic text-xs">
                                <XCircle className="w-3.5 h-3.5 text-red-400/80" />
                                <span>No official website found</span>
                              </div>
                            )}
                          </td>

                          {/* Accuracy Score */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold font-mono border ${
                                  isHighConf
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60 shadow-sm'
                                    : isProbable
                                    ? 'bg-amber-950/80 text-amber-300 border-amber-600/60'
                                    : 'bg-red-950/80 text-red-400 border-red-700/60'
                                }`}
                              >
                                {isHighConf && <CheckCircle2 className="w-3 h-3" />}
                                {isProbable && <ShieldCheck className="w-3 h-3" />}
                                {!isHighConf && !isProbable && <XCircle className="w-3 h-3" />}
                                {result.confidenceScore}% {isHighConf ? 'Authentic' : isProbable ? 'Probable' : 'Unmatched'}
                              </span>
                            </div>
                          </td>

                          {/* Discovered Corporate Emails */}
                          <td className="py-3 px-4">
                            {result.discoveredEmails && result.discoveredEmails.length > 0 ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {result.discoveredEmails.slice(0, 3).map((e, eIdx) => (
                                    <button
                                      key={eIdx}
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(e.email);
                                        showToast(`✓ Copied ${e.email} to clipboard!`);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-200 text-[11px] font-mono transition-colors group/em"
                                      title={`Category: ${e.category} • Source: ${e.sourcePageUrl} (Click to copy)`}
                                    >
                                      <span>{e.email}</span>
                                      <Copy className="w-2.5 h-2.5 opacity-60 group-hover/em:opacity-100" />
                                    </button>
                                  ))}
                                  {result.discoveredEmails.length > 3 && (
                                    <span className="text-[10px] text-gray-400 font-mono">
                                      +{result.discoveredEmails.length - 3} more
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-500 block">
                                  {result.discoveredEmails.length} public business {result.discoveredEmails.length === 1 ? 'address' : 'addresses'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-500 italic">
                                No public emails on scanned pages
                              </span>
                            )}
                          </td>

                          {/* Verification Reason */}
                          <td className="py-3 px-4">
                            <span className="text-[11px] text-gray-400 leading-tight block max-w-xs">
                              {result.verificationReason || 'Search engine match'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {result.cleanDomain && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(result.cleanDomain!);
                                    showToast(`✓ Copied domain ${result.cleanDomain}!`);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors"
                                  title="Copy domain name"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {result.cleanDomain && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDomainQueue(prev => Array.from(new Set([...prev, result.cleanDomain!.toLowerCase()])));
                                    setInputText(prev => prev ? `${prev}\n${result.cleanDomain}` : result.cleanDomain!);
                                    setActiveWorkspaceMode('crawler');
                                    showToast(`✓ Added ${result.cleanDomain} to Crawler queue!`);
                                  }}
                                  className="p-1.5 text-blue-400 hover:text-blue-300 rounded hover:bg-blue-950 transition-colors"
                                  title="Send this website to Direct Domain Crawler"
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {result.discoveredEmails.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const ems = result.discoveredEmails.map(e => e.email).join('\n');
                                    navigator.clipboard.writeText(ems);
                                    showToast(`✓ Copied ${result.discoveredEmails.length} emails for ${result.companyName}!`);
                                  }}
                                  className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded hover:bg-emerald-950 transition-colors"
                                  title="Copy all corporate emails for this company"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showConfigModal && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Crawler Engine Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Concurrency */}
              <div>
                <div className="flex justify-between font-semibold text-gray-200 mb-1">
                  <span>Concurrent Crawling Workers:</span>
                  <span className="text-blue-400 font-mono">{config.concurrency} parallel domains</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={config.concurrency}
                  onChange={e => setConfig({ ...config, concurrency: parseInt(e.target.value) })}
                  className="w-full accent-blue-500"
                />
                <span className="text-[10px] text-gray-400">Controls how many company websites are inspected simultaneously.</span>
              </div>

              {/* Max Pages per Domain */}
              <div>
                <div className="flex justify-between font-semibold text-gray-200 mb-1">
                  <span>Max Subpages per Company Domain:</span>
                  <span className="text-purple-400 font-mono">{config.maxPagesPerDomain} pages</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={1}
                  value={config.maxPagesPerDomain}
                  onChange={e => setConfig({ ...config, maxPagesPerDomain: parseInt(e.target.value) })}
                  className="w-full accent-purple-500"
                />
                <span className="text-[10px] text-gray-400">Inspects Homepage plus top prioritized Contact, Sales, Export, About & Management links.</span>
              </div>

              {/* Request Timeout */}
              <div>
                <div className="flex justify-between font-semibold text-gray-200 mb-1">
                  <span>Page Request Timeout:</span>
                  <span className="text-amber-400 font-mono">{(config.timeoutMs / 1000).toFixed(1)} seconds</span>
                </div>
                <input
                  type="range"
                  min={3000}
                  max={15000}
                  step={1000}
                  value={config.timeoutMs}
                  onChange={e => setConfig({ ...config, timeoutMs: parseInt(e.target.value) })}
                  className="w-full accent-amber-500"
                />
                <span className="text-[10px] text-gray-400">Avoids hanging on unresponsive servers or slow network routes.</span>
              </div>

              {/* Polite Crawl Delay */}
              <div>
                <div className="flex justify-between font-semibold text-gray-200 mb-1">
                  <span>Polite Request Delay between Subpages:</span>
                  <span className="text-emerald-400 font-mono">{config.politeDelayMs} ms</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={1500}
                  step={50}
                  value={config.politeDelayMs}
                  onChange={e => setConfig({ ...config, politeDelayMs: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
                <span className="text-[10px] text-gray-400">Protects target websites from excessive traffic by pacing internal page visits.</span>
              </div>

              {/* Google Search Fallback Option */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-1">
                <label className="flex items-center justify-between font-semibold text-gray-200 cursor-pointer">
                  <span className="flex items-center gap-1.5 text-indigo-300">
                    <Search className="w-3.5 h-3.5" />
                    Google Search Fallback (if no email found):
                  </span>
                  <input
                    type="checkbox"
                    checked={config.searchGoogleIfNoEmail}
                    onChange={e => setConfig({ ...config, searchGoogleIfNoEmail: e.target.checked })}
                    className="w-4 h-4 accent-indigo-500 rounded"
                  />
                </label>
                <p className="text-[10px] text-gray-400">
                  When a website crawl discovers 0 emails, automatically queries Google & search engines to extract public emails from company indexed subpages and search snippets.
                </p>
              </div>

              {/* Strict Company Email Filter Option */}
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-1">
                <label className="flex items-center justify-between font-semibold text-gray-200 cursor-pointer">
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Strict Company Email Filter (Anti-Junk/Bot/Hash):
                  </span>
                  <input
                    type="checkbox"
                    checked={config.strictCorporateFilter}
                    onChange={e => setConfig({ ...config, strictCorporateFilter: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>
                <p className="text-[10px] text-gray-400">
                  Strictly discards bots (`noreply@`, `daemon@`, `system@`), random alphanumeric hashes, tracking tokens, and unrelated 3rd-party tracker domains (`sentry.io`, `doubleclick.net`, `wordpress.org`).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setConfig({ ...DEFAULT_DISCOVERY_CONFIG })}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
              >
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfigModal(false);
                  showToast("Crawl settings applied.");
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE DATA & CLEAN EMAILS MODAL (Requirement: Save clean emails as main focus, save all data if wanted) */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    Save & Export Center
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Clean Emails Priority
                    </span>
                  </h3>
                  <p className="text-gray-400 text-xs">
                    Save clean corporate emails for immediate outreach or export full discovery audit records.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="flex border-b border-gray-800 bg-gray-950/60 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => setSaveModalTab('emails')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  saveModalTab === 'emails'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-700/30 ring-1 ring-emerald-400/50'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                }`}
              >
                <Mail className="w-4 h-4 text-emerald-200" />
                <span>Save Clean Emails (Main Focus)</span>
                {uniqueEmailsCount > 0 && (
                  <span className="bg-emerald-950/80 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                    {uniqueEmailsCount.toLocaleString()}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSaveModalTab('all_data')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  saveModalTab === 'all_data'
                    ? 'bg-slate-800 text-white shadow-lg ring-1 ring-slate-600'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                }`}
              >
                <Database className="w-4 h-4 text-indigo-400" />
                <span>Save All Data (Complete Audit)</span>
                <span className="bg-slate-900 text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {discoveredRecords.length} records
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {saveModalTab === 'emails' ? (
                /* TAB 1: CLEAN EMAILS ONLY (MAIN FOCUS) */
                <div className="space-y-4">
                  <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Corporate Clean Email Guarantee</span>
                    </div>
                    <p className="text-gray-300 text-[11px] leading-relaxed">
                      All saved emails are filtered to eliminate computer-generated tokens, hash strings, bot accounts (<code className="text-emerald-300">noreply@</code>, <code className="text-emerald-300">daemon@</code>), and 3rd-party tracker domains. Pure corporate addresses ready for cold outreach and CRM import.
                    </p>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-gray-800/70 border border-gray-700/60 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold">Total Clean Emails</span>
                      <div className="text-lg font-bold text-emerald-300 font-mono mt-0.5">
                        {uniqueEmailsCount.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-800/70 border border-gray-700/60 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold">Active Category</span>
                      <div className="text-sm font-semibold text-white mt-1 truncate">
                        {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
                      </div>
                    </div>
                    <div className="bg-gray-800/70 border border-gray-700/60 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold">Selection Status</span>
                      <div className="text-sm font-semibold text-teal-300 mt-1">
                        {selectedEmailIds.size > 0 ? `${selectedEmailIds.size} Selected` : 'All Emails'}
                      </div>
                    </div>
                  </div>

                  {/* Clean Email Save Options */}
                  <div className="space-y-2.5 pt-1">
                    {/* Option 1: TXT (1 email per line) */}
                    <div className="p-3.5 bg-gray-800/50 hover:bg-gray-800/80 border border-gray-700/60 rounded-xl flex items-center justify-between gap-3 transition-colors">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <span>1. Clean TXT File (1 Email Per Line)</span>
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                            Recommended for Outreach
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Pure text file with one clean email address per line. No headers, quotes, or trailing characters.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedEmailIds.size > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              handleSaveEmailsTxt(true);
                              setIsSaveModalOpen(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold text-xs whitespace-nowrap"
                          >
                            Save Selected ({selectedEmailIds.size})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            handleSaveEmailsTxt(false);
                            setIsSaveModalOpen(false);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Save All TXT
                        </button>
                      </div>
                    </div>

                    {/* Option 2: Clean CSV */}
                    <div className="p-3.5 bg-gray-800/50 hover:bg-gray-800/80 border border-gray-700/60 rounded-xl flex items-center justify-between gap-3 transition-colors">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                          <span>2. Clean CSV Spreadsheet</span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Single-column or two-column CSV (Email, Company Domain) ready for spreadsheet applications.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleSaveEmailsCsv(selectedEmailIds.size > 0, true);
                            setIsSaveModalOpen(false);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-medium text-xs whitespace-nowrap"
                          title="Include company domain as second column"
                        >
                          Email + Domain
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSaveEmailsCsv(selectedEmailIds.size > 0, false);
                            setIsSaveModalOpen(false);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Save CSV
                        </button>
                      </div>
                    </div>

                    {/* Option 3: Copy to Clipboard */}
                    <div className="p-3.5 bg-gray-800/50 hover:bg-gray-800/80 border border-gray-700/60 rounded-xl flex items-center justify-between gap-3 transition-colors">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Copy className="w-4 h-4 text-blue-400" />
                          <span>3. Quick Copy to Clipboard</span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Instantly copies the deduplicated email list directly into your system clipboard.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleCopyCleanEmails(selectedEmailIds.size > 0);
                          setIsSaveModalOpen(false);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy Clean Emails
                      </button>
                    </div>

                    {/* Option 4: Save to Cloud Vault & Database */}
                    <div className="p-3.5 bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-500/50 rounded-xl flex items-center justify-between gap-3 transition-colors">
                      <div className="space-y-0.5">
                        <div className="font-bold text-emerald-200 flex items-center gap-1.5">
                          <CloudUpload className="w-4 h-4 text-emerald-400" />
                          <span>4. Save Clean Emails to Cloud Storage & DB</span>
                          <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-900/80 px-1.5 py-0.5 rounded border border-emerald-600">
                            All-Tab Cloud Sync
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-300">
                          Saves the email list permanently into cloud storage so you can immediately use it in the Email Sorter, Email Validator, or Outreach Sender without re-uploading.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isUploadingEmailsToCloud}
                        onClick={async () => {
                          await handleUploadEmailsToCloudVault(selectedEmailIds.size > 0);
                          setIsSaveModalOpen(false);
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-700/30 whitespace-nowrap"
                      >
                        <CloudUpload className="w-4 h-4" />
                        {isUploadingEmailsToCloud ? 'Saving to Cloud...' : 'Save to Cloud Vault'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* TAB 2: SAVE ALL DATA (COMPLETE AUDIT) */
                <div className="space-y-4">
                  <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/30 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                      <Database className="w-4 h-4 text-indigo-400" />
                      <span>Full Discovery Audit Dataset</span>
                    </div>
                    <p className="text-gray-300 text-[11px] leading-relaxed">
                      Saves the entire technical record including company domains, verified websites, exact source page URLs, phone numbers, page titles, crawl depth, and timestamps.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {/* Option 1: Multi-Sheet Excel */}
                    <div className="p-3.5 bg-gray-800/50 hover:bg-gray-800/80 border border-gray-700/60 rounded-xl flex items-center justify-between gap-3 transition-colors">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                          <span>Multi-Sheet Excel Workbook (.XLSX)</span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Three styled worksheets: "Discovered Emails", "Website Crawl Audit", and "Scanned URLs Log".
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          exportDiscoveryToExcel(filteredRecords, domainsStatus, projectName);
                          setIsSaveModalOpen(false);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download XLSX
                      </button>
                    </div>

                    {/* Option 2: Full Audit CSV */}
                    <div className="p-3.5 bg-gray-800/50 hover:bg-gray-800/80 border border-gray-700/60 rounded-xl flex items-center justify-between gap-3 transition-colors">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-slate-300" />
                          <span>Full Audit CSV (.CSV)</span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Complete comma-separated file with all metadata columns: Domain, Website, Email, Category, Exact Source URL, Phone, and Timestamp.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          exportDiscoveryToCsv(filteredRecords, `${projectName}_complete_audit.csv`);
                          setIsSaveModalOpen(false);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Full CSV
                      </button>
                    </div>

                    {/* Option 3: Categorized ZIP */}
                    <div className="p-3.5 bg-gray-800/50 hover:bg-gray-800/80 border border-gray-700/60 rounded-xl flex items-center justify-between gap-3 transition-colors">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Download className="w-4 h-4 text-indigo-400" />
                          <span>Categorized ZIP Archive (.ZIP)</span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Zipped package with individual CSV files per category: Sales, Export, Procurement, Purchasing, Management, etc.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          exportDiscoveryCategoriesZip(discoveredRecords, domainsStatus, projectName);
                          setIsSaveModalOpen(false);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-900 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download ZIP
                      </button>
                    </div>

                    {/* Option 4: Save Project to Database */}
                    <div className="p-3.5 bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-500/40 rounded-xl flex items-center justify-between gap-3 transition-colors">
                      <div className="space-y-0.5">
                        <div className="font-bold text-indigo-200 flex items-center gap-1.5">
                          <Database className="w-4 h-4 text-indigo-400" />
                          <span>Save Discovery Project to Persistent Database</span>
                        </div>
                        <p className="text-[11px] text-gray-300">
                          Saves session to server database so you can reload, resume, and browse past crawls anytime in the "Saved Projects" tab.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isSavingSession}
                        onClick={async () => {
                          await handleSaveToDatabase();
                          setIsSaveModalOpen(false);
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 whitespace-nowrap"
                      >
                        <Save className="w-4 h-4" />
                        {isSavingSession ? 'Saving to DB...' : 'Save to DB'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-800 bg-gray-950/80 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                Tip: You can select specific rows with checkboxes in the table to save a custom subset.
              </span>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEBSITE & DOMAIN SEPARATOR STUDIO MODAL */}
      {isSeparatorModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700/90 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-teal-700/30">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    Website & Domain Separator Studio
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                      Multi-Field Extractor
                    </span>
                  </h3>
                  <p className="text-gray-400 text-xs">
                    Isolate only company websites from mixed text, paragraphs, words, CRM tables, or multi-field files.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSeparatorModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Row 1: Input text area and upload trigger */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="font-bold text-white flex items-center gap-1.5 text-xs">
                    <FileText className="w-3.5 h-3.5 text-teal-400" />
                    <span>Mixed Text, Paragraphs, Words, or Multi-Field Data</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={separatorFileInputRef}
                      onChange={handleSeparatorFileUpload}
                      accept=".txt,.csv,.xlsx,.xls,.tsv"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => separatorFileInputRef.current?.click()}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-teal-300 border border-teal-700/60 flex items-center gap-1 transition-all"
                    >
                      <Upload className="w-3 h-3" />
                      Upload Multi-Field File (.csv, .xlsx, .txt)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const sample = `Acme Corp, John Doe, john.doe@gmail.com, https://www.acmecorp.com/about-us, +1-555-1234, Dallas TX\nGlobal Logistics GmbH;Hans Schmidt;h.schmidt@logistics.de;www.global-logistics.de/en;Berlin\nHere is a note: please visit https://alpha-tools.co.uk or check beta.org for export catalog.\nPresentation file: presentation.pdf and styles at style.css should NOT be extracted.\nReach out at sales@acmeworks.eu or info@tech-supplies.net.`;
                        setSeparatorInputText(sample);
                        showToast("Loaded sample multi-field data!");
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex items-center gap-1 transition-all"
                    >
                      Load Sample
                    </button>

                    {separatorInputText && (
                      <button
                        type="button"
                        onClick={() => setSeparatorInputText('')}
                        className="text-xs text-red-400 hover:text-red-300 underline ml-1"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={separatorInputText}
                  onChange={e => setSeparatorInputText(e.target.value)}
                  placeholder="Paste any messy text, multi-column spreadsheet copy, CSV rows, or sentences containing websites mixed with names, addresses, emails, and phone numbers..."
                  className="w-full p-3 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-200 font-mono placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Row 2: Separation & Filter Settings */}
              <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-3.5 space-y-2.5">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-teal-400" />
                  Separation & Clean-up Filters
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Filter 1: Clean Root Domains */}
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-gray-900 border border-gray-800 cursor-pointer hover:bg-gray-850">
                    <input
                      type="checkbox"
                      checked={separatorOptions.cleanToRootDomain ?? true}
                      onChange={e => setSeparatorOptions({ ...separatorOptions, cleanToRootDomain: e.target.checked })}
                      className="accent-teal-500 rounded"
                    />
                    <div className="leading-tight">
                      <div className="font-semibold text-gray-200 text-[11px]">Clean Root Domain</div>
                      <div className="text-[10px] text-gray-500">acme.com instead of URL</div>
                    </div>
                  </label>

                  {/* Filter 2: Exclude Free Webmail */}
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-gray-900 border border-gray-800 cursor-pointer hover:bg-gray-850">
                    <input
                      type="checkbox"
                      checked={separatorOptions.excludeFreeEmailDomains ?? true}
                      onChange={e => setSeparatorOptions({ ...separatorOptions, excludeFreeEmailDomains: e.target.checked })}
                      className="accent-teal-500 rounded"
                    />
                    <div className="leading-tight">
                      <div className="font-semibold text-gray-200 text-[11px]">Exclude Free Emails</div>
                      <div className="text-[10px] text-gray-500">Ignore gmail, yahoo, hotmail</div>
                    </div>
                  </label>

                  {/* Filter 3: Exclude Social Media */}
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-gray-900 border border-gray-800 cursor-pointer hover:bg-gray-850">
                    <input
                      type="checkbox"
                      checked={separatorOptions.excludeSocialMedia ?? true}
                      onChange={e => setSeparatorOptions({ ...separatorOptions, excludeSocialMedia: e.target.checked })}
                      className="accent-teal-500 rounded"
                    />
                    <div className="leading-tight">
                      <div className="font-semibold text-gray-200 text-[11px]">Exclude Social Media</div>
                      <div className="text-[10px] text-gray-500">Ignore linkedin, facebook</div>
                    </div>
                  </label>

                  {/* Filter 4: Corporate Email Fallback */}
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-gray-900 border border-gray-800 cursor-pointer hover:bg-gray-850">
                    <input
                      type="checkbox"
                      checked={separatorOptions.extractFromCorporateEmail ?? false}
                      onChange={e => setSeparatorOptions({ ...separatorOptions, extractFromCorporateEmail: e.target.checked })}
                      className="accent-teal-500 rounded"
                    />
                    <div className="leading-tight">
                      <div className="font-semibold text-gray-200 text-[11px]">Email Domain Fallback</div>
                      <div className="text-[10px] text-gray-500">Extract if no website in row</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Row 3: Live Extraction Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Websites Discovered
                  </span>
                  <div className="text-xl font-bold text-emerald-300 font-mono mt-0.5">
                    {separatorResult.uniqueDomains.length.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-400/80">Unique company sites</span>
                </div>

                <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Analyzed Words / Fields</span>
                  <div className="text-xl font-bold text-white font-mono mt-0.5">
                    {separatorResult.rawTotalFields.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-gray-400">Total tokens processed</span>
                </div>

                <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Non-Websites Discarded</span>
                  <div className="text-xl font-bold text-gray-300 font-mono mt-0.5">
                    {separatorResult.filteredOutCount.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-gray-400">Names, phones, words removed</span>
                </div>

                <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Public Emails Skipped</span>
                  <div className="text-xl font-bold text-amber-300 font-mono mt-0.5">
                    {separatorResult.publicEmailDomainsSkipped.length.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-amber-400/80">gmail/yahoo accounts ignored</span>
                </div>
              </div>

              {/* Row 4: Discovered Websites Preview Table */}
              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950/40">
                <div className="p-2.5 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    Extracted Websites Preview ({separatorResult.uniqueDomains.length})
                  </span>
                  {separatorResult.detectedWebsiteColumn && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/60">
                      Isolated column: "{separatorResult.detectedWebsiteColumn}"
                    </span>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto">
                  {separatorResult.items.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">
                      Paste mixed text, paragraphs, or upload a multi-field file above to separate company websites.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-900/80 text-gray-400 border-b border-gray-800 font-semibold text-[11px]">
                          <th className="py-2 px-3 w-10">#</th>
                          <th className="py-2 px-3">Separated Website</th>
                          <th className="py-2 px-3">Source Field / Column</th>
                          <th className="py-2 px-3">Original Raw Input</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-850 text-gray-300">
                        {separatorResult.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-850/60 transition-colors">
                            <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono font-bold text-emerald-300 select-all">
                              {separatorOptions.cleanToRootDomain ? item.cleanDomain : item.fullWebsite}
                            </td>
                            <td className="py-2 px-3">
                              {item.fieldName ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-950 text-blue-300 border border-blue-800">
                                  {item.fieldName}
                                </span>
                              ) : item.isFromEmailDomain ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-800">
                                  Email Fallback
                                </span>
                              ) : (
                                <span className="text-gray-500 text-[10px]">Inline Text</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-gray-400 max-w-xs truncate" title={item.sourceText}>
                              {item.sourceText}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleCopy(separatorOptions.cleanToRootDomain ? item.cleanDomain : item.fullWebsite, `sep_${idx}`)}
                                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
                                title="Copy website"
                              >
                                {copiedKey === `sep_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-800 bg-gray-950/90 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadExtractedWebsitesTxt}
                  disabled={separatorResult.uniqueDomains.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 flex items-center gap-1.5 transition-all disabled:opacity-40"
                  title="Download clean 1-per-line text file of extracted websites"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save TXT
                </button>

                <button
                  type="button"
                  onClick={handleDownloadExtractedWebsitesCsv}
                  disabled={separatorResult.uniqueDomains.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 flex items-center gap-1.5 transition-all disabled:opacity-40"
                  title="Download CSV spreadsheet of extracted websites with source attribution"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save CSV
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const websites = separatorOptions.cleanToRootDomain ? separatorResult.uniqueDomains : separatorResult.uniqueWebsites;
                    if (websites.length === 0) return;
                    navigator.clipboard.writeText(websites.join('\n'));
                    showToast(`✓ Copied ${websites.length.toLocaleString()} extracted websites to clipboard!`);
                  }}
                  disabled={separatorResult.uniqueDomains.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy All ({separatorResult.uniqueDomains.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSeparatorModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-750 text-gray-300 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleApplySeparatorToQueue}
                  disabled={separatorResult.uniqueDomains.length === 0}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-700/30 transition-all disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                  <span>Apply & Load into Discovery Queue ({separatorResult.uniqueDomains.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
