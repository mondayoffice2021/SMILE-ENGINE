import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  Database,
  Upload,
  Play,
  Pause,
  StopCircle,
  Trash2,
  Download,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Mail,
  Phone,
  Globe,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Send,
  Layers,
  HardDrive
} from 'lucide-react';
import {
  serverApi,
  type ServerJob,
  type ServerLead,
  type UserProfile
} from '../services/serverApiClient';

interface ServerJobsManagerProps {
  currentUser: UserProfile | null;
  showToast: (msg: string) => void;
  onOpenAuth: () => void;
  onSendToDispatcher?: (leads: any[]) => void;
}

export const ServerJobsManager: React.FC<ServerJobsManagerProps> = ({
  currentUser,
  showToast,
  onOpenAuth,
  onSendToDispatcher
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'database'>('tasks');
  const [jobs, setJobs] = useState<ServerJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // File Upload State
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Job Config
  const [jobCountry, setJobCountry] = useState('Germany');
  const [verifyMx, setVerifyMx] = useState(true);
  const [extractPhone, setExtractPhone] = useState(true);
  const [extractWeb, setExtractWeb] = useState(true);

  // Crawler Launcher state
  const [crawlerQuery, setCrawlerQuery] = useState('medical device manufacturer');
  const [crawlerCountry, setCrawlerCountry] = useState('Germany');
  const [crawlerTargetCount, setCrawlerTargetCount] = useState(500);

  // Database Leads Explorer State
  const [dbLeads, setDbLeads] = useState<ServerLead[]>([]);
  const [totalDbLeads, setTotalDbLeads] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [validMxOnly, setValidMxOnly] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  // Auto-polling for active background jobs
  useEffect(() => {
    if (!currentUser) return;
    loadJobs();
    const interval = setInterval(() => {
      // Poll if any job is currently running
      setJobs((prev) => {
        const hasRunning = prev.some((j) => j.status === 'running' || j.status === 'pending');
        if (hasRunning) {
          loadJobs(false);
        }
        return prev;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Load Database Leads
  useEffect(() => {
    if (currentUser && activeSubTab === 'database') {
      loadLeads();
    }
  }, [currentUser, activeSubTab, currentPage, pageSize, selectedJobFilter, validMxOnly]);

  const loadJobs = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoadingJobs(true);
    try {
      const res = await serverApi.getJobs();
      setJobs(res.jobs);
    } catch (err: any) {
      console.warn('Jobs load warning:', err.message);
    } finally {
      if (showLoadingSpinner) setIsLoadingJobs(false);
    }
  };

  const loadLeads = async () => {
    setIsLoadingLeads(true);
    try {
      const res = await serverApi.getServerLeads({
        page: currentPage,
        pageSize,
        jobId: selectedJobFilter || undefined,
        search: searchQuery || undefined,
        country: countryFilter || undefined,
        validOnly: validMxOnly
      });
      setDbLeads(res.leads);
      setTotalDbLeads(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      showToast(`Error loading database leads: ${err.message}`);
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDroppedFile(e.target.files[0]);
    }
  };

  const handleStartFileJob = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!droppedFile) {
      showToast('Please select or drop a file first');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      showToast(`Uploading ${droppedFile.name} to server disk...`);
      const uploadRes = await serverApi.uploadFile(droppedFile, (pct) => {
        setUploadProgress(pct);
      });

      showToast(`File uploaded! Spawning server background worker...`);
      const jobTitle = `File Extract: ${droppedFile.name} (${(droppedFile.size / (1024 * 1024)).toFixed(1)} MB)`;
      await serverApi.startJob('file_extraction', jobTitle, {
        sourceFileName: droppedFile.name,
        filePath: uploadRes.file.path,
        country: jobCountry,
        verifyMx,
        extractPhone,
        extractWeb
      });

      showToast('Server background job started! Runs quietly without using browser memory.');
      setDroppedFile(null);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadJobs();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartCrawlJob = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!crawlerQuery.trim()) {
      showToast('Search query keywords required');
      return;
    }

    try {
      const jobTitle = `Deep Crawl: "${crawlerQuery}" (${crawlerCountry} - ${crawlerTargetCount} leads)`;
      await serverApi.startJob('dork_crawl', jobTitle, {
        query: crawlerQuery.trim(),
        country: crawlerCountry,
        targetCount: crawlerTargetCount,
        verifyMx: true
      });
      showToast('Autonomous background crawl queued on server engine!');
      loadJobs();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await serverApi.cancelJob(jobId);
      showToast('Cancellation requested');
      loadJobs();
    } catch (err: any) {
      showToast(`Error cancelling: ${err.message}`);
    }
  };

  const handleDeleteJob = async (jobId: string, deleteLeads = false) => {
    if (!window.confirm(`Delete this background task record${deleteLeads ? ' and its extracted leads' : ''}?`)) return;
    try {
      await serverApi.deleteJob(jobId, deleteLeads);
      showToast('Task removed');
      loadJobs();
      if (deleteLeads) loadLeads();
    } catch (err: any) {
      showToast(`Error deleting: ${err.message}`);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'txt') => {
    try {
      showToast(`Generating ${format.toUpperCase()} export on server...`);
      await serverApi.downloadExport(format, selectedJobFilter || undefined, validMxOnly);
      showToast('Download started');
    } catch (err: any) {
      showToast(`Export error: ${err.message}`);
    }
  };

  const handlePushToSender = () => {
    if (!onSendToDispatcher || dbLeads.length === 0) return;
    const formatted = dbLeads.map((l) => ({
      email: l.email,
      companyName: l.companyName,
      country: l.country,
      sourceUrl: l.sourceUrl,
      isValid: l.isValid,
      mxStatus: l.mxStatus,
      phone: l.phone,
      contactPerson: l.contactPerson
    }));
    onSendToDispatcher(formatted);
    showToast(`Pushed ${formatted.length} database leads to Rotational Email Dispatcher!`);
  };

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/10">
          <Server className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Internal Database & Server Background Engine</h2>
          <p className="text-sm text-gray-400 max-w-lg mx-auto">
            Offload massive file extractions and 1,000+ lead crawlers to run quietly on the server backend. Never freeze your browser tab again.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md mx-auto space-y-4 text-left">
          <div className="flex items-start gap-3 text-xs text-gray-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Drop 500MB+ files directly onto server disk with zero browser RAM lag</span>
          </div>
          <div className="flex items-start gap-3 text-xs text-gray-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Multi-tenant isolation: other users cannot see or conflict with your data</span>
          </div>
          <div className="flex items-start gap-3 text-xs text-gray-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Close your browser, lock your screen, or switch tabs—tasks run persistently</span>
          </div>
          <button
            onClick={onOpenAuth}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/20"
          >
            Sign In / Register Account to Access Server Storage
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner explaining architecture */}
      <div className="bg-gradient-to-r from-blue-950/60 via-gray-900 to-purple-950/60 border border-blue-500/30 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 shrink-0">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">Server Background Tasks & Internal Database</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                Online • Zero Browser Lag
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Files and multi-engine crawlers run internally on the Node.js backend. Memory is streamed into your isolated partition.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-gray-950/80 border border-gray-800 rounded-xl px-3.5 py-2 text-right">
            <div className="text-[10px] uppercase font-mono text-gray-500">Database Storage</div>
            <div className="text-sm font-bold text-white font-mono">
              {(currentUser.totalLeadsStored || 0).toLocaleString()} <span className="text-xs text-gray-500 font-normal">/ {currentUser.maxLeads.toLocaleString()} leads</span>
            </div>
          </div>
          <div className="bg-gray-950/80 border border-gray-800 rounded-xl px-3.5 py-2 text-right">
            <div className="text-[10px] uppercase font-mono text-gray-500">License Tier</div>
            <div className="text-sm font-bold text-amber-300 uppercase font-mono">
              {currentUser.licenseTier}
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b border-gray-800">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('tasks')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeSubTab === 'tasks'
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Server className="w-4 h-4" />
            Background Workers & File Drop ({jobs.length})
          </button>
          <button
            onClick={() => setActiveSubTab('database')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeSubTab === 'database'
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Database className="w-4 h-4" />
            Internal Database Explorer ({(currentUser.totalLeadsStored || 0).toLocaleString()} Leads)
          </button>
        </div>

        <button
          onClick={() => (activeSubTab === 'tasks' ? loadJobs() : loadLeads())}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingJobs || isLoadingLeads ? 'animate-spin text-blue-400' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* TAB 1: BACKGROUND WORKERS & FILE DROP */}
      {activeSubTab === 'tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Launch New Task */}
          <div className="space-y-6">
            {/* Box 1: Drop Files onto Server */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Drop Bulky File to Server</h3>
              </div>
              <p className="text-xs text-gray-400">
                Uploaded files stream directly into disk storage and extract in background chunks.
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                  droppedFile
                    ? 'border-blue-500/80 bg-blue-950/20'
                    : 'border-gray-700 hover:border-gray-600 bg-gray-950/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".csv,.txt,.xlsx,.xls,.tsv,.log,.json"
                  className="hidden"
                />
                <FileText className="w-8 h-8 mx-auto text-blue-400 mb-2" />
                {droppedFile ? (
                  <div>
                    <div className="text-xs font-semibold text-white truncate">{droppedFile.name}</div>
                    <div className="text-[11px] text-blue-400 font-mono mt-0.5">
                      {(droppedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-semibold text-gray-200">Click to choose or drag & drop file</div>
                    <div className="text-[11px] text-gray-500 mt-1">.CSV, .TXT, .XLSX, .LOG up to 500MB</div>
                  </div>
                )}
              </div>

              {/* Upload Progress Bar if uploading */}
              {isUploading && uploadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-gray-400 font-mono">
                    <span>Uploading to server...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Extraction Options */}
              <div className="space-y-2 pt-2 border-t border-gray-800/80 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Target Country Tag</span>
                  <input
                    type="text"
                    value={jobCountry}
                    onChange={(e) => setJobCountry(e.target.value)}
                    placeholder="e.g. Germany"
                    className="w-32 bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                  <input
                    type="checkbox"
                    checked={verifyMx}
                    onChange={(e) => setVerifyMx(e.target.checked)}
                    className="rounded bg-gray-950 border-gray-700 text-blue-600 focus:ring-0"
                  />
                  <span>Live DNS MX mailbox check</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                  <input
                    type="checkbox"
                    checked={extractPhone}
                    onChange={(e) => setExtractPhone(e.target.checked)}
                    className="rounded bg-gray-950 border-gray-700 text-blue-600 focus:ring-0"
                  />
                  <span>Extract telephone numbers</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleStartFileJob}
                disabled={isUploading || !droppedFile}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/20"
              >
                <Play className="w-3.5 h-3.5" />
                {isUploading ? 'Transferring File...' : 'Start Server Extraction Worker'}
              </button>
            </div>

            {/* Box 2: Autonomous Server Deep Crawl */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Autonomous 1,000+ Crawler</h3>
              </div>
              <p className="text-xs text-gray-400">
                Runs web search matrix & website spidering quietly on the server.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-gray-300 block mb-1">Keywords / Industry</label>
                  <input
                    type="text"
                    value={crawlerQuery}
                    onChange={(e) => setCrawlerQuery(e.target.value)}
                    placeholder="e.g. steel distributor"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-gray-300 block mb-1">Country</label>
                    <input
                      type="text"
                      value={crawlerCountry}
                      onChange={(e) => setCrawlerCountry(e.target.value)}
                      placeholder="e.g. Germany"
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-1">Goal Leads</label>
                    <input
                      type="number"
                      step={50}
                      value={crawlerTargetCount}
                      onChange={(e) => setCrawlerTargetCount(parseInt(e.target.value, 10))}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartCrawlJob}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-purple-600/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Launch Background Crawler
              </button>
            </div>
          </div>

          {/* Right 2 Columns: Active & Past Background Jobs */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Your Background Workers</h3>
                <p className="text-xs text-gray-400">Tasks remain running in Node.js even if you close this browser tab.</p>
              </div>
              <span className="text-xs text-gray-400 font-mono">
                {jobs.filter((j) => j.status === 'running').length} running / {currentUser.maxConcurrentJobs} limit
              </span>
            </div>

            {jobs.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center space-y-3">
                <HardDrive className="w-10 h-10 mx-auto text-gray-600" />
                <h4 className="text-sm font-semibold text-white">No Server Tasks Yet</h4>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Drop a bulky file or start a background crawler on the left panel. Leads will be saved directly into your internal database.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3 hover:border-gray-700 transition-colors shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              job.status === 'running'
                                ? 'bg-blue-400 animate-pulse'
                                : job.status === 'completed'
                                ? 'bg-emerald-400'
                                : job.status === 'failed'
                                ? 'bg-rose-400'
                                : 'bg-gray-500'
                            }`}
                          />
                          <h4 className="font-semibold text-white text-xs">{job.title}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            job.status === 'running'
                              ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                              : job.status === 'completed'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : job.status === 'failed'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : 'bg-gray-800 text-gray-400'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {job.progress?.currentStage || 'Initializing...'}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        {job.status === 'running' && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded-lg transition-colors"
                            title="Cancel Job"
                          >
                            <StopCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedJobFilter(job.id);
                            setActiveSubTab('database');
                          }}
                          className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Browse leads from this job"
                        >
                          <Database className="w-3.5 h-3.5" />
                          View Leads
                        </button>
                        <button
                          onClick={() => handleDeleteJob(job.id, true)}
                          className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-gray-800 rounded-lg transition-colors"
                          title="Delete task & data"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-gray-400">
                          Progress: <strong className="text-white">{job.progress?.percent || 0}%</strong>
                        </span>
                        <span className="text-purple-300">
                          {(job.progress?.leadsFound || 0).toLocaleString()} leads saved to DB
                        </span>
                      </div>
                      <div className="w-full bg-gray-950 h-2 rounded-full overflow-hidden border border-gray-800">
                        <div
                          className={`h-full transition-all duration-300 ${
                            job.status === 'completed'
                              ? 'bg-emerald-500'
                              : job.status === 'failed'
                              ? 'bg-rose-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${job.progress?.percent || 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer Stats */}
                    {job.resultSummary && (
                      <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between text-[11px] text-gray-400">
                        <span>
                          Total Harvested: <strong className="text-white font-mono">{job.resultSummary.totalLeads.toLocaleString()} leads</strong>
                        </span>
                        <span>
                          Valid MX: <strong className="text-emerald-400 font-mono">{job.resultSummary.validMxCount.toLocaleString()}</strong>
                        </span>
                        <span>
                          Duration: <strong className="text-gray-300 font-mono">{(job.resultSummary.durationMs / 1000).toFixed(1)}s</strong>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INTERNAL DATABASE LEADS EXPLORER */}
      {activeSubTab === 'database' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search email, company, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadLeads()}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500"
                />
              </div>

              {/* Job filter dropdown */}
              <select
                value={selectedJobFilter}
                onChange={(e) => {
                  setSelectedJobFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="">All Background Jobs</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title.slice(0, 35)}...
                  </option>
                ))}
              </select>

              {/* MX Filter */}
              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer bg-gray-950 border border-gray-700 px-3 py-1.5 rounded-lg">
                <input
                  type="checkbox"
                  checked={validMxOnly}
                  onChange={(e) => {
                    setValidMxOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-0"
                />
                <span>Valid MX Only</span>
              </label>

              <button
                onClick={loadLeads}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold"
              >
                Apply
              </button>
            </div>

            {/* Export & Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Download CSV from server"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                onClick={() => handleExport('xlsx')}
                className="px-3 py-1.5 bg-teal-700/80 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Download Excel from server"
              >
                <Download className="w-3.5 h-3.5" />
                Export XLSX
              </button>
              {onSendToDispatcher && (
                <button
                  onClick={handlePushToSender}
                  disabled={dbLeads.length === 0}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-blue-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  Push to Email Sender
                </button>
              )}
            </div>
          </div>

          {/* Leads Table */}
          <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-800/80 text-gray-400 uppercase font-mono text-[10px] tracking-wider border-b border-gray-800">
                <tr>
                  <th className="py-3 px-4">Contact / Email</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Country</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">MX Mailbox Verification</th>
                  <th className="py-3 px-4">Extracted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {isLoadingLeads ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      <RefreshCw className="w-5 h-5 mx-auto animate-spin text-blue-400 mb-2" />
                      Loading records from internal database...
                    </td>
                  </tr>
                ) : dbLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      No leads match this filter. Run a background extraction or clear search filters.
                    </td>
                  </tr>
                ) : (
                  dbLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-white font-mono flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>{lead.email}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-gray-300">
                        {lead.companyName || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-gray-400">
                        {lead.country || 'N/A'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-300 text-[11px]">
                        {lead.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            {lead.phone}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          lead.mxStatus === 'valid'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : lead.mxStatus === 'invalid'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            : 'bg-gray-800 text-gray-400'
                        }`}>
                          {lead.mxStatus === 'valid' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : lead.mxStatus === 'invalid' ? (
                            <XCircle className="w-3 h-3 text-rose-400" />
                          ) : null}
                          {lead.mxStatus.toUpperCase()} {lead.mxProvider ? `(${lead.mxProvider.slice(0, 15)})` : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-500 text-[10px] font-mono">
                        {lead.extractedAt ? new Date(lead.extractedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400 pt-2">
            <div>
              Showing <strong className="text-white">{dbLeads.length}</strong> of{' '}
              <strong className="text-white">{totalDbLeads.toLocaleString()}</strong> stored database leads
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isLoadingLeads}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 rounded-lg transition-colors"
              >
                Previous
              </button>
              <span className="font-mono text-gray-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || isLoadingLeads}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
