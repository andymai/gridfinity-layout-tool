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
import { isValidLayoutId, isLegacyUUID } from '@/shared/utils/uuid';
import { generateBinId, generateLayerId, generateCategoryId, STAGING_ID } from '@/core/constants';
import type { Layout, LayerId, CategoryId, DesignId } from '@/core/types';
import { designId as toDesignId } from '@/core/types';
import type { Result, ValidationError } from '@/core/result';
import { ok, err, validationImportFailed, isOk } from '@/core/result';
import { getDesignStorePort } from './designStorePort';
import type { BinParams } from '@/shared/types/bin';
import type { AssemblyStructure } from '@/shared/types/assembly';
import {
  assemblyHeightUnits,
  assemblyOverhangMm,
  assemblyRiseMm,
} from '@/shared/types/assemblyPlacement';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { hasOversizedMeshAsset } from '@/shared/generation/meshAsset';

/** A design travelling with a layout: bin params, or an assembly's
 *  envelope + structure. Exactly one of the two shapes is populated. */
export interface LinkedDesignExport {
  readonly id: string;
  readonly name: string;
  readonly params?: BinParams;
  readonly kind?: 'assembly';
  readonly envelope?: unknown;
  readonly structure?: unknown;
}

/** Assembly envelope fields the restore paths actually read. */
interface AssemblyEnvelopeShape {
  readonly width: number;
  readonly depth: number;
  readonly heightUnitMm: number;
  readonly gridUnitMm: number;
}

function isAssemblyEnvelope(value: unknown): value is AssemblyEnvelopeShape {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.width === 'number' &&
    typeof v.depth === 'number' &&
    typeof v.heightUnitMm === 'number' &&
    typeof v.gridUnitMm === 'number'
  );
}

function isAssemblyStructureShape(value: unknown): value is AssemblyStructure {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const base = v.base as Record<string, unknown> | null | undefined;
  return (
    v.kind === 'assembly' &&
    Array.isArray(v.parts) &&
    typeof base === 'object' &&
    base !== null &&
    typeof base.floorThickness === 'number'
  );
}

/**
 * Resolve the bin designs referenced by a layout's `linkedDesignId`s.
 *
 * Shared by file export and cloud share so both carry the same payload — a
 * layout that travels without its designs arrives as bins with dangling
 * references. Bin designs travel as `params`, assemblies as
 * `envelope`/`structure`; designs that fail to load (deleted) or cannot travel
 * (tool racks, imported meshes) are omitted rather than failing the whole set.
 */
