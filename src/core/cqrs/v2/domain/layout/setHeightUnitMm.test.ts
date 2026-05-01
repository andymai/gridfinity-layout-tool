import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { mm } from '@/core/types';
import { setHeightUnitMm } from './setHeightUnitMm';
import { makeLayout } from './_testHelpers';

describe('v2 layout.setHeightUnitMm', () => {
  it('clamps to [1, 50]', () => {
    const layout = makeLayout();
    const result = setHeightUnitMm.handle({ mm: 9999 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.mm).toBe(50);
  });

  it('apply() updates heightUnitMm', () => {
    const layout = makeLayout();
    const result = setHeightUnitMm.handle({ mm: 12 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      setHeightUnitMm.apply(
        { type: 'layout.heightUnitMmSet', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.heightUnitMm).toBe(mm(12));
  });
});
