import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { addLayer } from './addLayer';
import { makeLayout, makeLayer } from './_testHelpers';

describe('v2 layer.add', () => {
  it('emits an event with a generated layer fitting the remaining height', () => {
    const layout = makeLayout(); // drawer.height = 7, one layer of height 3 -> 4 remaining
    const result = addLayer.handle(undefined, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.layer.height).toBeLessThanOrEqual(4);
    expect(result.value.event.payload.layer.height).toBeGreaterThanOrEqual(
      CONSTRAINTS.MIN_LAYER_HEIGHT
    );
    expect(result.value.event.payload.layer.id).toBe(result.value.value);
  });

  it('errors when the layer-count limit is reached', () => {
    const layers = Array.from({ length: CONSTRAINTS.LAYERS_MAX }, (_, i) =>
      makeLayer(`layer_${String(i)}`, 1)
    );
    const layout = makeLayout({ layers });
    const result = addLayer.handle(undefined, { aggregate: layout });
    expect(result.ok).toBe(false);
  });

  it('errors when no remaining drawer height', () => {
    // drawer.height = 7, layer fills it
    const layout = makeLayout({ layers: [makeLayer('layer_1', 7)] });
    const result = addLayer.handle(undefined, { aggregate: layout });
    expect(result.ok).toBe(false);
  });

  it('apply() pushes the new layer onto the draft', () => {
    const layout = makeLayout();
    const result = addLayer.handle(undefined, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      addLayer.apply({ type: 'layer.added', payload: result.value.event.payload }, draft);
    });

    expect(applied.layers).toHaveLength(2);
    expect(applied.layers[1]).toEqual(result.value.event.payload.layer);
  });
});
