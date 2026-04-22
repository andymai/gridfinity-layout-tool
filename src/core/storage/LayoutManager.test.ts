/**
 * Unit tests for LayoutManager.ts atomic storage operations.
 *
 * These tests verify the atomic storage API that combines layout saves
 * with library metadata updates in single operations.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computePreview,
  saveLayoutWithMetadata,
  createLayoutEntry,
  deleteLayoutWithEntry,
  duplicateLayoutEntry,
  switchActiveLayout,
  updateCloudShare,
  renameLayoutEntry,
} from '@/core/storage/LayoutManager';
import { expectOk, expectErr } from '@/test/testUtils';
import { ok, err, storageQuotaExceeded, storageUnavailable } from '@/core/result';
import { createDefaultLayout, STAGING_ID, CONSTRAINTS, SHARED_PREVIEW_ID } from '@/core/constants';
import type { Layout, LayoutLibrary, LayoutEntry, Bin } from '@/core/types';

// Mock the backend module
vi.mock('@/core/storage/backend', () => ({
  saveSyncGeneric: vi.fn(),
  saveAsync: vi.fn(),
  loadAsync: vi.fn(),
  deleteAsync: vi.fn().mockResolvedValue(undefined),
}));

// Mock the IndexedDB backend
vi.mock('@/core/storage/backends/indexedDB', () => ({
  saveLibraryIndex: vi.fn().mockResolvedValue(undefined),
  loadLibraryIndex: vi.fn().mockResolvedValue(null),
}));

// Mock librarySync
vi.mock('@/core/storage/librarySync', () => ({
  notifyLibraryChanged: vi.fn(),
}));

// Mock validation to always pass (salvageImport is used for storage loads)
vi.mock('@/shared/utils/validation', () => ({
  salvageImport: vi.fn((data: unknown) => ({ valid: true, layout: data, salvaged: [] })),
}));

// Mock UUID generation for predictable IDs
vi.mock('@/shared/utils/uuid', () => ({
  generateLayoutId: vi.fn(() => 'generated-id-123'),
}));

import * as backend from '@/core/storage/backend';
import * as indexedDBBackend from '@/core/storage/backends/indexedDB';

// Helper to reset backend.saveAsync to its default mock behavior.
// Called in each describe's beforeEach since vi.clearAllMocks() resets implementations.
function resetSaveAsyncMock(): void {
  vi.mocked(backend.saveAsync).mockResolvedValue(ok(undefined));
}

// === Test Fixtures ===

function createTestLayout(name = 'Test Layout'): Layout {
  const layout = createDefaultLayout();
  layout.name = name;
  return layout;
}

function createTestLayoutWithBins(name = 'Layout With Bins'): Layout {
  const layout = createTestLayout(name);
  layout.bins = [
    {
      id: 'bin-1',
      x: 0,
      y: 0,
      width: 2,
      depth: 2,
      height: 3,
      layerId: layout.layers[0].id,
      category: layout.categories[0].id,
    },
    {
      id: 'bin-2',
      x: 2,
      y: 0,
      width: 1,
      depth: 1,
      height: 3,
      layerId: layout.layers[0].id,
      category: layout.categories[1]?.id || layout.categories[0].id,
    },
    // Staging bin - should be excluded from preview
    {
      id: 'staging-bin',
      x: 0,
      y: 0,
      width: 1,
      depth: 1,
      height: 3,
      layerId: STAGING_ID,
      category: layout.categories[0].id,
    },
  ] as Bin[];
  return layout;
}

function createTestEntry(id: string, name: string): LayoutEntry {
  return {
    id,
    name,
    createdAt: Date.now() - 10000,
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

function createTestLibrary(entries: LayoutEntry[]): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: entries[0]?.id || '',
    settings: {},
    entries,
  };
}

// === computePreview Tests ===

describe('computePreview', () => {
  it('computes drawer dimensions from layout', () => {
    const layout = createTestLayout();
    layout.drawer = { width: 15, depth: 10, height: 20 };

    const preview = computePreview(layout);

    expect(preview.drawerWidth).toBe(15);
    expect(preview.drawerDepth).toBe(10);
    expect(preview.drawerHeight).toBe(20);
  });

  it('counts all bins including staged', () => {
    const layout = createTestLayoutWithBins();

    const preview = computePreview(layout);

    // bins.length includes all bins
    expect(preview.binCount).toBe(3);
  });

  it('counts layers correctly', () => {
    const layout = createTestLayout();
    layout.layers = [
      { id: 'layer-1', name: 'Layer 1', height: 3 },
      { id: 'layer-2', name: 'Layer 2', height: 5 },
      { id: 'layer-3', name: 'Layer 3', height: 7 },
    ];

    const preview = computePreview(layout);

    expect(preview.layerCount).toBe(3);
  });

  it('generates binMap excluding staged bins', () => {
    const layout = createTestLayoutWithBins();

    const preview = computePreview(layout);

    // binMap should exclude staging bins
    expect(preview.binMap.length).toBe(2);
    expect(preview.binMap.some((b) => b.x === 0 && b.y === 0 && b.w === 2)).toBe(true);
    expect(preview.binMap.some((b) => b.x === 2 && b.y === 0 && b.w === 1)).toBe(true);
  });

  it('maps category colors to bins', () => {
    const layout = createTestLayoutWithBins();
    layout.categories[0].color = '#FF0000';

    const preview = computePreview(layout);

    const binWithColor = preview.binMap.find((b) => b.x === 0 && b.y === 0);
    expect(binWithColor?.c).toBe('#FF0000');
  });

  it('uses fallback color for unknown category', () => {
    const layout = createTestLayoutWithBins();
    // Set bin to unknown category
    layout.bins[0].category = 'unknown-category';

    const preview = computePreview(layout);

    const binWithFallback = preview.binMap.find((b) => b.x === 0 && b.y === 0);
    expect(binWithFallback?.c).toBe('#6B7280'); // Gray fallback
  });

  it('handles empty layout', () => {
    const layout = createTestLayout();
    layout.bins = [];
    layout.layers = [];

    const preview = computePreview(layout);

    expect(preview.binCount).toBe(0);
    expect(preview.layerCount).toBe(0);
    expect(preview.binMap).toEqual([]);
  });
});

// === saveLayoutWithMetadata Tests ===

describe('saveLayoutWithMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSaveAsyncMock();
  });

  it('saves layout and updates library entry', async () => {
    const layout = createTestLayout('Updated Name');
    const entry = createTestEntry('layout-1', 'Original Name');
    const library = createTestLibrary([entry]);

    const result = await saveLayoutWithMetadata('layout-1', layout, library);

    const value = expectOk(result);
    expect(value.layoutId).toBe('layout-1');
    expect(value.entry.name).toBe('Updated Name');
    expect(value.library.entries[0].name).toBe('Updated Name');
  });

  it('computes and updates preview', async () => {
    const layout = createTestLayoutWithBins();
    const entry = createTestEntry('layout-1', 'Test');
    const library = createTestLibrary([entry]);

    const result = await saveLayoutWithMetadata('layout-1', layout, library);

    const value = expectOk(result);
    expect(value.entry.preview.binCount).toBe(3);
    expect(value.entry.preview.binMap.length).toBe(2); // Excludes staging
  });

  it('updates modifiedAt timestamp', async () => {
    const layout = createTestLayout();
    const entry = createTestEntry('layout-1', 'Test');
    entry.modifiedAt = 1000; // Old timestamp
    const library = createTestLibrary([entry]);

    const before = Date.now();
    const result = await saveLayoutWithMetadata('layout-1', layout, library);
    const after = Date.now();

    const value = expectOk(result);
    expect(value.entry.modifiedAt).toBeGreaterThanOrEqual(before);
    expect(value.entry.modifiedAt).toBeLessThanOrEqual(after);
  });

  it('returns error for non-existent layout', async () => {
    const layout = createTestLayout();
    const library = createTestLibrary([createTestEntry('other-layout', 'Other')]);

    const result = await saveLayoutWithMetadata('non-existent', layout, library);

    expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
  });

  it('returns error when backend save fails', async () => {
    vi.mocked(backend.saveAsync).mockResolvedValueOnce(err(storageQuotaExceeded()));

    const layout = createTestLayout();
    const entry = createTestEntry('layout-1', 'Test');
    const library = createTestLibrary([entry]);

    const result = await saveLayoutWithMetadata('layout-1', layout, library);

    expect(expectErr(result).code).toBe('STORAGE_QUOTA_EXCEEDED');
  });

  it('skips preview computation when skipPreview is true', async () => {
    const layout = createTestLayoutWithBins();
    const entry = createTestEntry('layout-1', 'Test');
    entry.preview.binCount = 999; // Custom value to verify it's preserved
    const library = createTestLibrary([entry]);

    const result = await saveLayoutWithMetadata('layout-1', layout, library, {
      skipPreview: true,
    });

    const value = expectOk(result);
    expect(value.entry.preview.binCount).toBe(999); // Preserved
  });

  it('uses provided preview when skipPreview is true', async () => {
    const layout = createTestLayout();
    const entry = createTestEntry('layout-1', 'Test');
    const library = createTestLibrary([entry]);
    const customPreview = {
      drawerWidth: 99,
      drawerDepth: 99,
      drawerHeight: 99,
      binCount: 999,
      layerCount: 99,
      binMap: [],
    };

    const result = await saveLayoutWithMetadata('layout-1', layout, library, {
      skipPreview: true,
      preview: customPreview,
    });

    const value = expectOk(result);
    expect(value.entry.preview).toEqual(customPreview);
  });

  it('respects name option override', async () => {
    const layout = createTestLayout('Layout Name');
    const entry = createTestEntry('layout-1', 'Old Name');
    const library = createTestLibrary([entry]);

    const result = await saveLayoutWithMetadata('layout-1', layout, library, {
      name: 'Override Name',
    });

    const value = expectOk(result);
    expect(value.entry.name).toBe('Override Name');
  });

  it('calls backend saveAsync with correct key', async () => {
    const layout = createTestLayout();
    const entry = createTestEntry('my-layout-id', 'Test');
    const library = createTestLibrary([entry]);

    await saveLayoutWithMetadata('my-layout-id', layout, library);

    expect(backend.saveAsync).toHaveBeenCalledWith('gridfinity-layout-my-layout-id', layout);
  });
});

// === createLayoutEntry Tests ===

describe('createLayoutEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSaveAsyncMock();
  });

  it('creates new layout with generated ID', async () => {
    const layout = createTestLayout('New Layout');
    const library = createTestLibrary([createTestEntry('existing', 'Existing')]);

    const result = await createLayoutEntry(layout, library);

    const value = expectOk(result);
    expect(value.layoutId).toBe('generated-id-123');
    expect(value.entry.id).toBe('generated-id-123');
  });

  it('adds entry to library', async () => {
    const layout = createTestLayout('New Layout');
    const library = createTestLibrary([createTestEntry('existing', 'Existing')]);

    const result = await createLayoutEntry(layout, library);

    const value = expectOk(result);
    expect(value.library.entries.length).toBe(2);
    expect(value.library.entries[1].name).toBe('New Layout');
  });

  it('sets createdAt and modifiedAt to current time', async () => {
    const layout = createTestLayout();
    const library = createTestLibrary([]);

    const before = Date.now();
    const result = await createLayoutEntry(layout, library);
    const after = Date.now();

    const value = expectOk(result);
    expect(value.entry.createdAt).toBeGreaterThanOrEqual(before);
    expect(value.entry.createdAt).toBeLessThanOrEqual(after);
    expect(value.entry.modifiedAt).toBeGreaterThanOrEqual(before);
    expect(value.entry.modifiedAt).toBeLessThanOrEqual(after);
  });

  it('uses author from options', async () => {
    const layout = createTestLayout();
    const library = createTestLibrary([]);

    const result = await createLayoutEntry(layout, library, { author: 'Test Author' });

    const value = expectOk(result);
    expect(value.entry.author).toBe('Test Author');
  });

  it('uses author from library settings as fallback', async () => {
    const layout = createTestLayout();
    const library = createTestLibrary([]);
    library.settings.authorName = 'Library Author';

    const result = await createLayoutEntry(layout, library);

    const value = expectOk(result);
    expect(value.entry.author).toBe('Library Author');
  });

  it('adds forkedFrom metadata when provided', async () => {
    const layout = createTestLayout();
    const library = createTestLibrary([]);

    const result = await createLayoutEntry(layout, library, {
      forkedFrom: { name: 'Original Layout', author: 'Original Author' },
    });

    const value = expectOk(result);
    expect(value.entry.forkedFrom).toEqual({
      name: 'Original Layout',
      author: 'Original Author',
    });
  });

  it('computes preview for new layout', async () => {
    const layout = createTestLayoutWithBins();
    const library = createTestLibrary([]);

    const result = await createLayoutEntry(layout, library);

    const value = expectOk(result);
    expect(value.entry.preview.binCount).toBe(3);
  });

  it('returns error when backend save fails', async () => {
    vi.mocked(backend.saveAsync).mockResolvedValueOnce(err(storageUnavailable('indexedDB')));

    const layout = createTestLayout();
    const library = createTestLibrary([]);

    const result = await createLayoutEntry(layout, library);

    expectErr(result);
  });

  it('returns error when library is at max capacity', async () => {
    const entries = Array.from({ length: CONSTRAINTS.LAYOUTS_MAX }, (_, i) =>
      createTestEntry(`layout-${i}`, `Layout ${i}`)
    );
    const library = createTestLibrary(entries);
    const layout = createTestLayout();

    const result = await createLayoutEntry(layout, library);

    expect(expectErr(result).code).toBe('LAYOUT_LIBRARY_LIMIT');
  });
});

// === deleteLayoutWithEntry Tests ===

describe('deleteLayoutWithEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSaveAsyncMock();
  });

  it('deletes layout and removes from library', async () => {
    const library = createTestLibrary([
      createTestEntry('layout-1', 'Layout 1'),
      createTestEntry('layout-2', 'Layout 2'),
    ]);

    const result = await deleteLayoutWithEntry('layout-2', library);

    const value = expectOk(result);
    expect(value.library.entries.length).toBe(1);
    expect(value.library.entries[0].id).toBe('layout-1');
  });

  it('returns newActiveId when deleting active layout', async () => {
    const library = createTestLibrary([
      createTestEntry('layout-1', 'Layout 1'),
      createTestEntry('layout-2', 'Layout 2'),
    ]);
    library.activeLayoutId = 'layout-1';

    const result = await deleteLayoutWithEntry('layout-1', library);

    const value = expectOk(result);
    expect(value.newActiveId).toBe('layout-2');
    expect(value.library.activeLayoutId).toBe('layout-2');
  });

  it('does not set newActiveId when deleting non-active layout', async () => {
    const library = createTestLibrary([
      createTestEntry('layout-1', 'Layout 1'),
      createTestEntry('layout-2', 'Layout 2'),
    ]);
    library.activeLayoutId = 'layout-1';

    const result = await deleteLayoutWithEntry('layout-2', library);

    const value = expectOk(result);
    expect(value.newActiveId).toBeUndefined();
    expect(value.library.activeLayoutId).toBe('layout-1');
  });

  it('returns error when trying to delete last layout', async () => {
    const library = createTestLibrary([createTestEntry('only-layout', 'Only Layout')]);

    const result = await deleteLayoutWithEntry('only-layout', library);

    expect(expectErr(result).code).toBe('STORAGE_CORRUPTED');
  });

  it('returns error for non-existent layout', async () => {
    const library = createTestLibrary([
      createTestEntry('layout-1', 'Layout 1'),
      createTestEntry('layout-2', 'Layout 2'),
    ]);

    const result = await deleteLayoutWithEntry('non-existent', library);

    expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
  });

  it('calls backend deleteAsync with correct key', async () => {
    const library = createTestLibrary([
      createTestEntry('layout-1', 'Layout 1'),
      createTestEntry('layout-2', 'Layout 2'),
    ]);

    await deleteLayoutWithEntry('layout-2', library);

    expect(backend.deleteAsync).toHaveBeenCalledWith('gridfinity-layout-layout-2');
  });

  it('does not delete blob when library save fails (leaves recoverable state)', async () => {
    const library = createTestLibrary([
      createTestEntry('layout-1', 'Layout 1'),
      createTestEntry('layout-2', 'Layout 2'),
    ]);
    vi.mocked(indexedDBBackend.saveLibraryIndex).mockRejectedValueOnce(new Error('Storage full'));

    const result = await deleteLayoutWithEntry('layout-2', library);

    expect(expectErr(result).code).toBeDefined();
    // Blob delete must not have been called — the user's data is still reachable.
    expect(backend.deleteAsync).not.toHaveBeenCalledWith('gridfinity-layout-layout-2');
  });

  it('returns ok with updated library when blob delete fails after library save succeeds', async () => {
    // Library has already been persisted, so the deletion is user-visible
    // regardless. The caller needs the updated library (and newActiveId if
    // the deleted layout was active) to keep in-memory state in sync with
    // storage; an orphan blob is harmless and gets reconciled on next load.
    const library = createTestLibrary([
      createTestEntry('layout-1', 'Layout 1'),
      createTestEntry('layout-2', 'Layout 2'),
    ]);
    library.activeLayoutId = 'layout-1';
    vi.mocked(backend.deleteAsync).mockRejectedValueOnce(new Error('Blob gone'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await deleteLayoutWithEntry('layout-1', library);

    const value = expectOk(result);
    expect(value.newActiveId).toBe('layout-2');
    expect(value.library.entries.map((e) => e.id)).toEqual(['layout-2']);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// === duplicateLayoutEntry Tests ===

describe('duplicateLayoutEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSaveAsyncMock();
    // Mock loadAsync to return a layout when called
    vi.mocked(backend.loadAsync).mockResolvedValue(createTestLayout('Source Layout'));
  });

  it('creates a copy with (copy) suffix', async () => {
    const library = createTestLibrary([createTestEntry('source-id', 'Source Layout')]);

    const result = await duplicateLayoutEntry('source-id', library);

    const value = expectOk(result);
    expect(value.entry.name).toBe('Source Layout (copy)');
    expect(value.layout.name).toBe('Source Layout (copy)');
  });

  it('adds duplicated entry to library', async () => {
    const library = createTestLibrary([createTestEntry('source-id', 'Source')]);

    const result = await duplicateLayoutEntry('source-id', library);

    const value = expectOk(result);
    expect(value.library.entries.length).toBe(2);
  });

  it('generates new ID for duplicated layout', async () => {
    const library = createTestLibrary([createTestEntry('source-id', 'Source')]);

    const result = await duplicateLayoutEntry('source-id', library);

    const value = expectOk(result);
    expect(value.layoutId).toBe('generated-id-123');
    expect(value.layoutId).not.toBe('source-id');
  });

  it('returns error for non-existent source', async () => {
    const library = createTestLibrary([createTestEntry('other-id', 'Other')]);

    const result = await duplicateLayoutEntry('non-existent', library);

    expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
  });

  it('returns error when source layout fails to load', async () => {
    vi.mocked(backend.loadAsync).mockResolvedValueOnce(null);
    const library = createTestLibrary([createTestEntry('source-id', 'Source')]);

    const result = await duplicateLayoutEntry('source-id', library);

    expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
  });

  it('returns error when library is at max capacity', async () => {
    const entries = Array.from({ length: CONSTRAINTS.LAYOUTS_MAX }, (_, i) =>
      createTestEntry(`layout-${i}`, `Layout ${i}`)
    );
    const library = createTestLibrary(entries);

    const result = await duplicateLayoutEntry('layout-0', library);

    expect(expectErr(result).code).toBe('LAYOUT_LIBRARY_LIMIT');
  });
});

// === switchActiveLayout Tests ===

describe('switchActiveLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSaveAsyncMock();
    // Mock loadAsync to return a target layout
    vi.mocked(backend.loadAsync).mockResolvedValue(createTestLayout('Target Layout'));
  });

  it('saves current layout before switching', async () => {
    const fromLayout = createTestLayout('From Layout');
    const library = createTestLibrary([
      createTestEntry('from-id', 'From'),
      createTestEntry('to-id', 'To'),
    ]);

    await switchActiveLayout('from-id', fromLayout, 'to-id', library);

    expect(backend.saveAsync).toHaveBeenCalledWith('gridfinity-layout-from-id', fromLayout);
  });

  it('loads target layout', async () => {
    const fromLayout = createTestLayout();
    const library = createTestLibrary([
      createTestEntry('from-id', 'From'),
      createTestEntry('to-id', 'To'),
    ]);

    const result = await switchActiveLayout('from-id', fromLayout, 'to-id', library);

    const value = expectOk(result);
    expect(value.targetLayout.name).toBe('Target Layout');
  });

  it('updates activeLayoutId in library', async () => {
    const fromLayout = createTestLayout();
    const library = createTestLibrary([
      createTestEntry('from-id', 'From'),
      createTestEntry('to-id', 'To'),
    ]);
    library.activeLayoutId = 'from-id';

    const result = await switchActiveLayout('from-id', fromLayout, 'to-id', library);

    const value = expectOk(result);
    expect(value.library.activeLayoutId).toBe('to-id');
  });

  it('returns target entry in result', async () => {
    const fromLayout = createTestLayout();
    const library = createTestLibrary([
      createTestEntry('from-id', 'From'),
      createTestEntry('to-id', 'Target Entry'),
    ]);

    const result = await switchActiveLayout('from-id', fromLayout, 'to-id', library);

    const value = expectOk(result);
    expect(value.targetEntry.name).toBe('Target Entry');
  });

  it('skips saving when fromId is __shared_preview__', async () => {
    const fromLayout = createTestLayout();
    const library = createTestLibrary([createTestEntry('to-id', 'To')]);

    await switchActiveLayout(SHARED_PREVIEW_ID, fromLayout, 'to-id', library);

    // saveAsync should only be called once (for loading target, not saving from)
    // Actually, saveAsync is for saving, loadAsync is for loading
    // So saveAsync should NOT have been called at all for the "from" layout
    const saveAsyncCalls = vi.mocked(backend.saveAsync).mock.calls;
    const savingFromId = saveAsyncCalls.some(
      (call) => call[0] === `gridfinity-layout-${SHARED_PREVIEW_ID}`
    );
    expect(savingFromId).toBe(false);
  });

  it('returns error for non-existent target', async () => {
    const fromLayout = createTestLayout();
    const library = createTestLibrary([createTestEntry('from-id', 'From')]);

    const result = await switchActiveLayout('from-id', fromLayout, 'non-existent', library);

    expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
  });

  it('returns error when target layout fails to load', async () => {
    vi.mocked(backend.loadAsync).mockResolvedValueOnce(null);
    const fromLayout = createTestLayout();
    const library = createTestLibrary([
      createTestEntry('from-id', 'From'),
      createTestEntry('to-id', 'To'),
    ]);

    const result = await switchActiveLayout('from-id', fromLayout, 'to-id', library);

    expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
  });

  it('returns error when saving current layout fails during switch', async () => {
    vi.mocked(backend.saveAsync).mockResolvedValueOnce(err(storageQuotaExceeded()));
    const fromLayout = createTestLayout();
    const library = createTestLibrary([
      createTestEntry('from-id', 'From'),
      createTestEntry('to-id', 'To'),
    ]);

    const result = await switchActiveLayout('from-id', fromLayout, 'to-id', library);

    expect(expectErr(result).code).toBe('STORAGE_QUOTA_EXCEEDED');
  });

  it('returns error when library save fails after loading target', async () => {
    // First saveLibraryIndex call (from saveLayoutWithMetadata) succeeds,
    // second call (switchActiveLayout's own library save) fails
    vi.mocked(indexedDBBackend.saveLibraryIndex)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Storage full'));
    const fromLayout = createTestLayout();
    const library = createTestLibrary([
      createTestEntry('from-id', 'From'),
      createTestEntry('to-id', 'To'),
    ]);

    const result = await switchActiveLayout('from-id', fromLayout, 'to-id', library);

    expectErr(result);
  });
});

// === updateCloudShare Tests ===

describe('updateCloudShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSaveAsyncMock();
  });

  it('sets cloud share info on entry', () => {
    const library = createTestLibrary([createTestEntry('layout-1', 'Layout 1')]);
    const cloudShare = {
      id: 'share-id',
      deleteToken: 'delete-token',
      sharedAt: Date.now(),
      permission: 'view' as const,
    };

    const result = updateCloudShare('layout-1', cloudShare, library);

    const value = expectOk(result);
    expect(value.entries[0].cloudShare).toEqual(cloudShare);
  });

  it('clears cloud share info when undefined', () => {
    const library = createTestLibrary([createTestEntry('layout-1', 'Layout 1')]);
    library.entries[0].cloudShare = {
      id: 'old-share',
      deleteToken: 'old-token',
      sharedAt: Date.now(),
      permission: 'view',
    };

    const result = updateCloudShare('layout-1', undefined, library);

    const value = expectOk(result);
    expect(value.entries[0].cloudShare).toBeUndefined();
  });

  it('returns error for non-existent layout', () => {
    const library = createTestLibrary([createTestEntry('other', 'Other')]);

    const result = updateCloudShare('non-existent', undefined, library);

    expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
  });

  it('saves library after update', () => {
    const library = createTestLibrary([createTestEntry('layout-1', 'Layout 1')]);

    updateCloudShare(
      'layout-1',
      { id: 'share', deleteToken: 'token', sharedAt: Date.now(), permission: 'view' },
      library
    );

    expect(indexedDBBackend.saveLibraryIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({ cloudShare: expect.any(Object) }),
        ]),
      })
    );
  });

  it('succeeds even when background library save would fail (fire-and-forget)', () => {
    vi.mocked(indexedDBBackend.saveLibraryIndex).mockRejectedValueOnce(new Error('Storage full'));
    const library = createTestLibrary([createTestEntry('layout-1', 'Layout 1')]);

    const result = updateCloudShare(
      'layout-1',
      { id: 'share', deleteToken: 'token', sharedAt: Date.now(), permission: 'view' },
      library
    );

    // Fire-and-forget: sync caller always returns ok
    expectOk(result);
  });
});

// === renameLayoutEntry Tests ===

describe('renameLayoutEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSaveAsyncMock();
  });

  it('renames layout entry', () => {
    const library = createTestLibrary([createTestEntry('layout-1', 'Old Name')]);

    const result = renameLayoutEntry('layout-1', 'New Name', library);

    const value = expectOk(result);
    expect(value.entries[0].name).toBe('New Name');
  });

  it('updates modifiedAt timestamp', () => {
    const library = createTestLibrary([createTestEntry('layout-1', 'Test')]);
    library.entries[0].modifiedAt = 1000;

    const before = Date.now();
    const result = renameLayoutEntry('layout-1', 'New Name', library);
    const after = Date.now();

    const value = expectOk(result);
    expect(value.entries[0].modifiedAt).toBeGreaterThanOrEqual(before);
    expect(value.entries[0].modifiedAt).toBeLessThanOrEqual(after);
  });

  it('truncates long names to max length', () => {
    const library = createTestLibrary([createTestEntry('layout-1', 'Test')]);
    const longName = 'A'.repeat(200); // Longer than CONSTRAINTS.NAME_MAX_LENGTH

    const result = renameLayoutEntry('layout-1', longName, library);

    const value = expectOk(result);
    expect(value.entries[0].name.length).toBeLessThanOrEqual(100);
  });

  it('returns error for non-existent layout', () => {
    const library = createTestLibrary([createTestEntry('other', 'Other')]);

    const result = renameLayoutEntry('non-existent', 'New Name', library);

    expect(expectErr(result).code).toBe('STORAGE_NOT_FOUND');
  });

  it('saves library after rename', () => {
    const library = createTestLibrary([createTestEntry('layout-1', 'Old')]);

    renameLayoutEntry('layout-1', 'New', library);

    expect(indexedDBBackend.saveLibraryIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: expect.arrayContaining([expect.objectContaining({ name: 'New' })]),
      })
    );
  });

  it('succeeds even when background library save would fail (fire-and-forget)', () => {
    vi.mocked(indexedDBBackend.saveLibraryIndex).mockRejectedValueOnce(new Error('Storage full'));
    const library = createTestLibrary([createTestEntry('layout-1', 'Old')]);

    const result = renameLayoutEntry('layout-1', 'New', library);

    // Fire-and-forget: sync caller always returns ok
    expectOk(result);
  });
});
