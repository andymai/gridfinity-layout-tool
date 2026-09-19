import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import {
  effectiveOpenSides,
  localEdgeFacing,
  normalizeOpenSides,
  openSideBlocker,
  openSideWallExits,
  rectangleWorldHalfExtents,
} from './cutoutOpenSides';

const INNER = 81.1;

function rect(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'r1',
    shape: 'rectangle',
    x: 10,
    y: 20,
    width: 30,
    depth: 12,
    cutDepth: 8,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    openSides: ['right'],
    ...overrides,
  };
}

function solid(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    ...overrides,
  };
}

describe('openSideBlocker', () => {
  it('passes an upright, ungrouped, square-rotated rectangle on a solid host', () => {
    expect(openSideBlocker(rect(), solid())).toBeNull();
    expect(openSideBlocker(rect({ rotation: 270 }), solid())).toBeNull();
  });

  it('names the cutout-side reason before the host-side one', () => {
    expect(openSideBlocker(rect({ shape: 'circle' }), solid())).toBe('shape');
    expect(openSideBlocker(rect({ groupId: 'g' }), solid())).toBe('grouped');
    expect(openSideBlocker(rect({ rotation: 45 }), solid())).toBe('rotation');
    expect(openSideBlocker(rect({ leanDeg: 10 }), solid())).toBe('lean');
    expect(openSideBlocker(rect({ rotation: 45, groupId: 'g' }), DEFAULT_BIN_PARAMS)).toBe(
      'grouped'
    );
  });

  it('refuses a cavity host and a tapered wall', () => {
    expect(openSideBlocker(rect(), DEFAULT_BIN_PARAMS)).toBe('host');
    const tapered = solid({
      overhang: {
        enabled: true,
        left: 3,
        right: 3,
        front: 3,
        back: 3,
        taper: {
          enabled: true,
          profile: 'chamfer',
          bandHeight: 5,
          left: 3,
          right: 3,
          front: 3,
          back: 3,
        },
      },
    });
    expect(openSideBlocker(rect(), tapered)).toBe('taper');
  });
});

describe('normalizeOpenSides', () => {
  it('keeps real sides once each in canonical order, and drops an empty set', () => {
    expect(normalizeOpenSides(['right', 'front', 'right', 'up'])).toEqual(['front', 'right']);
    expect(normalizeOpenSides([])).toBeUndefined();
    expect(normalizeOpenSides('right')).toBeUndefined();
  });
});

describe('effectiveOpenSides', () => {
  it('is empty for a hidden or gated cutout and the stored set otherwise', () => {
    expect(effectiveOpenSides(rect({ hidden: true }), solid())).toEqual([]);
    expect(effectiveOpenSides(rect({ rotation: 30 }), solid())).toEqual([]);
    expect(effectiveOpenSides(rect({ openSides: ['back', 'left'] }), solid())).toEqual([
      'back',
      'left',
    ]);
  });
});

describe('rectangleWorldHalfExtents', () => {
  it('swaps the axes on a quarter turn only', () => {
    expect(rectangleWorldHalfExtents({ width: 30, depth: 12, rotation: 0 })).toEqual({
      halfX: 15,
      halfY: 6,
    });
    expect(rectangleWorldHalfExtents({ width: 30, depth: 12, rotation: 90 })).toEqual({
      halfX: 6,
      halfY: 15,
    });
    expect(rectangleWorldHalfExtents({ width: 30, depth: 12, rotation: 180 })).toEqual({
      halfX: 15,
      halfY: 6,
    });
    expect(rectangleWorldHalfExtents({ width: 30, depth: 12, rotation: -90 })).toEqual({
      halfX: 6,
      halfY: 15,
    });
  });
});

describe('localEdgeFacing', () => {
  it('is the identity unrotated and follows the knife exit table when turned', () => {
    expect(localEdgeFacing('right', 0)).toBe('right');
    expect(localEdgeFacing('front', 0)).toBe('front');
    // Local +X sweeps right → front → left → back through 0/90/180/270.
    expect(localEdgeFacing('front', 90)).toBe('right');
    expect(localEdgeFacing('left', 180)).toBe('right');
    expect(localEdgeFacing('back', 270)).toBe('right');
    expect(localEdgeFacing('right', 90)).toBe('back');
  });
});

describe('openSideWallExits', () => {
  it('centres each exit on the pocket and reports its span across the wall', () => {
    const exits = openSideWallExits(
      solid({ cutouts: [rect({ openSides: ['right', 'front'] })] }),
      INNER,
      INNER
    );
    expect(exits).toHaveLength(2);
    const right = exits.find((e) => e.side === 'right');
    const front = exits.find((e) => e.side === 'front');
    expect(right?.centre).toBeCloseTo(20 + 6 - INNER / 2, 5);
    expect(right?.width).toBe(12);
    expect(front?.centre).toBeCloseTo(10 + 15 - INNER / 2, 5);
    expect(front?.width).toBe(30);
  });

  it('measures a quarter-turned pocket across its swapped axis', () => {
    const [exit] = openSideWallExits(
      solid({ cutouts: [rect({ rotation: 90, openSides: ['front'] })] }),
      INNER,
      INNER
    );
    expect(exit.side).toBe('front');
    expect(exit.width).toBe(12);
    expect(exit.centre).toBeCloseTo(10 + 15 - INNER / 2, 5);
  });

  it('expands repeat arrays into one exit per copy and skips gated cutouts', () => {
    const exits = openSideWallExits(
      solid({
        cutouts: [
          rect({
            array: {
              mode: 'grid',
              cols: 1,
              rows: 3,
              pitchX: 12,
              pitchY: 15,
              count: 1,
              radius: 20,
              startAngle: 0,
              rotateToCenter: false,
            },
          }),
          rect({ id: 'gated', rotation: 30 }),
        ],
      }),
      INNER,
      INNER
    );
    expect(exits.map((e) => e.centre)).toEqual([
      expect.closeTo(26 - INNER / 2, 5),
      expect.closeTo(41 - INNER / 2, 5),
      expect.closeTo(56 - INNER / 2, 5),
    ]);
  });

  it('reports nothing on a cavity bin', () => {
    expect(openSideWallExits({ ...DEFAULT_BIN_PARAMS, cutouts: [rect()] }, INNER, INNER)).toEqual(
      []
    );
  });
});
