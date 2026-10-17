import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import type { Bin } from '@/core/types';
import { binId, categoryId, gridUnits, heightUnits, layerId } from '@/core/types';
import { reorderLayers } from './reorderLayers';
import { makeLayout, makeLayer } from './_testHelpers';

describe('v2 layer.reorder', () => {
  it('emits a reorder event for valid indices', () => {
    const layout = makeLayout({
      layers: [makeLayer('a'), makeLayer('b'), makeLayer('c')],
    });
    const result = reorderLayers.handle({ fromIndex: 0, toIndex: 2 }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload).toEqual({ fromIndex: 0, toIndex: 2 });
  });

  it('errors when the new order stacks bins past the drawer top', () => {
    // B spans A and C, which do not overlap. On top, B rests on the taller of
    // them (5u total); moved between them, C lands on B: 3 + 2 + 3 = 8u > 7u.
    const bin = (id: string, layer: string, x: number, width: number, height: number): Bin => ({
      id: binId(id),
      layerId: layerId(layer),
      x: gridUnits(x),
      y: gridUnits(0),
      width: gridUnits(width),
      depth: gridUnits(1),
      height: heightUnits(height),
      category: categoryId('cat_1'),
      label: '',
      notes: '',
    });
    const layout = makeLayout({
      layers: [makeLayer('a'), makeLayer('c'), makeLayer('b')],
      bins: [bin('A', 'a', 0, 1, 3), bin('C', 'c', 2, 1, 3), bin('B', 'b', 0, 3, 2)],
    });

    const result = reorderLayers.handle({ fromIndex: 2, toIndex: 1 }, { aggregate: layout });
    expect(result.ok).toBe(false);
    expect(reorderLayers.handle({ fromIndex: 0, toIndex: 1 }, { aggregate: layout }).ok).toBe(true);
  });

  it('errors on out-of-range source index', () => {
    const layout = makeLayout({ layers: [makeLayer('a'), makeLayer('b')] });
    const result = reorderLayers.handle({ fromIndex: 99, toIndex: 0 }, { aggregate: layout });
    expect(result.ok).toBe(false);
  });

  it('errors on out-of-range target index', () => {
    const layout = makeLayout({ layers: [makeLayer('a'), makeLayer('b')] });
    const result = reorderLayers.handle({ fromIndex: 0, toIndex: 99 }, { aggregate: layout });
    expect(result.ok).toBe(false);
  });

  it('treats fromIndex === toIndex as a no-op (succeeds, apply does nothing)', () => {
    const layout = makeLayout({ layers: [makeLayer('a'), makeLayer('b')] });
    const result = reorderLayers.handle({ fromIndex: 1, toIndex: 1 }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const applied = produce(layout, (draft) => {
      reorderLayers.apply({ type: 'layer.reordered', payload: result.value.event.payload }, draft);
    });
    expect(applied.layers.map((l) => l.id)).toEqual([layerId('a'), layerId('b')]);
  });

  it('apply() splices the layer to the new position', () => {
    const layout = makeLayout({
      layers: [makeLayer('a'), makeLayer('b'), makeLayer('c')],
    });
    const result = reorderLayers.handle({ fromIndex: 0, toIndex: 2 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      reorderLayers.apply({ type: 'layer.reordered', payload: result.value.event.payload }, draft);
    });
    expect(applied.layers.map((l) => l.id)).toEqual([layerId('b'), layerId('c'), layerId('a')]);
  });
});
