import React, { useState, useEffect } from 'react';
import {
  Zap,
  Play,
  Download,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  getActiveCheckpoint,
  clearSessionCheckpoint,
  type SessionCheckpoint
} from '../services/checkpointClient';

export interface SessionRecoveryBannerProps {
  tab: string;
  tabLabel: string;
  onResume: (checkpoint: SessionCheckpoint) => void;
  onDownloadPartialZip?: (checkpoint: SessionCheckpoint) => void;
  showToast: (msg: string) => void;
  // If parent detects completion or triggers clear
  triggerRefreshKey?: number;
}

export const SessionRecoveryBanner: React.FC<SessionRecoveryBannerProps> = ({
  tab,
  tabLabel,
  onResume,
  onDownloadPartialZip,
  showToast,
  triggerRefreshKey
}) => {
  const [activeCheckpoint, setActiveCheckpoint] = useState<SessionCheckpoint | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    getActiveCheckpoint(tab).then(cp => {
      if (isMounted) {
        if (cp && cp.status !== 'completed' && cp.processedCount > 0) {
          setActiveCheckpoint(cp);
          setIsDismissed(false);
        } else {
          setActiveCheckpoint(null);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [tab, triggerRefreshKey]);

  if (!activeCheckpoint || isDismissed) {
    return null;
  }

  const handleResume = () => {
    showToast(`Resuming ${tabLabel} from ${activeCheckpoint.processedCount.toLocaleString()} leads...`);
    onResume(activeCheckpoint);
  };

  const handleDiscard = async () => {
    await clearSessionCheckpoint(tab);
    setActiveCheckpoint(null);
    setIsDismissed(true);
    showToast(`Discarded unfinished session. Starting fresh.`);
  };

  const formattedTime = activeCheckpoint.updatedAt
    ? new Date(activeCheckpoint.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'recently';

  const percent = activeCheckpoint.totalItems > 0
    ? Math.round((activeCheckpoint.processedCount / activeCheckpoint.totalItems) * 100)
    : activeCheckpoint.percent || 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-emerald-950/60 border border-amber-500/50 shadow-2xl p-4 text-xs animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Icon & Description */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0 shadow-lg shadow-amber-500/10">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-sm">
                Unfinished Session Detected
              </span>
              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Auto-Saved at {formattedTime}
              </span>
            </div>
            <p className="text-slate-300 text-xs mt-1">
              Your previous run on <strong className="text-white">{activeCheckpoint.sourceName || tabLabel}</strong> stopped at{' '}
              <strong className="text-emerald-400 font-mono">{activeCheckpoint.processedCount.toLocaleString()}</strong> of{' '}
              <strong className="text-white font-mono">{activeCheckpoint.totalItems.toLocaleString()}</strong> records ({percent}%).
              You can resume exactly where it stopped without restarting from scratch!
            </p>

            {/* Progress bar */}
            <div className="w-full max-w-md bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-700/60">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleResume}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 border border-emerald-400/40"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Resume Where You Stopped</span>
          </button>

          {onDownloadPartialZip && (
            <button
              type="button"
              onClick={() => onDownloadPartialZip(activeCheckpoint)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs transition flex items-center gap-1.5"
              title="Download currently processed items as ZIP"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Export {activeCheckpoint.processedCount.toLocaleString()} Leads</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDiscard}
            className="px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700/60 transition"
            title="Discard this unfinished session and start fresh"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
