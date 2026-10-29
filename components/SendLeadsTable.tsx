import React, { useState, useMemo } from 'react';
import {
  Users,
  CheckSquare,
  Square,
  Trash2,
  Globe,
  Building2,
  Phone,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Filter,
  Sparkles,
  RefreshCw,
  Search,
  Languages,
  CheckCircle,
  XCircle,
  Clock,
  Landmark,
  GraduationCap,
  Bot,
  Eye,
  Edit3,
  X,
  Save,
  Check
} from 'lucide-react';
import { RecipientItem } from '../types';

interface SendLeadsTableProps {
  leads?: RecipientItem[];
  recipients?: RecipientItem[];
  selectedIds?: Set<string>;
  selectedLeadIds?: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;
  onDeleteSingle?: (id: string) => void;
  onCrawlSites?: () => void;
  onCrawlCompanySites?: () => void;
  isCrawling: boolean;
  onPurgeFilter: (type: 'dead' | 'webmail' | 'banking' | 'govedu' | 'roles') => void;
  onSendGoodMxOnly: () => void;
  onPreloadTranslations?: (targetLeadIds?: string[]) => void;
  onUpdateLeadTranslation?: (id: string, updatedSubject: string, updatedBody: string) => void;
  onSetLeadLanguage?: (id: string, language: string, applyToAll?: boolean) => void;
  isPreloadingTranslations?: boolean;
  preloadingProgress?: { completed: number; total: number };
}

