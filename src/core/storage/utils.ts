/**
 * Storage utilities - clipboard and download operations.
 *
 * These are general-purpose utilities used by various parts of the app
 * for interacting with browser APIs (clipboard, file download).
 */

import { deliverExport } from '@/shared/exportDestination/deliverExport';
import { primeExportFolder } from '@/shared/exportDestination/exportFolder';
import { exportLayoutJSONWithDesigns } from './ShareService';
import type { Layout } from '@/core/types';
import { isOk, OK } from '@/core/result';
import type { Result, StorageMeshMissingError } from '@/core/result';

/**
 * Copy text to clipboard.
 * Uses the modern Clipboard API with fallback for older browsers.
 * @returns true if successful
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API failed (e.g. no secure context)
    return false;
  }
}

/**
 * Save a layout as a JSON file with embedded bin designs, through the user's
 * export destination. Looks up linked designs in IndexedDB first, and fails,
 * saving nothing, when a linked design's mesh file is missing. Resolves once
 * the file is saved locally (downloaded or written to the export folder); an
 * upload to the export URL carries on afterwards and does not change the result.
 */
export async function downloadLayoutAsFile(
  layout: Layout,
  filename?: string
): Promise<Result<void, StorageMeshMissingError>> {
  primeExportFolder();
  const exported = await exportLayoutJSONWithDesigns(layout);
  if (!isOk(exported)) return exported;
  const blob = new Blob([exported.value], { type: 'application/json' });
  await deliverExport(
    blob,
    filename || `${layout.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`
  );
  return OK;
}
