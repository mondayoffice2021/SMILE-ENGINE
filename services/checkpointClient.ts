/**
 * Automatic Session Checkpointing & Recovery Client
 * Saves progress as tasks run so work can be resumed even if the computer is turned off,
 * network is disconnected, or the browser is refreshed.
 */

export interface SessionCheckpoint {
  id?: string;
  tab: 'country-sorter' | 'mx-sorter' | 'email-validator' | 'file-text' | 'folder-extractor' | 'lead-crawler' | string;
  title: string;
  sourceName: string;
  totalItems: number;
  processedCount: number;
  percent: number;
  remainingItems?: string[];
  processedResults?: any;
  auditEvidence?: any;
  filterSummary?: any;
  tempFileId?: string;
  tempFileOffset?: number;
  status?: 'running' | 'paused' | 'interrupted' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}

const LOCAL_STORAGE_PREFIX = 'smile_session_checkpoint_';

export async function saveSessionCheckpoint(checkpoint: SessionCheckpoint): Promise<boolean> {
  const tab = checkpoint.tab;
  const localKey = `${LOCAL_STORAGE_PREFIX}${tab}`;

  // 1. Save immediately to LocalStorage for zero-latency crash immunity
  try {
    const payload = {
      ...checkpoint,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(localKey, JSON.stringify(payload));
  } catch (err) {
    console.warn('[Checkpoint] LocalStorage write notice:', err);
  }

  // 2. Persist to Server Disk via API
  try {
    const res = await fetch('/api/checkpoints/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkpoint)
    });
    return res.ok;
  } catch (err) {
    // If network disconnected, local storage already has the checkpoint!
    console.warn('[Checkpoint] Server sync warning (network offline):', err);
    return false;
  }
}

export async function getActiveCheckpoint(tab: string): Promise<SessionCheckpoint | null> {
  const localKey = `${LOCAL_STORAGE_PREFIX}${tab}`;

  // Check server first
  try {
    const res = await fetch(`/api/checkpoints/active?tab=${encodeURIComponent(tab)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.checkpoint && data.checkpoint.status !== 'completed') {
        return data.checkpoint;
      }
    }
  } catch (err) {
    console.warn('[Checkpoint] Server check failed, checking local backup:', err);
  }

  // Fallback to local storage if offline or server doesn't respond
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const parsed: SessionCheckpoint = JSON.parse(raw);
      if (parsed && parsed.status !== 'completed' && parsed.processedCount > 0) {
        return parsed;
      }
    }
  } catch {}

  return null;
}

export async function clearSessionCheckpoint(tab: string): Promise<boolean> {
  const localKey = `${LOCAL_STORAGE_PREFIX}${tab}`;

  // Clear local storage
  try {
    localStorage.removeItem(localKey);
  } catch {}

  // Clear from server
  try {
    const res = await fetch(`/api/checkpoints/${encodeURIComponent(tab)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch {
    return true;
  }
}
