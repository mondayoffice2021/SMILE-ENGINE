import React, { useState, useEffect, useRef, useMemo } from 'react';
import LinkIcon from './icons/LinkIcon';
import GlobeAltIcon from './icons/GlobeAltIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import DocumentArrowUpIcon from './icons/DocumentArrowUpIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import CheckIcon from './icons/CheckIcon';
import XCircleIcon from './icons/XCircleIcon';
import PlayIcon from './icons/PlayIcon';
import StopIcon from './icons/StopIcon';
import { isPublicDomain } from '../constants/domains';
import { useActiveWakeLock } from '../hooks/useWakeLock';
import { evaluateCleanTarget, CleanFilterConfig } from '../services/businessEmailFilter';
import { CloudDbActionBar } from './CloudDbActionBar';
import type { UserProfile } from '../services/serverApiClient';
import type { ExtractedEmail } from '../types';

interface BulkUrlOpenerProps {
  showToast: (message: string) => void;
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  onNavigateToServerJobs?: () => void;
}

export interface ParsedItem {
  id: string;
  original: string;
  url: string;
  domain: string;
  isEmail: boolean;
  isPublicWebmail: boolean;
  status: 'ready' | 'opened' | 'blocked' | 'skipped' | 'nulled';
  openedAt?: number;
  openCount?: number;
}

export interface OpenedItem {
  id: string;
  original: string;
  url: string;
  domain: string;
  isEmail: boolean;
  isPublicWebmail: boolean;
  openedAt: number;
  openCount: number;
  status: 'opened' | 'blocked';
}

