import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { isCradle, resolveCutoutLeanDeg } from '@/features/bin-designer/types';
import { cradleArc, cradleAxis, cradleOpensSide, normalizeCradle } from './cutoutCradle';
import { effectiveOpenSides, openSideBlocker, openSideChannels } from './cutoutOpenSides';
import { resolveScoop } from './cutoutScoopHelpers';
import { entryChamferWidth } from './cutoutFit';
import { splitBlockedReason } from './cutoutSplit';
import { throughBlockedReason } from './cutoutDepth';
import { planNestedOpenings } from './nestedCutoutOpenings';

function cradle(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'rectangle',
    x: 10,
    y: 0,
    width: 60,
    depth: 39,
    cutDepth: 12,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    cradle: true,
    ...overrides,
  };
}

function solid(cutouts: Cutout[]): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 1,
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts,
  };
}

describe('cradleArc', () => {
  it('passes through both top edges and the lowest point for a shallow cradle', () => {
    const { radius, endZ } = cradleArc(60, 12);
    expect(radius).toBeCloseTo(43.5, 6);
    expect(endZ).toBe(12);
    // The top edge sits on the circle centred `radius` above the lowest point.
    expect(Math.hypot(30, radius - 12)).toBeCloseTo(radius, 6);
  });

  it('stops at a half circle once the depth reaches half the width', () => {
    expect(cradleArc(20, 10)).toEqual({ radius: 10, endZ: 10 });
    expect(cradleArc(20, 16)).toEqual({ radius: 10, endZ: 10 });
  });
});

describe('cradleAxis', () => {
  it.each([
    [0, 'y'],
    [180, 'y'],
    [360, 'y'],
    [90, 'x'],
    [270, 'x'],
    [-90, 'x'],
    [45, null],
    [89.5, null],
  ] as const)('reads %s° as %s', (rotation, axis) => {
    expect(cradleAxis(rotation)).toBe(axis);
  });
});

describe('cradleOpensSide', () => {
  it('opens the walls its length runs into', () => {
    expect(cradleOpensSide(cradle(), 'front')).toBe(true);
    expect(cradleOpensSide(cradle(), 'back')).toBe(true);
    expect(cradleOpensSide(cradle(), 'left')).toBe(false);
    expect(cradleOpensSide(cradle({ rotation: 90 }), 'left')).toBe(true);
    expect(cradleOpensSide(cradle({ rotation: 90 }), 'front')).toBe(false);
  });

  it('opens nothing for a pocket that is not a cradle', () => {
    expect(cradleOpensSide(cradle({ cradle: undefined }), 'front')).toBe(false);
  });
});

describe('normalizeCradle', () => {
  it('keeps a consistent cradle and a plain pocket by reference', () => {
    const c = cradle();
    expect(normalizeCradle(c)).toBe(c);
    const plain = cradle({ cradle: undefined });
    delete (plain as { cradle?: boolean }).cradle;
    expect(normalizeCradle(plain)).toBe(plain);
  });

  it('squares a cradle’s corners', () => {
    expect(normalizeCradle(cradle({ cornerRadius: 4 })).cornerRadius).toBe(0);
  });

  it('drops the flag when it is off or on a shape that cannot be a cradle', () => {
    expect('cradle' in normalizeCradle(cradle({ cradle: false }))).toBe(false);
    expect('cradle' in normalizeCradle(cradle({ cradle: undefined }))).toBe(false);
    const slot = normalizeCradle(cradle({ shape: 'slot', cornerRadius: 3 }));
    expect('cradle' in slot).toBe(false);
    expect(slot.cornerRadius).toBe(3);
  });
});

