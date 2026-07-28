import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { mm } from '@/core/types';
import { setSocketHeightMm } from './setSocketHeightMm';
import { makeLayout } from './_testHelpers';

describe('v2 layout.setSocketHeightMm', () => {
  it('clamps above the max (5mm)', () => {
    const layout = makeLayout();
    const result = setSocketHeightMm.handle({ mm: 9999 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.mm).toBe(5);
  });

  it('clamps below the min (2mm)', () => {
    const layout = makeLayout();
    const result = setSocketHeightMm.handle({ mm: 0.5 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.mm).toBe(2);
  });

  it('captures previousMm for undo (defaults to standard when unset)', () => {
    const layout = makeLayout();
    const result = setSocketHeightMm.handle({ mm: 3 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.mm).toBe(3);
    expect(result.value.event.payload.previousMm).toBe(5);
  });

  it('apply() updates socketHeightMm', () => {
    const layout = makeLayout();
    const result = setSocketHeightMm.handle({ mm: 3 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      setSocketHeightMm.apply(
        { type: 'layout.socketHeightMmSet', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.socketHeightMm).toBe(mm(3));
  });
});