export const BulkUrlOpener: React.FC<BulkUrlOpenerProps> = ({ 
  showToast,
  currentUser,
  onOpenAuth,
  onNavigateToServerJobs
}) => {
  const [inputText, setInputText] = useState<string>('');

  // Clean filtering and deduplication states
  const [enableCleanFilter, setEnableCleanFilter] = useState<boolean>(true);
  const [excludePublicWebmail, setExcludePublicWebmail] = useState<boolean>(true);
  const [excludeBanks, setExcludeBanks] = useState<boolean>(true);
  const [excludeJunkEmails, setExcludeJunkEmails] = useState<boolean>(true);
  const [excludeGovEdu, setExcludeGovEdu] = useState<boolean>(true);
  const [removeDuplicateUrls, setRemoveDuplicateUrls] = useState<boolean>(true);
  const [showCleanConfig, setShowCleanConfig] = useState<boolean>(false);

  // Behavior on Click: 'remove' (Auto-remove from active list) or 'null' (Mark as nulled in-place)
  const [clickBehavior, setClickBehavior] = useState<'remove' | 'null'>('remove');
  const [autoRemoveFromTextarea, setAutoRemoveFromTextarea] = useState<boolean>(false);

  // Tabs for URL list view: 'queue' (unopened only), 'opened' (clicked/removed with try open again), 'all' (all items)
  const [activeListTab, setActiveListTab] = useState<'queue' | 'opened' | 'all'>('queue');

  const [delayBetweenTabs, setDelayBetweenTabs] = useState<number>(150); // ms delay to prevent browser crash
  const [isOpening, setIsOpening] = useState<boolean>(false);

  // Keep screen awake while batch URLs are being opened
  useActiveWakeLock(isOpening, 'Bulk URL Opener: Launching Targets');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [popupBlockedWarning, setPopupBlockedWarning] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'opened' | 'nulled' | 'blocked'>('all');

  // Opened / Clicked history list with retry capabilities
  const [openedItems, setOpenedItems] = useState<OpenedItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortOpeningRef = useRef<boolean>(false);

  // Helper: Normalize URL or Email to clean https:// URL
  const convertToUrl = (raw: string): { url: string; domain: string; isEmail: boolean; isPublicWebmail: boolean } | null => {
    let text = raw.trim();
    if (!text) return null;

    // Clean common wrappers like < >, [ ], ( ), quotes, trailing semicolons/commas
    text = text.replace(/^[<"'\(\[]+|[>"'\)\];,]+$/g, '').trim();
    if (!text) return null;

    // Check if it's an email format
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      const rawDomain = emailMatch[2].toLowerCase();
      const isPublic = isPublicDomain(rawDomain);
      return {
        url: `https://${rawDomain}`,
        domain: rawDomain,
        isEmail: true,
        isPublicWebmail: isPublic
      };
    }

    // Check if it's already a URL or domain
    let cleanText = text;
    if (/^https?:\/\//i.test(cleanText)) {
      const parts = cleanText.split(/:\/\//i);
      cleanText = parts[1];
    }

    // Extract hostname / domain
    const hostMatch = cleanText.match(/^([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (hostMatch) {
      const domain = hostMatch[1].toLowerCase();
      const isPublic = isPublicDomain(domain);
      // Reconstruct clean URL
      const fullUrl = text.startsWith('http://') || text.startsWith('https://')
        ? text
        : `https://${text}`;
      return {
        url: fullUrl,
        domain,
        isEmail: false,
        isPublicWebmail: isPublic
      };
    }

    return null;
  };

  // Helper: Format relative timestamp
  const formatTimeAgo = (timestamp?: number): string => {
    if (!timestamp) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Parse and deduplicate with clean filter rules
  const { parsedItems, cleanFilterStats } = useMemo(() => {
    if (!inputText.trim()) {
      return {
        parsedItems: [] as ParsedItem[],
        cleanFilterStats: {
          totalTokens: 0,
          publicExcluded: 0,
          banksExcluded: 0,
          junkExcluded: 0,
          govEduExcluded: 0,
          duplicatesRemoved: 0
        }
      };
    }

    // Split on newlines, commas, tabs, spaces
    const tokens = inputText
      .split(/[\r\n,;]+/)
      .map(t => t.trim())
      .filter(Boolean);

    const cleanConfig: CleanFilterConfig = {
      removePublicEmails: excludePublicWebmail,
      removeBanks: excludeBanks,
      removeJunkUsers: excludeJunkEmails,
      removeGovEdu: excludeGovEdu,
      removeDuplicates: removeDuplicateUrls
    };

    let pubCount = 0;
    let bankCount = 0;
    let junkCount = 0;
    let govEduCount = 0;
    let dupCount = 0;

    const seenUrls = new Set<string>();
    const items: ParsedItem[] = [];

    tokens.forEach((token, idx) => {
      // 1. Check raw token against business clean filter if enabled
      if (enableCleanFilter) {
        const evalRes = evaluateCleanTarget(token, cleanConfig);
        if (!evalRes.isClean) {
          if (evalRes.category === 'public_webmail') pubCount++;
          else if (evalRes.category === 'bank') bankCount++;
          else if (evalRes.category === 'webmaster_bot') junkCount++;
          else if (evalRes.category === 'government' || evalRes.category === 'education') govEduCount++;
          return;
        }
      }

      const res = convertToUrl(token);
      if (!res) return;

      // 2. Check resolved domain against clean rules
      if (enableCleanFilter && res.domain) {
        const domainEval = evaluateCleanTarget(res.domain, cleanConfig);
        if (!domainEval.isClean) {
          if (domainEval.category === 'public_webmail') pubCount++;
          else if (domainEval.category === 'bank') bankCount++;
          else if (domainEval.category === 'government' || domainEval.category === 'education') govEduCount++;
          return;
        }
      }

      // Legacy toggle fallback
      if (excludePublicWebmail && res.isPublicWebmail) {
        pubCount++;
        return;
      }

      // 3. Normalized URL Deduplication
      const normalizedKey = res.url.toLowerCase().replace(/\/+$/, '');
      if (removeDuplicateUrls) {
        if (seenUrls.has(normalizedKey)) {
          dupCount++;
          return;
        }
        seenUrls.add(normalizedKey);
      }

      items.push({
        id: `item-${idx}-${normalizedKey}`,
        original: token,
        url: res.url,
        domain: res.domain,
        isEmail: res.isEmail,
        isPublicWebmail: res.isPublicWebmail,
        status: 'ready'
      });
    });

    return {
      parsedItems: items,
      cleanFilterStats: {
        totalTokens: tokens.length,
        publicExcluded: pubCount,
        banksExcluded: bankCount,
        junkExcluded: junkCount,
        govEduExcluded: govEduCount,
        duplicatesRemoved: dupCount
      }
    };
  }, [
    inputText,
    enableCleanFilter,
    excludePublicWebmail,
    excludeBanks,
    excludeJunkEmails,
    excludeGovEdu,
    removeDuplicateUrls
  ]);

  // Synchronize itemsState while taking into account opened items and clickBehavior
  const [itemsState, setItemsState] = useState<ParsedItem[]>([]);

  useEffect(() => {
    const openedUrlMap = new Map<string, OpenedItem>(
      openedItems.map(o => [o.url.toLowerCase().replace(/\/+$/, ''), o])
    );

    if (clickBehavior === 'remove') {
      // Exclude already opened URLs from the active queue
      const activeOnly = parsedItems.filter(item => {
        const key = item.url.toLowerCase().replace(/\/+$/, '');
        return !openedUrlMap.has(key);
      });
      setItemsState(activeOnly);
      setSelectedIds(new Set(activeOnly.map(item => item.id)));
    } else {
      // Keep in list but mark opened ones as 'nulled'
      const merged = parsedItems.map(item => {
        const key = item.url.toLowerCase().replace(/\/+$/, '');
        const opened = openedUrlMap.get(key);
        if (opened) {
          return {
            ...item,
            status: 'nulled' as const,
            openedAt: opened.openedAt,
            openCount: opened.openCount
          };
        }
        return item;
      });
      setItemsState(merged);
      setSelectedIds(new Set(merged.filter(it => it.status !== 'nulled').map(item => item.id)));
    }
  }, [parsedItems, clickBehavior]);

  // Helper: Remove original token from textarea if autoRemoveFromTextarea is on
  const removeTokenFromInputText = (tokenToRemove: string) => {
    setInputText(prev => {
      const lines = prev.split(/[\r\n]+/);
      const filtered = lines.filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return true;
        return trimmed !== tokenToRemove && !trimmed.includes(tokenToRemove);
      });
      return filtered.join('\n');
    });
  };

  // Sync textarea with remaining active items
  const handleSyncTextareaWithQueue = () => {
    const active = itemsState.filter(it => it.status === 'ready');
    const remaining = active.map(it => it.original || it.url).join('\n');
    setInputText(remaining);
    showToast(`Synced text box: ${active.length} active URL(s) remaining.`);
  };

  // Global Keyboard Shortcuts: Ctrl+Enter (Open All) and Ctrl+R (Reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open all on Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (activeListTab === 'opened') {
          handleTryOpenAllAgain();
        } else {
          handleOpenSelected();
        }
      }

      // Reset on Ctrl+R or Cmd+R
      if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemsState, selectedIds, isOpening, activeListTab, openedItems]);

  // Reset function
  const handleReset = () => {
    if (isOpening) {
      abortOpeningRef.current = true;
      setIsOpening(false);
    }
    setInputText('');
    setItemsState([]);
    setOpenedItems([]);
    setSelectedIds(new Set());
    setPopupBlockedWarning(false);
    setSearchQuery('');
    showToast('Reset complete! [Ctrl+R]');
  };

  // Single URL Opener helper
  const openSingleUrl = (url: string): boolean => {
    try {
      const newTab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
        // Popup was blocked by browser
        return false;
      }
      return true;
    } catch (err) {
      console.error('Failed to open tab', err);
      return false;
    }
  };

  // Unified Open / Click Handler for single URL (either initial click or retry)
  const handleOpenUrl = (
    item: ParsedItem | OpenedItem,
    isRetry = false
  ) => {
    const success = openSingleUrl(item.url);
    const now = Date.now();
    const normalizedKey = item.url.toLowerCase().replace(/\/+$/, '');

    if (success) {
      // 1. Update or append to openedItems
      setOpenedItems(prev => {
        const existingIdx = prev.findIndex(p => p.url.toLowerCase().replace(/\/+$/, '') === normalizedKey);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const curr = updated[existingIdx];
          updated[existingIdx] = {
            ...curr,
            openedAt: now,
            openCount: (curr.openCount || 1) + 1,
            status: 'opened'
          };
          return updated;
        } else {
          const newItem: OpenedItem = {
            id: item.id,
            original: item.original,
            url: item.url,
            domain: item.domain,
            isEmail: item.isEmail,
            isPublicWebmail: item.isPublicWebmail,
            openedAt: now,
            openCount: 1,
            status: 'opened'
          };
          return [newItem, ...prev];
        }
      });

      // 2. Adjust itemsState based on clickBehavior
      if (clickBehavior === 'remove') {
        // Remove from active items list
        setItemsState(prev => prev.filter(it => it.url.toLowerCase().replace(/\/+$/, '') !== normalizedKey));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      } else {
        // Null in place: update status to 'nulled'
        setItemsState(prev => prev.map(it => {
          if (it.url.toLowerCase().replace(/\/+$/, '') === normalizedKey) {
            return {
              ...it,
              status: 'nulled',
              openedAt: now,
              openCount: (it.openCount || 0) + 1
            };
          }
          return it;
        }));
      }

      // 3. Auto-remove from text box if configured
      if (autoRemoveFromTextarea && item.original) {
        removeTokenFromInputText(item.original);
      }

      if (isRetry) {
        showToast(`🔄 Re-opened: ${item.domain} (Attempt #${(item.openCount || 1) + 1})`);
      } else {
        if (clickBehavior === 'remove') {
          showToast(`Opened & removed: ${item.domain} — Option to "Try Open Again" in Opened tab.`);
        } else {
          showToast(`Opened & nulled: ${item.domain} — Option to "Try Open Again" available.`);
        }
      }
    } else {
      setPopupBlockedWarning(true);
      setItemsState(prev => prev.map(it => it.id === item.id ? { ...it, status: 'blocked' } : it));
      showToast('⚠️ Pop-up blocked! Please click the pop-up icon in your address bar to allow.');
    }
  };

  // Try Open Again handler for any opened/nulled item
  const handleTryOpenAgain = (item: OpenedItem | ParsedItem) => {
    handleOpenUrl(item, true);
  };

  // Restore an opened/nulled item back to active queue
  const handleRestoreItem = (item: OpenedItem | ParsedItem) => {
    const normalizedKey = item.url.toLowerCase().replace(/\/+$/, '');

    // Remove from openedItems
    setOpenedItems(prev => prev.filter(o => o.url.toLowerCase().replace(/\/+$/, '') !== normalizedKey));

    // Re-insert or mark ready in itemsState
    setItemsState(prev => {
      const existing = prev.find(p => p.url.toLowerCase().replace(/\/+$/, '') === normalizedKey);
      if (existing) {
        return prev.map(p => p.id === existing.id ? { ...p, status: 'ready', openCount: 0 } : p);
      } else {
        const restored: ParsedItem = {
          id: item.id,
          original: item.original,
          url: item.url,
          domain: item.domain,
          isEmail: item.isEmail,
          isPublicWebmail: item.isPublicWebmail,
          status: 'ready',
          openCount: 0
        };
        return [restored, ...prev];
      }
    });

    setSelectedIds(prev => new Set(prev).add(item.id));
    showToast(`Restored ${item.domain} back to active queue.`);
  };

  // Open All / Selected URLs in Queue
  const handleOpenSelected = async () => {
    const toOpen = itemsState.filter(item => selectedIds.has(item.id) && item.status !== 'nulled');
    if (toOpen.length === 0) {
      showToast('No active URLs selected to open. Please enter emails or URLs first.');
      return;
    }

    setIsOpening(true);
    abortOpeningRef.current = false;
    setPopupBlockedWarning(false);

    let openedCount = 0;
    let blockedCount = 0;

    for (let i = 0; i < toOpen.length; i++) {
      if (abortOpeningRef.current) {
        showToast(`Stopped opening. Opened ${openedCount} of ${toOpen.length} URLs.`);
        break;
      }

      const item = toOpen[i];
      const success = openSingleUrl(item.url);
      const now = Date.now();
      const normalizedKey = item.url.toLowerCase().replace(/\/+$/, '');

      if (success) {
        openedCount++;
        // Add to openedItems
        setOpenedItems(prev => {
          const existingIdx = prev.findIndex(p => p.url.toLowerCase().replace(/\/+$/, '') === normalizedKey);
          if (existingIdx >= 0) {
            const copy = [...prev];
            copy[existingIdx] = {
              ...copy[existingIdx],
              openedAt: now,
              openCount: (copy[existingIdx].openCount || 1) + 1,
              status: 'opened'
            };
            return copy;
          }
          return [{
            id: item.id,
            original: item.original,
            url: item.url,
            domain: item.domain,
            isEmail: item.isEmail,
            isPublicWebmail: item.isPublicWebmail,
            openedAt: now,
            openCount: 1,
            status: 'opened'
          }, ...prev];
        });

        if (clickBehavior === 'remove') {
          setItemsState(prev => prev.filter(it => it.id !== item.id));
          setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        } else {
          setItemsState(prev => prev.map(it => it.id === item.id ? { ...it, status: 'nulled', openedAt: now, openCount: 1 } : it));
        }

        if (autoRemoveFromTextarea && item.original) {
          removeTokenFromInputText(item.original);
        }
      } else {
        blockedCount++;
        setPopupBlockedWarning(true);
        setItemsState(prev => prev.map(it => it.id === item.id ? { ...it, status: 'blocked' } : it));
      }

      // Small delay between opening tabs to prevent browser freezing
      if (delayBetweenTabs > 0 && i < toOpen.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenTabs));
      }
    }

    setIsOpening(false);

    if (blockedCount > 0) {
      showToast(`⚠️ ${blockedCount} tab(s) were blocked by browser pop-up blocker. Please enable pop-ups!`);
    } else {
      showToast(`Successfully opened ${openedCount} tab(s)! You can "Try Open Again" anytime in the Opened tab.`);
    }
  };

  // Try Open All Again for opened items
  const handleTryOpenAllAgain = async () => {
    if (openedItems.length === 0) return;
    setIsOpening(true);
    abortOpeningRef.current = false;
    let count = 0;

    for (let i = 0; i < openedItems.length; i++) {
      if (abortOpeningRef.current) break;
      const it = openedItems[i];
      const success = openSingleUrl(it.url);
      const now = Date.now();
      if (success) {
        count++;
        setOpenedItems(prev => prev.map(p => p.id === it.id ? { ...p, openedAt: now, openCount: (p.openCount || 1) + 1 } : p));
      }
      if (delayBetweenTabs > 0 && i < openedItems.length - 1) {
        await new Promise(r => setTimeout(r, delayBetweenTabs));
      }
    }

    setIsOpening(false);
    showToast(`Re-opened ${count} of ${openedItems.length} URLs!`);
  };

  // Restore All opened items to active queue
  const handleRestoreAllToQueue = () => {
    if (openedItems.length === 0) return;
    setItemsState(prev => {
      const existingUrls = new Set(prev.map(p => p.url.toLowerCase().replace(/\/+$/, '')));
      const toAdd: ParsedItem[] = openedItems
        .filter(o => !existingUrls.has(o.url.toLowerCase().replace(/\/+$/, '')))
        .map(o => ({
          id: o.id,
          original: o.original,
          url: o.url,
          domain: o.domain,
          isEmail: o.isEmail,
          isPublicWebmail: o.isPublicWebmail,
          status: 'ready' as const,
          openCount: 0
        }));
      const updatedPrev = prev.map(p => ({ ...p, status: 'ready' as const }));
      return [...updatedPrev, ...toAdd];
    });
    setOpenedItems([]);
    showToast(`Restored all ${openedItems.length} URLs back to active queue!`);
  };

  // Clear opened items history
  const handleClearOpenedHistory = () => {
    setOpenedItems([]);
    showToast('Cleared opened URLs history.');
  };

  // File Upload / Drop handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInputText(content);
        showToast(`Loaded ${file.name} successfully.`);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  // Load Sample Data for fast testing
  const handleLoadSample = () => {
    const sample = [
      '// Corporate contacts & domains to test (Click any URL to open & remove):',
      'contact@siemens.com',
      'info@bosch.de',
      'sales@siemens.com', // Duplicate domain
      'https://www.bmwgroup.com',
      'support@volkswagen.de',
      'press@mercedes-benz.com',
      'partner@sap.com',
      'john.doe@gmail.com', // Public email (filtered if clean toggle is on)
      'contact@airbus.com',
      'https://www.basf.com/global/en.html',
      'info@thyssenkrupp.com',
      'https://www.bosch.de' // Duplicate domain
    ].join('\n');
    setInputText(sample);
    showToast('Loaded sample emails & URLs.');
  };

  // Copy All URLs to clipboard
  const handleCopyAll = () => {
    const targetList = activeListTab === 'opened' ? openedItems : itemsState;
    const urls = targetList.map(item => item.url).join('\n');
    if (!urls) {
      showToast('No URLs to copy.');
      return;
    }
    navigator.clipboard.writeText(urls);
    showToast(`Copied ${targetList.length} URLs to clipboard!`);
  };

  // Export URLs to .txt file
  const handleExportTxt = () => {
    const targetList = activeListTab === 'opened' ? openedItems : itemsState;
    const urls = targetList.map(item => item.url).join('\n');
    if (!urls) {
      showToast('No URLs to export.');
      return;
    }
    const blob = new Blob([urls], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bulk_urls_${activeListTab}_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    showToast(`Exported ${targetList.length} URLs to text file.`);
  };

  // Toggle selection in active list
  const toggleSelectAll = () => {
    const active = itemsState.filter(it => it.status !== 'nulled');
    if (selectedIds.size === active.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(active.map(it => it.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered lists for the 3 tabs:
  // 1. Active Queue: only ready items
  const activeQueueList = itemsState.filter(item => {
    if (item.status === 'nulled') return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.url.toLowerCase().includes(q) || item.original.toLowerCase().includes(q);
    }
    return true;
  });

  // 2. Opened / Removed list
  const filteredOpenedList = openedItems.filter(item => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.url.toLowerCase().includes(q) || item.original.toLowerCase().includes(q);
    }
    return true;
  });

  // 3. All items list (merged)
  const allMergedList = useMemo(() => {
    const list: Array<ParsedItem | OpenedItem> = [...itemsState];
    if (clickBehavior === 'remove') {
      const existingUrls = new Set(itemsState.map(it => it.url.toLowerCase().replace(/\/+$/, '')));
      openedItems.forEach(op => {
        if (!existingUrls.has(op.url.toLowerCase().replace(/\/+$/, ''))) {
          list.push(op);
        }
      });
    }
    return list.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.url.toLowerCase().includes(q) || item.original.toLowerCase().includes(q);
      }
      return true;
    });
  }, [itemsState, openedItems, clickBehavior, searchQuery]);

  const totalRawLines = inputText.split(/[\r\n,;]+/).filter(t => t.trim().length > 0).length;
  const emailsConvertedCount = itemsState.filter(it => it.isEmail).length;
  const directUrlsCount = itemsState.filter(it => !it.isEmail).length;
  const activeQueueCount = itemsState.filter(it => it.status !== 'nulled').length;

  // Cloud Database synchronization mapping
  const itemsToUploadToCloudDb = useMemo<ExtractedEmail[]>(() => {
    return itemsState.filter(it => it.isEmail).map(it => ({
      email: it.original,
      domain: it.domain,
      source: 'Bulk URL Opener',
      isValid: true,
      confidence: 0.95
    }));
  }, [itemsState]);

  const handleLoadLeadsFromCloudDb = (leads: ExtractedEmail[]) => {
    if (leads.length === 0) return;
    const urlsOrEmails = leads.map(l => l.sourceUrl || (l.domain ? `https://${l.domain}` : l.email)).filter(Boolean);
    setInputText(prev => prev ? `${prev}\n${urlsOrEmails.join('\n')}` : urlsOrEmails.join('\n'));
    showToast(`Loaded ${urlsOrEmails.length} targets from Cloud DB into URL queue!`);
  };

  return (
    <div className="space-y-6">
      <CloudDbActionBar
        systemName="Bulk URL Opener & Spider"
        currentUser={currentUser}
        onOpenAuth={onOpenAuth}
        showToast={showToast}
        itemsToUpload={itemsToUploadToCloudDb}
        onLoadLeads={handleLoadLeadsFromCloudDb}
        onNavigateToServerJobs={onNavigateToServerJobs}
      />

      {/* TOP INSTRUCTION & POPUP BANNER */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-blue-900/40 border border-blue-700/60 rounded-xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-blue-600/30 border border-blue-500/40 rounded-lg text-blue-300 mt-0.5">
            <GlobeAltIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Bulk URL Opener
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-800 text-blue-200 border border-blue-600">
                Click-to-Remove / Null & Retry
              </span>
            </h2>
            <p className="text-sm text-yellow-300 font-medium mt-0.5 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Please allow pop-ups for this site so every URL opens directly in its own tab.</span>
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Clicking any URL removes it from your active list (or nulls it) with an instant option to <strong>Try Open Again</strong>.
            </p>
          </div>
        </div>

        {/* Action Shortcuts Pill */}
        <div className="flex flex-wrap items-center gap-2 bg-gray-900/80 px-3 py-2 rounded-lg border border-gray-700 text-xs text-gray-300">
          <span className="font-semibold text-gray-200">Shortcuts:</span>
          <span className="bg-gray-800 text-blue-300 px-2 py-0.5 rounded font-mono border border-gray-600">
            Open all [Ctrl+Enter]
          </span>
          <span className="bg-gray-800 text-yellow-300 px-2 py-0.5 rounded font-mono border border-gray-600">
            Reset [Ctrl+R]
          </span>
        </div>
      </div>

      {/* POP-UP BLOCKED WARNING MODAL/BANNER */}
      {popupBlockedWarning && (
        <div className="bg-red-950/80 border-2 border-red-600 rounded-xl p-4 text-red-200 shadow-2xl flex items-start justify-between gap-4 animate-pulse">
          <div className="flex items-start gap-3">
            <XCircleIcon className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-white text-sm">Browser Pop-up Blocker Active!</h3>
              <p className="text-xs text-red-200 leading-relaxed">
                Your browser blocked one or more tabs from opening automatically. To enable:
              </p>
              <ol className="list-decimal list-inside text-xs text-red-100 space-y-0.5 mt-1">
                <li>Look at the right side of your browser address bar for the <strong>Pop-up blocked icon</strong> (window with red X).</li>
                <li>Click it and select <strong>"Always allow pop-ups and redirects from this site"</strong>.</li>
                <li>Click <strong>Done</strong>, then click <strong>"Open Tab"</strong> or <strong>"Try Open Again"</strong>.</li>
              </ol>
            </div>
          </div>
          <button
            onClick={() => setPopupBlockedWarning(false)}
            className="text-xs bg-red-800/60 hover:bg-red-700 text-white px-2.5 py-1 rounded transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: INPUT & SETTINGS */}
        <div className="lg:col-span-5 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-blue-400" />
                  Load Emails or URLs
                </h3>
                <span className="text-xs text-gray-400">Pastes, lists, or file uploads</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="text-xs px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-blue-300 transition-colors font-medium"
                  title="Insert sample test list"
                >
                  Load Sample
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors font-medium flex items-center gap-1"
                  title="Upload .txt or .csv"
                >
                  <DocumentArrowUpIcon className="w-3.5 h-3.5" />
                  Upload
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.log,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* TEXTAREA INPUT */}
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste email addresses or URLs here, one per line or separated by commas:&#10;&#10;sales@company.com&#10;info@industry-corp.de&#10;https://target-domain.org&#10;support@logistics.co.uk&#10;user@gmail.com"
              className="w-full h-56 p-3.5 bg-gray-900/90 border border-gray-600 rounded-lg text-sm font-mono text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none custom-scrollbar"
            />

            {/* REAL-TIME DEDUPLICATION STATS BAR */}
            <div className="grid grid-cols-4 gap-2 bg-gray-900/60 p-2.5 rounded-lg border border-gray-700/80 text-center text-xs">
              <div>
                <span className="text-gray-400 block text-[11px]">Raw Lines</span>
                <span className="font-bold text-white text-sm">{totalRawLines}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">In Queue</span>
                <span className="font-bold text-blue-400 text-sm">{activeQueueCount}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Opened / Done</span>
                <span className="font-bold text-emerald-400 text-sm">{openedItems.length}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Total Unique</span>
                <span className="font-bold text-purple-400 text-sm">{parsedItems.length}</span>
              </div>
            </div>

            {/* USER REQUESTED FEATURE: URL CLICK BEHAVIOR & NULL/RETRY CONTROLS */}
            <div className="p-3 bg-gradient-to-br from-gray-900/90 via-blue-950/30 to-indigo-950/40 border border-blue-500/40 rounded-xl space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                  <span>🖱️</span> When any URL is clicked:
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-blue-900/70 text-blue-200 border border-blue-700/50">
                  {clickBehavior === 'remove' ? 'Auto-Remove from list' : 'Null in place'}
                </span>
              </div>

              {/* Behavior selector buttons */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setClickBehavior('remove')}
                  className={`p-2 rounded-lg border text-left flex items-start gap-2 transition-all ${
                    clickBehavior === 'remove'
                      ? 'bg-blue-600/30 border-blue-500 text-blue-100 shadow-sm'
                      : 'bg-gray-800/80 border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex-shrink-0 ${
                    clickBehavior === 'remove' ? 'border-blue-400 bg-blue-500' : 'border-gray-500'
                  }`} />
                  <div>
                    <div className="font-bold text-xs text-white">Remove from list</div>
                    <div className="text-[10px] text-gray-300 leading-tight mt-0.5">
                      Shrinks active queue; try open again anytime in Opened tab
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setClickBehavior('null')}
                  className={`p-2 rounded-lg border text-left flex items-start gap-2 transition-all ${
                    clickBehavior === 'null'
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-100 shadow-sm'
                      : 'bg-gray-800/80 border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex-shrink-0 ${
                    clickBehavior === 'null' ? 'border-indigo-400 bg-indigo-500' : 'border-gray-500'
                  }`} />
                  <div>
                    <div className="font-bold text-xs text-white">Null in place</div>
                    <div className="text-[10px] text-gray-300 leading-tight mt-0.5">
                      Crosses out URL with inline "Try Open Again" button
                    </div>
                  </div>
                </button>
              </div>

              {/* Auto remove from text box toggle & sync button */}
              <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-xs gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white select-none">
                  <input
                    type="checkbox"
                    checked={autoRemoveFromTextarea}
                    onChange={(e) => setAutoRemoveFromTextarea(e.target.checked)}
                    className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 bg-gray-800"
                  />
                  <span className="text-[11px]">Also remove clicked URLs from input text box</span>
                </label>
                <button
                  type="button"
                  onClick={handleSyncTextareaWithQueue}
                  className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium flex-shrink-0"
                  title="Replace input text with only remaining active URLs"
                >
                  Sync text box now
                </button>
              </div>
            </div>

            {/* FILTER & SAFETY CONTROLS WITH CLEAN SEPARATION RULES */}
            <div className="p-3 bg-gradient-to-br from-gray-900/90 to-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-2 shadow-md">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableCleanFilter}
                    onChange={(e) => setEnableCleanFilter(e.target.checked)}
                    className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-gray-800"
                  />
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    🛡️ Clean Filter & Deduplication
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowCleanConfig(!showCleanConfig)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-200 underline font-medium"
                >
                  {showCleanConfig ? 'Hide Rules' : 'Customize Rules'}
                </button>
              </div>

              {/* Clean Filter Stats Badges */}
              {(cleanFilterStats.duplicatesRemoved > 0 ||
                cleanFilterStats.publicExcluded > 0 ||
                cleanFilterStats.banksExcluded > 0 ||
                cleanFilterStats.junkExcluded > 0 ||
                cleanFilterStats.govEduExcluded > 0) && (
                <div className="flex flex-wrap gap-1.5 pt-0.5 text-[10px] font-mono">
                  {cleanFilterStats.duplicatesRemoved > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                      {cleanFilterStats.duplicatesRemoved} Duplicates Stripped
                    </span>
                  )}
                  {cleanFilterStats.publicExcluded > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800/60">
                      {cleanFilterStats.publicExcluded} Public Webmails Filtered
                    </span>
                  )}
                  {cleanFilterStats.banksExcluded > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60">
                      {cleanFilterStats.banksExcluded} Banks Filtered
                    </span>
                  )}
                  {cleanFilterStats.junkExcluded > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60">
                      {cleanFilterStats.junkExcluded} Junk Filtered (Kept Info/Sales)
                    </span>
                  )}
                </div>
              )}

              {/* Expandable Individual Rule Checkboxes */}
              {showCleanConfig && (
                <div className="pt-2 border-t border-gray-800 space-y-1.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={excludePublicWebmail}
                      onChange={(e) => setExcludePublicWebmail(e.target.checked)}
                      disabled={!enableCleanFilter}
                      className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 bg-gray-800"
                    />
                    <span>Remove consumer webmails (Gmail, Yahoo, Hotmail, Outlook)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={excludeBanks}
                      onChange={(e) => setExcludeBanks(e.target.checked)}
                      disabled={!enableCleanFilter}
                      className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 bg-gray-800"
                    />
                    <span>Remove banks & financial institutions</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={excludeJunkEmails}
                      onChange={(e) => setExcludeJunkEmails(e.target.checked)}
                      disabled={!enableCleanFilter}
                      className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 bg-gray-800"
                    />
                    <span>Remove junk mailboxes (preserves info, sales, order)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={excludeGovEdu}
                      onChange={(e) => setExcludeGovEdu(e.target.checked)}
                      disabled={!enableCleanFilter}
                      className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 bg-gray-800"
                    />
                    <span>Remove Government (.gov) & Education (.edu)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={removeDuplicateUrls}
                      onChange={(e) => setRemoveDuplicateUrls(e.target.checked)}
                      disabled={!enableCleanFilter}
                      className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 bg-gray-800"
                    />
                    <span>Remove duplicate URLs (Normalized URL deduplication)</span>
                  </label>
                </div>
              )}

              {/* Delay between tabs */}
              <div className="pt-2 border-t border-gray-800 text-xs flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white block">Tab Stagger Delay</span>
                  <span className="text-gray-400 text-[11px]">Safe delay to avoid browser tab freezing</span>
                </div>
                <select
                  value={delayBetweenTabs}
                  onChange={(e) => setDelayBetweenTabs(Number(e.target.value))}
                  className="bg-gray-800 border border-gray-600 text-white rounded px-2 py-1 text-xs focus:ring-0"
                >
                  <option value={0}>0ms (Instant)</option>
                  <option value={100}>100ms (Fast)</option>
                  <option value={200}>200ms (Recommended)</option>
                  <option value={500}>500ms (Safe)</option>
                </select>
              </div>
            </div>
          </div>

          {/* PRIMARY BUTTONS: OPEN ALL & RESET */}
          <div className="pt-3 border-t border-gray-700 space-y-2">
            <button
              onClick={handleOpenSelected}
              disabled={isOpening || activeQueueCount === 0}
              className={`w-full py-3 px-4 rounded-xl font-bold text-white text-base shadow-xl flex items-center justify-center gap-2 transition-all duration-200 ${
                isOpening
                  ? 'bg-blue-700 cursor-wait'
                  : activeQueueCount === 0
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] shadow-blue-500/25'
              }`}
            >
              <PlayIcon className="w-5 h-5" />
              <span>Open List of URLs by just one click ({activeQueueCount})</span>
              <span className="text-xs px-2 py-0.5 bg-black/30 rounded border border-white/20 font-mono font-normal">
                [Ctrl+Enter]
              </span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 py-2 px-3 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-gray-600"
                title="Clear input and reset all tabs [Ctrl+R]"
              >
                <ArrowPathIcon className="w-4 h-4 text-yellow-400" />
                <span>Reset</span>
                <span className="font-mono text-[10px] text-gray-400">[Ctrl+R]</span>
              </button>

              {isOpening && (
                <button
                  onClick={() => { abortOpeningRef.current = true; }}
                  className="py-2 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <StopIcon className="w-4 h-4" />
                  <span>Stop</span>
                </button>
              )}

              <button
                onClick={handleCopyAll}
                disabled={itemsState.length === 0 && openedItems.length === 0}
                className="py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors border border-gray-700"
                title="Copy URLs to clipboard"
              >
                <ClipboardIcon className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>

              <button
                onClick={handleExportTxt}
                disabled={itemsState.length === 0 && openedItems.length === 0}
                className="py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors border border-gray-700"
                title="Export URLs to .txt file"
              >
                <DocumentArrowUpIcon className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PREPARED URL LIST WITH ACTIVE QUEUE, OPENED/REMOVED, AND TRY OPEN AGAIN */}
        <div className="lg:col-span-7 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl flex flex-col h-[700px] overflow-hidden">
          {/* HEADER WITH SEGMENTED TABS & ACTIONS */}
          <div className="p-3.5 border-b border-gray-700 bg-gray-850/70 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* LIST VIEW SEGMENTED TABS */}
              <div className="flex items-center gap-1 bg-gray-900/90 p-1 rounded-lg border border-gray-700">
                <button
                  type="button"
                  onClick={() => setActiveListTab('queue')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                    activeListTab === 'queue'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  <span>Active Queue</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeListTab === 'queue' ? 'bg-blue-800 text-blue-100' : 'bg-gray-800 text-gray-400'
                  }`}>
                    {activeQueueCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveListTab('opened')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                    activeListTab === 'opened'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <CheckIcon className="w-3 h-3 text-emerald-300" />
                    <span>Opened / Removed</span>
                  </span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeListTab === 'opened' ? 'bg-emerald-800 text-emerald-100' : 'bg-gray-800 text-emerald-400'
                  }`}>
                    {openedItems.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveListTab('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                    activeListTab === 'all'
                      ? 'bg-gray-700 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  <span>All Items</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeListTab === 'all' ? 'bg-gray-800 text-gray-200' : 'bg-gray-800 text-gray-400'
                  }`}>
                    {allMergedList.length}
                  </span>
                </button>
              </div>

              {/* BATCH ACTIONS FOR OPENED TAB */}
              {activeListTab === 'opened' && openedItems.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleTryOpenAllAgain}
                    disabled={isOpening}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
                    title="Open all opened URLs again in new tabs"
                  >
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                    <span>Try Open All Again</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRestoreAllToQueue}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center gap-1 transition-colors"
                    title="Move all opened URLs back to active queue"
                  >
                    <span>↩️ Restore All</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearOpenedHistory}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-red-300 transition-colors"
                    title="Clear opened list history"
                  >
                    Clear History
                  </button>
                </div>
              )}
            </div>

            {/* SEARCH & FILTERS ROW */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-gray-750">
              <div className="flex items-center gap-2 flex-grow max-w-sm">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search domain or URL..."
                  className="bg-gray-900 border border-gray-700 text-xs text-gray-200 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 w-full"
                />
              </div>

              {activeListTab === 'queue' && (
                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-gray-900 border border-gray-700 text-xs text-gray-300 rounded px-2 py-1.5 focus:ring-0"
                  >
                    <option value="all">All Status</option>
                    <option value="ready">Ready</option>
                    <option value="blocked">Blocked</option>
                  </select>

                  <button
                    onClick={toggleSelectAll}
                    className="text-xs px-2.5 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors font-medium"
                  >
                    {selectedIds.size === activeQueueCount ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* URL LIST ITEMS CONTAINER */}
          <div className="flex-grow overflow-y-auto p-3 space-y-2 custom-scrollbar bg-gray-900/30">
            {/* VIEW 1: ACTIVE QUEUE */}
            {activeListTab === 'queue' && (
              <>
                {activeQueueList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-3">
                    {openedItems.length > 0 ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-600/60 flex items-center justify-center text-emerald-400 text-xl font-bold shadow-lg">
                          ✓
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-white mb-1">
                            All URLs Opened & Removed from Active Queue!
                          </h4>
                          <p className="text-xs text-gray-400 max-w-sm">
                            You have opened {openedItems.length} URL(s). Switch to the <strong>Opened / Removed</strong> tab to review them or click <strong>Try Open Again</strong>.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setActiveListTab('opened')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
                          >
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            <span>View Opened & Try Open Again ({openedItems.length})</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRestoreAllToQueue}
                            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium transition-colors"
                          >
                            Restore All to Queue
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <GlobeAltIcon className="w-12 h-12 text-gray-600 mb-1" />
                        <h4 className="text-sm font-semibold text-gray-300 mb-1">No URLs in Active Queue</h4>
                        <p className="text-xs text-gray-500 max-w-sm">
                          Paste emails or website domains into the left box, or click <strong>Load Sample</strong> to populate your queue.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  activeQueueList.map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                          item.status === 'blocked'
                            ? 'bg-red-950/30 border-red-800/50'
                            : isSelected
                            ? 'bg-gray-800/90 border-blue-600/60 shadow-sm'
                            : 'bg-gray-900/50 border-gray-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(item.id)}
                            className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {/* Clickable URL link: opens tab and removes/nulls from list with option to retry */}
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleOpenUrl(item);
                                }}
                                className="text-sm font-semibold text-blue-400 hover:text-blue-300 truncate hover:underline cursor-pointer"
                                title={`Click to open tab (${clickBehavior === 'remove' ? 'removes from queue' : 'nulls in place'}): ${item.url}`}
                              >
                                {item.url}
                              </a>

                              {item.isEmail && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 font-mono flex-shrink-0">
                                  from email
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-gray-400 truncate flex items-center gap-1 mt-0.5">
                              <span>Domain: <strong className="text-gray-300">{item.domain}</strong></span>
                              {item.original !== item.url && (
                                <span className="text-gray-500">| Source: {item.original}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.status === 'blocked' && (
                            <span className="flex items-center text-[11px] text-red-400 font-medium gap-1 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/60">
                              <XCircleIcon className="w-3 h-3" /> Blocked
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenUrl(item)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-600/90 hover:bg-blue-600 text-white transition-colors shadow-sm flex items-center gap-1"
                            title={`Open tab and ${clickBehavior === 'remove' ? 'remove from list' : 'null in place'}`}
                          >
                            <span>Open Tab</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {/* VIEW 2: OPENED / REMOVED (WITH OPTION TO TRY OPEN AGAIN) */}
            {activeListTab === 'opened' && (
              <>
                {filteredOpenedList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-2">
                    <ArrowPathIcon className="w-12 h-12 text-gray-600 mb-1" />
                    <h4 className="text-sm font-semibold text-gray-300">No Opened URLs Yet</h4>
                    <p className="text-xs text-gray-500 max-w-sm">
                      When you click any URL from your queue, it will be listed here with an instant option to <strong>Try Open Again</strong>.
                    </p>
                  </div>
                ) : (
                  filteredOpenedList.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg border border-emerald-800/50 bg-emerald-950/20 transition-all flex items-center justify-between gap-3 shadow-sm hover:border-emerald-700/60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.preventDefault();
                              handleTryOpenAgain(item);
                            }}
                            className="text-sm font-semibold text-emerald-300 hover:text-emerald-200 truncate hover:underline cursor-pointer"
                            title={`Click to try open again: ${item.url}`}
                          >
                            {item.url}
                          </a>

                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-mono flex items-center gap-1 flex-shrink-0">
                            <CheckIcon className="w-3 h-3 text-emerald-400" />
                            <span>Opened {item.openCount > 1 ? `${item.openCount}x` : '1x'}</span>
                          </span>

                          <span className="text-[10px] text-gray-400 font-mono">
                            {formatTimeAgo(item.openedAt)}
                          </span>
                        </div>

                        <div className="text-[11px] text-gray-400 truncate flex items-center gap-1 mt-0.5">
                          <span>Domain: <strong className="text-gray-300">{item.domain}</strong></span>
                          {item.original !== item.url && (
                            <span className="text-gray-500">| Source: {item.original}</span>
                          )}
                        </div>
                      </div>

                      {/* ACTIONS: TRY OPEN AGAIN & RESTORE */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTryOpenAgain(item)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
                          title="Open this URL in a new tab again"
                        >
                          <ArrowPathIcon className="w-3.5 h-3.5" />
                          <span>Try Open Again</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRestoreItem(item)}
                          className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center gap-1 transition-colors"
                          title="Restore back to active queue"
                        >
                          <span>↩️ Restore</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* VIEW 3: ALL ITEMS (READY + OPENED / NULLED) */}
            {activeListTab === 'all' && (
              <>
                {allMergedList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
                    <GlobeAltIcon className="w-12 h-12 text-gray-600 mb-2" />
                    <h4 className="text-sm font-semibold text-gray-300 mb-1">No URLs to display</h4>
                    <p className="text-xs text-gray-500 max-w-sm">
                      Paste emails or website domains into the left box.
                    </p>
                  </div>
                ) : (
                  allMergedList.map((item) => {
                    const isOpened = ('openedAt' in item && Boolean(item.openedAt)) || item.status === 'opened' || item.status === 'nulled';
                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                          isOpened
                            ? 'bg-emerald-950/20 border-emerald-800/40 opacity-80'
                            : item.status === 'blocked'
                            ? 'bg-red-950/30 border-red-800/50'
                            : 'bg-gray-800/80 border-gray-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.preventDefault();
                                if (isOpened) {
                                  handleTryOpenAgain(item);
                                } else {
                                  handleOpenUrl(item);
                                }
                              }}
                              className={`text-sm font-semibold truncate hover:underline cursor-pointer ${
                                isOpened ? 'text-gray-400 line-through' : 'text-blue-400 hover:text-blue-300'
                              }`}
                              title={isOpened ? `Opened - Click to try open again: ${item.url}` : `Click to open: ${item.url}`}
                            >
                              {item.url}
                            </a>

                            {isOpened && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-mono flex items-center gap-1 flex-shrink-0">
                                <CheckIcon className="w-3 h-3 text-emerald-400" />
                                <span>{item.openCount ? `${item.openCount}x` : 'Opened'}</span>
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-gray-400 truncate flex items-center gap-1 mt-0.5">
                            <span>Domain: <strong className="text-gray-300">{item.domain}</strong></span>
                            {item.original !== item.url && (
                              <span className="text-gray-500">| Source: {item.original}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isOpened ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleTryOpenAgain(item)}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
                                title="Open this URL in a new tab again"
                              >
                                <ArrowPathIcon className="w-3.5 h-3.5" />
                                <span>Try Open Again</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRestoreItem(item)}
                                className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                                title="Restore back to active queue"
                              >
                                ↩️
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenUrl(item)}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-600/90 hover:bg-blue-600 text-white transition-colors shadow-sm"
                            >
                              Open Tab
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* FOOTER STATS */}
          <div className="p-3 border-t border-gray-700 bg-gray-900/80 flex items-center justify-between text-xs text-gray-400">
            <span>
              Queue: <strong className="text-blue-400">{activeQueueCount}</strong> | 
              Opened / Removed: <strong className="text-emerald-400">{openedItems.length}</strong> | 
              Mode: <strong className="text-gray-300">{clickBehavior === 'remove' ? 'Auto-Remove' : 'Null in place'}</strong>
            </span>
            <div className="flex items-center gap-3">
              {openedItems.length > 0 && activeListTab !== 'opened' && (
                <button
                  type="button"
                  onClick={() => setActiveListTab('opened')}
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium flex items-center gap-1"
                >
                  <ArrowPathIcon className="w-3 h-3" />
                  <span>View Opened ({openedItems.length}) - Try Open Again</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkUrlOpener;
