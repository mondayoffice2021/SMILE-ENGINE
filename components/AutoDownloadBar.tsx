import React from 'react';
import { FileArchive, FolderLock, Download, HardDrive, ShieldCheck, Check } from 'lucide-react';

export interface AutoDownloadBarProps {
  autoDownloadZip: boolean;
  onToggleAutoDownload: (enabled: boolean) => void;
  onDownloadAllZip: () => void;
  onOpenSecretVaultSave: () => void;
  onOpenSecretVaultBrowse: () => void;
  isTempCloudActive?: boolean;
  tempFilename?: string;
  totalItemsCount?: number;
  categoryLabel?: string;
  isProcessing?: boolean;
}

export const AutoDownloadBar: React.FC<AutoDownloadBarProps> = ({
  autoDownloadZip,
  onToggleAutoDownload,
  onDownloadAllZip,
  onOpenSecretVaultSave,
  onOpenSecretVaultBrowse,
  isTempCloudActive = false,
  tempFilename,
  totalItemsCount = 0,
  categoryLabel = 'Categories',
  isProcessing = false
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-700/70 shadow-sm text-xs">
      {/* Left: Auto-Download ZIP toggle & Cloud Temp status */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none group">
          <div
            onClick={() => onToggleAutoDownload(!autoDownloadZip)}
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
              autoDownloadZip ? 'bg-emerald-500' : 'bg-slate-700 group-hover:bg-slate-600'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                autoDownloadZip ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
          <span className="font-medium text-slate-300 flex items-center gap-1.5">
            <FileArchive className="w-3.5 h-3.5 text-emerald-400" />
            Auto-Download All Categories (.ZIP) on Finish
          </span>
        </label>

        {isTempCloudActive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-[11px]">
            <HardDrive className="w-3 h-3 text-indigo-400" />
            <span>Zero-RAM Cloud File: <strong className="text-white">{tempFilename || 'Active'}</strong></span>
          </div>
        )}
      </div>

      {/* Right: Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onDownloadAllZip}
          disabled={totalItemsCount === 0 || isProcessing}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          title="Bundle all sorted categories into a compressed ZIP file"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          Download All {categoryLabel} (.ZIP)
        </button>

        <button
          onClick={onOpenSecretVaultSave}
          disabled={totalItemsCount === 0 || isProcessing}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600/90 to-amber-500/90 hover:from-amber-500 hover:to-amber-400 text-white font-medium flex items-center gap-1.5 transition-all shadow-sm shadow-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Save secretly to encrypted cloud vault with your custom password"
        >
          <FolderLock className="w-3.5 h-3.5 text-amber-200" />
          Save Secretly to Cloud Vault
        </button>

        <button
          onClick={onOpenSecretVaultBrowse}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1.5 transition-colors"
          title="Open Vault Manager to unlock and decrypt stored files"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Cloud Vaults
        </button>
      </div>
    </div>
  );
};
