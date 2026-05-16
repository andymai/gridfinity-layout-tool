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

describe('normalizeIncomingLayout', () => {
  function bin(overrides: Partial<Bin> & { notes?: unknown; label?: unknown } = {}): Bin {
    return {
      id: 'b1',
      layerId: 'lay-1',
      x: 0,
      y: 0,
      width: 1,
      depth: 1,
      height: 1,
      category: 'cat-1',
      label: '',
      notes: '',
      ...overrides,
    } as Bin;
  }
  const layoutWith = (bins: Bin[]): Layout => ({ bins }) as unknown as Layout;

  it('defaults missing notes and label to empty string', () => {
    const out = normalizeIncomingLayout(layoutWith([bin({ notes: undefined, label: undefined })]));
    expect(out.bins[0].notes).toBe('');
    expect(out.bins[0].label).toBe('');
  });

  it('returns the same reference when every bin is already valid', () => {
    // Reference equality matters: without it every poll cycle reallocates
    // the bin array and churns downstream shallow-equality selectors.
    const layout = layoutWith([bin({ notes: 'hi', label: 'screws' })]);
    expect(normalizeIncomingLayout(layout)).toBe(layout);
  });

  it('preserves other bin fields when healing', () => {
    const out = normalizeIncomingLayout(
      layoutWith([bin({ x: 5, y: 7, category: 'tools', notes: undefined })])
    );
    expect(out.bins[0]).toMatchObject({ x: 5, y: 7, category: 'tools', notes: '' });
  });
});
