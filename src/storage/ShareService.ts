/**
 * Share Service - import, export, and URL sharing operations.
 *
 * This module handles all data serialization and sharing:
 * - JSON import/export (file format)
 * - TSV export (spreadsheet format)
 * - URL encoding (shareable links)
 * - Cloud share URL parsing
 * - Result-based imports (*Result suffix)
 */

import { validateImport } from '../utils/validation';
import { generateId, STAGING_ID } from '../constants';
import type { Layout } from '../types';
import type { Result, ValidationError } from '../result';
import { ok, err, validationImportFailed } from '../result';

// === JSON Import/Export ===

/**
 * Export layout as JSON string.
 * Adds metadata for user reference (source URL, export time).
 */
export function exportLayoutJSON(layout: Layout): string {
  const exportData = {
    ...layout,
    _meta: {
      exportedFrom: 'https://gridfinitylayouttool.com',
      exportedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Import layout from JSON string.
 * Regenerates all IDs to prevent collisions.
 */
export function importLayoutJSON(json: string): { layout: Layout | null; errors: string[] } {
  try {
    const parsed = JSON.parse(json);

    // Strip export metadata if present (not part of Layout type)
    if (parsed._meta) {
      delete parsed._meta;
    }

    const validation = validateImport(parsed);

    if (!validation.valid) {
      return { layout: null, errors: validation.errors };
    }

    // Regenerate all IDs
    const layout = parsed as Layout;
    const idMap = new Map<string, string>();

    // Regenerate layer IDs
    layout.layers = layout.layers.map(layer => {
      const newId = generateId();
      idMap.set(layer.id, newId);
      return { ...layer, id: newId };
    });

    // Regenerate category IDs
    layout.categories = layout.categories.map(cat => {
      const newId = generateId();
      idMap.set(cat.id, newId);
      return { ...cat, id: newId };
    });

    // Regenerate bin IDs and update references
    layout.bins = layout.bins.map(bin => ({
      ...bin,
      id: generateId(),
      layerId: bin.layerId === STAGING_ID ? STAGING_ID : (idMap.get(bin.layerId) || bin.layerId),
      category: idMap.get(bin.category) || bin.category,
    }));

    return { layout, errors: [] };
  } catch (e) {
    return { layout: null, errors: [`Parse error: ${(e as Error).message}`] };
  }
}

/**
 * Import layout from JSON string with Result-based error handling.
 * Returns Ok with layout on success, or Err with ValidationImportError.
 *
 * @example
 * ```ts
 * const result = importLayoutResult(json);
 * match(result, {
 *   ok: (layout) => applyLayout(layout),
 *   err: (error) => showErrors(error.errors)
 * });
 * ```
 */
export function importLayoutResult(json: string): Result<Layout, ValidationError> {
  const { layout, errors } = importLayoutJSON(json);

  if (layout === null) {
    return err(validationImportFailed(errors));
  }

  return ok(layout);
}

// === TSV Export ===

/**
 * Export print list as TSV for spreadsheet paste.
 * Dynamically adds columns for custom properties that exist in any row.
 */
export function exportPrintListTSV(rows: Array<{
  size: string;
  height: number;
  binCount: number;
  totalPieces: number;
  labels?: string[];
  notes?: string;
  customProperties?: Record<string, string>;
}>): string {
  // Collect all unique custom property keys across all rows
  const customKeys = new Set<string>();
  for (const r of rows) {
    if (r.customProperties) {
      for (const key of Object.keys(r.customProperties)) {
        customKeys.add(key);
      }
    }
  }
  const sortedKeys = Array.from(customKeys).sort();

  // Build header with dynamic custom property columns
  const baseHeader = 'Size\tHeight\tBins\tPieces\tLabel\tNotes';
  const header = sortedKeys.length > 0
    ? `${baseHeader}\t${sortedKeys.join('\t')}`
    : baseHeader;

  // Build data rows
  const lines = rows.map(r => {
    const label = r.labels?.[0] || '';
    const notes = r.notes || '';
    const baseLine = `${r.size}\t${r.height}u\t${r.binCount}\t${r.totalPieces}\t${label}\t${notes}`;

    if (sortedKeys.length === 0) {
      return baseLine;
    }

    // Add custom property values in order
    const customValues = sortedKeys.map(key => r.customProperties?.[key] || '');
    return `${baseLine}\t${customValues.join('\t')}`;
  });

  return [header, ...lines].join('\n');
}

// === URL Encoding (Hash-based sharing) ===

/**
 * Compress a string using base64 encoding.
 */
function compressString(str: string): string {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return btoa(String.fromCharCode(...data));
  } catch {
    return btoa(str);
  }
}

/**
 * Decompress a base64-encoded string.
 */
function decompressString(compressed: string): string {
  try {
    const binary = atob(compressed);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch {
    return atob(compressed);
  }
}

/**
 * Encode a layout for URL sharing.
 * Returns a base64-encoded string safe for URL hash.
 */
export function encodeLayoutForURL(layout: Layout): string {
  const json = JSON.stringify(layout);
  const compressed = compressString(json);
  // Make base64 URL-safe
  return compressed.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a layout from URL-encoded string.
 * Returns the layout or null if invalid.
 */
export function decodeLayoutFromURL(encoded: string): { layout: Layout | null; errors: string[] } {
  try {
    // Restore base64 from URL-safe version
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add back padding
    while (base64.length % 4) {
      base64 += '=';
    }

    const json = decompressString(base64);
    return importLayoutJSON(json);
  } catch (e) {
    return { layout: null, errors: [`Failed to decode URL: ${(e as Error).message}`] };
  }
}

/**
 * Decode a layout from URL-encoded string with Result-based error handling.
 * Returns Ok with layout on success, or Err with ValidationImportError.
 */
export function decodeLayoutResult(encoded: string): Result<Layout, ValidationError> {
  const { layout, errors } = decodeLayoutFromURL(encoded);

  if (layout === null) {
    return err(validationImportFailed(errors));
  }

  return ok(layout);
}

/**
 * Generate a shareable URL for a layout.
 * The layout is encoded in the URL hash.
 */
export function generateShareableURL(layout: Layout): string {
  const encoded = encodeLayoutForURL(layout);
  const baseURL = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : '';
  return `${baseURL}#share=${encoded}`;
}

/**
 * Check if the current URL contains a shared layout.
 */
export function getSharedLayoutFromURL(): { layout: Layout | null; errors: string[] } | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;

  const encoded = hash.slice(7); // Remove '#share='
  return decodeLayoutFromURL(encoded);
}

/**
 * Check if the current URL contains a shared layout with Result-based error handling.
 * Returns null if no shared layout in URL (not an error).
 * Returns Ok with layout if found and valid, Err with ValidationError if found but invalid.
 */
export function getSharedLayoutResult(): Result<Layout, ValidationError> | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;

  const encoded = hash.slice(7); // Remove '#share='
  return decodeLayoutResult(encoded);
}

/**
 * Clear the shared layout from URL (after import).
 */
export function clearSharedLayoutFromURL(): void {
  if (typeof window === 'undefined') return;

  // Remove the hash without triggering a page reload
  const url = window.location.href.split('#')[0];
  window.history.replaceState(null, '', url);
}

// === Cloud Share URLs ===

/**
 * Check if the current URL contains a layout ID that may be a cloud share.
 * Returns the ID if found, null otherwise.
 *
 * Matches:
 * - Share URL pattern: /s/{12-char-id} (for shared layouts)
 * - Unified pattern: /l/{12-char-id} or /l/{12-char-id}/{slug} (for local layouts that might be cloud shares)
 *
 * Note: For the unified /l/ pattern, the caller should check if the layout
 * exists locally before assuming it's a cloud share.
 */
export function getCloudShareIdFromURL(): string | null {
  if (typeof window === 'undefined') return null;

  const pathname = window.location.pathname;

  // Check share URL pattern: /s/{id}
  const shareMatch = pathname.match(/^\/s\/([a-zA-Z0-9]{12})$/);
  if (shareMatch) {
    return shareMatch[1];
  }

  // Check unified pattern: /l/{id} or /l/{id}/{slug}
  const unifiedMatch = pathname.match(/^\/l\/([a-zA-Z0-9]{12})(?:\/.*)?$/);
  if (unifiedMatch) {
    return unifiedMatch[1];
  }

  return null;
}

/**
 * Clear the cloud share ID from URL.
 * Note: This is only called after loading a shared layout that doesn't exist locally.
 * For layouts that DO exist locally, the URL stays as-is.
 */
export function clearCloudShareFromURL(): void {
  if (typeof window === 'undefined') return;

  const pathname = window.location.pathname;

  // Clear share format /s/{id}
  if (pathname.match(/^\/s\/[a-zA-Z0-9]{12}$/)) {
    window.history.replaceState(null, '', '/');
    return;
  }

  // Clear unified format /l/{id} or /l/{id}/{slug} (only for non-local layouts)
  // This is called after determining the layout needs cloud fetch
  if (pathname.match(/^\/l\/[a-zA-Z0-9]{12}(\/.*)?$/)) {
    window.history.replaceState(null, '', '/');
  }
}
