import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, ok } from '@/core/result';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import { binId, gridUnits, heightUnits, layerId, layoutId } from '@/core/types';
import type { Bin } from '@/core/types';
import type { Mutations } from '@/shared/contexts';
import { createTestLayout, resetAllStores } from '@/test/testUtils';
import { applyChange, prepareCalls } from './browserCalls';

const t = (key: string, vars?: Record<string, unknown>): string =>
  vars ? `${key} ${JSON.stringify(vars)}` : key;
const base = createTestLayout();
const pliers: Bin = {
  id: binId('a'),
  layerId: layerId('layer1'),
  x: gridUnits(0),
  y: gridUnits(0),
  width: gridUnits(2),
  depth: gridUnits(2),
  height: heightUnits(3),
  category: base.categories[0].id,
  label: 'Pliers',
  notes: '',
};
const addAt = (x: number) => ({
  summary: 'Add M3',
  ops: [
    { op: 'addBin', ref: 'm3', layer: { id: 'layer1' }, x, y: 0, width: 1, depth: 1, height: 3 },
  ],
});

beforeEach(() => {
  resetAllStores();
  const layout = createTestLayout({ name: 'Desk', bins: [pliers] });
  useLayoutStore.setState({ layout, activeLayoutId: layoutId('desk') });
  useLibraryStore.setState({
    library: {
      ...useLibraryStore.getState().library,
      activeLayoutId: layoutId('desk'),
      entries: [
        {
          id: layoutId('desk'),
          name: 'Desk',
          createdAt: 1,
          modifiedAt: 2,
          preview: {
            drawerWidth: layout.drawer.width,
            drawerDepth: layout.drawer.depth,
            drawerHeight: layout.drawer.height,
            binCount: 1,
            layerCount: 1,
            binMap: [],
          },
        },
      ],
    },
  });
});

describe('prepareCalls', () => {
  it('reads the open layout from the editor, with the text that the model reads', async () => {
    const [read] = await prepareCalls([{ id: 'r', name: 'read_my_layout', input: {} }], t);
    expect(read).toMatchObject({
      id: 'r',
      unavailable: false,
      title: 'askAi.read.layout {"name":"Desk"}',
    });
    expect(read?.preview).toContain('"Pliers" (id "a")');
  });

  it('marks a change for the reader to decide, and sends one that the app refused at once', async () => {
    const [ready, refused, unknown] = await prepareCalls(
      [
        { id: 'c1', name: 'propose_changes', input: addAt(3) },
        { id: 'c2', name: 'propose_changes', input: addAt(0) },
        { id: 'x', name: 'delete_everything', input: {} },
      ],
      t
    );
    expect(ready).toMatchObject({ kind: 'change', title: 'Add M3', unavailable: false });
    expect(ready?.settled).toBeUndefined();
    expect(refused?.settled).toMatchObject({ outcome: 'refused', change: 1 });
    expect(unknown).toMatchObject({ unavailable: true });
  });
});

describe('applyChange', () => {
  it('runs the set again on the layout as it is now, then applies it as one command', async () => {
    const [call] = await prepareCalls([{ id: 'c', name: 'propose_changes', input: addAt(3) }], t);
    if (!call) throw new Error('no call');
    const applyChangeSet = vi.fn(() => ok({ refs: { m3: 'bin-9' } }));
    const mutations = { applyChangeSet } as unknown as Mutations;
    expect(await applyChange(call, mutations)).toEqual({
      outcome: 'applied',
      added: { m3: 'bin-9' },
    });
    expect(applyChangeSet).toHaveBeenCalledWith(
      expect.objectContaining({ layoutId: 'desk', summary: 'Add M3' })
    );

    // A bin drawn on that spot after the preview: the set no longer fits.
    useLayoutStore.setState({
      layout: {
        ...useLayoutStore.getState().layout,
        bins: [
          pliers,
          { ...pliers, id: binId('b'), x: gridUnits(3), width: gridUnits(1), depth: gridUnits(1) },
        ],
      },
    });
    applyChangeSet.mockClear();
    expect(await applyChange(call, mutations)).toMatchObject({ outcome: 'refused', change: 1 });
    expect(applyChangeSet).not.toHaveBeenCalled();
  });

  it('reports what the command refused', async () => {
    const [call] = await prepareCalls([{ id: 'c', name: 'propose_changes', input: addAt(3) }], t);
    if (!call) throw new Error('no call');
    const mutations = {
      applyChangeSet: () =>
        err({
          type: 'LayoutError',
          code: 'LAYOUT_INVALID_OPERATION',
          operation: 'x',
          reason: 'No.',
        }),
    } as unknown as Mutations;
    expect(await applyChange(call, mutations)).toMatchObject({ outcome: 'refused', change: null });
  });
});
