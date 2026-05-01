import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { layerId } from '@/core/types';
import { moveBinToStaging } from './moveBinToStaging';
import { makeLayout, makeBin } from './_testHelpers';

describe('v2 bin.moveToStaging', () => {
  it('captures previousLayerId so undo can restore the prior placement', () => {
    const bin = makeBin('bin_1', { layerId: layerId('layer_1') });
    const layout = makeLayout({ bins: [bin] });

    const result = moveBinToStaging.handle({ id: 'bin_1' }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.previousLayerId).toBe(layerId('layer_1'));
  });

  it('errors when the bin does not exist', () => {
    const layout = makeLayout();
    const result = moveBinToStaging.handle({ id: 'bin_gone' }, { aggregate: layout });
    expect(result.ok).toBe(false);
  });

  it('apply() sets layerId to STAGING_ID without removing the bin', () => {
    const bin = makeBin('bin_1', { layerId: layerId('layer_1') });
    const layout = makeLayout({ bins: [bin] });
    const result = moveBinToStaging.handle({ id: 'bin_1' }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      moveBinToStaging.apply(
        { type: 'bin.movedToStaging', payload: result.value.event.payload },
        draft
      );
    });

    expect(applied.bins).toHaveLength(1);
    expect(applied.bins[0].layerId).toBe(STAGING_ID);
  });
});
