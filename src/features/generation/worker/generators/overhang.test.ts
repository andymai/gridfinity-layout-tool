import { describe, it, expect } from 'vitest';
import { resolveOverhang, hasOverhang, overhangExpansion, overhangKey } from './overhang';

describe('resolveOverhang', () => {
  it('returns all-zero for undefined', () => {
    expect(resolveOverhang(undefined)).toEqual({
      left: 0,
      right: 0,
      front: 0,
      back: 0,
      feet: false,
    });
  });

  it('clamps negative sides to zero (outward-only)', () => {
    expect(resolveOverhang({ left: -3, right: 5, front: -0.1, back: 2 })).toEqual({
      left: 0,
      right: 5,
      front: 0,
      back: 2,
      feet: false,
    });
  });

  it('carries the feet flag through', () => {
    expect(resolveOverhang({ left: 5, right: 0, front: 0, back: 0, feet: true }).feet).toBe(true);
    expect(resolveOverhang({ left: 5, right: 0, front: 0, back: 0 }).feet).toBe(false);
  });
});

describe('hasOverhang', () => {
  it('is false for all-zero (feet flag alone does not count)', () => {
    expect(hasOverhang({ left: 0, right: 0, front: 0, back: 0, feet: false })).toBe(false);
    expect(hasOverhang({ left: 0, right: 0, front: 0, back: 0, feet: true })).toBe(false);
  });
  it('is true when any side is positive', () => {
    expect(hasOverhang({ left: 0, right: 0, front: 0, back: 0.5, feet: false })).toBe(true);
  });
});

describe('overhangExpansion', () => {
  it('sums opposite sides and centers symmetric overhang', () => {
    const e = overhangExpansion({ left: 5, right: 5, front: 4, back: 4, feet: false });
    expect(e.addW).toBe(10);
    expect(e.addD).toBe(8);
    expect(e.offsetX).toBe(0);
    expect(e.offsetY).toBe(0);
  });

  it('offsets the center toward the larger side for asymmetric overhang', () => {
    const e = overhangExpansion({ left: 0, right: 6, front: 2, back: 0, feet: false });
    expect(e.addW).toBe(6);
    expect(e.offsetX).toBe(3); // shifts toward +X (right)
    expect(e.offsetY).toBe(-1); // shifts toward -Y (front)
  });
});

describe('overhangKey', () => {
  it('is a stable "0" when there is no overhang', () => {
    expect(overhangKey({ left: 0, right: 0, front: 0, back: 0, feet: false })).toBe('0');
  });
  it('distinguishes different overhang configs', () => {
    const a = overhangKey({ left: 1, right: 2, front: 3, back: 4, feet: false });
    const b = overhangKey({ left: 4, right: 3, front: 2, back: 1, feet: false });
    expect(a).not.toBe(b);
  });
  it('distinguishes feet on vs off at the same overhang', () => {
    const off = overhangKey({ left: 5, right: 0, front: 0, back: 0, feet: false });
    const on = overhangKey({ left: 5, right: 0, front: 0, back: 0, feet: true });
    expect(off).not.toBe(on);
  });
});
