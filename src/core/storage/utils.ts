/**
 * Storage utilities - clipboard and download operations.
 *
 * These are general-purpose utilities used by various parts of the app
 * for interacting with browser APIs (clipboard, file download).
 *
 * Result-returning variants (*Result suffix) provide structured error handling.
 */

import { exportLayoutJSON } from './ShareService';
import type { Layout } from '@/core/types';
import type { Result, UnknownError } from '@/core/result';
import { ok, err, unknownError } from '@/core/result';

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
 * Copy text to clipboard with Result-based error handling.
 * Returns Ok on success, or Err with UnknownError on failure.
 *
 * @example
 * ```ts
 * const result = await copyToClipboardResult(text);
 * match(result, {
 *   ok: () => showToast('Copied!', 'success'),
 *   err: (e) => showToast(getUserMessage(e), 'error')
 * });
 * ```
 */
export async function copyToClipboardResult(text: string): Promise<Result<void, UnknownError>> {
  const success = await copyToClipboard(text);
  if (success) {
    return ok(undefined);
  }
  return err(unknownError(new Error('Failed to copy to clipboard')));
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
