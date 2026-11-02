/**
 * Central Cloud File Repository Client
 * Stores and manages files on the cloud server so they can be immediately
 * used across any tab (Country Sorter, MX Sorter, Validator, Extractor, Email Sender).
 */

export interface CloudFileRecord {
  id: string;
  originalName: string;
  filePath: string;
  fileSizeBytes: number;
  sizeFormatted: string;
  totalLines: number;
  previewLines: string[];
  uploadedBy?: string;
  sourceTab?: string;
  createdAt: string;
}

export interface CloudFileLinesChunk {
  success: boolean;
  lines: string[];
  totalLines: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number;
}

export async function uploadToCloudFiles(
  file: File,
  sourceTab: string = 'global',
  onProgress?: (percent: number) => void
): Promise<CloudFileRecord> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('sourceTab', sourceTab);

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
          if (res.success && res.file) {
            resolve(res.file);
          } else {
            reject(new Error(res.error || 'Failed to register cloud file'));
          }
        } catch (e: any) {
          reject(new Error(`Failed to parse response: ${e.message}`));
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

    xhr.onerror = () => reject(new Error('Network error uploading file to cloud'));
    xhr.open('POST', '/api/cloud-files/upload');
    xhr.send(formData);
  });
}

export async function listCloudFiles(): Promise<CloudFileRecord[]> {
  try {
    const res = await fetch('/api/cloud-files');
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.warn('[Cloud Files] Failed to list files:', err);
    return [];
  }
}

export async function getCloudFile(id: string): Promise<CloudFileRecord | null> {
  try {
    const res = await fetch(`/api/cloud-files/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.file || null;
  } catch {
    return null;
  }
}

export async function fetchCloudFileLines(
  fileId: string,
  offset: number = 0,
  limit: number = 5000
): Promise<CloudFileLinesChunk> {
  let url = `/api/cloud-files/${encodeURIComponent(fileId)}/lines?offset=${offset}&limit=${limit}`;
  let res = await fetch(url);
  if (!res.ok) {
    // Fallback: check temporary files endpoint
    url = `/api/cloud-temp/${encodeURIComponent(fileId)}/lines?offset=${offset}&limit=${limit}`;
    res = await fetch(url);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to stream from cloud file: ${errText || res.statusText}`);
  }
  return res.json();
}

export async function deleteCloudFile(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/cloud-files/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}
