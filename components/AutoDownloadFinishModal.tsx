import React from 'react';
import { CheckCircle2, FileArchive, FolderLock, Download, X, ArrowRight } from 'lucide-react';

export interface AutoDownloadFinishModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  totalItems: number;
  categoriesCount: number;
  autoDownloaded: boolean;
  onDownloadZip: () => void;
  onOpenSecretVault: () => void;
}

export const AutoDownloadFinishModal: React.FC<AutoDownloadFinishModalProps> = ({
  isOpen,
  onClose,
  title,
  totalItems,
  categoriesCount,
  autoDownloaded,
  onDownloadZip,
  onOpenSecretVault
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header gradient banner */}
        <div className="p-6 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-amber-950/40 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{title} Finished!</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Successfully processed <strong className="text-emerald-400">{totalItems.toLocaleString()}</strong> records across <strong className="text-white">{categoriesCount}</strong> categories.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status & Options */}
        <div className="p-6 space-y-4">
          {autoDownloaded ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
              <FileArchive className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold block text-sm">ZIP Auto-Downloaded!</span>
                All categorized files have been bundled and saved to your device.
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileArchive className="w-5 h-5 text-amber-400" />
                <div>
                  <span className="text-sm font-semibold text-white block">Download All as ZIP</span>
                  <span className="text-xs text-slate-400">Bundle all sorted categories into a single archive</span>
                </div>
              </div>
              <button
                onClick={onDownloadZip}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          )}

          {/* Secret Cloud Vault Prompt */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/30 to-slate-800 border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2.5">
              <FolderLock className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-bold text-white">Save Secretly to Cloud Vault?</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              You can protect this finished dataset with your own secret passphrase using AES-256-GCM encryption. Stored safely in the cloud so it doesn't take up browser RAM and can be unlocked anytime.
            </p>
            <div className="pt-1">
              <button
                onClick={() => {
                  onClose();
                  onOpenSecretVault();
                }}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                <FolderLock className="w-4 h-4" />
                Save Secretly to Cloud Vault (Name & Password)
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
