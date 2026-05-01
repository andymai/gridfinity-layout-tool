import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { binId } from '@/core/types';
import { deleteBins } from './deleteBins';
import { makeLayout, makeBin } from './_testHelpers';

describe('v2 bin.deleteBatch', () => {
  it('captures every existing bin in the requested set', () => {
    const a = makeBin('bin_a');
    const b = makeBin('bin_b');
    const c = makeBin('bin_c');
    const layout = makeLayout({ bins: [a, b, c] });

    const result = deleteBins.handle(
      { ids: ['bin_a', 'bin_c', 'bin_missing'] },
      { aggregate: layout }
    );

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.bins).toHaveLength(2);
    const ids = result.value.event.payload.bins.map((b) => b.id);
    expect(ids).toContain(binId('bin_a'));
    expect(ids).toContain(binId('bin_c'));
  });

  it('returns an empty bin list when no ids match (lenient like v1)', () => {
    const layout = makeLayout({ bins: [makeBin('bin_a')] });
    const result = deleteBins.handle({ ids: ['bin_missing'] }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.event.payload.bins).toHaveLength(0);
  });

  it('apply() removes only the captured bins', () => {
    const a = makeBin('bin_a');
    const b = makeBin('bin_b');
    const c = makeBin('bin_c');
    const layout = makeLayout({ bins: [a, b, c] });
    const result = deleteBins.handle({ ids: ['bin_a', 'bin_c'] }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      deleteBins.apply({ type: 'bin.batchDeleted', payload: result.value.event.payload }, draft);
    });

    expect(applied.bins).toHaveLength(1);
    expect(applied.bins[0].id).toBe(binId('bin_b'));
  });
});
