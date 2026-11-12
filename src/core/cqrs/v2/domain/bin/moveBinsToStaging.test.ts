import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { binId, gridUnits, layerId } from '@/core/types';
import { moveBinsToStaging } from './moveBinsToStaging';
import { makeLayout, makeBin } from './_testHelpers';

describe('v2 bin.moveToStagingBatch', () => {
  it('records each placed bin with its previous layer', () => {
    const layout = makeLayout({
      bins: [makeBin('bin_a'), makeBin('bin_b'), makeBin('bin_staged', { layerId: STAGING_ID })],
    });

    const result = moveBinsToStaging.handle(
      { ids: ['bin_a', 'bin_staged', 'bin_missing'] },
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.moves).toEqual([
      { id: binId('bin_a'), previousLayerId: layerId('layer_1') },
    ]);
  });

  it('apply() stashes only the recorded bins and keeps their position', () => {
    const layout = makeLayout({
      bins: [
        makeBin('bin_a', { x: gridUnits(2), y: gridUnits(3) }),
        makeBin('bin_b', { x: gridUnits(4), y: gridUnits(1) }),
        makeBin('bin_c'),
      ],
    });
    const result = moveBinsToStaging.handle({ ids: ['bin_a', 'bin_b'] }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      moveBinsToStaging.apply(
        { type: 'bin.batchMovedToStaging', payload: result.value.event.payload },
        draft
      );
    });

    expect(applied.bins.map((b) => [b.id, b.layerId, b.x, b.y])).toEqual([
      [binId('bin_a'), STAGING_ID, 2, 3],
      [binId('bin_b'), STAGING_ID, 4, 1],
      [binId('bin_c'), layerId('layer_1'), 0, 0],
    ]);
    expect(applied.bins[2]).toBe(layout.bins[2]);
  });

  it('apply() leaves the layout untouched when nothing moves', () => {
    const layout = makeLayout({ bins: [makeBin('bin_a')] });
    const applied = produce(layout, (draft) => {
      moveBinsToStaging.apply({ type: 'bin.batchMovedToStaging', payload: { moves: [] } }, draft);
    });
    expect(applied).toBe(layout);
  });
});
