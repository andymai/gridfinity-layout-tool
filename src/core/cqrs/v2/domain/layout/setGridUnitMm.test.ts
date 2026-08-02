import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import { mm } from '@/core/types';
import { setGridUnitMm } from './setGridUnitMm';
import { makeLayout, makeLayoutWithOutline } from './_testHelpers';

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

  it('floors the pitch so a custom outline stays inside the extent (#3149)', () => {
    // 6×4 drawer with a shape reaching x=252, y=168: any pitch below 42
    // shrinks the mm extent under the shape, which the read-side normalizer
    // would then clip — so the pitch clamps at maxX/width = 42.
    const layout = makeLayoutWithOutline([
      { x: 0, y: 0 },
      { x: 252, y: 0 },
      { x: 252, y: 84 },
      { x: 168, y: 84 },
      { x: 168, y: 168 },
      { x: 0, y: 168 },
    ]);
    const result = setGridUnitMm.handle({ mm: 30 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.mm).toBe(42);
  });

  it('honours the Y bound too when the pitch drives both axes (square grid)', () => {
    // Same drawer, shape reaching y=168 over depth 4 → Y needs ≥42; a shape
    // narrower in X (maxX=126 over width 6 → 21) must not lower the floor.
    const layout = makeLayoutWithOutline([
      { x: 0, y: 0 },
      { x: 126, y: 0 },
      { x: 126, y: 168 },
      { x: 0, y: 168 },
    ]);
    const result = setGridUnitMm.handle({ mm: 30 }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.mm).toBe(42);
  });
});
