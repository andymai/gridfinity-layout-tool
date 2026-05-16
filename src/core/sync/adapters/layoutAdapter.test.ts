/**
 * Focused tests for the layoutAdapter's read paths and the change-event
 * suppression on `applyRemote`. Engine-level integration coverage of the
 * full apply-remote flow (UI re-render, library entry upsert) lives in
 * PR 4b's engine tests, where the integration is meaningful.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLibraryStore } from '@/core/store';
import type { LayoutEntry, LayoutId, LayoutLibrary } from '@/core/types';

const loadLayoutAsyncMock = vi.fn();
const saveLayoutAsyncMock = vi.fn();
const saveLibraryMock = vi.fn();
const loadLayoutSyncMock = vi.fn();

vi.mock('@/core/storage', () => ({
  loadLayoutAsync: (id: string) => loadLayoutAsyncMock(id),
  saveLayoutAsync: (id: string, layout: unknown) => saveLayoutAsyncMock(id, layout),
  saveLibrary: (lib: unknown) => saveLibraryMock(lib),
  loadLayoutSync: (id: string) => loadLayoutSyncMock(id),
}));

import { layoutAdapter, normalizeIncomingLayout } from './layoutAdapter';
import type { Bin, Layout } from '@/core/types';
import type { AdapterChange } from './types';

const minimalLayout = (name: string): { name: string } => ({ name });

function setLibrary(entries: LayoutEntry[]): void {
  const library: LayoutLibrary = {
    version: '1.0',
    activeLayoutId: entries[0]?.id ?? (null as unknown as LayoutId),
    settings: {},
    entries,
  };
  useLibraryStore.setState({ library });
}

function entry(id: string, modifiedAt: number, name = 'L'): LayoutEntry {
  return {
    id: id as unknown as LayoutId,
    name,
    createdAt: modifiedAt,
    modifiedAt,
  } as LayoutEntry;
}

beforeEach(() => {
  vi.clearAllMocks();
  setLibrary([entry('lay-1', 1000)]);
});

describe('layoutAdapter.list', () => {
  it('returns one SyncableItem per library entry, with payload from storage', async () => {
    setLibrary([entry('a', 100), entry('b', 200)]);
    loadLayoutAsyncMock.mockImplementation(async (id) => minimalLayout(id));

    const items = await layoutAdapter.list();
    expect(items.map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(items.find((i) => i.id === 'a')?.modifiedAt).toBe(100);
    expect(items.find((i) => i.id === 'b')?.modifiedAt).toBe(200);
  });

  it('skips entries whose payload is missing from storage', async () => {
    setLibrary([entry('present', 100), entry('orphan', 200)]);
    loadLayoutAsyncMock.mockImplementation(async (id) =>
      id === 'present' ? minimalLayout(id) : null
    );

    const items = await layoutAdapter.list();
    expect(items.map((i) => i.id)).toEqual(['present']);
  });
});

describe('layoutAdapter.get', () => {
  it('returns null when the entry is absent', async () => {
    expect(await layoutAdapter.get('not-here')).toBe(null);
  });

  it('returns null when storage lacks the payload', async () => {
    loadLayoutAsyncMock.mockResolvedValueOnce(null);
    expect(await layoutAdapter.get('lay-1')).toBe(null);
  });

  it('returns id + modifiedAt + payload on success', async () => {
    loadLayoutAsyncMock.mockResolvedValueOnce(minimalLayout('lay-1'));
    const item = await layoutAdapter.get('lay-1');
    expect(item?.id).toBe('lay-1');
    expect(item?.modifiedAt).toBe(1000);
  });
});

describe('layoutAdapter.subscribe', () => {
  it('emits a put change when an entry is added to the library', () => {
    const events: AdapterChange[] = [];
    const unsubscribe = layoutAdapter.subscribe((c) => events.push(c));

    setLibrary([entry('lay-1', 1000), entry('lay-2', 2000)]);

    expect(events).toEqual([{ kind: 'put', id: 'lay-2', modifiedAt: 2000 }]);
    unsubscribe();
  });

  it('emits a put change when modifiedAt changes', () => {
    const events: AdapterChange[] = [];
    const unsubscribe = layoutAdapter.subscribe((c) => events.push(c));

    setLibrary([entry('lay-1', 5000)]);

    expect(events).toEqual([{ kind: 'put', id: 'lay-1', modifiedAt: 5000 }]);
    unsubscribe();
  });

  it('emits a delete change when an entry vanishes', () => {
    const events: AdapterChange[] = [];
    const unsubscribe = layoutAdapter.subscribe((c) => events.push(c));

    setLibrary([]);

    expect(events).toEqual([expect.objectContaining({ kind: 'delete', id: 'lay-1' })]);
    unsubscribe();
  });

  it('does not emit when modifiedAt is unchanged (no-op store updates)', () => {
    const events: AdapterChange[] = [];
    const unsubscribe = layoutAdapter.subscribe((c) => events.push(c));

    // Same content; Zustand notifies subscribers even on identity changes.
    setLibrary([entry('lay-1', 1000)]);

    expect(events).toEqual([]);
    unsubscribe();
  });

  it('unsubscribe stops emitting further changes', () => {
    const events: AdapterChange[] = [];
    const unsubscribe = layoutAdapter.subscribe((c) => events.push(c));
    unsubscribe();

    setLibrary([entry('lay-1', 9999)]);
    expect(events).toEqual([]);
  });
});

/**
 * `normalizeIncomingLayout` heals legacy cloud blobs whose bins were
 * written before `api/lib/validation.ts` started emitting `notes`/`label`
 * as required strings. Without this, the 3D view crashes on `bin.notes.trim()`
 * when the user switches to a synced layout from before the contract fix.
 */
