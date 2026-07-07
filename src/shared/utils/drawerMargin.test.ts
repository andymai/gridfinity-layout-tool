import { describe, it, expect } from 'vitest';
import { binMarginSides, binCanExtendToMargin, resolveBinMarginOverhang } from './drawerMargin';
import { gridUnits } from '@/core/types';
import type { Bin, Drawer, StoredBaseplateParams } from '@/core/types';

const DRAWER: Pick<Drawer, 'width' | 'depth'> = {
  width: gridUnits(5),
  depth: gridUnits(4),
};

function baseplate(overrides: Partial<StoredBaseplateParams> = {}): StoredBaseplateParams {
  return {
    magnetHoles: false,
    magnetDiameter: 6,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    ...overrides,
  };
}

function bin(x: number, y: number, width: number, depth: number, extendToMargin = false): Bin {
  return {
    x: gridUnits(x),
    y: gridUnits(y),
    width: gridUnits(width),
    depth: gridUnits(depth),
    extendToMargin,
  } as Bin;
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
    const bp = baseplate({ paddingLeft: 3, paddingRight: 3, paddingFront: 2, paddingBack: 2 });
    // Bin in the bottom-left corner abuts left (x=0) and front (y=0) only.
    expect(binMarginSides(bin(0, 0, 1, 1), DRAWER, bp)).toEqual({
      left: 3,
      right: 0,
      front: 2,
      back: 0,
    });
  });

  it('maps the far edges (top-right corner)', () => {
    const bp = baseplate({ paddingLeft: 3, paddingRight: 3, paddingFront: 2, paddingBack: 2 });
    // Bin whose right edge = drawer.width and top edge = drawer.depth.
    expect(binMarginSides(bin(4, 3, 1, 1), DRAWER, bp)).toEqual({
      left: 0,
      right: 3,
      front: 0,
      back: 2,
    });
  });

  it('claims nothing for an interior bin', () => {
    const bp = baseplate({ paddingLeft: 3, paddingRight: 3, paddingFront: 2, paddingBack: 2 });
    expect(binMarginSides(bin(1, 1, 2, 1), DRAWER, bp)).toEqual({
      left: 0,
      right: 0,
      front: 0,
      back: 0,
    });
  });

  it('ignores an abutting edge that has no padding', () => {
    const bp = baseplate({ paddingLeft: 0, paddingBack: 5 });
    // Abuts left (no padding) and back (padding 5).
    expect(binMarginSides(bin(0, 3, 1, 1), DRAWER, bp)).toEqual({
      left: 0,
      right: 0,
      front: 0,
      back: 5,
    });
  });

  it('handles a fractional far edge', () => {
    const bp = baseplate({ paddingRight: 4 });
    const fracDrawer = { width: gridUnits(5.5), depth: gridUnits(4) };
    // Bin ending at 5.5 abuts the (fractional) right edge.
    expect(binMarginSides(bin(5, 0, 0.5, 1), fracDrawer, bp).right).toBe(4);
  });

  it('clamps negative padding to zero', () => {
    const bp = baseplate({ paddingLeft: -5 });
    expect(binMarginSides(bin(0, 1, 1, 1), DRAWER, bp).left).toBe(0);
  });
});

describe('binCanExtendToMargin', () => {
  it('is true when the bin abuts a padded edge', () => {
    expect(binCanExtendToMargin(bin(0, 1, 1, 1), DRAWER, baseplate({ paddingLeft: 3 }))).toBe(true);
  });

  it('is false when the abutting edge has no padding', () => {
    expect(binCanExtendToMargin(bin(0, 1, 1, 1), DRAWER, baseplate({ paddingBack: 3 }))).toBe(
      false
    );
  });

  it('is false for an interior bin and with no baseplate', () => {
    expect(binCanExtendToMargin(bin(1, 1, 1, 1), DRAWER, baseplate({ paddingLeft: 3 }))).toBe(
      false
    );
    expect(binCanExtendToMargin(bin(0, 0, 1, 1), DRAWER, undefined)).toBe(false);
  });
});

describe('resolveBinMarginOverhang', () => {
  const bp = baseplate({ paddingLeft: 3, paddingFront: 2, overTile: true });

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
    const solid = baseplate({ paddingLeft: 3, overTile: false });
    expect(resolveBinMarginOverhang(bin(0, 1, 1, 1, true), DRAWER, solid)?.feet).toBe(false);
  });
});
