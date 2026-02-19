import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isArchiveFormat,
  parseArchive,
  exportAllLayouts,
  importArchive,
} from '@/core/storage/BulkArchiveService';
import type { Layout, LayoutLibrary, LayoutEntry } from '@/core/types';
import { ok, err } from '@/core/result';

// === Mocks ===

const mockLoadLayoutAsync = vi.fn();
vi.mock('@/core/storage/LayoutService', () => ({
  loadLayoutAsync: (...args: unknown[]) => mockLoadLayoutAsync(...args),
}));

const mockCreateLayoutEntry = vi.fn();
vi.mock('@/core/storage/LayoutManager', () => ({
  createLayoutEntry: (...args: unknown[]) => mockCreateLayoutEntry(...args),
}));

const mockImportLayoutJSON = vi.fn();
vi.mock('@/core/storage/ShareService', () => ({
  importLayoutJSON: (...args: unknown[]) => mockImportLayoutJSON(...args),
}));

// === Fixtures ===

function makeLayout(name = 'Test Layout'): Layout {
  return {
    version: '1.0',
    name,
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [],
    layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
    bins: [],
  } as unknown as Layout;
}

function makeEntry(id: string, name: string): LayoutEntry {
  return {
    id,
    name,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 0,
      layerCount: 1,
      binMap: [],
    },
  };
}

function makeLibrary(entries: LayoutEntry[]): LayoutLibrary {
  return { version: '1.0', activeLayoutId: entries[0]?.id ?? '', settings: {}, entries };
}

// === isArchiveFormat ===

describe('isArchiveFormat', () => {
  it('returns true for a valid archive object', () => {
    const archive = {
      _archive: { version: '1.0', exportedFrom: 'x', exportedAt: 'now', layoutCount: 1 },
      layouts: [],
    };
    expect(isArchiveFormat(archive)).toBe(true);
  });

  it('returns false for a single layout (no _archive key)', () => {
    expect(isArchiveFormat(makeLayout())).toBe(false);
  });

  it('returns false for null', () => {
    expect(isArchiveFormat(null)).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isArchiveFormat('not an object')).toBe(false);
  });

  it('returns false when layouts is not an array', () => {
    expect(isArchiveFormat({ _archive: { version: '1.0' }, layouts: 'bad' })).toBe(false);
  });

  it('returns false for unknown version', () => {
    expect(
      isArchiveFormat({
        _archive: { version: '2.0', exportedFrom: 'x', exportedAt: 'now', layoutCount: 0 },
        layouts: [],
      })
    ).toBe(false);
  });

  it('returns false when _archive is not an object', () => {
    expect(isArchiveFormat({ _archive: 'bad', layouts: [] })).toBe(false);
  });
});

// === parseArchive ===

describe('parseArchive', () => {
  it('parses valid archive JSON', () => {
    const archive = {
      _archive: { version: '1.0', exportedFrom: 'x', exportedAt: 'now', layoutCount: 1 },
      layouts: [{ name: 'L1', layout: makeLayout('L1') }],
    };
    const result = parseArchive(JSON.stringify(archive));
    expect(result).not.toBeNull();
    expect(result?._archive.version).toBe('1.0');
    expect(result?.layouts).toHaveLength(1);
  });

  it('returns null for single-layout JSON (missing _archive)', () => {
    expect(parseArchive(JSON.stringify(makeLayout()))).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseArchive('{broken json')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseArchive('')).toBeNull();
  });
});

// === exportAllLayouts ===

