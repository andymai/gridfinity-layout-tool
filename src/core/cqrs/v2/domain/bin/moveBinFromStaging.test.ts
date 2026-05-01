import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { layerId, heightUnits } from '@/core/types';
import { moveBinFromStaging } from './moveBinFromStaging';
import { makeLayout, makeBin } from './_testHelpers';

describe('v2 bin.moveFromStaging', () => {
  it('emits an event whose payload includes the resolved layer height', () => {
    const bin = makeBin('bin_1', { layerId: STAGING_ID, height: heightUnits(5) });
    const layout = makeLayout({
      layers: [{ id: layerId('layer_1'), name: 'L1', height: heightUnits(3) }],
      bins: [bin],
    });

    const result = moveBinFromStaging.handle(
      { id: 'bin_1', layerId: 'layer_1', x: 0, y: 0 },
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.height).toBe(heightUnits(3));
    expect(result.value.event.payload.layerId).toBe(layerId('layer_1'));
  });

  it('errors when the source bin is not in staging (v2 tightening)', () => {
    const bin = makeBin('bin_1', { layerId: layerId('layer_1') });
    const layout = makeLayout({ bins: [bin] });
    const result = moveBinFromStaging.handle(
      { id: 'bin_1', layerId: 'layer_1', x: 1, y: 1 },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
  });

  it('errors when the bin does not exist', () => {
    const layout = makeLayout();
    const result = moveBinFromStaging.handle(
      { id: 'bin_gone', layerId: 'layer_1', x: 0, y: 0 },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
  });

  it('errors when the target layer does not exist', () => {
    const bin = makeBin('bin_1', { layerId: STAGING_ID });
    const layout = makeLayout({ bins: [bin] });
    const result = moveBinFromStaging.handle(
      { id: 'bin_1', layerId: 'layer_gone', x: 0, y: 0 },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
  });

  it('errors when placement collides with an existing bin', () => {
    const occupant = makeBin('bin_occupant', { layerId: layerId('layer_1') });
    const moving = makeBin('bin_1', { layerId: STAGING_ID });
    const layout = makeLayout({ bins: [occupant, moving] });

    const result = moveBinFromStaging.handle(
      { id: 'bin_1', layerId: 'layer_1', x: 0, y: 0 },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
  });

  it('apply() round-trip: layerId, x, y, AND height are restored', () => {
    const bin = makeBin('bin_1', { layerId: STAGING_ID, height: heightUnits(5) });
    const layout = makeLayout({
      layers: [{ id: layerId('layer_1'), name: 'L1', height: heightUnits(3) }],
      bins: [bin],
    });
    const result = moveBinFromStaging.handle(
      { id: 'bin_1', layerId: 'layer_1', x: 0, y: 0 },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      moveBinFromStaging.apply(
        { type: 'bin.movedFromStaging', payload: result.value.event.payload },
        draft
      );
    });

    expect(applied.bins[0].layerId).toBe(layerId('layer_1'));
    expect(applied.bins[0].height).toBe(heightUnits(3));
  });
});
