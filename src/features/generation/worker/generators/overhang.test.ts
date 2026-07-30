import { describe, it, expect } from 'vitest';
import {
  resolveOverhang,
  hasOverhang,
  hasTaper,
  overhangBaseSides,
  overhangExpansion,
  overhangKey,
} from './overhang';

describe('resolveOverhang', () => {
  it('returns all-zero for undefined', () => {
    expect(resolveOverhang(undefined)).toEqual({
      left: 0,
      right: 0,
      front: 0,
      back: 0,
      feet: false,
      taper: null,
    });
  });

  it('clamps negative sides to zero (outward-only)', () => {
    expect(resolveOverhang({ left: -3, right: 5, front: -0.1, back: 2 })).toEqual({
      left: 0,
      right: 5,
      front: 0,
      back: 2,
      feet: false,
      taper: null,
    });
  });

  it('carries the feet flag through', () => {
    expect(resolveOverhang({ left: 5, right: 0, front: 0, back: 0, feet: true }).feet).toBe(true);
    expect(resolveOverhang({ left: 5, right: 0, front: 0, back: 0 }).feet).toBe(false);
  });

  it('returns zero when explicitly disabled, retaining nothing in the resolved value', () => {
    expect(resolveOverhang({ left: 5, right: 5, front: 5, back: 5, enabled: false })).toEqual({
      left: 0,
      right: 0,
      front: 0,
      back: 0,
      feet: false,
      taper: null,
    });
  });

  it('applies per-side values when enabled is omitted (legacy configs)', () => {
    expect(resolveOverhang({ left: 3, right: 0, front: 0, back: 0 }).left).toBe(3);
  });
});

describe('resolveOverhang taper (#2933)', () => {
  const TAPER = {
    enabled: true,
    profile: 'chamfer' as const,
    bandHeight: 6,
    left: 10,
    right: 10,
    front: 10,
    back: 10,
  };

  it('is null when no taper is configured', () => {
    expect(resolveOverhang({ left: 8, right: 8, front: 0, back: 0 }).taper).toBeNull();
  });

  it("clamps each side to that side's overhang", () => {
    const t = resolveOverhang({ left: 4, right: 8, front: 0, back: 0, taper: TAPER }).taper;
    expect(t).toEqual({ profile: 'chamfer', bandHeight: 6, left: 4, right: 8, front: 0, back: 0 });
  });

  it('is null when overhang is zero on every side (taper needs overhang)', () => {
    expect(
      resolveOverhang({ left: 0, right: 0, front: 0, back: 0, taper: TAPER }).taper
    ).toBeNull();
  });

  it('survives overhang feet, which are framed from the base instead', () => {
    const o = resolveOverhang({ left: 8, right: 8, front: 0, back: 0, feet: true, taper: TAPER });
    expect(o.taper).not.toBeNull();
    expect(o.feet).toBe(true);
  });

  it('overhangBaseSides subtracts the taper so feet stop where the wall does', () => {
    const o = resolveOverhang({
      left: 8,
      right: 8,
      front: 0,
      back: 0,
      feet: true,
      taper: { ...TAPER, left: 3, right: 8 },
    });
    // Left keeps 5mm of base to stand feet on; right retracts fully.
    expect(overhangBaseSides(o)).toEqual({ left: 5, right: 0, front: 0, back: 0 });
  });

  it('overhangBaseSides is the overhang itself when nothing tapers', () => {
    const o = resolveOverhang({ left: 8, right: 3, front: 0, back: 0 });
    expect(overhangBaseSides(o)).toEqual({ left: 8, right: 3, front: 0, back: 0 });
  });

  it('is null when the taper is disabled', () => {
    expect(
      resolveOverhang({ left: 8, right: 8, front: 0, back: 0, taper: { ...TAPER, enabled: false } })
        .taper
    ).toBeNull();
  });

  it('is null when bandHeight is zero', () => {
    expect(
      resolveOverhang({ left: 8, right: 8, front: 0, back: 0, taper: { ...TAPER, bandHeight: 0 } })
        .taper
    ).toBeNull();
  });
});

