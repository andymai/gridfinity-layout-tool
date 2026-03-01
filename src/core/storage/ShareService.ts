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

import { validateImport } from '@/shared/utils/validation';
import { generateBinId, generateLayerId, generateCategoryId, STAGING_ID } from '@/core/constants';
import type { Layout, LayerId, CategoryId } from '@/core/types';
import type { Result, ValidationError } from '@/core/result';
import { ok, err, validationImportFailed, isOk } from '@/core/result';
import type { BinParams } from '@/shared/types/bin';

// === JSON Import/Export ===

interface LinkedDesignExport {
  readonly id: string;
  readonly name: string;
  readonly params: BinParams;
}

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
 * Export layout as JSON string with linked bin designs embedded.
 * Async because it needs to look up designs from IndexedDB.
 */
export async function exportLayoutJSONWithDesigns(layout: Layout): Promise<string> {
  // Collect unique linkedDesignIds from bins
  const designIds = new Set<string>();
  for (const bin of layout.bins) {
    if (bin.linkedDesignId) {
      designIds.add(bin.linkedDesignId);
    }
  }

  // Look up each design from IndexedDB
  const linkedDesigns: LinkedDesignExport[] = [];
  if (designIds.size > 0) {
    const { loadDesign } = await import('@/features/bin-designer/storage/DesignerStorage');
    for (const id of designIds) {
      const result = await loadDesign(id);
      if (isOk(result)) {
        linkedDesigns.push({
          id: result.value.id,
          name: result.value.name,
          params: result.value.params,
        });
      }
      // If design not found (deleted), just omit it
    }
  }

  const exportData = {
    ...layout,
    ...(linkedDesigns.length > 0 ? { linkedDesigns } : {}),
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
    const parsed = JSON.parse(json) as Record<string, unknown>;

    // Strip export metadata if present (not part of Layout type)
    if ('_meta' in parsed) {
      delete parsed._meta;
    }

    const validation = validateImport(parsed);

    if (!validation.valid) {
      return { layout: null, errors: validation.errors };
    }

    // Regenerate all IDs
    const layout = validation.layout;
    const layerIdMap = new Map<string, LayerId>();
    const categoryIdMap = new Map<string, CategoryId>();

    // Regenerate layer IDs
    layout.layers = layout.layers.map((layer) => {
      const newId = generateLayerId();
      layerIdMap.set(layer.id, newId);
      return { ...layer, id: newId };
    });

    // Regenerate category IDs
    layout.categories = layout.categories.map((cat) => {
      const newId = generateCategoryId();
      categoryIdMap.set(cat.id, newId);
      return { ...cat, id: newId };
    });

    // Regenerate bin IDs and update references
    layout.bins = layout.bins.map((bin) => ({
      ...bin,
      id: generateBinId(),
      layerId:
        bin.layerId === STAGING_ID ? STAGING_ID : (layerIdMap.get(bin.layerId) ?? bin.layerId),
      category: categoryIdMap.get(bin.category) ?? bin.category,
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

/**
 * Restore embedded bin designs from layout JSON and update bin references.
 * Call this after importLayoutJSON when you need design restoration.
 *
 * @param json - The raw JSON string containing linkedDesigns array
 * @param layout - The layout with regenerated IDs from importLayoutJSON
 * @returns Updated layout with new linkedDesignId references and count of imported designs
 */
export async function restoreEmbeddedDesigns(
  json: string,
  layout: Layout
): Promise<{ layout: Layout; importedDesignCount: number }> {
  // Parse the raw JSON again to get linkedDesigns
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return { layout, importedDesignCount: 0 };
  }

  if (!Array.isArray(data.linkedDesigns) || data.linkedDesigns.length === 0) {
    return { layout, importedDesignCount: 0 };
  }

  const { saveDesign } = await import('@/features/bin-designer/storage/DesignerStorage');
  const designIdMap = new Map<string, string>();
  let importedDesignCount = 0;

  for (const entry of data.linkedDesigns as unknown[]) {
    const linkedDesign = entry as Record<string, unknown> | null;
    if (
      linkedDesign &&
      typeof linkedDesign === 'object' &&
      'id' in linkedDesign &&
      'name' in linkedDesign &&
      'params' in linkedDesign &&
      typeof linkedDesign.id === 'string' &&
      typeof linkedDesign.name === 'string'
    ) {
      const result = await saveDesign({
        name: linkedDesign.name,
        params: linkedDesign.params as BinParams,
        thumbnail: null,
        exportFileNameConfig: null,
      });
      if (isOk(result)) {
        designIdMap.set(linkedDesign.id, result.value.id);
        importedDesignCount++;
      }
    }
  }

  // Update linkedDesignId references on bins
  if (designIdMap.size > 0) {
    layout = {
      ...layout,
      bins: layout.bins.map((bin) => ({
        ...bin,
        linkedDesignId: bin.linkedDesignId
          ? designIdMap.get(bin.linkedDesignId) || bin.linkedDesignId
          : bin.linkedDesignId,
      })),
    };
  }

  return { layout, importedDesignCount };
}

// === TSV Export ===

/**
 * Escape a value for TSV format.
 * Replaces tabs and newlines with spaces to prevent breaking the format.
 */
function escapeTSVValue(value: string): string {
  return value.replace(/[\t\n\r]/g, ' ');
}

/**
 * Metadata for TSV export including layout context.
 */
export interface PrintListTSVMeta {
  gridUnitMm: number;
  categories: Array<{ id: string; name: string }>;
}

/**
 * Calculate size in mm from grid units.
 */
function calculateSizeMm(size: string, gridUnitMm: number): string {
  const [w, d] = size.split('×').map(Number);
  return `${Math.round(w * gridUnitMm)}×${Math.round(d * gridUnitMm)}`;
}

/**
 * Export print list as TSV for spreadsheet paste.
 * Column order: Qty, Size, Size(mm), Height, Category, Label, Notes, [Custom Props]
 * Dynamically adds columns for custom properties that exist in any row.
 */
export function exportPrintListTSV(
  rows: Array<{
    size: string;
    height: number;
    binCount: number;
    categoryIds?: string[];
    labels?: string[];
    notes?: string;
    customProperties?: Record<string, string>;
  }>,
  meta?: PrintListTSVMeta
): string {
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

  // Build header with new column order: Qty, Size, Size(mm), Height, Category, Label, Notes
  const baseHeader = 'Qty\tSize\tSize(mm)\tHeight\tCategory\tLabel\tNotes';
  const header = sortedKeys.length > 0 ? `${baseHeader}\t${sortedKeys.join('\t')}` : baseHeader;

  // Build category lookup map
  const categoryMap = new Map(meta?.categories.map((c) => [c.id, c.name]) ?? []);

  // Build data rows
  const lines = rows.map((r) => {
    const sizeMm = meta ? calculateSizeMm(r.size, meta.gridUnitMm) : '';
    const categoryName = r.categoryIds?.[0]
      ? escapeTSVValue(categoryMap.get(r.categoryIds[0]) || 'Uncategorized')
      : '';
    const label = escapeTSVValue(r.labels?.[0] || '');
    const notes = escapeTSVValue(r.notes || '');

    const baseLine = `${r.binCount}\t${r.size}\t${sizeMm}\t${r.height}u\t${categoryName}\t${label}\t${notes}`;

    if (sortedKeys.length === 0) {
      return baseLine;
    }

    // Add custom property values in order (with TSV escaping)
    const customValues = sortedKeys.map((key) => escapeTSVValue(r.customProperties?.[key] || ''));
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
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
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
  const baseURL =
    typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
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
 * Get layout ID from URL if present.
 * Matches: /l/{12-char-id} or /l/{12-char-id}/{slug}
 *
 * Note: The caller should check if the layout exists locally or in
 * "Shared with me" before attempting to fetch from cloud.
 */
export function getCloudShareIdFromURL(): string | null {
  if (typeof window === 'undefined') return null;

  const pathname = window.location.pathname;

  // Match /l/{id} or /l/{id}/{slug}
  const match = pathname.match(/^\/l\/([a-zA-Z0-9]{12})(?:\/.*)?$/);
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Clear the layout ID from URL.
 * Called after loading a shared layout to reset the URL to root.
 */
export function clearCloudShareFromURL(): void {
  if (typeof window === 'undefined') return;

  const pathname = window.location.pathname;

  // Clear /l/{id} or /l/{id}/{slug} format
  if (pathname.match(/^\/l\/[a-zA-Z0-9]{12}(\/.*)?$/)) {
    window.history.replaceState(null, '', '/');
  }
}
