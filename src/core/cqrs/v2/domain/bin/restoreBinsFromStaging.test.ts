import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin, BinId, Layout } from '@/core/types';
import { restoreBinsFromStaging } from './restoreBinsFromStaging';
import { updateBin } from './updateBin';
import { makeLayout, makeBin } from './_testHelpers';

const L1 = layerId('layer_1');
const L2 = layerId('layer_2');

function restore(layout: Layout, ids: readonly string[], target: string = 'layer_1'): Layout {
  const result = restoreBinsFromStaging.handle({ ids, layerId: target }, { aggregate: layout });
  if (!isOk(result)) throw new Error('handle failed');
  return produce(layout, (draft) => {
    restoreBinsFromStaging.apply(
      { type: 'bin.restoredFromStaging', payload: result.value.event.payload },
      draft
    );
  });
}

function restoredIds(layout: Layout, ids: readonly string[], target: string): BinId[] {
  const result = restoreBinsFromStaging.handle({ ids, layerId: target }, { aggregate: layout });
  if (!isOk(result)) throw new Error('handle failed');
  return result.value.event.payload.moves.map((m) => m.id);
}

/** The per-bin `bin.update` loop the command replaces. */
function updateLoopIds(layout: Layout, ids: readonly string[], target: string): BinId[] {
  let current = layout;
  const moved: BinId[] = [];
  for (const id of ids) {
    const result = updateBin.handle({ id, updates: { layerId: target } }, { aggregate: current });
    if (!isOk(result)) break;
    current = produce(current, (draft) => {
      updateBin.apply({ type: 'bin.updated', payload: result.value.event.payload }, draft);
    });
    moved.push(binId(id));
  }
  return moved;
}

function staged(id: string, x: number, y: number, overrides: Partial<Bin> = {}): Bin {
  return makeBin(id, { layerId: STAGING_ID, x: gridUnits(x), y: gridUnits(y), ...overrides });
}

function placement(layout: Layout, id: string) {
  const bin = layout.bins.find((b) => b.id === binId(id));
  return bin && { layerId: bin.layerId, x: bin.x, y: bin.y };
}

