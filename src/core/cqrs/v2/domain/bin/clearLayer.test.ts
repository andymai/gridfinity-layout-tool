import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import type { Layout } from '@/core/types';
import { layerId } from '@/core/types';
import { clearLayer } from './clearLayer';
import { makeLayout, makeBin } from './_testHelpers';

describe('v2 bin.clearLayer', () => {
  it('captures every bin on the layer in the event payload', () => {
    const a = makeBin('bin_a', { layerId: layerId('layer_1') });
    const b = makeBin('bin_b', { layerId: layerId('layer_1') });
    const c = makeBin('bin_c', { layerId: layerId('layer_other') });
    const layout = makeLayout({
      layers: [
        { id: layerId('layer_1'), name: 'L1', height: 3 as Layout['layers'][number]['height'] },
        { id: layerId('layer_other'), name: 'L2', height: 3 as Layout['layers'][number]['height'] },
      ],
      bins: [a, b, c],
    });

    const result = clearLayer.handle({ layerId: 'layer_1' }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.value).toBe(2);
    expect(result.value.event.payload.bins).toHaveLength(2);
    expect(result.value.event.payload.binsRemoved).toBe(2);
  });

  it('returns 0 and an empty bin list for an empty layer', () => {
    const layout = makeLayout();
    const result = clearLayer.handle({ layerId: 'layer_1' }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.value).toBe(0);
    expect(result.value.event.payload.bins).toHaveLength(0);
  });

  it('apply() removes only the bins on the cleared layer', () => {
    const a = makeBin('bin_a', { layerId: layerId('layer_1') });
    const b = makeBin('bin_b', { layerId: layerId('layer_other') });
    const layout = makeLayout({
      layers: [
        { id: layerId('layer_1'), name: 'L1', height: 3 as Layout['layers'][number]['height'] },
        { id: layerId('layer_other'), name: 'L2', height: 3 as Layout['layers'][number]['height'] },
      ],
      bins: [a, b],
    });
    const result = clearLayer.handle({ layerId: 'layer_1' }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      clearLayer.apply({ type: 'bin.layerCleared', payload: result.value.event.payload }, draft);
    });

    expect(applied.bins).toHaveLength(1);
    expect(applied.bins[0].id).toBe('bin_b');
  });
});
