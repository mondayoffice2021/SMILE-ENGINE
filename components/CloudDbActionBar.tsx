import React, { useState } from 'react';
import {
  Database,
  Upload,
  Download,
  Server,
  Sparkles,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { CloudDatabaseBridgeModal } from './CloudDatabaseBridgeModal';
import { type UserProfile, type ServerLead } from '../services/serverApiClient';

export interface CloudDbActionBarProps {
  tabName: string;
  sourceTag?: string;
  items: Array<any> | string[];
  currentUser: UserProfile | null;
  showToast: (msg: string) => void;
  onOpenAuth?: () => void;
  onLoadFromDb?: (leads: ServerLead[], emails: string[]) => void;
  onRunServerJob?: () => void;
  serverJobLabel?: string;
  compact?: boolean;
}

export const CloudDbActionBar: React.FC<CloudDbActionBarProps> = ({
  tabName,
  sourceTag,
  items,
  currentUser,
  showToast,
  onOpenAuth,
  onLoadFromDb,
  onRunServerJob,
  serverJobLabel,
  compact = false
}) => {
  const [modalMode, setModalMode] = useState<'upload' | 'load' | null>(null);

  const itemCount = Array.isArray(items) ? items.length : 0;

  return (
    <>
      <div className={`flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg ${compact ? 'text-xs' : ''}`}>
        {/* Left: Cloud DB Indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-blue-950/80 border border-blue-500/40 text-blue-400 shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-xs truncate">
                Cloud Database
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {currentUser ? `${(currentUser.totalLeadsStored || 0).toLocaleString()} Stored` : 'Multi-User DB'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate hidden sm:block">
              Sync results & pull stored leads seamlessly across tabs
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Work / Load from Cloud DB */}
          {onLoadFromDb && (
            <button
              type="button"
              onClick={() => {
                if (!currentUser && onOpenAuth) {
                  onOpenAuth();
                  return;
                }
                setModalMode('load');
              }}
              className="py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1.5 shadow-sm"
              title={`Load leads from Cloud Database into ${tabName}`}
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Work from Cloud DB</span>
            </button>
          )}

          {/* Upload to Cloud DB */}
          <button
            type="button"
            onClick={() => {
              if (itemCount === 0) {
                showToast(`No leads or items currently in ${tabName} to upload.`);
                return;
              }
              if (!currentUser && onOpenAuth) {
                onOpenAuth();
                return;
              }
              setModalMode('upload');
            }}
            disabled={itemCount === 0}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
              itemCount > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-blue-500/20'
                : 'bg-slate-800/60 text-slate-500 border-slate-700/60 cursor-not-allowed'
            }`}
            title={`Upload ${itemCount.toLocaleString()} leads to Cloud Database`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload to Cloud DB</span>
            {itemCount > 0 && (
              <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-white/20 text-white font-bold ml-0.5">
                {itemCount.toLocaleString()}
              </span>
            )}
          </button>

          {/* Optional Server-Side Execution Button */}
          {onRunServerJob && (
            <button
              type="button"
              onClick={onRunServerJob}
              className="py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-200 transition flex items-center gap-1.5 shadow-sm"
              title="Delegate this task to run in the background on the server"
            >
              <Server className="w-3.5 h-3.5 text-purple-400" />
              <span>{serverJobLabel || 'Run on Server'}</span>
            </button>
          )}
        </div>
      </div>

      {modalMode && (
        <CloudDatabaseBridgeModal
          isOpen={Boolean(modalMode)}
          onClose={() => setModalMode(null)}
          mode={modalMode}
          tabName={tabName}
          sourceTag={sourceTag}
          itemsToUpload={items}
          onLoadLeads={onLoadFromDb}
          showToast={showToast}
          currentUser={currentUser}
          onOpenAuth={onOpenAuth}
        />
      )}
    </>
  );
};
