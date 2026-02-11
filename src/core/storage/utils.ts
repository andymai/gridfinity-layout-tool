/**
 * Storage utilities - clipboard and download operations.
 *
 * These are general-purpose utilities used by various parts of the app
 * for interacting with browser APIs (clipboard, file download).
 */

import { exportLayoutJSONWithDesigns } from './ShareService';
import type { Layout } from '@/core/types';

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
 * Download a layout as a JSON file with embedded bin designs.
 * Creates a temporary anchor element to trigger the download.
 * Async because it needs to look up linked designs from IndexedDB.
 */
export async function downloadLayoutAsFile(layout: Layout, filename?: string): Promise<void> {
  const json = await exportLayoutJSONWithDesigns(layout);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${layout.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