describe('exportAllLayouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds archive JSON containing each layout entry', async () => {
    const layout1 = makeLayout('Alpha');
    const layout2 = makeLayout('Beta');
    mockLoadLayoutAsync.mockResolvedValueOnce(layout1).mockResolvedValueOnce(layout2);

    const library = makeLibrary([makeEntry('id-1', 'Alpha'), makeEntry('id-2', 'Beta')]);
    const result = await exportAllLayouts(library);
    const parsed = JSON.parse(result.json);

    expect(result.exported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(isArchiveFormat(parsed)).toBe(true);
    expect(parsed._archive.layoutCount).toBe(2);
    expect(parsed.layouts).toHaveLength(2);
    expect(parsed.layouts[0].name).toBe('Alpha');
    expect(parsed.layouts[1].name).toBe('Beta');
  });

  it('reports progress for each entry', async () => {
    mockLoadLayoutAsync.mockResolvedValue(makeLayout());
    const library = makeLibrary([makeEntry('id-1', 'L1'), makeEntry('id-2', 'L2')]);
    const progress: { current: number; total: number }[] = [];

    await exportAllLayouts(library, (p) => progress.push({ ...p }));

    expect(progress).toHaveLength(2);
    expect(progress[0]).toEqual({ current: 1, total: 2 });
    expect(progress[1]).toEqual({ current: 2, total: 2 });
  });

  it('skips layouts that throw during load and reports skipped count', async () => {
    mockLoadLayoutAsync
      .mockRejectedValueOnce(new Error('corrupt'))
      .mockResolvedValueOnce(makeLayout('Beta'));
    const library = makeLibrary([makeEntry('id-1', 'Alpha'), makeEntry('id-2', 'Beta')]);

    const result = await exportAllLayouts(library);
    const parsed = JSON.parse(result.json);

    expect(result.exported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(parsed.layouts[0].name).toBe('Beta');
  });

  it('skips layouts that fail to load and reports skipped count', async () => {
    mockLoadLayoutAsync.mockResolvedValueOnce(null).mockResolvedValueOnce(makeLayout('Beta'));
    const library = makeLibrary([makeEntry('id-1', 'Alpha'), makeEntry('id-2', 'Beta')]);

    const result = await exportAllLayouts(library);
    const parsed = JSON.parse(result.json);

    expect(result.exported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(parsed._archive.layoutCount).toBe(1);
    expect(parsed.layouts[0].name).toBe('Beta');
  });
});

// === importArchive ===

describe('importArchive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports valid layouts and skips invalid ones', async () => {
    const layout1 = makeLayout('Valid');
    const regeneratedLayout1 = makeLayout('Valid');
    const layout2 = makeLayout('Invalid');
    const library = makeLibrary([makeEntry('existing', 'Existing')]);
    const updatedLibrary = makeLibrary([
      makeEntry('existing', 'Existing'),
      makeEntry('new-id', 'Valid'),
    ]);

    mockImportLayoutJSON
      .mockReturnValueOnce({ layout: regeneratedLayout1, errors: [] })
      .mockReturnValueOnce({ layout: null, errors: ['bad data'] });
    mockCreateLayoutEntry.mockResolvedValueOnce(
      ok({ library: updatedLibrary, layoutId: 'new-id' })
    );

    const archive = {
      _archive: { version: '1.0' as const, exportedFrom: 'x', exportedAt: 'now', layoutCount: 2 },
      layouts: [
        { name: 'Valid', layout: layout1 },
        { name: 'Invalid', layout: layout2 },
      ],
    };

    const { result } = await importArchive(archive, library);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Invalid');
  });

  it('passes serialized layout JSON to importLayoutJSON for ID regeneration', async () => {
    const layout = makeLayout('My Layout');
    const regeneratedLayout = makeLayout('My Layout');
    const library = makeLibrary([makeEntry('existing', 'Existing')]);
    const updatedLibrary = makeLibrary([
      makeEntry('existing', 'Existing'),
      makeEntry('new-id', 'My Layout'),
    ]);

    mockImportLayoutJSON.mockReturnValueOnce({ layout: regeneratedLayout, errors: [] });
    mockCreateLayoutEntry.mockResolvedValueOnce(
      ok({ library: updatedLibrary, layoutId: 'new-id' })
    );

    const archive = {
      _archive: { version: '1.0' as const, exportedFrom: 'x', exportedAt: 'now', layoutCount: 1 },
      layouts: [{ name: 'My Layout', layout }],
    };

    await importArchive(archive, library);

    // Should pass serialized JSON (not the raw object) so importLayoutJSON can parse + regenerate IDs
    expect(mockImportLayoutJSON).toHaveBeenCalledWith(JSON.stringify(layout));
    // Should pass the regenerated layout (not original) to createLayoutEntry
    expect(mockCreateLayoutEntry).toHaveBeenCalledWith(
      regeneratedLayout,
      expect.anything(),
      expect.objectContaining({ name: 'My Layout' })
    );
  });

  it('returns updated library after successful imports', async () => {
    const layout = makeLayout('My Layout');
    const regeneratedLayout = makeLayout('My Layout');
    const library = makeLibrary([makeEntry('existing', 'Existing')]);
    const updatedLibrary = makeLibrary([
      makeEntry('existing', 'Existing'),
      makeEntry('new-id', 'My Layout'),
    ]);

    mockImportLayoutJSON.mockReturnValueOnce({ layout: regeneratedLayout, errors: [] });
    mockCreateLayoutEntry.mockResolvedValueOnce(
      ok({ library: updatedLibrary, layoutId: 'new-id' })
    );

    const archive = {
      _archive: { version: '1.0' as const, exportedFrom: 'x', exportedAt: 'now', layoutCount: 1 },
      layouts: [{ name: 'My Layout', layout }],
    };

    const { library: resultLibrary } = await importArchive(archive, library);

    expect(resultLibrary.entries).toHaveLength(2);
  });

  it('skips and records error when createLayoutEntry fails', async () => {
    const layout = makeLayout('Layout');
    const regeneratedLayout = makeLayout('Layout');
    const library = makeLibrary([makeEntry('existing', 'Existing')]);

    mockImportLayoutJSON.mockReturnValueOnce({ layout: regeneratedLayout, errors: [] });
    mockCreateLayoutEntry.mockResolvedValueOnce(
      err({ code: 'STORAGE_QUOTA_EXCEEDED', message: 'full' })
    );

    const archive = {
      _archive: { version: '1.0' as const, exportedFrom: 'x', exportedAt: 'now', layoutCount: 1 },
      layouts: [{ name: 'Layout', layout }],
    };

    const { result } = await importArchive(archive, library);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain('storage error');
  });

  it('returns early when library is already at LAYOUTS_MAX', async () => {
    // Create a library with 500 entries (LAYOUTS_MAX)
    const entries = Array.from({ length: 500 }, (_, i) => makeEntry(`id-${i}`, `Layout ${i}`));
    const library = makeLibrary(entries);

    const archive = {
      _archive: { version: '1.0' as const, exportedFrom: 'x', exportedAt: 'now', layoutCount: 1 },
      layouts: [{ name: 'New', layout: makeLayout('New') }],
    };

    const { result } = await importArchive(archive, library);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain('full');
    expect(mockCreateLayoutEntry).not.toHaveBeenCalled();
  });

  it('stops importing when library limit is reached mid-loop', async () => {
    // Start with 499 entries, try to import 3 => should import 1, skip 2
    const entries = Array.from({ length: 499 }, (_, i) => makeEntry(`id-${i}`, `L${i}`));
    const library = makeLibrary(entries);

    const regenerated = makeLayout('Import');
    mockImportLayoutJSON.mockReturnValue({ layout: regenerated, errors: [] });
    // After importing the first, the library has 500 entries (at the limit)
    const fullLibrary = makeLibrary([...entries, makeEntry('new-1', 'Import 1')]);
    mockCreateLayoutEntry.mockResolvedValueOnce(ok({ library: fullLibrary, layoutId: 'new-1' }));

    const archive = {
      _archive: {
        version: '1.0' as const,
        exportedFrom: 'x',
        exportedAt: 'now',
        layoutCount: 3,
      },
      layouts: [
        { name: 'Import 1', layout: makeLayout('I1') },
        { name: 'Import 2', layout: makeLayout('I2') },
        { name: 'Import 3', layout: makeLayout('I3') },
      ],
    };

    const { result } = await importArchive(archive, library);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.errors[0]).toContain('Library full');
    expect(mockCreateLayoutEntry).toHaveBeenCalledTimes(1);
  });

  it('calls onProgress for each layout entry', async () => {
    const layout = makeLayout();
    const regeneratedLayout = makeLayout();
    const library = makeLibrary([makeEntry('existing', 'Existing')]);
    const updatedLibrary = makeLibrary([
      makeEntry('existing', 'Existing'),
      makeEntry('new-id', 'New'),
    ]);

    mockImportLayoutJSON.mockReturnValue({ layout: regeneratedLayout, errors: [] });
    mockCreateLayoutEntry.mockResolvedValue(ok({ library: updatedLibrary, layoutId: 'new-id' }));

    const archive = {
      _archive: { version: '1.0' as const, exportedFrom: 'x', exportedAt: 'now', layoutCount: 2 },
      layouts: [
        { name: 'L1', layout },
        { name: 'L2', layout },
      ],
    };

    const progress: { current: number; total: number }[] = [];
    await importArchive(archive, library, (p) => progress.push({ ...p }));

    expect(progress).toHaveLength(2);
    expect(progress[0]).toEqual({ current: 1, total: 2 });
    expect(progress[1]).toEqual({ current: 2, total: 2 });
  });
});
