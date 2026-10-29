import React, { useState, useEffect } from 'react';
import {
  Database,
  Upload,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Layers,
  Sparkles,
  Server,
  RefreshCw
} from 'lucide-react';
import { serverApi, type ServerLead, type UserProfile } from '../services/serverApiClient';

export interface CloudDatabaseBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'upload' | 'load';
  tabName: string;
  sourceTag?: string;
  itemsToUpload?: Array<{
    email: string;
    companyName?: string;
    country?: string;
    phone?: string;
    sourceUrl?: string;
    isValid?: boolean;
    mxStatus?: string;
    mxProvider?: string;
    role?: string;
    contactPerson?: string;
    [key: string]: any;
  }> | string[];
  onLoadLeads?: (leads: ServerLead[], emails: string[]) => void;
  showToast: (msg: string) => void;
  currentUser: UserProfile | null;
  onOpenAuth?: () => void;
}

export const CloudDatabaseBridgeModal: React.FC<CloudDatabaseBridgeModalProps> = ({
  isOpen,
  onClose,
  mode,
  tabName,
  sourceTag,
  itemsToUpload = [],
  onLoadLeads,
  showToast,
  currentUser,
  onOpenAuth
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customTag, setCustomTag] = useState(sourceTag || `${tabName} Export`);

  // Load from DB state
  const [filterCountry, setFilterCountry] = useState('all');
  const [validOnly, setValidOnly] = useState(false);
  const [limitCount, setLimitCount] = useState<number>(500);
  const [dbTotalCount, setDbTotalCount] = useState<number>(0);
  const [previewLeads, setPreviewLeads] = useState<ServerLead[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (sourceTag) setCustomTag(sourceTag);
  }, [sourceTag]);

  // Load Cloud DB overview when opening in 'load' mode
  useEffect(() => {
    if (isOpen && mode === 'load' && currentUser) {
      fetchPreview();
    }
  }, [isOpen, mode, currentUser, filterCountry, validOnly, limitCount]);

  const fetchPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const res = await serverApi.getAllCloudDbLeads({
        country: filterCountry !== 'all' ? filterCountry : undefined,
        validOnly,
        limit: limitCount
      });
      setPreviewLeads(res.leads);
      setDbTotalCount(res.total);
    } catch (err: any) {
      showToast(`Database preview warning: ${err.message}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  if (!isOpen) return null;

  const handleUploadToDb = async () => {
    if (!currentUser) {
      if (onOpenAuth) onOpenAuth();
      else showToast('Please sign in to access Cloud Database.');
      return;
    }

    if (!itemsToUpload || itemsToUpload.length === 0) {
      showToast('No leads or emails available to upload.');
      return;
    }

    setIsSubmitting(true);
    try {
      const normalized = itemsToUpload.map((item) => {
        if (typeof item === 'string') {
          return { email: item.trim(), source: customTag };
        }
        return { ...item, source: customTag };
      });

      const res = await serverApi.uploadLeadsToCloudDb(normalized, customTag);
      showToast(res.message);
      onClose();
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyLoadedLeads = () => {
    if (!previewLeads || previewLeads.length === 0) {
      showToast('No leads found in Cloud Database matching criteria.');
      return;
    }

    const filtered = searchFilter.trim()
      ? previewLeads.filter(
          (l) =>
            l.email.toLowerCase().includes(searchFilter.toLowerCase()) ||
            l.companyName.toLowerCase().includes(searchFilter.toLowerCase())
        )
      : previewLeads;

    const emails = filtered.map((l) => l.email);
    if (onLoadLeads) {
      onLoadLeads(filtered, emails);
      showToast(`Loaded ${filtered.length.toLocaleString()} leads from Cloud Database into ${tabName}!`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${mode === 'upload' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                {mode === 'upload' ? 'Upload Leads to Cloud Database' : `Work from Cloud Database in ${tabName}`}
              </h2>
              <p className="text-xs text-slate-400">
                Persistent multi-tenant server storage • Accessible across all tabs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          {mode === 'upload' ? (
            /* UPLOAD MODE */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-start gap-3">
                <Upload className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-200/90 leading-relaxed space-y-1">
                  <div className="font-bold text-white text-sm">
                    Ready to sync {itemsToUpload.length.toLocaleString()} leads from {tabName}
                  </div>
                  <p>
                    These leads will be deduplicated against your existing database, enriched with their company name, domain, and country, and stored in your private partitioned database on the server.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Job Tag / Batch Identifier
                </label>
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  placeholder="e.g. Country Sorter German Leads"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Tagging allows you to easily filter and export this specific batch later in Server Tasks & DB.
                </span>
              </div>

              {/* Account Quota Preview */}
              {currentUser && (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block">Cloud Database Status</span>
                    <strong className="text-white font-mono">
                      {currentUser.totalLeadsStored.toLocaleString()} / {currentUser.maxLeads.toLocaleString()} Leads Used
                    </strong>
                  </div>
                  <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-blue-300 border border-slate-700">
                    {currentUser.licenseTier} License
                  </span>
                </div>
              )}

              {/* Items Preview */}
              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Preview (First 5 Items):
                </span>
                <div className="p-2.5 bg-black/40 border border-slate-800 rounded-lg font-mono text-xs text-emerald-400 space-y-1 max-h-36 overflow-y-auto">
                  {itemsToUpload.slice(0, 5).map((item, idx) => {
                    const em = typeof item === 'string' ? item : item.email;
                    const c = typeof item === 'object' && item.country ? ` (${item.country})` : '';
                    return (
                      <div key={idx} className="truncate">
                        • {em}{c}
                      </div>
                    );
                  })}
                  {itemsToUpload.length > 5 && (
                    <div className="text-slate-500 italic">
                      + {(itemsToUpload.length - 5).toLocaleString()} more items...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* LOAD MODE */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
                <Database className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-200/90 leading-relaxed space-y-1">
                  <div className="font-bold text-white text-sm">
                    Load Leads from Persistent Cloud Database
                  </div>
                  <p>
                    Select records to pull directly into <strong>{tabName}</strong>. You can filter by country or valid MX to work with specific segments.
                  </p>
                </div>
              </div>

              {/* Filters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Country Filter</label>
                  <select
                    value={filterCountry}
                    onChange={(e) => setFilterCountry(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-white focus:outline-none"
                  >
                    <option value="all">All Countries</option>
                    <option value="Germany">Germany</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="France">France</option>
                    <option value="Italy">Italy</option>
                    <option value="Spain">Spain</option>
                    <option value="Netherlands">Netherlands</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                    <option value="India">India</option>
                    <option value="Poland">Poland</option>
                    <option value="Unknown">Unknown (Unsorted)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Max Quantity</label>
                  <select
                    value={limitCount}
                    onChange={(e) => setLimitCount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-white focus:outline-none"
                  >
                    <option value={100}>100 Leads</option>
                    <option value={250}>250 Leads</option>
                    <option value={500}>500 Leads</option>
                    <option value={1000}>1,000 Leads</option>
                    <option value={2500}>2,500 Leads</option>
                    <option value={5000}>5,000 Leads</option>
                    <option value={10000}>10,000 Leads (All)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Hygiene Filter</label>
                  <button
                    type="button"
                    onClick={() => setValidOnly(!validOnly)}
                    className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold border transition text-left flex items-center justify-between ${
                      validOnly
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span>{validOnly ? '✓ Valid MX Only' : 'All Mailboxes'}</span>
                    <span className="text-[10px] text-slate-400">Toggle</span>
                  </button>
                </div>
              </div>

              {/* Instant Search in results */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter matching leads by keyword, domain, or company..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Table Preview */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span>
                    Discovered <strong>{previewLeads.length.toLocaleString()}</strong> matching leads in Cloud DB:
                  </span>
                  <button
                    type="button"
                    onClick={fetchPreview}
                    disabled={isLoadingPreview}
                    className="text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-48 overflow-y-auto">
                  {isLoadingPreview ? (
                    <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                      Loading records from Cloud Database...
                    </div>
                  ) : previewLeads.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No leads found in Cloud Database matching criteria. Use another tab or Extractor to save leads.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Email</th>
                          <th className="py-2 px-3">Company</th>
                          <th className="py-2 px-3">Country</th>
                          <th className="py-2 px-3">MX Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {previewLeads.slice(0, 50).map((l, i) => (
                          <tr key={i} className="hover:bg-slate-900/50">
                            <td className="py-1.5 px-3 font-semibold text-white">{l.email}</td>
                            <td className="py-1.5 px-3 text-slate-300">{l.companyName}</td>
                            <td className="py-1.5 px-3 text-cyan-300">{l.country}</td>
                            <td className="py-1.5 px-3">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${l.isValid ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                                {l.mxStatus || 'unknown'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancel
          </button>

          {mode === 'upload' ? (
            <button
              type="button"
              onClick={handleUploadToDb}
              disabled={isSubmitting || itemsToUpload.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Syncing to Cloud DB...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-white" />
                  <span>Upload {itemsToUpload.length.toLocaleString()} Leads to Cloud DB</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApplyLoadedLeads}
              disabled={previewLeads.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Load {previewLeads.length.toLocaleString()} Leads into {tabName}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
