import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  FileText,
  Upload,
  ArrowRight,
  Trash2,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  Layers
} from 'lucide-react';
import {
  listCloudFiles,
  uploadToCloudFiles,
  deleteCloudFile,
  type CloudFileRecord
} from '../services/cloudFilesClient';

export interface CloudFileHubBarProps {
  currentTabName: string;
  sourceTabId: string;
  activeFileId?: string | null;
  activeFileName?: string | null;
  onSelectFile: (file: CloudFileRecord) => void;
  showToast: (msg: string) => void;
  compact?: boolean;
}

export const CloudFileHubBar: React.FC<CloudFileHubBarProps> = ({
  currentTabName,
  sourceTabId,
  activeFileId,
  activeFileName,
  onSelectFile,
  showToast,
  compact = false
}) => {
  const [cloudFiles, setCloudFiles] = useState<CloudFileRecord[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    setIsLoadingList(true);
    try {
      const files = await listCloudFiles();
      setCloudFiles(files);
      if (files.length > 0 && !selectedFileId) {
        setSelectedFileId(files[0].id);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  // Update selected dropdown if activeFileId changes
  useEffect(() => {
    if (activeFileId) {
      setSelectedFileId(activeFileId);
    }
  }, [activeFileId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadPercent(0);

    try {
      showToast(`Uploading ${file.name} to Cloud Server Repository...`);
      const record = await uploadToCloudFiles(file, sourceTabId, (pct) => {
        setUploadPercent(pct);
      });

      showToast(`Saved ${record.originalName} (${record.sizeFormatted}, ${record.totalLines.toLocaleString()} records) to Cloud Server!`);
      await loadFiles();
      setSelectedFileId(record.id);
      onSelectFile(record);
    } catch (err: any) {
      showToast(`Cloud Upload notice: ${err?.message || 'Failed to upload'}`);
    } finally {
      setIsUploading(false);
      setUploadPercent(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplySelected = () => {
    const found = cloudFiles.find(f => f.id === selectedFileId);
    if (!found) {
      showToast("Please select a cloud file first.");
      return;
    }
    onSelectFile(found);
    showToast(`Loaded "${found.originalName}" into ${currentTabName}!`);
  };

  const handleDeleteSelected = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedFileId) return;
    const found = cloudFiles.find(f => f.id === selectedFileId);
    if (!found) return;

    if (!window.confirm(`Delete cloud file "${found.originalName}" from server repository?`)) {
      return;
    }

    const ok = await deleteCloudFile(selectedFileId);
    if (ok) {
      showToast(`Deleted "${found.originalName}" from Cloud Repository.`);
      const remaining = cloudFiles.filter(f => f.id !== selectedFileId);
      setCloudFiles(remaining);
      setSelectedFileId(remaining[0]?.id || '');
    } else {
      showToast("Failed to delete file.");
    }
  };

  const selectedFile = cloudFiles.find(f => f.id === selectedFileId);

  return (
    <div className={`p-3 rounded-xl bg-slate-900/90 border border-indigo-500/30 shadow-lg text-xs flex flex-wrap items-center justify-between gap-3 ${compact ? 'text-xs' : ''}`}>
      {/* Left: Cloud Files Title & Active Indicator */}
      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <Cloud className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-xs flex items-center gap-1.5">
              Cloud File Repository
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Shared Across All Tabs
              </span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {activeFileName ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Active in {currentTabName}: <strong>{activeFileName}</strong>
              </span>
            ) : (
              "Upload once to the cloud server, use instantly anywhere in the app"
            )}
          </p>
        </div>
      </div>

      {/* Right: Cloud File Selector & Upload Controls */}
      <div className="flex items-center gap-2 flex-wrap ml-auto">
        {cloudFiles.length > 0 && (
          <div className="flex items-center gap-1.5">
            <select
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 max-w-[220px] sm:max-w-[280px] truncate"
            >
              {cloudFiles.map(f => (
                <option key={f.id} value={f.id}>
                  {f.originalName} ({f.totalLines.toLocaleString()} records • {f.sizeFormatted})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleApplySelected}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1 shadow-sm shadow-indigo-600/30"
              title="Load this cloud file into current tab"
            >
              <span>Use in {currentTabName}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleDeleteSelected}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700/60 transition"
              title="Delete selected file from cloud repository"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Upload New File Button */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.csv,.xlsx,.xls,.log,.json"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Upload file directly to the Cloud File Repository so it can be used anywhere"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Uploading {uploadPercent}%...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Upload to Cloud</span>
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={loadFiles}
          disabled={isLoadingList}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          title="Refresh cloud files list"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};
