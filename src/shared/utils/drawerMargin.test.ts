import { describe, it, expect } from 'vitest';
import {
  binMarginSides,
  binCanExtendToMargin,
  resolveBinMarginOverhang,
  resolveBinOverhang,
  binOverhangSides,
} from './drawerMargin';
import type { OverhangSource } from './drawerMargin';
import { gridUnits, mm } from '@/core/types';
import type { Drawer, StoredBaseplateParams } from '@/core/types';

const DRAWER: Pick<Drawer, 'width' | 'depth'> = {
  width: gridUnits(5),
  depth: gridUnits(4),
};

function baseplate(overrides: Partial<StoredBaseplateParams> = {}): StoredBaseplateParams {
  return {
    magnetHoles: false,
    magnetDiameter: mm(6),
    magnetDepth: mm(2),
    paddingLeft: mm(0),
    paddingRight: mm(0),
    paddingFront: mm(0),
    paddingBack: mm(0),
    ...overrides,
  };
}

function bin(
  x: number,
  y: number,
  width: number,
  depth: number,
  extendToMargin = false
): OverhangSource {
  return {
    x: gridUnits(x),
    y: gridUnits(y),
    width: gridUnits(width),
    depth: gridUnits(depth),
    extendToMargin,
  };
}

describe('binMarginSides', () => {
  it('is all-zero with no baseplate', () => {
    expect(binMarginSides(bin(0, 0, 1, 1), DRAWER, undefined)).toEqual({
      left: 0,
      right: 0,
      front: 0,
      back: 0,
    });
  });

  it('claims padding only on abutting edges (bottom-left corner)', () => {
    const bp = baseplate({
      paddingLeft: mm(3),
      paddingRight: mm(3),
      paddingFront: mm(2),
      paddingBack: mm(2),
    });
    // Bin in the bottom-left corner abuts left (x=0) and front (y=0) only.
    expect(binMarginSides(bin(0, 0, 1, 1), DRAWER, bp)).toEqual({
      left: 3,
      right: 0,
      front: 2,
      back: 0,
    });
  });

  it('maps the far edges (top-right corner)', () => {
    const bp = baseplate({
      paddingLeft: mm(3),
      paddingRight: mm(3),
      paddingFront: mm(2),
      paddingBack: mm(2),
    });
    // Bin whose right edge = drawer.width and top edge = drawer.depth.
    expect(binMarginSides(bin(4, 3, 1, 1), DRAWER, bp)).toEqual({
      left: 0,
      right: 3,
      front: 0,
      back: 2,
    });
  });

  it('claims nothing for an interior bin', () => {
    const bp = baseplate({
      paddingLeft: mm(3),
      paddingRight: mm(3),
      paddingFront: mm(2),
      paddingBack: mm(2),
    });
    expect(binMarginSides(bin(1, 1, 2, 1), DRAWER, bp)).toEqual({
      left: 0,
      right: 0,
      front: 0,
      back: 0,
    });
  });

  it('ignores an abutting edge that has no padding', () => {
    const bp = baseplate({ paddingLeft: mm(0), paddingBack: mm(5) });
    // Abuts left (no padding) and back (padding 5).
    expect(binMarginSides(bin(0, 3, 1, 1), DRAWER, bp)).toEqual({
      left: 0,
      right: 0,
      front: 0,
      back: 5,
    });
  });

  it('handles a fractional far edge', () => {
    const bp = baseplate({ paddingRight: mm(4) });
    const fracDrawer = { width: gridUnits(5.5), depth: gridUnits(4) };
    // Bin ending at 5.5 abuts the (fractional) right edge.
    expect(binMarginSides(bin(5, 0, 0.5, 1), fracDrawer, bp).right).toBe(4);
  });

  it('clamps negative padding to zero', () => {
    const bp = baseplate({ paddingLeft: mm(-5) });
    expect(binMarginSides(bin(0, 1, 1, 1), DRAWER, bp).left).toBe(0);
  });
});

describe('binCanExtendToMargin', () => {
  it('is true when the bin abuts a padded edge', () => {
    expect(binCanExtendToMargin(bin(0, 1, 1, 1), DRAWER, baseplate({ paddingLeft: mm(3) }))).toBe(
      true
    );
  });

  it('is false when the abutting edge has no padding', () => {
    expect(binCanExtendToMargin(bin(0, 1, 1, 1), DRAWER, baseplate({ paddingBack: mm(3) }))).toBe(
      false
    );
  });

  it('is false for an interior bin and with no baseplate', () => {
    expect(binCanExtendToMargin(bin(1, 1, 1, 1), DRAWER, baseplate({ paddingLeft: mm(3) }))).toBe(
      false
    );
    expect(binCanExtendToMargin(bin(0, 0, 1, 1), DRAWER, undefined)).toBe(false);
  });
});

