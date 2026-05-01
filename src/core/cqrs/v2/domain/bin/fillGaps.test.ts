import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { fillGaps } from './fillGaps';
import { makeLayout, makeBin } from './_testHelpers';
import { gridUnits, layerId } from '@/core/types';

describe('v2 bin.fillGaps', () => {
  it('emits a gaps-fill event with bins covering the empty space', () => {
    // Place a single bin off in the corner; fillGaps should fill the rest.
    const corner = makeBin('bin_corner', { x: gridUnits(0), y: gridUnits(0) });
    const layout = makeLayout({ bins: [corner] });

    const result = fillGaps.handle(
      { layerId: 'layer_1', categoryId: 'cat_1' },
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.fillType).toBe('gaps');
    expect(result.value.event.payload.binsCreated).toBeGreaterThan(0);
    // Width/depth not set for gap fills (mixed bin sizes possible).
    expect(result.value.event.payload.width).toBeUndefined();
    expect(result.value.event.payload.depth).toBeUndefined();
  });

  it('returns 0 + empty event when the layer is already full', () => {
    const layout = makeLayout();

    // First, fully fill the layer
    const fillResult = fillGaps.handle(
      { layerId: 'layer_1', categoryId: 'cat_1' },
      { aggregate: layout }
    );
    if (!isOk(fillResult)) throw new Error('first fill failed');

    const filled = produce(layout, (draft) => {
      fillGaps.apply({ type: 'bin.layerFilled', payload: fillResult.value.event.payload }, draft);
    });

    const second = fillGaps.handle(
      { layerId: 'layer_1', categoryId: 'cat_1' },
      { aggregate: filled }
    );
    expect(isOk(second)).toBe(true);
    if (!isOk(second)) return;
    expect(second.value.event.payload.bins).toHaveLength(0);
  });

  it('apply() pushes the planned bins onto the draft', () => {
    const layout = makeLayout();
    const result = fillGaps.handle(
      { layerId: 'layer_1', categoryId: 'cat_1' },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      fillGaps.apply({ type: 'bin.layerFilled', payload: result.value.event.payload }, draft);
    });

    expect(applied.bins.length).toBe(result.value.event.payload.bins.length);
    expect(applied.bins.every((b) => b.layerId === layerId('layer_1'))).toBe(true);
  });
});
