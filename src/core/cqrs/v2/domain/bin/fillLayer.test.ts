import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { categoryId, layerId } from '@/core/types';
import { fillLayer } from './fillLayer';
import { makeLayout } from './_testHelpers';

describe('v2 bin.fillLayer', () => {
  it('places bins on the empty layer and emits a uniform-fill event', () => {
    const layout = makeLayout();
    const result = fillLayer.handle(
      { layerId: 'layer_1', width: 1, depth: 1, categoryId: 'cat_1' },
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.value).toBeGreaterThan(0);
    expect(result.value.event.payload.fillType).toBe('uniform');
    expect(result.value.event.payload.width).toBe(1);
    expect(result.value.event.payload.depth).toBe(1);
    expect(result.value.event.payload.bins.length).toBe(result.value.event.payload.binsCreated);
  });

  it('returns 0 + empty event when the layer is already full', () => {
    const layout = makeLayout();
    const first = fillLayer.handle(
      { layerId: 'layer_1', width: 1, depth: 1, categoryId: 'cat_1' },
      { aggregate: layout }
    );
    if (!isOk(first)) throw new Error('first fill failed');

    const filled = produce(layout, (draft) => {
      fillLayer.apply({ type: 'bin.layerFilled', payload: first.value.event.payload }, draft);
    });

    const second = fillLayer.handle(
      { layerId: 'layer_1', width: 1, depth: 1, categoryId: 'cat_1' },
      { aggregate: filled }
    );

    expect(isOk(second)).toBe(true);
    if (!isOk(second)) return;
    expect(second.value.value).toBe(0);
    expect(second.value.event.payload.bins).toHaveLength(0);
  });

  it('apply() pushes the planned bins onto the draft', () => {
    const layout = makeLayout();
    const result = fillLayer.handle(
      { layerId: 'layer_1', width: 2, depth: 2, categoryId: 'cat_1' },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      fillLayer.apply({ type: 'bin.layerFilled', payload: result.value.event.payload }, draft);
    });

    expect(applied.bins.length).toBe(result.value.event.payload.bins.length);
    expect(applied.bins.every((b) => b.layerId === layerId('layer_1'))).toBe(true);
    expect(applied.bins.every((b) => b.category === categoryId('cat_1'))).toBe(true);
  });
});
