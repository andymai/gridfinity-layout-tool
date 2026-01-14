/**
 * Storage utilities - clipboard and download operations.
 *
 * These are general-purpose utilities used by various parts of the app
 * for interacting with browser APIs (clipboard, file download).
 */

import { exportLayoutJSON } from './ShareService';
import type { Layout } from '../types';

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
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Download a layout as a JSON file.
 * Creates a temporary anchor element to trigger the download.
 */
export function downloadLayoutAsFile(layout: Layout, filename?: string): void {
  const json = exportLayoutJSON(layout);
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
