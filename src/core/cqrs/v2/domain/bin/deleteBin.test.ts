import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { binId } from '@/core/types';
import { deleteBin } from './deleteBin';
import { makeLayout, makeBin } from './_testHelpers';

describe('v2 bin.delete', () => {
  it('returns the bin in the event payload before removing it', () => {
    const bin = makeBin('bin_1');
    const layout = makeLayout({ bins: [bin] });

    const result = deleteBin.handle({ id: 'bin_1' }, { aggregate: layout });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.bin).toEqual(bin);
  });

  it('errors when the bin does not exist', () => {
    const layout = makeLayout();
    const result = deleteBin.handle({ id: 'bin_gone' }, { aggregate: layout });
    expect(result.ok).toBe(false);
  });

  it('apply() removes the bin from the draft', () => {
    const a = makeBin('bin_a');
    const b = makeBin('bin_b');
    const layout = makeLayout({ bins: [a, b] });
    const result = deleteBin.handle({ id: 'bin_a' }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      deleteBin.apply({ type: 'bin.deleted', payload: result.value.event.payload }, draft);
    });

    expect(applied.bins).toHaveLength(1);
    expect(applied.bins[0].id).toBe(binId('bin_b'));
  });
});
