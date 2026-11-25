import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin, Layout } from '@/core/types';
import { createTestLayout } from '@/test/testUtils';
import { produce } from 'immer';
import { applyChangeSetEvents, simulateChangeSet } from './simulate';
import type { ChangeOp, ChangeSet } from './schema';
import { layoutRevision } from './revision';

const bin = (id: string, x: number, y: number, extra: Partial<Bin> = {}): Bin => ({
  id: binId(id),
  layerId: layerId('layer1'),
  x: gridUnits(x),
  y: gridUnits(y),
  width: gridUnits(2),
  depth: gridUnits(2),
  height: heightUnits(3),
  category: createTestLayout().categories[0].id,
  label: id,
  notes: '',
  ...extra,
});

const layout: Layout = createTestLayout({ bins: [bin('a', 0, 0), bin('b', 2, 0)] });

const set = (ops: ChangeOp[]): ChangeSet => ({
  v: 1,
  layoutId: 'layout-1',
  baseRev: layoutRevision(layout),
  summary: 'Test',
  ops,
});

describe('simulateChangeSet', () => {
  it('runs every op on a copy and leaves the input alone', () => {
    const result = simulateChangeSet(
      layout,
      set([
        { op: 'addCategory', ref: 'tools', name: 'Tools' },
        {
          op: 'addBin',
          ref: 'pliers',
          layer: { id: 'layer1' },
          x: 4,
          y: 0,
          width: 2,
          depth: 3,
          height: 4,
          label: 'Pliers',
          category: { ref: 'tools' },
          items: ['Needle-nose'],
        },
        { op: 'updateBin', bin: { id: 'a' }, set: { label: 'Screws', height: 4 } },
        { op: 'stashBin', bin: { id: 'b' } },
      ])
    );
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const { layout: after, events, refs } = result.value;
    expect(events.map((e) => e.type)).toEqual([
      'category.added',
      'bin.added',
      'bin.updated',
      'bin.movedToStaging',
    ]);
    const pliers = after.bins.find((b) => b.id === refs.pliers);
    expect(pliers).toMatchObject({ label: 'Pliers', category: refs.tools, width: 2, depth: 3 });
    expect(pliers?.items?.map((i) => i.name)).toEqual(['Needle-nose']);
    expect(after.bins.find((b) => b.id === 'a')).toMatchObject({ label: 'Screws', height: 4 });
    expect(after.bins.find((b) => b.id === 'b')?.layerId).toBe(STAGING_ID);
    expect(layout.bins).toHaveLength(2);
    expect(layout.bins[0].label).toBe('a');
  });

  it('replays to the same layout from its events alone', () => {
    const result = simulateChangeSet(
      layout,
      set([
        { op: 'addLayer', ref: 'top' },
        { op: 'addBin', layer: { ref: 'top' }, x: 0, y: 0, width: 2, depth: 2, height: 3 },
        { op: 'moveBin', bin: { id: 'b' }, layer: { id: 'layer1' }, x: 4, y: 4 },
        { op: 'deleteBin', bin: { id: 'a' } },
      ])
    );
    if (!isOk(result)) throw new Error(JSON.stringify(result.error));
    const replayed = produce(layout, (draft) => applyChangeSetEvents(draft, result.value.events));
    expect(replayed).toEqual(result.value.layout);
  });

  it('brings a stashed bin back with a move', () => {
    const stashed = createTestLayout({ bins: [bin('s', 0, 0, { layerId: layerId(STAGING_ID) })] });
    const result = simulateChangeSet(stashed, {
      ...set([{ op: 'moveBin', bin: { id: 's' }, layer: { id: 'layer1' }, x: 1, y: 1 }]),
      baseRev: layoutRevision(stashed),
    });
    if (!isOk(result)) throw new Error(JSON.stringify(result.error));
    expect(result.value.events[0].type).toBe('bin.movedFromStaging');
    expect(result.value.layout.bins[0]).toMatchObject({ layerId: 'layer1', x: 1, y: 1 });
  });

  it('stops at the first op that a real edit would refuse, and names it', () => {
    const result = simulateChangeSet(
      layout,
      set([
        { op: 'updateBin', bin: { id: 'a' }, set: { label: 'Fine' } },
        { op: 'addBin', layer: { id: 'layer1' }, x: 1, y: 0, width: 2, depth: 2, height: 3 },
      ])
    );
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error).toMatchObject({ opIndex: 1, op: 'addBin' });
    expect(result.error.reason.length).toBeGreaterThan(0);
  });

  it('refuses refs that are unknown, of the wrong kind or used twice', () => {
    const cases: ChangeOp[][] = [
      [{ op: 'deleteBin', bin: { ref: 'ghost' } }],
      [
        { op: 'addLayer', ref: 'x' },
        { op: 'deleteBin', bin: { ref: 'x' } },
      ],
      [
        { op: 'addLayer', ref: 'x' },
        { op: 'addCategory', ref: 'x', name: 'Again' },
      ],
      [{ op: 'deleteBin', bin: { id: 'missing' } }],
    ];
    for (const ops of cases) {
      const result = simulateChangeSet(layout, set(ops));
      expect(isErr(result), JSON.stringify(ops)).toBe(true);
    }
  });

  it('applies the bus schema, as a dispatched command would', () => {
    const result = simulateChangeSet(
      layout,
      set([{ op: 'addBin', layer: { id: 'layer1' }, x: 6, y: 6, width: -1, depth: 2, height: 3 }])
    );
    expect(isErr(result)).toBe(true);
  });
});

describe('layoutRevision', () => {
  it('changes with an edit and ignores key order', () => {
    const reordered: Layout = {
      ...layout,
      bins: layout.bins.map((b) => Object.fromEntries(Object.entries(b).reverse()) as Bin),
    };
    expect(layoutRevision(reordered)).toBe(layoutRevision(layout));
    const edited = { ...layout, bins: [{ ...layout.bins[0], label: 'changed' }, layout.bins[1]] };
    expect(layoutRevision(edited)).not.toBe(layoutRevision(layout));
    expect(layoutRevision(layout)).toMatch(/^[0-9a-f]{16}$/);
    expect(layoutRevision({ ...layout, name: 'Renamed' })).toBe(layoutRevision(layout));
    expect(layoutRevision({ ...layout, gridUnitMm: 40 as Layout['gridUnitMm'] })).not.toBe(
      layoutRevision(layout)
    );
  });
});
