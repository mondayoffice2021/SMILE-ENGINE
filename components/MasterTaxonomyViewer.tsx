import React, { useState, useMemo, useEffect } from 'react';
import {
  MASTER_PRODUCT_CATEGORIES,
  B2B_TRADE_ROLES,
  SOURCING_SEARCH_ENGINES,
  buildSourcingSearchQuery,
  buildSimpleSourcingKeywords,
  getSourcingEngineUrl,
  matchMasterCategory,
  getAllCategories,
  getCustomCategories,
  saveCustomCategory,
  deleteCustomCategory,
  type MasterCategoryDefinition
} from '../constants/masterProductTaxonomy';
import { countries } from '../constants/countries';
import * as XLSX from 'xlsx';
import {
  Search,
  ExternalLink,
  Copy,
  Check,
  Send,
  FileSpreadsheet,
  Layers,
  Tag,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Download,
  ArrowRight,
  Boxes,
  Info,
  Plus,
  Trash2,
  X,
  SlidersHorizontal,
  BookmarkCheck
} from 'lucide-react';

interface MasterTaxonomyViewerProps {
  showToast: (msg: string) => void;
  onApplySearchToExtractor?: (keywords: string, country?: string) => void;
  leadsCountByCategory?: Record<string, number>;
  onSelectCategoryFilter?: (categoryName: string) => void;
}

