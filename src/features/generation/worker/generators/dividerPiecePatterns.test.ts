import { describe, it, expect } from 'vitest';
import { planPiecePattern } from './dividerPiecePatterns';
import type { PiecePatternInput } from './dividerPiecePatterns';

function input(overrides: Partial<PiecePatternInput> = {}): PiecePatternInput {
  return {
    length: 80,
    height: 30,
    tabEngagement: 2,
    notches: [],
    grooves: [],
    border: 1.5,
    ...overrides,
  };
}

describe('planPiecePattern', () => {
  it('holds the tab engagement plus a border clear at both ends', () => {
    const plan = planPiecePattern(input({ length: 80, tabEngagement: 2, border: 1.5 }));
    expect(plan?.patternSpan).toBeCloseTo(80 - 2 * (2 + 1.5), 6);
  });

  it('leaves a solid rim at both edges of a free-standing piece', () => {
    const plan = planPiecePattern(input({ height: 30 }));
    // No floor slab on a removable piece, so the bottom keep-out is the skirt
    // alone — unlike an integrated divider, which also clears wallThickness.
    expect(plan?.bandZ0).toBeCloseTo(1.5, 6);
    expect(plan?.bandHeight).toBeCloseTo(30 - 1.5 - 1.5, 6);
  });

  it('returns null when the piece is too short to hold a band', () => {
    expect(planPiecePattern(input({ height: 3 }))).toBeNull();
  });

  it('returns null when tab engagement consumes the whole length', () => {
    expect(planPiecePattern(input({ length: 6, tabEngagement: 3, border: 1 }))).toBeNull();
  });

  it('clears a full-height column at each cross-lap notch', () => {
    const plan = planPiecePattern(
      input({
        notches: [
          { offset: -10, width: 2 },
          { offset: 10, width: 2 },
        ],
      })
    );
    expect(plan?.keepOuts).toHaveLength(2);
    const bandTop = (plan?.bandZ0 ?? 0) + (plan?.bandHeight ?? 0);
    for (const k of plan?.keepOuts ?? []) {
      // Full height: a notch already removes half the piece there, so the
      // surviving ligament carries the joint and must stay unperforated.
      expect(k.zMin).toBeLessThanOrEqual(0);
      expect(k.zMax).toBeGreaterThanOrEqual(bandTop);
      expect(k.uMax - k.uMin).toBeCloseTo(2 + 2 * 1.5, 6);
    }
  });

  it('clears a full-height column at each face groove', () => {
    const plan = planPiecePattern(input({ grooves: [{ offset: 0, width: 1 }] }));
    expect(plan?.keepOuts).toHaveLength(1);
    expect(plan?.keepOuts[0].uMin).toBeCloseTo(-(0.5 + 1.5), 6);
    expect(plan?.keepOuts[0].uMax).toBeCloseTo(0.5 + 1.5, 6);
  });

  it('accumulates notches and grooves together', () => {
    const plan = planPiecePattern(
      input({ notches: [{ offset: -5, width: 2 }], grooves: [{ offset: 5, width: 1 }] })
    );
    expect(plan?.keepOuts).toHaveLength(2);
  });

  it('scales every margin with the border', () => {
    const narrow = planPiecePattern(input({ border: 1, grooves: [{ offset: 0, width: 2 }] }));
    const wide = planPiecePattern(input({ border: 4, grooves: [{ offset: 0, width: 2 }] }));
    expect(wide?.patternSpan).toBeLessThan(narrow?.patternSpan ?? 0);
    const narrowWidth = (narrow?.keepOuts[0].uMax ?? 0) - (narrow?.keepOuts[0].uMin ?? 0);
    const wideWidth = (wide?.keepOuts[0].uMax ?? 0) - (wide?.keepOuts[0].uMin ?? 0);
    expect(wideWidth).toBeGreaterThan(narrowWidth);
  });
});
