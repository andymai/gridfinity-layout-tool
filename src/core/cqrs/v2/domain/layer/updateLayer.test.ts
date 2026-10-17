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

  it('clamps height to the drawer, regardless of other layers', () => {
    // drawer.height = 7; the other layer's 6u does not shrink the cap.
    const layout = makeLayout({
      layers: [makeLayer('layer_1', 2), makeLayer('layer_2', 6)],
    });
    const result = updateLayer.handle(
      { id: 'layer_1', updates: { height: 99 } },
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.changes.height).toBe(heightUnits(7));
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
