import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import type { Bin } from '@/core/types';
import { binId, layerId, categoryId, gridUnits, heightUnits } from '@/core/types';
import { deleteLayer } from './deleteLayer';
import { makeLayout, makeLayer } from './_testHelpers';

function makeBin(idStr: string, lid: string): Bin {
  return {
    id: binId(idStr),
    layerId: layerId(lid),
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(1),
    depth: gridUnits(1),
    height: heightUnits(3),
    category: categoryId('cat_1'),
    label: '',
    notes: '',
  };
}

describe('v2 layer.delete', () => {
  it('captures displacedBinIds for replay determinism', () => {
    const layout = makeLayout({
      layers: [makeLayer('layer_1', 3), makeLayer('layer_2', 3)],
      bins: [makeBin('bin_a', 'layer_1'), makeBin('bin_b', 'layer_2')],
    });
    const result = deleteLayer.handle({ id: 'layer_1' }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.displacedBinIds).toEqual([binId('bin_a')]);
    expect(result.value.event.payload.deletedBinCount).toBe(1);
  });

  it('errors at the layer-count minimum', () => {
    const layout = makeLayout(); // single layer
    const result = deleteLayer.handle({ id: 'layer_1' }, { aggregate: layout });
    expect(result.ok).toBe(false);
  });

  it('errors when the layer does not exist', () => {
    const layout = makeLayout({
      layers: [makeLayer('layer_1', 3), makeLayer('layer_2', 3)],
    });
    const result = deleteLayer.handle({ id: 'layer_gone' }, { aggregate: layout });
    expect(result.ok).toBe(false);
  });

  it('apply() removes the layer AND moves displaced bins to STAGING_ID', () => {
    const layout = makeLayout({
      layers: [makeLayer('layer_1', 3), makeLayer('layer_2', 3)],
      bins: [makeBin('bin_a', 'layer_1'), makeBin('bin_b', 'layer_2')],
    });
    const result = deleteLayer.handle({ id: 'layer_1' }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      deleteLayer.apply({ type: 'layer.deleted', payload: result.value.event.payload }, draft);
    });

    expect(applied.layers).toHaveLength(1);
    expect(applied.layers[0].id).toBe(layerId('layer_2'));
    const movedBin = applied.bins.find((b) => b.id === binId('bin_a'));
    expect(movedBin?.layerId).toBe(STAGING_ID);
    const otherBin = applied.bins.find((b) => b.id === binId('bin_b'));
    expect(otherBin?.layerId).toBe(layerId('layer_2'));
  });
});