describe('v2 bin.restoreFromStaging', () => {
  it('returns the listed staged bins to the layer at their own x and y', () => {
    const layout = makeLayout({
      bins: [
        staged('a', 2, 1),
        staged('b', 4, 3),
        staged('left', 0, 0),
        makeBin('placed', { x: gridUnits(5), y: gridUnits(0) }),
      ],
    });

    const next = restore(layout, ['a', 'b', 'placed', 'missing']);

    expect(placement(next, 'a')).toEqual({ layerId: L1, x: 2, y: 1 });
    expect(placement(next, 'b')).toEqual({ layerId: L1, x: 4, y: 3 });
    expect(placement(next, 'left')).toEqual({ layerId: STAGING_ID, x: 0, y: 0 });
    expect(placement(next, 'placed')).toEqual({ layerId: L1, x: 5, y: 0 });
  });

  it('drops an explicit overhang and records it, as bin.update does on a layer change', () => {
    const overhang = { left: 0, right: 4, front: 0, back: 0 };
    const layout = makeLayout({ bins: [staged('a', 0, 0, { overhang }), staged('b', 2, 0)] });

    const result = restoreBinsFromStaging.handle(
      { ids: ['a', 'b'], layerId: 'layer_1' },
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.moves).toEqual([
      { id: binId('a'), previousOverhang: overhang },
      { id: binId('b') },
    ]);
    expect(restore(layout, ['a', 'b']).bins[0].overhang).toBeUndefined();
  });

  it('stops at the first bin that collides, keeping the ones before it', () => {
    const layout = makeLayout({
      bins: [
        makeBin('occupant', { x: gridUnits(3), y: gridUnits(0) }),
        staged('a', 0, 0),
        staged('blocked', 3, 0),
        staged('after', 5, 0),
      ],
    });

    expect(restoredIds(layout, ['a', 'blocked', 'after'], 'layer_1')).toEqual([binId('a')]);
  });

  it('returns how many bins it restored', () => {
    const layout = makeLayout({
      bins: [
        makeBin('occupant', { x: gridUnits(3), y: gridUnits(0) }),
        staged('a', 0, 0),
        staged('b', 1, 0),
        staged('blocked', 3, 0),
        staged('after', 5, 0),
      ],
    });

    const result = restoreBinsFromStaging.handle(
      { ids: ['a', 'b', 'blocked', 'after'], layerId: 'layer_1' },
      { aggregate: layout }
    );

    expect(isOk(result) && result.value.value).toBe(2);
  });

  it('checks each bin against the bins returned before it', () => {
    const layout = makeLayout({
      bins: [
        staged('a', 0, 0, { width: gridUnits(2) }),
        staged('overlaps-a', 1, 0),
        staged('after', 4, 0),
      ],
    });

    expect(restoredIds(layout, ['a', 'overlaps-a', 'after'], 'layer_1')).toEqual([binId('a')]);
  });

  it('stops at the bin that would lift a stack past the drawer', () => {
    const layout = makeLayout({
      drawer: { width: gridUnits(6), depth: gridUnits(4), height: heightUnits(7) },
      layers: [
        { id: L1, name: 'L1', height: heightUnits(3) },
        { id: L2, name: 'L2', height: heightUnits(3) },
      ],
      bins: [
        makeBin('top', { layerId: L2, x: gridUnits(2), y: gridUnits(0), height: heightUnits(4) }),
        staged('a', 0, 0),
        staged('under-top', 2, 0, { height: heightUnits(4) }),
        staged('after', 4, 0),
      ],
    });

    expect(restoredIds(layout, ['a', 'under-top', 'after'], 'layer_1')).toEqual([binId('a')]);
  });

  it('stops where a bin above would rest on clearance, though a later bin would hold it up', () => {
    const layout = makeLayout({
      layers: [
        { id: L1, name: 'L1', height: heightUnits(3) },
        { id: L2, name: 'L2', height: heightUnits(3) },
      ],
      bins: [
        makeBin('above', { layerId: L2, width: gridUnits(2) }),
        staged('with-clearance', 0, 0, {
          height: heightUnits(2),
          clearanceHeight: heightUnits(2),
        }),
        staged('solid', 1, 0, { height: heightUnits(4) }),
      ],
    });
    const ids = ['with-clearance', 'solid'];

    expect(updateLoopIds(layout, ids, 'layer_1')).toEqual([]);
    expect(restoredIds(layout, ids, 'layer_1')).toEqual([]);
  });

  it("stops at a bin on a slanted bin's end support", () => {
    const layout = makeLayout({
      bins: [
        makeBin('slanted', { slant: { angleDeg: 40, side: 'back', endSupport: true } }),
        staged('a', 3, 0),
        staged('on-support', 0, 1),
      ],
    });
    const ids = ['a', 'on-support'];

    expect(updateLoopIds(layout, ids, 'layer_1')).toEqual([binId('a')]);
    expect(restoredIds(layout, ids, 'layer_1')).toEqual([binId('a')]);
  });

  it('rejects a layer that does not exist', () => {
    const layout = makeLayout({ bins: [staged('a', 0, 0)] });
    const result = restoreBinsFromStaging.handle(
      { ids: ['a'], layerId: 'layer_gone' },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
  });

  it('apply() leaves the layout untouched when nothing moves', () => {
    const layout = makeLayout({ bins: [staged('a', 0, 0)] });
    const applied = produce(layout, (draft) => {
      restoreBinsFromStaging.apply(
        { type: 'bin.restoredFromStaging', payload: { layerId: L1, moves: [] } },
        draft
      );
    });
    expect(applied).toBe(layout);
  });

  it('restores what a loop of bin.update restores, with and without clearance', () => {
    let seed = 7;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = (n: number): number => Math.floor(random() * n);

    for (let run = 0; run < 300; run++) {
      const layers = [
        { id: L1, name: 'L1', height: heightUnits(3) },
        { id: L2, name: 'L2', height: heightUnits(3) },
      ];
      const withClearance = run % 2 === 1;
      const placedCount = pick(6);
      const bins: Bin[] = [];
      for (let i = 0; i < placedCount + 1 + pick(6); i++) {
        bins.push(
          makeBin(`b${i}`, {
            layerId: i >= placedCount ? STAGING_ID : layers[pick(2)].id,
            x: gridUnits(pick(12) * 0.5 + pick(3)),
            y: gridUnits(pick(5)),
            width: gridUnits(1 + pick(2) * 0.5),
            depth: gridUnits(1 + pick(2)),
            height: heightUnits(2 + pick(4)),
            clearanceHeight: withClearance && pick(3) === 0 ? heightUnits(1 + pick(2)) : undefined,
          })
        );
      }
      const layout = makeLayout({
        drawer: { width: gridUnits(8), depth: gridUnits(6), height: heightUnits(4 + pick(6)) },
        layers,
        bins,
      });
      const ids = bins.filter((b) => b.layerId === STAGING_ID).map((b) => b.id);
      const target = layers[pick(2)].id;

      expect(restoredIds(layout, ids, target), `run ${run}`).toEqual(
        updateLoopIds(layout, ids, target)
      );
    }
  });
});