describe('hasOverhang', () => {
  it('is false for all-zero (feet flag alone does not count)', () => {
    expect(hasOverhang({ left: 0, right: 0, front: 0, back: 0, feet: false, taper: null })).toBe(
      false
    );
    expect(hasOverhang({ left: 0, right: 0, front: 0, back: 0, feet: true, taper: null })).toBe(
      false
    );
  });
  it('is true when any side is positive', () => {
    expect(hasOverhang({ left: 0, right: 0, front: 0, back: 0.5, feet: false, taper: null })).toBe(
      true
    );
  });
});

describe('hasTaper', () => {
  it('is false when the resolved taper is null', () => {
    expect(hasTaper({ left: 5, right: 0, front: 0, back: 0, feet: false, taper: null })).toBe(
      false
    );
  });
  it('is true when a resolved taper is present', () => {
    const o = resolveOverhang({
      left: 8,
      right: 0,
      front: 0,
      back: 0,
      taper: {
        enabled: true,
        profile: 'fillet',
        bandHeight: 5,
        left: 8,
        right: 0,
        front: 0,
        back: 0,
      },
    });
    expect(hasTaper(o)).toBe(true);
  });
});

describe('overhangExpansion', () => {
  it('sums opposite sides and centers symmetric overhang', () => {
    const e = overhangExpansion({ left: 5, right: 5, front: 4, back: 4, feet: false, taper: null });
    expect(e.addW).toBe(10);
    expect(e.addD).toBe(8);
    expect(e.offsetX).toBe(0);
    expect(e.offsetY).toBe(0);
  });

  it('offsets the center toward the larger side for asymmetric overhang', () => {
    const e = overhangExpansion({ left: 0, right: 6, front: 2, back: 0, feet: false, taper: null });
    expect(e.addW).toBe(6);
    expect(e.offsetX).toBe(3); // shifts toward +X (right)
    expect(e.offsetY).toBe(-1); // shifts toward -Y (front)
  });
});

describe('overhangKey', () => {
  const chamfer = (side: number) => ({
    enabled: true as const,
    profile: 'chamfer' as const,
    bandHeight: 6,
    left: side,
    right: 0,
    front: 0,
    back: 0,
  });

  it('is a stable "0" when there is no overhang', () => {
    expect(overhangKey({ left: 0, right: 0, front: 0, back: 0, feet: false, taper: null })).toBe(
      '0'
    );
  });
  it('distinguishes different overhang configs', () => {
    const a = overhangKey({ left: 1, right: 2, front: 3, back: 4, feet: false, taper: null });
    const b = overhangKey({ left: 4, right: 3, front: 2, back: 1, feet: false, taper: null });
    expect(a).not.toBe(b);
  });
  it('distinguishes feet on vs off at the same overhang', () => {
    const off = overhangKey({ left: 5, right: 0, front: 0, back: 0, feet: false, taper: null });
    const on = overhangKey({ left: 5, right: 0, front: 0, back: 0, feet: true, taper: null });
    expect(off).not.toBe(on);
  });
  it('distinguishes a taper from the same overhang without one', () => {
    const flat = overhangKey(resolveOverhang({ left: 10, right: 0, front: 0, back: 0 }));
    const tapered = overhangKey(
      resolveOverhang({ left: 10, right: 0, front: 0, back: 0, taper: chamfer(10) })
    );
    expect(flat).not.toBe(tapered);
  });
  it('distinguishes chamfer from fillet at the same taper', () => {
    const base = { left: 10, right: 0, front: 0, back: 0 };
    const cham = overhangKey(resolveOverhang({ ...base, taper: chamfer(10) }));
    const fill = overhangKey(
      resolveOverhang({ ...base, taper: { ...chamfer(10), profile: 'fillet' } })
    );
    expect(cham).not.toBe(fill);
  });
});
