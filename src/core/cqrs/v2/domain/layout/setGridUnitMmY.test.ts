import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { mm } from '@/core/types';
import { setGridUnitMmY } from './setGridUnitMmY';
import { makeLayout } from './_testHelpers';

describe('v2 layout.setGridUnitMmY', () => {
  it('clamps a concrete value to [1, 200]', () => {
    const layout = makeLayout();
    const result = setGridUnitMmY.handle({ mm: 9999 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.mm).toBe(200);
  });

  it('captures previousMmY as null when the grid was square', () => {
    const layout = makeLayout();
    const result = setGridUnitMmY.handle({ mm: 22 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousMmY).toBeNull();
  });

  it('captures the prior Y pitch when already non-square', () => {
    const layout = { ...makeLayout(), gridUnitMmY: mm(22) };
    const result = setGridUnitMmY.handle({ mm: 30 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.previousMmY).toBe(22);
  });

  it('apply() sets a concrete Y pitch', () => {
    const layout = makeLayout();
    const result = setGridUnitMmY.handle({ mm: 22 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    const applied = produce(layout, (draft) => {
      setGridUnitMmY.apply(
        { type: 'layout.gridUnitMmYSet', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.gridUnitMmY).toBe(mm(22));
  });

  it('apply() clears back to square when mm is null', () => {
    const layout = { ...makeLayout(), gridUnitMmY: mm(22) };
    const result = setGridUnitMmY.handle({ mm: null }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.mm).toBeNull();
    const applied = produce(layout, (draft) => {
      setGridUnitMmY.apply(
        { type: 'layout.gridUnitMmYSet', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.gridUnitMmY).toBeUndefined();
  });
});
