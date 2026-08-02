import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isErr, isOk } from '@/core/result';
import { mm } from '@/core/types';
import type { Layout } from '@/core/types';
import { setGridUnitMmY } from './setGridUnitMmY';
import { makeLayout, makeLayoutWithOutline } from './_testHelpers';

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

  describe('with a custom outline (#3149)', () => {
    /** 6×4 drawer, Y pitch 48, shape reaching the full y=192 back edge. */
    const withOutline = (): Layout =>
      makeLayoutWithOutline(
        [
          { x: 0, y: 0 },
          { x: 252, y: 0 },
          { x: 252, y: 96 },
          { x: 126, y: 96 },
          { x: 126, y: 192 },
          { x: 0, y: 192 },
        ],
        { gridUnitMmY: mm(48) }
      );

    it('floors a concrete Y pitch at the shape bound', () => {
      // maxY/depth = 192/4 = 48: anything lower would clip the shape.
      const result = setGridUnitMmY.handle({ mm: 30 }, { aggregate: withOutline() });
      if (!isOk(result)) throw new Error('handle failed');
      expect(result.value.event.payload.mm).toBe(48);
    });

    it('refuses clearing to square when the square pitch would clip the shape', () => {
      // Clearing makes Y follow gridUnitMm (42) < required 48.
      const result = setGridUnitMmY.handle({ mm: null }, { aggregate: withOutline() });
      expect(isErr(result)).toBe(true);
    });

    it('allows clearing when the square pitch still holds the shape', () => {
      const layout = withOutline();
      const roomy = { ...layout, gridUnitMm: mm(48) };
      const result = setGridUnitMmY.handle({ mm: null }, { aggregate: roomy });
      expect(isOk(result)).toBe(true);
    });
  });
});