export const SendLeadsTable: React.FC<SendLeadsTableProps> = ({
  leads: propsLeads,
  recipients,
  selectedIds: propsSelectedIds,
  selectedLeadIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  onDeleteAll,
  onDeleteSingle,
  onCrawlSites,
  onCrawlCompanySites,
  isCrawling,
  onPurgeFilter,
  onSendGoodMxOnly,
  onPreloadTranslations,
  onUpdateLeadTranslation,
  onSetLeadLanguage,
  isPreloadingTranslations = false,
  preloadingProgress = { completed: 0, total: 0 },
}) => {
  const leads = useMemo(() => propsLeads || recipients || [], [propsLeads, recipients]);
  const selectedIds = useMemo(() => propsSelectedIds || selectedLeadIds || new Set<string>(), [propsSelectedIds, selectedLeadIds]);
  const handleCrawl = onCrawlSites || onCrawlCompanySites || (() => {});
  const handleDeleteItem = onDeleteSingle || ((id: string) => {});

  const [searchQuery, setSearchQuery] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'candidates' | 'preloaded' | 'with-phone' | 'good-mx'>('all');
  const [bulkSelectedLanguage, setBulkSelectedLanguage] = useState<string>('German');

  // Translation Preview & Edit Modal state
  const [selectedLeadForEdit, setSelectedLeadForEdit] = useState<RecipientItem | null>(null);
  const [modalSubject, setModalSubject] = useState('');
  const [modalBody, setModalBody] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const filteredLeads = useMemo(() => {
    if (!Array.isArray(leads)) return [];
    return leads.filter(lead => {
      // View filter
      if (viewFilter === 'candidates' && !lead.autoTranslated && lead.targetLanguage === 'English') {
        return false;
      }
      if (viewFilter === 'preloaded' && !lead.preloadedSubject && !lead.autoTranslated) {
        return false;
      }
      if (viewFilter === 'with-phone' && !lead.phone) {
        return false;
      }
      if (viewFilter === 'good-mx' && lead.mxStatus === 'invalid') {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchEmail = lead.email.toLowerCase().includes(q);
      const matchName = (lead.fullName || lead.name || '').toLowerCase().includes(q);
      const matchCompany = (lead.company || '').toLowerCase().includes(q);
      const matchCountry = (lead.country || '').toLowerCase().includes(q);
      const matchPhone = (lead.phone || '').toLowerCase().includes(q);
      return matchEmail || matchName || matchCompany || matchCountry || matchPhone;
    });
  }, [leads, searchQuery, viewFilter]);

  const preloadedCount = useMemo(() => {
    return leads.filter(l => Boolean(l.preloadedSubject || l.autoTranslated)).length;
  }, [leads]);

  const candidateCount = useMemo(() => {
    return leads.filter(l => l.targetLanguage && l.targetLanguage.toLowerCase() !== 'english').length;
  }, [leads]);

  const allSelected = leads.length > 0 && selectedIds.size === leads.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Top Header & Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Audited Lead Dispatch Table & Variables
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-semibold">
                {leads.length} Contacts
              </span>
              {preloadedCount > 0 && (
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-semibold">
                  {preloadedCount} Preloaded
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Personalized fields, Impressum contacts, MX health status, and country-specific translation readiness
            </p>
          </div>
        </div>

        {/* Primary Command Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preload Translations button */}
          {onPreloadTranslations && (
            <button
              type="button"
              onClick={() => onPreloadTranslations(selectedIds.size > 0 ? Array.from(selectedIds) : undefined)}
              disabled={isPreloadingTranslations || leads.length === 0}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              title="Preload translated versions of subject & body for target countries before sending"
            >
              {isPreloadingTranslations ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Languages className="w-3.5 h-3.5 text-cyan-300" />
              )}
              {isPreloadingTranslations 
                ? `Preloading (${preloadingProgress.completed}/${preloadingProgress.total})...`
                : selectedIds.size > 0 
                  ? `Preload Selected (${selectedIds.size})` 
                  : 'Preload Country Translations'
              }
            </button>
          )}

          {/* Crawl Company Sites button */}
          <button
            type="button"
            onClick={handleCrawl}
            disabled={isCrawling || leads.length === 0}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Crawl live website impressum & contact pages for headquarters phone numbers, corporate names, and languages"
          >
            {isCrawling ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            )}
            {isCrawling ? 'Crawling Sites...' : 'Crawl Company Sites'}
          </button>

          {/* Send to Good MX Records button */}
          <button
            type="button"
            onClick={onSendGoodMxOnly}
            disabled={leads.length === 0}
            className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Filter queue to only route contacts with confirmed valid MX DNS records"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Send to Good MX Records
          </button>
        </div>
      </div>

      {/* Bulk Operations Toolbar & One-Click Targeted Purges */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-950/80 rounded-xl border border-gray-800">
        {/* Selection & Bulk Delete */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            disabled={leads.length === 0}
            className="px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-200 hover:text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5" />}
            {allSelected ? 'Deselect All' : 'Make All (Select All)'}
          </button>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={onDeleteSelected}
              className="px-2.5 py-1.5 bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedIds.size})
            </button>
          )}

          {leads.length > 0 && (
            <button
              type="button"
              onClick={onDeleteAll}
              className="px-2.5 py-1.5 bg-gray-900 hover:bg-rose-950/60 text-gray-400 hover:text-rose-300 border border-gray-800 hover:border-rose-700/50 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
            >
              Delete All Records
            </button>
          )}

          {/* Bulk Language Setter */}
          {onSetLeadLanguage && leads.length > 0 && (
            <div className="flex items-center gap-1.5 bg-gray-900 border border-cyan-800/60 px-2 py-1 rounded-lg text-xs ml-1">
              <Languages className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-gray-400 font-medium text-[11px]">Set Language:</span>
              <select
                value={bulkSelectedLanguage}
                onChange={(e) => setBulkSelectedLanguage(e.target.value)}
                className="bg-gray-950 border border-gray-700 text-cyan-300 text-xs rounded px-1.5 py-0.5 focus:outline-none font-medium"
              >
                <option value="German">🇩🇪 German</option>
                <option value="French">🇫🇷 French</option>
                <option value="Spanish">🇪🇸 Spanish</option>
                <option value="Italian">🇮🇹 Italian</option>
                <option value="Dutch">🇳🇱 Dutch</option>
                <option value="Portuguese">🇵🇹 Portuguese</option>
                <option value="Polish">🇵🇱 Polish</option>
                <option value="Russian">🇷🇺 Russian</option>
                <option value="Turkish">🇹🇷 Turkish</option>
                <option value="Arabic">🇸🇦 Arabic</option>
                <option value="Chinese">🇨🇳 Chinese</option>
                <option value="Japanese">🇯🇵 Japanese</option>
                <option value="Korean">🇰🇷 Korean</option>
                <option value="Swedish">🇸🇪 Swedish</option>
                <option value="English">🇬🇧 English</option>
              </select>
              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    selectedIds.forEach(id => onSetLeadLanguage(id, bulkSelectedLanguage, false));
                  }}
                  className="px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 rounded font-semibold text-[10px]"
                >
                  Set Selected ({selectedIds.size})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetLeadLanguage('', bulkSelectedLanguage, true)}
                  className="px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 rounded font-semibold text-[10px]"
                >
                  Set All ({leads.length})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Targeted Purge Badges */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-gray-400 font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-emerald-400" />
            Targeted Purges:
          </span>
          <button
            type="button"
            onClick={() => onPurgeFilter('dead')}
            className="px-2 py-1 bg-gray-900 hover:bg-rose-950/50 text-gray-300 hover:text-rose-300 border border-gray-800 rounded-lg transition-colors flex items-center gap-1"
            title="Remove Dead / No MX domains"
          >
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            Dead / No MX
          </button>
          <button
            type="button"
            onClick={() => onPurgeFilter('webmail')}
            className="px-2 py-1 bg-gray-900 hover:bg-amber-950/50 text-gray-300 hover:text-amber-300 border border-gray-800 rounded-lg transition-colors flex items-center gap-1"
            title="Remove Gmail, Yahoo, Hotmail, Outlook"
          >
            <Globe className="w-3 h-3 text-amber-400" />
            Public Webmail
          </button>
          <button
            type="button"
            onClick={() => onPurgeFilter('banking')}
            className="px-2 py-1 bg-gray-900 hover:bg-amber-950/50 text-gray-300 hover:text-amber-300 border border-gray-800 rounded-lg transition-colors flex items-center gap-1"
            title="Remove banking and financial institutions"
          >
            <Landmark className="w-3 h-3 text-blue-400" />
            Banking
          </button>
          <button
            type="button"
            onClick={() => onPurgeFilter('govedu')}
            className="px-2 py-1 bg-gray-900 hover:bg-amber-950/50 text-gray-300 hover:text-amber-300 border border-gray-800 rounded-lg transition-colors flex items-center gap-1"
            title="Remove government (.gov) and educational (.edu) domains"
          >
            <GraduationCap className="w-3 h-3 text-purple-400" />
            Gov & Edu
          </button>
          <button
            type="button"
            onClick={() => onPurgeFilter('roles')}
            className="px-2 py-1 bg-gray-900 hover:bg-rose-950/50 text-gray-300 hover:text-rose-300 border border-gray-800 rounded-lg transition-colors flex items-center gap-1"
            title="Remove generic roles like webmaster@, privacy@, etc."
          >
            <Bot className="w-3 h-3 text-rose-400" />
            Generic Roles
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Quick View Filters */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setViewFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              viewFilter === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            All Leads ({leads.length})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('candidates')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
              viewFilter === 'candidates'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            <Languages className="w-3 h-3 text-cyan-400" />
            Auto-Translate Candidates ({candidateCount})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('preloaded')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
              viewFilter === 'preloaded'
                ? 'bg-purple-600 text-white shadow'
                : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            <CheckCircle className="w-3 h-3 text-purple-400" />
            Preloaded Translations ({preloadedCount})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('with-phone')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
              viewFilter === 'with-phone'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            <Phone className="w-3 h-3 text-emerald-400" />
            With Phone
          </button>
        </div>

        {/* Live Search Input */}
        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search name, domain, company, phone..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Main Table */}
      {filteredLeads.length === 0 ? (
        <div className="py-8 text-center bg-gray-950/60 rounded-xl border border-dashed border-gray-800 text-xs text-gray-400">
          No contacts match the active filter or search criteria.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800 custom-scrollbar">
          <table className="w-full text-left text-xs min-w-[1040px]">
            <thead className="bg-gray-950/80 text-gray-400 uppercase tracking-wider font-mono text-[10px] border-b border-gray-800">
              <tr>
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={allSelected ? onDeselectAll : onSelectAll}
                    className="rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 min-w-[150px]">Analyzed First & Last Name</th>
                <th className="py-3 px-3 min-w-[170px]">Email Address</th>
                <th className="py-3 px-3 min-w-[160px]">Company & Impressum Contact</th>
                <th className="py-3 px-3 min-w-[140px]">Country & Target Language</th>
                <th className="py-3 px-3 min-w-[160px]">Preloaded Translation</th>
                <th className="py-3 px-3 min-w-[95px]">MX Status</th>
                <th className="py-3 px-3 min-w-[120px]">Template Variables</th>
                <th className="py-3 px-2 text-right min-w-[55px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/80">
              {filteredLeads.map(lead => {
                const isSelected = selectedIds.has(lead.id);

                return (
                  <tr
                    key={lead.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/20'
                        : 'bg-gray-900/40 hover:bg-gray-850'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(lead.id)}
                        className="rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Analyzed First & Last Name */}
                    <td className="py-2.5 px-3">
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          {lead.fullName || lead.name || (
                            <span className="text-gray-500 italic">Unspecified</span>
                          )}
                        </div>
                        {(lead.firstName || lead.lastName) && (
                          <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px]">
                            {lead.firstName && (
                              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                                First: <strong>{lead.firstName}</strong>
                              </span>
                            )}
                            {lead.lastName && (
                              <span className="bg-blue-950 text-blue-300 border border-blue-800/60 px-1.5 py-0.2 rounded">
                                Last: <strong>{lead.lastName}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Email Address */}
                    <td className="py-2.5 px-3 font-mono text-gray-300">
                      <span className="text-emerald-400 font-semibold">{lead.email.split('@')[0]}</span>
                      <span className="text-gray-400">@{lead.email.split('@')[1]}</span>
                    </td>

                    {/* Company & Impressum Contact */}
                    <td className="py-2.5 px-3">
                      <div className="space-y-0.5">
                        <div className="text-white font-medium flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          {lead.company || lead.email.split('@')[1]?.split('.')[0]?.toUpperCase()}
                        </div>
                        {lead.phone ? (
                          <div className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            {lead.phone}
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-500">No phone crawled</div>
                        )}
                      </div>
                    </td>

                    {/* Country & Target Language */}
                    <td className="py-2.5 px-3">
                      <div className="space-y-1">
                        <div className="text-gray-200 flex items-center gap-1.5 text-xs">
                          <Globe className="w-3 h-3 text-blue-400 shrink-0" />
                          <span>{lead.country || 'International'}</span>
                        </div>
                        {onSetLeadLanguage ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={lead.targetLanguage || 'English'}
                              onChange={(e) => onSetLeadLanguage(lead.id, e.target.value, false)}
                              className="bg-gray-950 border border-gray-700 hover:border-cyan-500 text-cyan-300 text-[10px] rounded px-1.5 py-0.5 focus:outline-none font-semibold transition"
                              title="Set target language for this recipient"
                            >
                              <option value="German">🇩🇪 German</option>
                              <option value="French">🇫🇷 French</option>
                              <option value="Spanish">🇪🇸 Spanish</option>
                              <option value="Italian">🇮🇹 Italian</option>
                              <option value="Dutch">🇳🇱 Dutch</option>
                              <option value="Portuguese">🇵🇹 Portuguese</option>
                              <option value="Polish">🇵🇱 Polish</option>
                              <option value="Russian">🇷🇺 Russian</option>
                              <option value="Turkish">🇹🇷 Turkish</option>
                              <option value="Arabic">🇸🇦 Arabic</option>
                              <option value="Chinese">🇨🇳 Chinese</option>
                              <option value="Japanese">🇯🇵 Japanese</option>
                              <option value="Korean">🇰🇷 Korean</option>
                              <option value="Swedish">🇸🇪 Swedish</option>
                              <option value="English">🇬🇧 English</option>
                            </select>
                          </div>
                        ) : (
                          lead.targetLanguage && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                              <Languages className="w-2.5 h-2.5 text-cyan-400" />
                              <span>{lead.targetLanguage}</span>
                            </div>
                          )
                        )}
                      </div>
                    </td>

                    {/* Preloaded Translation Column */}
                    <td className="py-2.5 px-3">
                      {lead.isTranslating ? (
                        <div className="flex items-center gap-1.5 text-cyan-400 text-[11px] font-mono animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Translating...</span>
                        </div>
                      ) : (lead.preloadedSubject || lead.autoTranslated) ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            <span>{lead.translatedLanguage || lead.targetLanguage || 'Translated'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLeadForEdit(lead);
                              setModalSubject(lead.preloadedSubject || '');
                              setModalBody(lead.preloadedBody || '');
                              setSaveSuccess(false);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-[10px] font-bold text-purple-200 transition"
                            title="Preview and edit preloaded translation"
                          >
                            <Eye className="w-2.5 h-2.5 text-purple-300" />
                            Preview / Edit
                          </button>
                        </div>
                      ) : (lead.targetLanguage && lead.targetLanguage.toLowerCase() !== 'english') ? (
                        <div className="space-y-1">
                          <span className="text-[10px] text-amber-300/90 font-mono block">Needs {lead.targetLanguage}</span>
                          {onPreloadTranslations && (
                            <button
                              type="button"
                              onClick={() => onPreloadTranslations([lead.id])}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-[10px] font-bold text-indigo-200 transition"
                              title={`Preload ${lead.targetLanguage} translation`}
                            >
                              <Languages className="w-2.5 h-2.5 text-cyan-300" />
                              Preload
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500 font-mono">English (Original)</span>
                      )}
                    </td>

                    {/* MX Status */}
                    <td className="py-2.5 px-3">
                      {lead.mxStatus === 'valid' ? (
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-mono">
                          <CheckCircle className="w-3.5 h-3.5" />
                          MX Valid
                        </span>
                      ) : lead.mxStatus === 'invalid' ? (
                        <span className="text-rose-400 flex items-center gap-1 text-[11px] font-mono">
                          <XCircle className="w-3.5 h-3.5" />
                          No MX (Bounce)
                        </span>
                      ) : (
                        <span className="text-gray-400 flex items-center gap-1 text-[11px] font-mono">
                          <Clock className="w-3 h-3 text-gray-500" />
                          Unverified
                        </span>
                      )}
                    </td>

                    {/* Template Variables Preview */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                        <span className="px-1.5 py-0.5 bg-gray-950 rounded text-emerald-400 border border-gray-800" title="Resolved {{first_name}}">
                          fn: {lead.firstName || 'Executive'}
                        </span>
                        <span className="px-1.5 py-0.5 bg-gray-950 rounded text-blue-300 border border-gray-800" title="Resolved {{company}}">
                          co: {lead.company || 'Team'}
                        </span>
                        {lead.phone && (
                          <span className="px-1.5 py-0.5 bg-gray-950 rounded text-amber-300 border border-gray-800" title="Resolved {{phone}}">
                            tel: ✓
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(lead.id)}
                        className="p-1 text-gray-500 hover:text-rose-400 rounded transition-colors"
                        title="Delete lead record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PREVIEW & EDIT PRELOADED TRANSLATION MODAL */}
      {selectedLeadForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
                  <Languages className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Preloaded Translation: {selectedLeadForEdit.email}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Target: {selectedLeadForEdit.country || 'International'} ({selectedLeadForEdit.targetLanguage || selectedLeadForEdit.translatedLanguage || 'Target Language'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeadForEdit(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Translated Subject:
                </label>
                <input
                  type="text"
                  value={modalSubject}
                  onChange={(e) => setModalSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Translated Body:
                </label>
                <textarea
                  rows={8}
                  value={modalBody}
                  onChange={(e) => setModalBody(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Variable Helper preview */}
              <div className="p-3 bg-gray-950/70 border border-gray-800 rounded-xl">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  Active Recipient Variables:
                </span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                  <span className="px-2 py-0.5 bg-gray-900 text-emerald-300 rounded border border-gray-700">
                    First: {selectedLeadForEdit.firstName || 'Executive'}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-900 text-blue-300 rounded border border-gray-700">
                    Company: {selectedLeadForEdit.company || 'Team'}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-900 text-amber-300 rounded border border-gray-700">
                    Country: {selectedLeadForEdit.country || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-800">
              {saveSuccess ? (
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Translation Saved!
                </span>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLeadForEdit(null)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateLeadTranslation && selectedLeadForEdit) {
                      onUpdateLeadTranslation(selectedLeadForEdit.id, modalSubject, modalBody);
                      setSaveSuccess(true);
                      setTimeout(() => {
                        setSelectedLeadForEdit(null);
                        setSaveSuccess(false);
                      }, 800);
                    }
                  }}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Translation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
