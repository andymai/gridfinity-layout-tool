import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Layout, LayoutEntry, LayoutId, LayoutLibrary } from '@/core/types';
import { binId, heightUnits, layerId, layoutId } from '@/core/types';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import type * as Storage from '@/core/storage';

const loadLayoutAsyncMock = vi.fn();
vi.mock('@/core/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof Storage>()),
  loadLayoutAsync: (id: string) => loadLayoutAsyncMock(id),
}));

import { __resetForTests, reconcileFindIndex, recordsForLayout } from './findIndex';

function layoutWith(label: string): Layout {
  const layout = createTestLayout({
    layers: [{ id: layerId('layer-1'), name: 'Top drawer', height: heightUnits(3) }],
  });
  layout.bins = [
    createTestBin({ id: binId('b1'), layerId: layerId('layer-1'), label }),
    createTestBin({ id: binId('empty'), layerId: layerId('layer-1'), label: '' }),
  ];
  return layout;
}

/** One object per id and stamp, as the library keeps an entry nothing wrote. */
let entryObjects = new Map<string, LayoutEntry>();

function entry(id: string, modifiedAt: number): LayoutEntry {
  const key = `${id}@${modifiedAt}`;
  const existing = entryObjects.get(key);
  if (existing) return existing;
  const created = {
    id: layoutId(id),
    name: id,
    modifiedAt,
    createdAt: 1,
  } as unknown as LayoutEntry;
  entryObjects.set(key, created);
  return created;
}

function library(entries: Array<[string, number] | LayoutEntry>): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: layoutId('active'),
    settings: {},
    entries: entries.map((e) => (Array.isArray(e) ? entry(e[0], e[1]) : e)),
  };
}

const labels = (records: Awaited<ReturnType<typeof reconcileFindIndex>>): string[] =>
  records.map((r) => r.label).sort();

describe('findIndex', () => {
  beforeEach(() => {
    __resetForTests();
    loadLayoutAsyncMock.mockReset();
    entryObjects = new Map();
  });

  it('indexes bins that have something to find, with their layer name', () => {
    const [only, ...rest] = recordsForLayout(layoutId('a'), layoutWith('Screws'));
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ binId: 'b1', layerName: 'Top drawer', label: 'Screws' });
  });

  it('reads each stored layout once until its modifiedAt changes', async () => {
    loadLayoutAsyncMock.mockImplementation((id: LayoutId) => Promise.resolve(layoutWith(id)));
    expect(
      labels(
        await reconcileFindIndex(
          library([
            ['a', 1],
            ['b', 1],
          ]),
          null
        )
      )
    ).toEqual(['a', 'b']);
    expect(loadLayoutAsyncMock).toHaveBeenCalledTimes(2);

    await reconcileFindIndex(
      library([
        ['a', 1],
        ['b', 1],
      ]),
      null
    );
    expect(loadLayoutAsyncMock).toHaveBeenCalledTimes(2);

    await reconcileFindIndex(
      library([
        ['a', 2],
        ['b', 1],
      ]),
      null
    );
    expect(loadLayoutAsyncMock).toHaveBeenCalledTimes(3);
    expect(loadLayoutAsyncMock).toHaveBeenLastCalledWith('a');
  });

  it('reads a layout again when a write replaced its entry but kept the stamp', async () => {
    loadLayoutAsyncMock.mockResolvedValueOnce(layoutWith('before'));
    expect(labels(await reconcileFindIndex(library([['a', 1]]), null))).toEqual(['before']);

    // A sync pull whose envelope carries the local stamp writes a new entry.
    loadLayoutAsyncMock.mockResolvedValueOnce(layoutWith('pulled'));
    const rewritten = { ...entry('a', 1) };
    expect(labels(await reconcileFindIndex(library([rewritten]), null))).toEqual(['pulled']);
  });

  it('applies overlapping reconciles in order, so a slow older read never wins', async () => {
    let releaseOld: (layout: Layout) => void = () => {};
    loadLayoutAsyncMock
      .mockImplementationOnce(
        () =>
          new Promise<Layout>((resolve) => {
            releaseOld = resolve;
          })
      )
      .mockImplementationOnce(() => Promise.resolve(layoutWith('new')));
    const older = reconcileFindIndex(library([['a', 1]]), null);
    const newer = reconcileFindIndex(library([['a', 2]]), null);
    await vi.waitFor(() => expect(loadLayoutAsyncMock).toHaveBeenCalledTimes(1));
    releaseOld(layoutWith('old'));
    await older;
    expect(labels(await newer)).toEqual(['new']);
    expect(labels(await reconcileFindIndex(library([['a', 2]]), null))).toEqual(['new']);
  });

  it('leaves out the active layout and drops a removed one', async () => {
    loadLayoutAsyncMock.mockImplementation((id: LayoutId) => Promise.resolve(layoutWith(id)));
    await reconcileFindIndex(
      library([
        ['a', 1],
        ['b', 1],
      ]),
      null
    );
    expect(labels(await reconcileFindIndex(library([['a', 1]]), null))).toEqual(['a']);
    expect(
      labels(
        await reconcileFindIndex(
          library([
            ['a', 1],
            ['active', 1],
          ]),
          layoutId('active')
        )
      )
    ).toEqual(['a']);
  });
});
