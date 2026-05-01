import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { binId, gridUnits } from '@/core/types';
import { updateBin } from './updateBin';
import { makeLayout, makeBin } from './_testHelpers';

describe('v2 bin.update', () => {
  it('captures previous values for the fields being changed', () => {
    const bin = makeBin('bin_1', { x: gridUnits(2), y: gridUnits(3), label: 'old' });
    const layout = makeLayout({ bins: [bin] });

    const result = updateBin.handle(
      { id: 'bin_1', updates: { label: 'new' } },
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.previous).toEqual({ label: 'old' });
    expect(result.value.event.payload.changes).toEqual({ label: 'new' });
  });

  it('errors when the bin does not exist', () => {
    const layout = makeLayout();
    const result = updateBin.handle(
      { id: 'bin_gone', updates: { label: 'x' } },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
  });

  it('errors when spatial update would collide', () => {
    const a = makeBin('bin_a', { x: gridUnits(0), y: gridUnits(0) });
    const b = makeBin('bin_b', { x: gridUnits(2), y: gridUnits(0) });
    const layout = makeLayout({ bins: [a, b] });

    // Try to move bin_b to bin_a's position
    const result = updateBin.handle(
      { id: 'bin_b', updates: { x: 0, y: 0 } },
      { aggregate: layout }
    );
    expect(result.ok).toBe(false);
  });

  it('skips placement validation for staging bins', () => {
    const bin = makeBin('bin_1', { layerId: STAGING_ID });
    const layout = makeLayout({ bins: [bin] });

    const result = updateBin.handle(
      { id: 'bin_1', updates: { x: 99, y: 99 } },
      { aggregate: layout }
    );
    expect(isOk(result)).toBe(true);
  });

  it('apply() round-trip equals native Object.assign', () => {
    const bin = makeBin('bin_1', { label: 'old' });
    const layout = makeLayout({ bins: [bin] });
    const result = updateBin.handle(
      { id: 'bin_1', updates: { label: 'new' } },
      { aggregate: layout }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      updateBin.apply({ type: 'bin.updated', payload: result.value.event.payload }, draft);
    });
    const native = produce(layout, (draft) => {
      const b = draft.bins.find((b) => b.id === binId('bin_1'));
      if (b) Object.assign(b, { label: 'new' });
    });

    expect(applied).toEqual(native);
  });
});