describe('normalizeIncomingLayout', () => {
  function binFixture(overrides: Partial<Bin> = {}): Bin {
    return {
      id: 'b1' as Bin['id'],
      layerId: 'lay-1' as Bin['layerId'],
      x: 0 as Bin['x'],
      y: 0 as Bin['y'],
      width: 1 as Bin['width'],
      depth: 1 as Bin['depth'],
      height: 1 as Bin['height'],
      category: 'cat-1' as Bin['category'],
      label: '',
      notes: '',
      ...overrides,
    };
  }
  function layoutWith(bins: Bin[]): Layout {
    return { bins } as unknown as Layout;
  }

  it('defaults missing notes and label to empty string', () => {
    // Cast through unknown to simulate the cloud blob shape that predates
    // the validator contract — `notes`/`label` literally absent from JSON.
    const legacyBin = binFixture();
    delete (legacyBin as unknown as { notes?: string }).notes;
    delete (legacyBin as unknown as { label?: string }).label;

    const out = normalizeIncomingLayout(layoutWith([legacyBin]));
    expect(out.bins[0].notes).toBe('');
    expect(out.bins[0].label).toBe('');
  });

  it('preserves existing notes and label without copying', () => {
    const layout = layoutWith([binFixture({ notes: 'hi', label: 'screws' })]);
    const out = normalizeIncomingLayout(layout);
    // Reference equality: no allocation when every bin is already valid.
    // Without this, every poll cycle would rewrite the bin array and
    // churn downstream selectors using shallow equality.
    expect(out).toBe(layout);
  });

  it('preserves other bin fields', () => {
    const bin = binFixture({
      x: 5 as Bin['x'],
      y: 7 as Bin['y'],
      category: 'tools' as Bin['category'],
    });
    delete (bin as unknown as { notes?: string }).notes;
    const out = normalizeIncomingLayout(layoutWith([bin]));
    expect(out.bins[0].x).toBe(5);
    expect(out.bins[0].y).toBe(7);
    expect(out.bins[0].category).toBe('tools');
  });
});
