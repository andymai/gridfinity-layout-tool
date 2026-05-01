import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { heightUnits } from '@/core/types';
import { updateLayer } from './updateLayer';
import { makeLayout, makeLayer } from './_testHelpers';

describe('v2 layer.update', () => {
  it('captures previous values for the fields being changed', () => {
    const layout = makeLayout({ layers: [makeLayer('layer_1', 3)] });
    const result = updateLayer.handle(
      { id: 'layer_1', updates: { name: 'Renamed' } },
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.previous).toEqual({ name: 'layer_1' });
    expect(result.value.event.payload.changes).toEqual({ name: 'Renamed' });
  });

  it('clamps height against remaining drawer space', () => {
    // drawer.height = 7, layer_1 height=2, layer_2 height=2 -> max for layer_1 = 7 - 2 = 5
    const layout = makeLayout({
      layers: [makeLayer('layer_1', 2), makeLayer('layer_2', 2)],
    });
    const result = updateLayer.handle(
      { id: 'layer_1', updates: { height: 99 } }, // way above the cap
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.changes.height).toBe(heightUnits(5));
  });

  it('errors when the layer does not exist', () => {
    const layout = makeLayout();
    const result = updateLayer.handle(
      { id: 'layer_gone', updates: { name: 'X' } },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
  });

  it('apply() round-trip equals native Object.assign', () => {
    const layout = makeLayout({ layers: [makeLayer('layer_1', 3)] });
    const result = updateLayer.handle(
      { id: 'layer_1', updates: { name: 'X' } },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      updateLayer.apply({ type: 'layer.updated', payload: result.value.event.payload }, draft);
    });

    expect(applied.layers[0].name).toBe('X');
  });
});
