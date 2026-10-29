import JSZip from 'jszip';

export interface CategoryZipEntry {
  filename: string;
  content: string | Blob;
}

/**
 * Bundles multiple categorized files into a single compressed .zip file
 * and triggers an immediate browser download.
 */
export async function downloadCategoriesAsZip(
  zipFilename: string,
  files: CategoryZipEntry[]
): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    if (!file.filename || !file.content) continue;
    zip.file(file.filename, file.content);
  }

  // Generate ZIP blob with maximum compression
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const finalName = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = finalName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Triggers a download for a single text or CSV file.
 */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
