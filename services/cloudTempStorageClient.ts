/**
 * Zero-RAM Cloud Temporary Storage Client
 * Offloads bulky file reading from browser memory to server disk.
 * Prevents browser tabs from hanging, freezing or crashing during massive file operations.
 */

export interface CloudTempUploadResult {
  success: boolean;
  tempId: string;
  filename: string;
  fileSizeBytes: number;
  sizeFormatted: string;
  totalLines: number;
  previewLines: string[];
}

export interface CloudTempChunk {
  success: boolean;
  lines: string[];
  totalLines: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number;
}

export async function uploadFileToCloudTemp(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<CloudTempUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file, file.name);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res);
        } catch (e: any) {
          reject(new Error(`Failed to parse upload response: ${e.message}`));
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          reject(new Error(errRes.error || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during temporary cloud file upload'));
    };

    xhr.open('POST', '/api/cloud-temp/upload');
    xhr.send(formData);
  });
}

export async function fetchLinesFromCloudTemp(
  tempId: string,
  offset = 0,
  limit = 5000
): Promise<CloudTempChunk> {
  const res = await fetch(`/api/cloud-temp/${encodeURIComponent(tempId)}/lines?offset=${offset}&limit=${limit}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch lines (status ${res.status})`);
  }
  return res.json();
}

export async function deleteCloudTempFile(tempId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/cloud-temp/${encodeURIComponent(tempId)}`, {
      method: 'DELETE'
    });
    const data = await res.json().catch(() => ({}));
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Iterates through a temporary cloud file in stream chunks of lines,
 * keeping browser memory minimal (< 10MB) even on millions of lines.
 */
export async function streamLinesFromCloudTemp(
  tempId: string,
  batchSize = 5000,
  onBatch: (chunk: string[], progressPct: number, currentOffset: number, total: number) => Promise<boolean | void>
): Promise<{ processed: number; total: number; stoppedEarly: boolean }> {
  let offset = 0;
  let hasMore = true;
  let totalLines = 0;
  let stoppedEarly = false;

  while (hasMore) {
    const chunk = await fetchLinesFromCloudTemp(tempId, offset, batchSize);
    totalLines = chunk.totalLines;

    if (chunk.lines.length === 0) {
      break;
    }

    const pct = totalLines > 0 ? Math.min(100, Math.round(((offset + chunk.lines.length) / totalLines) * 100)) : 100;
    const shouldContinue = await onBatch(chunk.lines, pct, offset, totalLines);

    if (shouldContinue === false) {
      stoppedEarly = true;
      break;
    }

    offset = chunk.nextOffset;
    hasMore = chunk.hasMore && chunk.lines.length > 0;
  }

  return { processed: offset, total: totalLines, stoppedEarly };
}
