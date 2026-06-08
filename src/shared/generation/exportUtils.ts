/**
 * Shared export utilities used by both the baseplate generator and bin designer.
 *
 * Contains format MIME types and the browser download trigger function.
 */

import type { ExportFileFormat } from '@/shared/types/bin';

/** MIME types for each export format. */
export const FORMAT_MIME_TYPES: Record<ExportFileFormat, string> = {
  stl: 'application/sla',
  step: 'application/step',
  '3mf': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
};

/** File extensions for each export format. */
export const FORMAT_EXTENSIONS: Record<ExportFileFormat, string> = {
  stl: '.stl',
  step: '.step',
  '3mf': '.3mf',
};

/** Trigger a browser download from a Blob. */
export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.parentNode?.removeChild(anchor);
  URL.revokeObjectURL(url);
}
