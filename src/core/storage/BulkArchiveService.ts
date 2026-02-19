/**
 * Bulk Archive Service - export/import all layouts as a single JSON archive.
 *
 * Archive format:
 * {
 *   _archive: { version, exportedFrom, exportedAt, layoutCount },
 *   layouts: [{ name, layout, linkedDesigns? }]
 * }
 */

import type { Layout, LayoutLibrary } from '@/core/types';
import type { Result, StorageError, LayoutLibraryLimitError } from '@/core/result';
import { isOk, isErr } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { loadLayoutAsync } from './LayoutService';
import { createLayoutEntry } from './LayoutManager';
import { importLayoutJSON } from './ShareService';

// === Types ===

interface LinkedDesignExport {
  readonly id: string;
  readonly name: string;
  readonly params: unknown;
}

interface ArchiveLayoutEntry {
  readonly name: string;
  readonly layout: Layout;
  readonly linkedDesigns?: LinkedDesignExport[];
}

export interface LayoutArchive {
  readonly _archive: {
    readonly version: '1.0';
    readonly exportedFrom: string;
    readonly exportedAt: string;
    readonly layoutCount: number;
  };
  readonly layouts: ArchiveLayoutEntry[];
}

export interface ExportProgress {
  current: number;
  total: number;
}

export interface ExportResult {
  json: string;
  exported: number;
  skipped: number;
}

export interface ImportArchiveResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// === Export ===

/**
 * Check if parsed JSON is a bulk archive (vs. a single layout).
 * Validates structural shape and version to fail fast on malformed archives.
 */
export function isArchiveFormat(data: unknown): data is LayoutArchive {
  if (typeof data !== 'object' || data === null) return false;
  if (!('_archive' in data) || !('layouts' in data)) return false;

  const root = data as { _archive: unknown; layouts: unknown };

  // Validate _archive metadata
  if (typeof root._archive !== 'object' || root._archive === null) return false;
  const meta = root._archive as { version?: unknown };
  if (meta.version !== '1.0') return false;

  // Validate layouts array
  return Array.isArray(root.layouts);
}

/**
 * Export all layouts in the library as a JSON archive string.
 * Loads each layout from storage and bundles them together.
 */
export async function exportAllLayouts(
  library: LayoutLibrary,
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  const total = library.entries.length;
  const layouts: ArchiveLayoutEntry[] = [];
  let skipped = 0;

  for (let i = 0; i < library.entries.length; i++) {
    const entry = library.entries[i];
    onProgress?.({ current: i + 1, total });

    try {
      const layout = await loadLayoutAsync(entry.id);
      if (!layout) {
        skipped++;
        continue;
      }

      // Collect linked designs if any bins reference them
      const designIds = new Set<string>();
      for (const bin of layout.bins) {
        if (bin.linkedDesignId) {
          designIds.add(bin.linkedDesignId);
        }
      }

      let linkedDesigns: LinkedDesignExport[] | undefined;
      if (designIds.size > 0) {
        linkedDesigns = [];
        try {
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
          }
        } catch {
          // Designer storage unavailable — skip linked designs
        }
        if (linkedDesigns.length === 0) linkedDesigns = undefined;
      }

      layouts.push({
        name: entry.name,
        layout,
        ...(linkedDesigns ? { linkedDesigns } : {}),
      });
    } catch {
      // Skip layouts that can't be loaded
      skipped++;
    }
  }

  const archive: LayoutArchive = {
    _archive: {
      version: '1.0',
      exportedFrom: 'https://gridfinitylayouttool.com',
      exportedAt: new Date().toISOString(),
      layoutCount: layouts.length,
    },
    layouts,
  };

  return {
    json: JSON.stringify(archive),
    exported: layouts.length,
    skipped,
  };
}

/**
 * Download all layouts as a single JSON archive file.
 */
export async function downloadArchive(
  library: LayoutLibrary,
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  const result = await exportAllLayouts(library, onProgress);
  const blob = new Blob([result.json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `gridfinity-layouts-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return result;
}

// === Import ===

/**
 * Parse and validate a bulk archive from raw JSON.
 * Returns null if the JSON is not in archive format.
 */
export function parseArchive(json: string): LayoutArchive | null {
  try {
    const data = JSON.parse(json) as unknown;
    if (!isArchiveFormat(data)) return null;
    // Only accept archives with known version
    if (data._archive.version !== '1.0') return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Import all layouts from an archive into the library.
 * Each layout gets new IDs to prevent collisions.
 */
export async function importArchive(
  archive: LayoutArchive,
  library: LayoutLibrary,
  onProgress?: (progress: ExportProgress) => void
): Promise<{
  result: ImportArchiveResult;
  library: LayoutLibrary;
}> {
  const total = archive.layouts.length;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  let currentLibrary = library;

  // Pre-check: how many slots are available?
  const availableSlots = CONSTRAINTS.LAYOUTS_MAX - currentLibrary.entries.length;
  if (availableSlots <= 0) {
    return {
      result: {
        imported: 0,
        skipped: total,
        errors: [`Library is full (${CONSTRAINTS.LAYOUTS_MAX} layouts maximum)`],
      },
      library: currentLibrary,
    };
  }

  for (let i = 0; i < archive.layouts.length; i++) {
    const archiveEntry = archive.layouts[i];
    onProgress?.({ current: i + 1, total });

    // Stop early if we've hit the library limit
    if (currentLibrary.entries.length >= CONSTRAINTS.LAYOUTS_MAX) {
      const remaining = total - i;
      errors.push(`Library full — ${remaining} layout(s) not imported`);
      skipped += remaining;
      break;
    }

    // Validate and regenerate all IDs to prevent collisions
    const layoutJson = JSON.stringify(archiveEntry.layout);
    const { layout: importedLayout, errors: validationErrors } = importLayoutJSON(layoutJson);
    if (!importedLayout) {
      errors.push(`"${archiveEntry.name}": ${validationErrors.join(', ')}`);
      skipped++;
      continue;
    }

    // Create entry via atomic operation
    const createResult: Result<
      { library: LayoutLibrary; layoutId: string },
      StorageError | LayoutLibraryLimitError
    > = await createLayoutEntry(importedLayout, currentLibrary, {
      name: archiveEntry.name,
    });

    if (isErr(createResult)) {
      errors.push(`"${archiveEntry.name}": storage error`);
      skipped++;
      continue;
    }

    currentLibrary = createResult.value.library;
    imported++;

    // Restore linked designs if present (uses regenerated layout for correct ID mapping)
    if (archiveEntry.linkedDesigns && archiveEntry.linkedDesigns.length > 0) {
      try {
        const { restoreEmbeddedDesigns } = await import('./ShareService');
        // restoreEmbeddedDesigns expects raw JSON with linkedDesigns array
        const designsJson = JSON.stringify({ linkedDesigns: archiveEntry.linkedDesigns });
        await restoreEmbeddedDesigns(designsJson, importedLayout);
      } catch {
        // Design restoration is best-effort
      }
    }
  }

  return {
    result: { imported, skipped, errors },
    library: currentLibrary,
  };
}