export async function collectLinkedDesigns(layout: Layout): Promise<LinkedDesignExport[]> {
  const designIds = new Set<DesignId>();
  for (const bin of layout.bins) {
    if (bin.linkedDesignId) {
      designIds.add(bin.linkedDesignId);
    }
  }
  if (designIds.size === 0) return [];

  // A missing port means the design feature has not registered its adapter
  // yet; treat it exactly like "no designs resolved" (empty result).
  const port = getDesignStorePort();
  if (port === null) return [];

  const linkedDesigns: LinkedDesignExport[] = [];
  for (const id of designIds) {
    const result = await port.loadDesign(id);
    if (!isOk(result)) continue;
    const design = result.value;
    if (design.params) {
      linkedDesigns.push({ id: design.id, name: design.name, params: design.params as BinParams });
    } else if (design.kind === 'assembly' && design.envelope && design.structure) {
      linkedDesigns.push({
        id: design.id,
        name: design.name,
        kind: 'assembly',
        envelope: design.envelope,
        structure: design.structure,
      });
    }
  }
  return linkedDesigns;
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
  const linkedDesigns = await collectLinkedDesigns(layout);

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

  const port = getDesignStorePort();
  if (port === null) {
    return { layout, importedDesignCount: 0 };
  }

  const designIdMap = new Map<string, DesignId>();
  let importedDesignCount = 0;

  for (const entry of data.linkedDesigns as unknown[]) {
    const linkedDesign = entry as Record<string, unknown> | null;
    if (
      !linkedDesign ||
      typeof linkedDesign !== 'object' ||
      typeof linkedDesign.id !== 'string' ||
      typeof linkedDesign.name !== 'string'
    ) {
      continue;
    }
    const isAssembly =
      linkedDesign.kind === 'assembly' &&
      isAssemblyEnvelope(linkedDesign.envelope) &&
      isAssemblyStructureShape(linkedDesign.structure);
    // The cloud paths bound each asset server-side; a locally-imported file
    // reaches storage with its meshAssets verbatim, so this is where an
    // over-budget asset would otherwise get in and be handed to the decoder
    // on every preview. (The adapter's descriptor migration is the equivalent
    // gate for an assembly structure.)
    const isBin = 'params' in linkedDesign && !hasOversizedMeshAsset(linkedDesign.params);
    if (!isAssembly && !isBin) continue;
    const result = await port.saveDesign({
      name: linkedDesign.name,
      ...(isAssembly
        ? {
            kind: 'assembly' as const,
            envelope: linkedDesign.envelope,
            structure: linkedDesign.structure,
          }
        : { params: linkedDesign.params }),
      thumbnail: null,
      exportFileNameConfig: null,
    });
    if (isOk(result)) {
      designIdMap.set(linkedDesign.id, result.value.id);
      importedDesignCount++;
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
/** djb2 string hash → unsigned 32-bit hex (matches meshPersistence's pattern). */
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/**
 * Local id for a design that arrived with a share.
 *
 * Derived from (share, source design) rather than generated, because unlike a
 * one-shot file import a share link is re-fetched on every visit — a fresh id
 * each time would pile up duplicates in the recipient's design library. Hashed
 * to stay well inside the 64-char id budget the share API enforces, so a
 * recipient can re-share what they received.
 */
function sharedDesignLocalId(shareId: string, sourceDesignId: string): DesignId {
  return toDesignId(`design_shared_${djb2(`${shareId}:${sourceDesignId}`)}`);
}

/**
 * Persist the designs that travelled with a cloud share and repoint the
 * layout's bins at the local copies.
 *
 * Without this the recipient gets bins whose `linkedDesignId` names a design
 * that only ever existed in the sharer's browser — no 3D geometry, no
 * per-bin export, nothing to print.
 */
export async function restoreSharedDesigns(
  shareId: string,
  layout: Layout,
  designs: ReadonlyArray<{
    id: string;
    name: string;
    params?: unknown;
    kind?: string;
    envelope?: unknown;
    structure?: unknown;
  }>
): Promise<Layout> {
  if (designs.length === 0) return layout;

  // No registered port means the design feature is unavailable; leave the
  // layout untouched, exactly as when none of the designs resolve.
  const port = getDesignStorePort();
  if (port === null) return layout;

  const idMap = new Map<string, DesignId>();
  for (const design of designs) {
    if (
      design.kind === 'assembly' &&
      isAssemblyEnvelope(design.envelope) &&
      isAssemblyStructureShape(design.structure)
    ) {
      const envelope = design.envelope;
      const structure = design.structure;
      const result = await port.saveDesign({
        id: sharedDesignLocalId(shareId, design.id),
        name: design.name,
        kind: 'assembly',
        envelope,
        structure,
        thumbnail: null,
        exportFileNameConfig: null,
      });
      if (!isOk(result)) continue;
      idMap.set(design.id, result.value.id);
      // Same registry-or-invisible rule as bins; the assembly fields mirror
      // the feature's `registryAssemblyFields` projection (built here from
      // the server-validated structure — migration only clamps ranges, which
      // these placement reads tolerate).
      const socketAndFloorMm = GRIDFINITY_SPEC.SOCKET_HEIGHT + structure.base.floorThickness;
      await port.upsertRegistryEntry({
        id: result.value.id,
        name: result.value.name,
        width: envelope.width,
        depth: envelope.depth,
        height: assemblyHeightUnits(structure, envelope.heightUnitMm, socketAndFloorMm, {
          w: envelope.width * envelope.gridUnitMm,
          d: envelope.depth * envelope.gridUnitMm,
        }),
        kind: 'assembly',
        assembledRiseMm: assemblyRiseMm(structure, socketAndFloorMm, {
          w: envelope.width * envelope.gridUnitMm,
          d: envelope.depth * envelope.gridUnitMm,
        }),
        socketless: false,
        hasLip: false,
        overhangMm: assemblyOverhangMm(structure, {
          w: envelope.width * envelope.gridUnitMm,
          d: envelope.depth * envelope.gridUnitMm,
        }),
        updatedAt: result.value.updatedAt,
      });
      continue;
    }
    if (!design.params || typeof design.params !== 'object' || Array.isArray(design.params)) {
      continue;
    }
    const params = design.params as BinParams;

    const result = await port.saveDesign({
      id: sharedDesignLocalId(shareId, design.id),
      name: design.name,
      params,
      thumbnail: null,
      exportFileNameConfig: null,
    });
    if (!isOk(result)) continue;

    idMap.set(design.id, result.value.id);
    // The planner palette and the linked-bin mesh cache both key off the
    // registry, so a design that skips it stays invisible to the layout.
    const edgeFields = await port.registryEdgeFields(params);
    await port.upsertRegistryEntry({
      id: result.value.id,
      name: result.value.name,
      width: params.width,
      depth: params.depth,
      height: params.height,
      ...edgeFields,
      updatedAt: result.value.updatedAt,
    });
  }

  if (idMap.size === 0) return layout;

  return {
    ...layout,
    bins: layout.bins.map((bin) => {
      const localId = bin.linkedDesignId ? idMap.get(bin.linkedDesignId) : undefined;
      return localId ? { ...bin, linkedDesignId: localId } : bin;
    }),
  };
}

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
/**
 * Get layout ID from URL if present.
 * Matches: /l/{id} or /l/{id}/{slug} where id is one of the formats
 * generated by this client (12-char alphanumeric via `generateLayoutId()`,
 * legacy v4 UUID via `generateUUID()`). The server's `isValidShareId` also
 * accepts a base36 timestamp format that no client generates; those IDs
 * are intentionally not handled here. Kept in sync with `parseLayoutFromURL`
 * in `@/shared/utils/url` — divergence silently breaks share-link viewing.
 */
export function getCloudShareIdFromURL(): string | null {
  if (typeof window === 'undefined') return null;

  const pathname = window.location.pathname;

  const match = pathname.match(/^\/l\/([^/]+)(?:\/.*)?$/);
  if (!match) return null;

  const id = match[1];
  return isValidLayoutId(id) || isLegacyUUID(id) ? id : null;
}

/**
 * Clear the layout ID from URL.
 * Called after loading a shared layout to reset the URL to root.
 */
export function clearCloudShareFromURL(): void {
  if (typeof window === 'undefined') return;

  if (getCloudShareIdFromURL()) {
    window.history.replaceState(null, '', '/');
  }
}