export const MasterTaxonomyViewer: React.FC<MasterTaxonomyViewerProps> = ({
  showToast,
  onApplySearchToExtractor,
  leadsCountByCategory = {},
  onSelectCategoryFilter
}) => {
  // State for all categories (including dynamic custom categories)
  const [categoriesList, setCategoriesList] = useState<MasterCategoryDefinition[]>([]);
  
  // Section tab: 'all' | 'industries' | 'products' | 'custom'
  const [taxonomySection, setTaxonomySection] = useState<'all' | 'industries' | 'products' | 'custom'>('all');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedParentIndustry, setSelectedParentIndustry] = useState<string>('All');
  
  // Selected category for the Sourcing Query Generator
  const [activeCategory, setActiveCategory] = useState<MasterCategoryDefinition>(MASTER_PRODUCT_CATEGORIES[0]);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('Germany');
  const [selectedEngine, setSelectedEngine] = useState<string>('google');
  const [extraKeywords, setExtraKeywords] = useState<string>('');
  
  // Sandbox Product Classifier Test State
  const [testInput, setTestInput] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Add Custom Category Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customIcon, setCustomIcon] = useState<string>('🏷️');
  const [customIndustry, setCustomIndustry] = useState<string>('Manufacturing & Engineering');
  const [customKeywords, setCustomKeywords] = useState<string>('');
  const [customAltNames, setCustomAltNames] = useState<string>('');
  const [customProducts, setCustomProducts] = useState<string>('');
  const [customTokens, setCustomTokens] = useState<string>('');

  // Reload categories on mount and whenever updated
  const refreshCategories = () => {
    setCategoriesList(getAllCategories());
  };

  useEffect(() => {
    refreshCategories();
  }, []);

  // Quick test chips for user evaluation
  const SAMPLE_TEST_QUERIES = [
    'Nitrile examination gloves',
    'Petro drilling rig & offshore pipelines',
    'Rotary tablet press machine',
    'Telecom 5G wireless broadband antennas',
    'Aviation aircraft avionics',
    'Dental chairs & dental laboratory imaging',
    'Spectrophotometers & lab centrifuges',
    'Marine diesel engine & deck winches',
    'Brown kraft paperboard rolls',
    'Submersible water pumps & RO filtration',
    'Ergonomic standing desk & office chairs',
    'Fintech payment gateway & credit lending',
    'Nonprofit humanitarian aid kits'
  ];

  // Canonical 24 Industry Sector IDs for filtering
  const CANONICAL_INDUSTRY_IDS = useMemo(() => new Set([
    'medical', 'oil-and-gas', 'logistics', 'finance', 'technology',
    'education', 'manufacturing-industrial', 'retail', 'construction', 'automotive',
    'food-and-beverage', 'telecommunications', 'entertainment', 'travel-and-hospitality',
    'legal', 'real-estate', 'agriculture', 'energy', 'government', 'non-profit',
    'aerospace', 'pharmaceuticals', 'sports', 'beauty-and-cosmetics'
  ]), []);

  // Filtered categories based on section, parent industry, and search query
  const filteredCategories = useMemo(() => {
    return categoriesList.filter(cat => {
      // 1. Section filter
      if (taxonomySection === 'industries') {
        const isCanonical = CANONICAL_INDUSTRY_IDS.has(cat.id);
        if (!isCanonical) return false;
      } else if (taxonomySection === 'products') {
        const isCanonical = CANONICAL_INDUSTRY_IDS.has(cat.id);
        const isCustom = cat.id.startsWith('custom-');
        if (isCanonical && !isCustom) return false;
      } else if (taxonomySection === 'custom') {
        if (!cat.id.startsWith('custom-')) return false;
      }

      // 2. Parent Industry filter
      if (selectedParentIndustry !== 'All' && cat.parentIndustry !== selectedParentIndustry) {
        return false;
      }

      // 3. Search text filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        cat.name.toLowerCase().includes(q) ||
        cat.parentIndustry.toLowerCase().includes(q) ||
        cat.relatedKeywords.some(k => k.toLowerCase().includes(q)) ||
        cat.alternativeNames.some(a => a.toLowerCase().includes(q)) ||
        cat.productKeywords.some(p => p.toLowerCase().includes(q)) ||
        cat.classificationTokens.some(t => t.toLowerCase().includes(q))
      );
    });
  }, [categoriesList, taxonomySection, selectedParentIndustry, searchQuery, CANONICAL_INDUSTRY_IDS]);

  // Distinct parent industries
  const parentIndustries = useMemo(() => {
    const set = new Set(categoriesList.map(c => c.parentIndustry));
    return ['All', ...Array.from(set)];
  }, [categoriesList]);

  // Live Classifier Sandbox calculation
  const sandboxClassification = useMemo(() => {
    if (!testInput.trim()) return null;
    return matchMasterCategory(testInput.trim());
  }, [testInput]);

  // Sourcing Query generation
  const generatedBooleanQuery = useMemo(() => {
    return buildSourcingSearchQuery(activeCategory, selectedRole, selectedCountry, extraKeywords);
  }, [activeCategory, selectedRole, selectedCountry, extraKeywords]);

  const generatedSimpleQuery = useMemo(() => {
    return buildSimpleSourcingKeywords(activeCategory, selectedRole, selectedCountry, extraKeywords);
  }, [activeCategory, selectedRole, selectedCountry, extraKeywords]);

  // Copy helper
  const handleCopyText = (text: string, keyId: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
    showToast(`Copied ${label} to clipboard!`);
  };

  // Launch Search Engine
  const handleLaunchSearch = (engineId: string = selectedEngine) => {
    const url = getSourcingEngineUrl(engineId, generatedBooleanQuery, generatedSimpleQuery);
    window.open(url, '_blank', 'noopener,noreferrer');
    const engineName = SOURCING_SEARCH_ENGINES.find(e => e.id === engineId)?.name || engineId.toUpperCase();
    showToast(`Launched ${engineName} search for ${activeCategory.name}!`);
  };

  // Send to Lead Extractor
  const handleSendToExtractor = () => {
    if (!onApplySearchToExtractor) {
      showToast("Extractor integration not connected.");
      return;
    }
    const keywordsToSend = `${activeCategory.relatedKeywords[0] || activeCategory.name} ${activeCategory.relatedKeywords[1] || ''}`.trim();
    onApplySearchToExtractor(keywordsToSend, selectedCountry);
  };

  // Toggle card expansion
  const toggleCardExpansion = (catId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Create new Custom Category
  const handleSaveCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      showToast("Please enter a category name.");
      return;
    }

    const relList = customKeywords.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const altList = customAltNames.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const prodList = customProducts.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const tokenList = customTokens.split(/[,;\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean);

    // Merge name and keywords into token list if empty
    if (tokenList.length === 0) {
      tokenList.push(customName.trim().toLowerCase());
      relList.forEach(k => tokenList.push(k.toLowerCase()));
    }

    const newCat: MasterCategoryDefinition = {
      id: `custom-${Date.now()}-${customName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: customName.trim(),
      icon: customIcon.trim() || '🏷️',
      parentIndustry: customIndustry.trim() || 'Custom Categories',
      relatedKeywords: relList.length > 0 ? relList : [customName.trim()],
      alternativeNames: altList.length > 0 ? altList : [`${customName.trim()} Solutions`],
      productKeywords: prodList.length > 0 ? prodList : [`${customName.trim()} Products`],
      classificationTokens: tokenList,
      sampleQueryTerms: [
        `${customName.trim()} manufacturers`,
        `${customName.trim()} supplier wholesale`,
        `${customName.trim()} exporter factory`
      ]
    };

    saveCustomCategory(newCat);
    refreshCategories();
    setActiveCategory(newCat);
    setIsAddModalOpen(false);
    
    // Reset form
    setCustomName('');
    setCustomKeywords('');
    setCustomAltNames('');
    setCustomProducts('');
    setCustomTokens('');

    showToast(`Added custom category "${newCat.name}"! The system now actively categorizes using it.`);
  };

  // Delete Custom Category
  const handleDeleteCustom = (catId: string, catName: string) => {
    if (confirm(`Remove custom category "${catName}"?`)) {
      deleteCustomCategory(catId);
      refreshCategories();
      if (activeCategory.id === catId) {
        setActiveCategory(MASTER_PRODUCT_CATEGORIES[0]);
      }
      showToast(`Removed custom category "${catName}".`);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      const dateStr = new Date().toISOString().split('T')[0];

      const catData = categoriesList.map(cat => ({
        'Category ID': cat.id,
        'Category Name': cat.name,
        'Type': cat.id.startsWith('custom-') ? 'Custom' : 'Standard',
        'Parent Industry': cat.parentIndustry,
        'Related Search Keywords': cat.relatedKeywords.join(', '),
        'Alternative Names & Terms': cat.alternativeNames.join(', '),
        'Product Keywords': cat.productKeywords.join(', '),
        'Classification Tokens': cat.classificationTokens.join(', '),
        'Sample Query Terms': cat.sampleQueryTerms.join(' | ')
      }));
      const sheet1 = XLSX.utils.json_to_sheet(catData);
      XLSX.utils.book_append_sheet(workbook, sheet1, 'Master Taxonomy');

      const rolesData = B2B_TRADE_ROLES.map(r => ({
        'Role ID': r.id,
        'B2B Role Label': r.label,
        'Query Boolean Modifier': r.queryModifier
      }));
      const sheet2 = XLSX.utils.json_to_sheet(rolesData);
      XLSX.utils.book_append_sheet(workbook, sheet2, 'B2B Trade Roles');

      XLSX.writeFile(workbook, `Master_Product_Taxonomy_${dateStr}.xlsx`);
      showToast("Exported Master Product Taxonomy as Excel Workbook!");
    } catch (err) {
      console.error("Excel export error:", err);
      showToast("Failed to export Excel workbook.");
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    try {
      const headers = ['Category Name', 'Type', 'Parent Industry', 'Related Search Keywords', 'Alternative Names', 'Product Keywords', 'Classification Tokens'];
      const rows = categoriesList.map(cat => [
        `"${cat.name.replace(/"/g, '""')}"`,
        `"${cat.id.startsWith('custom-') ? 'Custom' : 'Standard'}"`,
        `"${cat.parentIndustry.replace(/"/g, '""')}"`,
        `"${cat.relatedKeywords.join('; ').replace(/"/g, '""')}"`,
        `"${cat.alternativeNames.join('; ').replace(/"/g, '""')}"`,
        `"${cat.productKeywords.join('; ').replace(/"/g, '""')}"`,
        `"${cat.classificationTokens.join('; ').replace(/"/g, '""')}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Master_Product_Taxonomy_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Exported Master Categories as CSV!");
    } catch {
      showToast("Failed to export CSV.");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto custom-scrollbar p-1">
      {/* 1. HERO HEADER WITH STATS & TAILORING ACTIONS */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-800/60 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-purple-600/30 rounded-xl border border-purple-500/40 text-purple-300">
              <Layers className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Master Industry & Product Sourcing Taxonomy
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-pink-900/70 border border-pink-500/50 text-pink-200">
                  {categoriesList.length} Active Categories
                </span>
                {getCustomCategories().length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-900 text-purple-200 border border-purple-600">
                    +{getCustomCategories().length} Custom Tailored
                  </span>
                )}
              </div>
              <p className="text-xs text-purple-200/80 mt-1 max-w-2xl leading-relaxed">
                Comprehensive classification engine covering Medical, Oil & Gas, Logistics, Technology, Pharmaceuticals, Manufacturing, and specialized sourcing sectors. Tailor categories to classify companies accurately.
              </p>
            </div>
          </div>

          {/* TAILOR & EXPORT ACTIONS */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition shadow-lg shadow-purple-900/30 border border-purple-400/50"
              title="Add a custom product category or industry to tailor classification"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Category</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow border border-emerald-400/40"
              title="Export complete taxonomy with keywords to Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 transition border border-gray-700"
              title="Download CSV spreadsheet"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-purple-900/50">
          <div className="bg-gray-900/50 rounded-xl p-3 border border-purple-900/30">
            <div className="text-[11px] text-purple-300 font-medium">Canonical Industry Sectors</div>
            <div className="text-lg font-bold text-white mt-0.5">24 Core Sectors</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Medical, Oil & Gas, Tech, Logistics...</div>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-3 border border-purple-900/30">
            <div className="text-[11px] text-pink-300 font-medium">Product Categories</div>
            <div className="text-lg font-bold text-white mt-0.5">{categoriesList.length} Categories</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Standardized + Tailored</div>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-3 border border-purple-900/30">
            <div className="text-[11px] text-cyan-300 font-medium">B2B Trade Roles</div>
            <div className="text-lg font-bold text-white mt-0.5">4 Classifications</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Mfrs, Exporters, Suppliers, Dist.</div>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-3 border border-purple-900/30">
            <div className="text-[11px] text-emerald-300 font-medium">Classification Tokens</div>
            <div className="text-lg font-bold text-white mt-0.5">450+ Keywords</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Instant domain & text tagging</div>
          </div>
        </div>
      </div>

      {/* 2. INSTANT CLASSIFIER SANDBOX WITH 24 SECTORS */}
      <div className="bg-gray-800/60 border border-gray-700/80 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Product & Company Classification Sandbox</h3>
          </div>
          <span className="text-[11px] text-gray-400">Tests instant classification against all 40+ categories</span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Type any product keyword or domain (e.g., 'oil drilling', 'telecom fiber', 'nitrile gloves', 'aircraft avionics', 'pfizer.com')..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900/80 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Quick Sample Chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          <span className="text-[11px] text-gray-400 mr-1">Quick tests:</span>
          {SAMPLE_TEST_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => setTestInput(q)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-purple-950/60 text-purple-300 hover:text-white border border-gray-700/80 transition"
            >
              {q}
            </button>
          ))}
          {testInput && (
            <button
              onClick={() => setTestInput('')}
              className="text-[11px] px-2 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* CLASSIFICATION RESULT CARD */}
        {testInput.trim() && (
          <div className="mt-3.5 p-3.5 bg-gray-900/90 rounded-xl border border-purple-500/40 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
            {sandboxClassification ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{sandboxClassification.category.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{sandboxClassification.category.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                        {Math.min(100, Math.max(75, sandboxClassification.score * 3))}% Confidence
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 border border-gray-700">
                        Matched Token: &quot;{sandboxClassification.matchedToken}&quot;
                      </span>
                      {sandboxClassification.category.id.startsWith('custom-') && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-700">
                          Custom Tailored
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Sector: <span className="text-purple-300 font-medium">{sandboxClassification.category.parentIndustry}</span>
                      {' '}&bull;{' '}Related: {sandboxClassification.category.relatedKeywords.slice(0, 4).join(', ')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveCategory(sandboxClassification.category);
                      showToast(`Loaded ${sandboxClassification.category.name} into Sourcing Query Generator!`);
                      window.scrollTo({ top: 320, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition shadow"
                  >
                    <span>Use in Sourcing Query Generator</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <Info className="w-4 h-4 shrink-0" />
                <span>No exact keyword match found. You can click &quot;Add Custom Category&quot; to teach the system this product/keyword!</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. B2B SOURCING QUERY GENERATOR */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800/90 to-slate-900 border border-indigo-700/60 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700/70 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{activeCategory.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">B2B International Sourcing Query Generator</h3>
                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-950 text-purple-300 border border-purple-700">
                  {activeCategory.name}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Generates high-precision Boolean dorks and directory search patterns for manufacturers, exporters, suppliers, and distributors.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleLaunchSearch(selectedEngine)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition shadow border border-blue-400/50"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Launch {SOURCING_SEARCH_ENGINES.find(e => e.id === selectedEngine)?.name || 'Search'}</span>
            </button>

            {onApplySearchToExtractor && (
              <button
                onClick={handleSendToExtractor}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition shadow border border-purple-400/60"
                title="Send category and sourcing terms directly to the 1,000+ Lead Extractor"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send to Lead Extractor</span>
              </button>
            )}
          </div>
        </div>

        {/* QUERY CONTROLS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Category Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-300 mb-1">Product Category</label>
            <select
              value={activeCategory.id}
              onChange={(e) => {
                const found = categoriesList.find(c => c.id === e.target.value);
                if (found) setActiveCategory(found);
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-purple-300 font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {categoriesList.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name} ({cat.parentIndustry})
                </option>
              ))}
            </select>
          </div>

          {/* 2. B2B Trade Role */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-300 mb-1">Target B2B Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-cyan-300 font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {B2B_TRADE_ROLES.map(role => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Target Country */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-300 mb-1">Target Country / Region</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="Global">Global / Worldwide</option>
              <option value="all">All Countries</option>
              {countries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 4. Search Engine / Directory */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-300 mb-1">Search Engine / Directory</label>
            <select
              value={selectedEngine}
              onChange={(e) => setSelectedEngine(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-emerald-300 font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {SOURCING_SEARCH_ENGINES.map(eng => (
                <option key={eng.id} value={eng.id}>
                  {eng.icon} {eng.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* OPTIONAL CUSTOM SPECS */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-300 mb-1">
            Optional Custom Product Specs / Certifications
          </label>
          <input
            type="text"
            value={extraKeywords}
            onChange={(e) => setExtraKeywords(e.target.value)}
            placeholder="e.g., ISO13485, CE marked, API 6D, GMP certified, wholesale MOQ, OEM..."
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {/* GENERATED QUERY PREVIEW */}
        <div className="bg-gray-950 rounded-xl p-3.5 border border-purple-900/60 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span className="font-semibold text-purple-300">
              Query Preview ({['thomasnet', 'europages', 'kompass', 'alibaba'].includes(selectedEngine) ? 'Directory Clean Mode' : 'Boolean Web Dork Mode'}):
            </span>
            <button
              onClick={() => {
                const q = ['thomasnet', 'europages', 'kompass', 'alibaba'].includes(selectedEngine) ? generatedSimpleQuery : generatedBooleanQuery;
                handleCopyText(q, 'active-query', 'Sourcing Query');
              }}
              className="flex items-center gap-1 text-[11px] text-purple-300 hover:text-white font-medium"
            >
              {copiedKey === 'active-query' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Query</span>
            </button>
          </div>

          <div className="p-2.5 bg-gray-900/90 rounded-lg text-xs font-mono text-emerald-300 break-all select-all border border-gray-800">
            {['thomasnet', 'europages', 'kompass', 'alibaba'].includes(selectedEngine) ? generatedSimpleQuery : generatedBooleanQuery}
          </div>

          {/* ENGINE QUICK LAUNCH ROW */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-900">
            <span className="text-[11px] text-gray-400 mr-1">Direct Engine Launch:</span>
            {SOURCING_SEARCH_ENGINES.map(eng => (
              <button
                key={eng.id}
                onClick={() => handleLaunchSearch(eng.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  selectedEngine === eng.id
                    ? 'bg-purple-600 text-white font-bold shadow'
                    : 'bg-gray-900 text-gray-300 hover:text-white hover:bg-gray-800 border border-gray-800'
                }`}
              >
                <span>{eng.icon}</span>
                <span>{eng.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. MASTER PRODUCT CATEGORIES & TAILORING DIRECTORY */}
      <div className="space-y-4">
        {/* DIRECTORY CONTROLS */}
        <div className="flex flex-col gap-3 p-4 bg-gray-800/40 border border-gray-700/70 rounded-2xl">
          {/* SECTION TABS: ALL | CANONICAL 24 INDUSTRIES | PRODUCT SPECIALTIES | CUSTOM */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-700 text-xs flex-wrap gap-1">
              <button
                onClick={() => setTaxonomySection('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  taxonomySection === 'all'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>All Categories</span>
                <span className="text-[10px] ml-1.5 font-mono opacity-80">({categoriesList.length})</span>
              </button>

              <button
                onClick={() => setTaxonomySection('industries')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                  taxonomySection === 'industries'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-cyan-300" />
                <span>Canonical 24 Industries</span>
              </button>

              <button
                onClick={() => setTaxonomySection('products')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                  taxonomySection === 'products'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-pink-300" />
                <span>Product Specialties</span>
              </button>

              <button
                onClick={() => setTaxonomySection('custom')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                  taxonomySection === 'custom'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Custom Tailored</span>
                <span className="text-[10px] ml-1 font-mono opacity-80">({getCustomCategories().length})</span>
              </button>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Category</span>
            </button>
          </div>

          {/* SEARCH & PARENT SECTOR FILTER */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-700/60">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search category name, keywords, alternative terms, or classification tokens..."
                className="w-full pl-9 pr-3 py-1.5 bg-gray-900/80 border border-gray-700 rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Parent Industry Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar max-w-full pb-1">
              <span className="text-[11px] text-gray-400 shrink-0 mr-1">Sector:</span>
              {parentIndustries.map(ind => (
                <button
                  key={ind}
                  onClick={() => setSelectedParentIndustry(ind)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                    selectedParentIndustry === ind
                      ? 'bg-purple-600 text-white shadow'
                      : 'bg-gray-800/80 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CATEGORY CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCategories.map(cat => {
            const isExpanded = Boolean(expandedCards[cat.id]);
            const leadsCount = leadsCountByCategory[cat.name] || 0;
            const isSelected = activeCategory.id === cat.id;
            const isCustom = cat.id.startsWith('custom-');

            return (
              <div
                key={cat.id}
                className={`bg-gray-800/50 border rounded-2xl p-5 transition-all shadow-lg flex flex-col justify-between ${
                  isSelected
                    ? 'border-purple-500 ring-1 ring-purple-500/50 bg-purple-950/20'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div>
                  {/* CARD HEADER */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl p-1.5 bg-gray-900/80 rounded-xl border border-gray-700/70">{cat.icon}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-base tracking-tight">{cat.name}</h4>
                          {isCustom && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600">
                              Custom
                            </span>
                          )}
                          {leadsCount > 0 && (
                            <span 
                              onClick={() => onSelectCategoryFilter && onSelectCategoryFilter(cat.name)}
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-900/80 text-pink-200 border border-pink-500/50 cursor-pointer hover:bg-pink-800"
                              title="Click to filter analyzed leads by this category"
                            >
                              {leadsCount} Leads
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-purple-300 font-medium">{cat.parentIndustry}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setActiveCategory(cat);
                          showToast(`Selected ${cat.name} in Sourcing Query Generator!`);
                          window.scrollTo({ top: 320, behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700/50 transition"
                        title="Use in Sourcing Query Generator"
                      >
                        Sourcing Dork
                      </button>

                      {isCustom && (
                        <button
                          onClick={() => handleDeleteCustom(cat.id, cat.name)}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg transition"
                          title="Delete this custom category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1. RELATED SEARCH KEYWORDS */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-300 mb-1.5">
                      <span className="flex items-center gap-1 text-purple-300">
                        <Search className="w-3 h-3 text-purple-400" />
                        Related Search Keywords:
                      </span>
                      <button
                        onClick={() => handleCopyText(cat.relatedKeywords.join(', '), `${cat.id}-rel`, 'Related Keywords')}
                        className="text-[10px] text-gray-400 hover:text-white"
                        title="Copy related search keywords"
                      >
                        {copiedKey === `${cat.id}-rel` ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cat.relatedKeywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[11px] bg-purple-950/60 border border-purple-800/50 text-purple-200 font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 2. ALTERNATIVE NAMES & INDUSTRY TERMS */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-300 mb-1.5">
                      <span className="flex items-center gap-1 text-pink-300">
                        <Tag className="w-3 h-3 text-pink-400" />
                        Alternative Names & Industry Terms:
                      </span>
                      <button
                        onClick={() => handleCopyText(cat.alternativeNames.join(', '), `${cat.id}-alt`, 'Alternative Names')}
                        className="text-[10px] text-gray-400 hover:text-white"
                        title="Copy alternative names"
                      >
                        {copiedKey === `${cat.id}-alt` ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cat.alternativeNames.map((alt, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[11px] bg-pink-950/60 border border-pink-800/40 text-pink-200 font-medium"
                        >
                          {alt}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 3. CLASSIFICATION TOKENS */}
                  <div className="mb-3">
                    <div className="text-[11px] font-bold text-gray-400 mb-1">
                      Classification Tokens:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cat.classificationTokens.slice(0, 8).map((tok, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-900 border border-gray-700 text-gray-300"
                        >
                          {tok}
                        </span>
                      ))}
                      {cat.classificationTokens.length > 8 && (
                        <span className="text-[10px] text-gray-500 font-mono py-0.5">
                          +{cat.classificationTokens.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4. PRODUCT KEYWORDS */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-300 mb-1.5">
                      <span className="flex items-center gap-1 text-cyan-300">
                        <Boxes className="w-3 h-3 text-cyan-400" />
                        Product Keywords:
                      </span>
                      <button
                        onClick={() => toggleCardExpansion(cat.id)}
                        className="text-[10px] text-cyan-300 hover:text-white flex items-center gap-0.5"
                      >
                        <span>{isExpanded ? 'Less' : `All (${cat.productKeywords.length})`}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(isExpanded ? cat.productKeywords : cat.productKeywords.slice(0, 6)).map((prod, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[11px] bg-cyan-950/60 border border-cyan-800/40 text-cyan-200 font-medium"
                        >
                          {prod}
                        </span>
                      ))}
                      {!isExpanded && cat.productKeywords.length > 6 && (
                        <button
                          onClick={() => toggleCardExpansion(cat.id)}
                          className="px-1.5 py-0.5 rounded-md text-[10px] bg-gray-800 text-gray-400 hover:text-white font-medium"
                        >
                          +{cat.productKeywords.length - 6} more
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* CARD FOOTER ACTIONS */}
                <div className="mt-4 pt-3 border-t border-gray-700/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const url = getSourcingEngineUrl('google', buildSourcingSearchQuery(cat, 'all', 'Germany'), buildSimpleSourcingKeywords(cat, 'all', 'Germany'));
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="px-2 py-1 text-[11px] font-medium rounded-md bg-gray-900 hover:bg-gray-800 text-blue-300 border border-gray-700 flex items-center gap-1"
                      title="Quick Google search for manufacturers and exporters"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Google</span>
                    </button>
                    <button
                      onClick={() => {
                        const url = getSourcingEngineUrl('bing', buildSourcingSearchQuery(cat, 'all', 'Germany'), buildSimpleSourcingKeywords(cat, 'all', 'Germany'));
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="px-2 py-1 text-[11px] font-medium rounded-md bg-gray-900 hover:bg-gray-800 text-cyan-300 border border-gray-700 flex items-center gap-1"
                      title="Quick Bing search"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Bing</span>
                    </button>
                    <button
                      onClick={() => {
                        const url = getSourcingEngineUrl('alibaba', buildSourcingSearchQuery(cat, 'all', 'Germany'), buildSimpleSourcingKeywords(cat, 'all', 'Germany'));
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="px-2 py-1 text-[11px] font-medium rounded-md bg-gray-900 hover:bg-gray-800 text-amber-300 border border-gray-700 flex items-center gap-1"
                      title="Quick Alibaba global sourcing search"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Alibaba</span>
                    </button>
                  </div>

                  {onApplySearchToExtractor && (
                    <button
                      onClick={() => {
                        const kw = `${cat.relatedKeywords[0] || cat.name} ${cat.relatedKeywords[1] || ''}`.trim();
                        onApplySearchToExtractor(kw, 'Germany');
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white flex items-center gap-1 transition"
                      title="Send this category to Lead Extractor"
                    >
                      <Send className="w-3 h-3" />
                      <span>Extract Leads</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. ADD CUSTOM CATEGORY MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-purple-500/60 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 bg-purple-600/30 rounded-xl border border-purple-500/40 text-purple-300">
                <Plus className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Add Custom Product / Industry Category</h3>
                <p className="text-xs text-gray-400">Tailor the classification engine with your custom sector keywords</p>
              </div>
            </div>

            <form onSubmit={handleSaveCustomCategory} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-gray-300 font-semibold mb-1">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g., Industrial Robotics, Solar Cells, Dairy Machinery..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Icon / Emoji</label>
                  <input
                    type="text"
                    value={customIcon}
                    onChange={(e) => setCustomIcon(e.target.value)}
                    placeholder="🏷️"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-center text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Parent Sector / Industry</label>
                <input
                  type="text"
                  value={customIndustry}
                  onChange={(e) => setCustomIndustry(e.target.value)}
                  placeholder="e.g., Technology, Manufacturing, Energy, Healthcare..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Related Search Keywords (comma-separated) *
                </label>
                <input
                  type="text"
                  required
                  value={customKeywords}
                  onChange={(e) => setCustomKeywords(e.target.value)}
                  placeholder="e.g., Robotic arms, SCARA robots, automation cells, industrial robotics OEM"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Alternative Names / Industry Terms (comma-separated)
                </label>
                <input
                  type="text"
                  value={customAltNames}
                  onChange={(e) => setCustomAltNames(e.target.value)}
                  placeholder="e.g., Factory automation, Cobots, Collaborative robots, Pick and place"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Product Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={customProducts}
                  onChange={(e) => setCustomProducts(e.target.value)}
                  placeholder="e.g., 6-axis articulated robots, Delta high speed robots, AGVs, robot grippers"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Classification Match Tokens (domain substrings / word tokens)
                </label>
                <input
                  type="text"
                  value={customTokens}
                  onChange={(e) => setCustomTokens(e.target.value)}
                  placeholder="e.g., robot, robotics, cobot, scara, agv, automation"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Used by the offline parser and AI classifier to instantly assign matching domains and emails to this category.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition shadow-lg"
                >
                  Save & Tailor Taxonomy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