describe('a cradle holds the floor-shaping fields inert', () => {
  const c = cradle({
    scoopRadiusW: 6,
    scoopRadiusD: 6,
    chamferWidth: 2,
    leanDeg: 20,
    split: { a: { x: 0, y: -30 }, b: { x: 0, y: 30 }, cutDepth: 4 },
  });

  it('reads as a cradle only on a rectangle', () => {
    expect(isCradle(c)).toBe(true);
    expect(isCradle({ ...c, shape: 'circle' })).toBe(false);
  });

  it('takes no scoop, entry edge or lean', () => {
    expect(resolveScoop(c, 12)).toMatchObject({ w: 0, d: 0 });
    expect(entryChamferWidth(c)).toBe(0);
    expect(resolveCutoutLeanDeg(c)).toBe(0);
  });

  it('cannot be split or cut through', () => {
    expect(splitBlockedReason(c)).toBe('shape');
    expect(throughBlockedReason(c, solid([c]))).toBe('cradle');
  });

  it('is never a floor another pocket opens onto', () => {
    const inside: Cutout = {
      ...cradle({ id: 'p', cradle: undefined, x: 30, y: 10, width: 10, depth: 10, cutDepth: 20 }),
      chamferWidth: 1,
    };
    const plan = planNestedOpenings([cradle(), inside], 20);
    expect(plan.sunk.size).toBe(0);
    expect(plan.flares).toHaveLength(0);
    // The same host with a flat floor does take the pocket's entry edge.
    expect(planNestedOpenings([cradle({ cradle: undefined }), inside], 20).sunk.size).toBe(1);
  });
});

describe('a cradle’s open sides', () => {
  it('keeps only the walls at its ends, at its full width', () => {
    const c = cradle({
      openSides: [{ side: 'front', widthMm: 10 }, { side: 'back', tunnel: true }, { side: 'left' }],
    });
    expect(effectiveOpenSides(c, solid([c]))).toEqual([
      { side: 'front' },
      { side: 'back', tunnel: true },
    ]);
  });

  it('plans channels that carry the arc across the whole chord, with no flare', () => {
    const c = cradle({ chamferWidth: 2, openSides: [{ side: 'front', widthMm: 10 }] });
    const [channel] = openSideChannels(solid([c]));
    expect(channel).toMatchObject({ side: 'front', lo: 10, hi: 70, chamferMm: 0, cradle: true });
  });

  it('opens nothing when turned off square to the walls', () => {
    const c = cradle({ rotation: 30, openSides: [{ side: 'front' }] });
    expect(openSideBlocker(c, solid([c]))).toBe('cradleAngle');
    expect(openSideChannels(solid([c]))).toHaveLength(0);
  });

  it('opens each turned copy of a radial repeat only where its own ends meet the walls', () => {
    const c = cradle({
      x: 30,
      y: 10,
      width: 20,
      depth: 20,
      cutDepth: 6,
      openSides: [{ side: 'front' }, { side: 'back' }],
      array: {
        mode: 'radial',
        cols: 1,
        rows: 1,
        pitchX: 0,
        pitchY: 0,
        count: 8,
        radius: 10,
        startAngle: 0,
        rotateToCenter: true,
      },
    });
    const channels = openSideChannels(solid([c]));
    // Only the copies at 0° and 180° run front to back. The 90° and 270° copies
    // run into the side walls, which are not picked, and the rest are off square.
    expect(channels).toHaveLength(4);
    for (const ch of channels) expect(ch.hi - ch.lo).toBeCloseTo(20, 5);
  });

  it('keeps every member of a group with a cradle in it enclosed', () => {
    const c = cradle({ groupId: 'g', openSides: [{ side: 'front' }] });
    const other = cradle({
      id: 'o',
      cradle: undefined,
      groupId: 'g',
      openSides: [{ side: 'back' }],
    });
    const params = solid([c, other]);
    expect(openSideBlocker(other, params)).toBe('cradleGroup');
    expect(openSideChannels(params)).toHaveLength(0);
  });

  it('leaves a flat pocket’s channel unmarked', () => {
    const c = cradle({ cradle: undefined, openSides: [{ side: 'front' }] });
    const [channel] = openSideChannels(solid([c]));
    expect(channel.cradle).toBeUndefined();
  });
});
