import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { mm } from '@/core/types';
import { setGridUnitMm } from './setGridUnitMm';
import { makeLayout } from './_testHelpers';

describe('v2 layout.setGridUnitMm', () => {
  it('clamps to [1, 200]', () => {
    const layout = makeLayout();
    const result = setGridUnitMm.handle({ mm: 9999 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.mm).toBe(200);
  });

  it('captures previousMm', () => {
    const layout = makeLayout();
    const result = setGridUnitMm.handle({ mm: 50 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousMm).toBe(42);
  });

  it('apply() updates gridUnitMm', () => {
    const layout = makeLayout();
    const result = setGridUnitMm.handle({ mm: 50 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      setGridUnitMm.apply(
        { type: 'layout.gridUnitMmSet', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.gridUnitMm).toBe(mm(50));
  });
});