describe('resolveBinMarginOverhang', () => {
  const bp = baseplate({ paddingLeft: mm(3), paddingFront: mm(2), overTile: true });

  it('returns null when the bin has not opted in', () => {
    expect(resolveBinMarginOverhang(bin(0, 0, 1, 1, false), DRAWER, bp)).toBeNull();
  });

  it('returns null when opted in but abutting no padded edge (dormant)', () => {
    expect(resolveBinMarginOverhang(bin(1, 1, 1, 1, true), DRAWER, bp)).toBeNull();
  });

  it('derives the overhang from padding on abutting sides, feet from over-tile', () => {
    expect(resolveBinMarginOverhang(bin(0, 0, 1, 1, true), DRAWER, bp)).toEqual({
      enabled: true,
      left: 3,
      right: 0,
      front: 2,
      back: 0,
      feet: true,
    });
  });

  it('uses flat feet for a solid (non-over-tiled) margin', () => {
    const solid = baseplate({ paddingLeft: mm(3), overTile: false });
    expect(resolveBinMarginOverhang(bin(0, 1, 1, 1, true), DRAWER, solid)?.feet).toBe(false);
  });

  it('adds the flare on top of the padding on every abutting edge (#2933)', () => {
    const solid = baseplate({ paddingLeft: mm(3), paddingFront: mm(2), overTile: false });
    const b = {
      ...bin(0, 0, 1, 1, true),
      marginTaper: { profile: 'chamfer' as const, bandHeight: 6, enabled: true, flare: 5 },
    };
    expect(resolveBinMarginOverhang(b, DRAWER, solid)).toEqual({
      enabled: true,
      // Rim = padding + flare on the two abutting edges; the base keeps the
      // padding, so the taper insets by the flare alone.
      left: 8,
      right: 0,
      front: 7,
      back: 0,
      feet: false,
      taper: {
        enabled: true,
        profile: 'chamfer',
        bandHeight: 6,
        left: 5,
        right: 0,
        front: 5,
        back: 0,
      },
    });
  });

  it('omits the taper when the flare is zero (nothing to inset)', () => {
    const solid = baseplate({ paddingLeft: mm(3), overTile: false });
    const b = {
      ...bin(0, 0, 1, 1, true),
      marginTaper: { profile: 'chamfer' as const, bandHeight: 6, enabled: true },
    };
    const resolved = resolveBinMarginOverhang(b, DRAWER, solid);
    expect(resolved?.taper).toBeUndefined();
    expect(resolved?.left).toBe(3);
  });

  it('does not flare an edge the bin does not abut', () => {
    const solid = baseplate({ paddingLeft: mm(3), paddingRight: mm(4), overTile: false });
    const b = {
      ...bin(0, 0, 1, 1, true),
      marginTaper: { profile: 'chamfer' as const, bandHeight: 6, enabled: true, flare: 5 },
    };
    const resolved = resolveBinMarginOverhang(b, DRAWER, solid);
    expect(resolved?.right).toBe(0);
    expect(resolved?.taper?.right).toBe(0);
  });

  it('keeps the taper on an over-tiled baseplate (feet are framed from the base)', () => {
    const b = {
      ...bin(0, 0, 1, 1, true),
      marginTaper: { profile: 'fillet' as const, bandHeight: 6, enabled: true, flare: 6 },
    };
    const resolved = resolveBinMarginOverhang(b, DRAWER, bp);
    expect(resolved?.feet).toBe(true);
    expect(resolved?.taper).toMatchObject({ enabled: true, profile: 'fillet' });
  });

  it('omits the taper when marginTaper is not enabled', () => {
    const solid = baseplate({ paddingLeft: mm(3), overTile: false });
    const b = {
      ...bin(0, 0, 1, 1, true),
      marginTaper: { profile: 'chamfer' as const, bandHeight: 6, enabled: false },
    };
    expect(resolveBinMarginOverhang(b, DRAWER, solid)?.taper).toBeUndefined();
  });
});

describe('resolveBinOverhang', () => {
  const bp = baseplate({ paddingLeft: mm(3), overTile: true });
  const explicit = { enabled: true, left: 7, right: 14, front: 0, back: 0 };

  it('falls through to null so the caller keeps the design overhang', () => {
    expect(resolveBinOverhang(bin(1, 1, 1, 1, false), DRAWER, bp)).toBeNull();
  });

  it('still derives the drawer margin when the bin carries no explicit overhang', () => {
    expect(resolveBinOverhang(bin(0, 0, 1, 1, true), DRAWER, bp)?.left).toBe(3);
  });

  it('serves an interior bin on a drawer with no padding at all', () => {
    const b = { ...bin(2, 1, 1, 1, false), overhang: explicit };
    expect(resolveBinOverhang(b, DRAWER, baseplate())).toEqual(explicit);
  });

  it('replaces (does not add to) a margin overhang on the same bin', () => {
    const b = { ...bin(0, 0, 1, 1, true), overhang: explicit };
    expect(resolveBinOverhang(b, DRAWER, bp)).toEqual(explicit);
  });

  it('ignores a disabled or all-zero explicit overhang', () => {
    const disabled = { ...bin(1, 1, 1, 1, false), overhang: { ...explicit, enabled: false } };
    const zero = {
      ...bin(1, 1, 1, 1, false),
      overhang: { enabled: true, left: 0, right: 0, front: 0, back: 0 },
    };
    expect(resolveBinOverhang(disabled, DRAWER, bp)).toBeNull();
    expect(resolveBinOverhang(zero, DRAWER, bp)).toBeNull();
  });

  it('falls back to the margin when the explicit overhang is disabled', () => {
    const b = { ...bin(0, 0, 1, 1, true), overhang: { ...explicit, enabled: false } };
    expect(resolveBinOverhang(b, DRAWER, bp)?.left).toBe(3);
  });
});

describe('binOverhangSides', () => {
  it('is all-zero when nothing resolves', () => {
    expect(binOverhangSides(bin(1, 1, 1, 1, false), DRAWER, baseplate())).toEqual({
      left: 0,
      right: 0,
      front: 0,
      back: 0,
    });
  });

  it('clamps a negative authored side to zero rather than shrinking the body', () => {
    const b = {
      ...bin(1, 1, 1, 1, false),
      overhang: { enabled: true, left: -5, right: 14, front: 0, back: 0 },
    };
    expect(binOverhangSides(b, DRAWER, baseplate())).toEqual({
      left: 0,
      right: 14,
      front: 0,
      back: 0,
    });
  });
});
