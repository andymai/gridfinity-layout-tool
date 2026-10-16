// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  insideWallBounds,
  insideWallObstacles,
  insideWallSegments,
  insideWallTextBlock,
  maximalClearRects,
  type InsideWallDims,
  type WallRect,
} from './insideWallTextPlan';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { resolveBinFloorMm } from './slotMath';

const DIMS: InsideWallDims = {
  innerW: 81.1,
  innerD: 81.1,
  wallHeight: 23.25,
  interiorHeight: 22.55,
};

const params = (over: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 2,
  height: 4,
  ...over,
});

const BOX: WallRect = { minU: 0, maxU: 100, minZ: 0, maxZ: 50 };

const area = (r: WallRect): number => (r.maxU - r.minU) * (r.maxZ - r.minZ);

describe('maximalClearRects', () => {
  it('returns the bounds when nothing is in the way', () => {
    expect(maximalClearRects(BOX, [])).toEqual([BOX]);
  });

  it('returns the four regions around a central obstacle, none inside another', () => {
    const rects = maximalClearRects(BOX, [{ minU: 40, maxU: 60, minZ: 20, maxZ: 30 }]);
    expect(rects).toHaveLength(4);
    expect(rects).toContainEqual({ minU: 0, maxU: 40, minZ: 0, maxZ: 50 });
    expect(rects).toContainEqual({ minU: 60, maxU: 100, minZ: 0, maxZ: 50 });
    expect(rects).toContainEqual({ minU: 0, maxU: 100, minZ: 0, maxZ: 20 });
    expect(rects).toContainEqual({ minU: 0, maxU: 100, minZ: 30, maxZ: 50 });
  });

  // A shelf across the top and a pad down each end: a union of the three
  // covers the whole wall, though the area under the shelf is clear.
  it('finds the region boxed in by separate obstacles', () => {
    const rects = maximalClearRects(BOX, [
      { minU: 0, maxU: 100, minZ: 35, maxZ: 50 },
      { minU: -Infinity, maxU: 10, minZ: -Infinity, maxZ: Infinity },
      { minU: 90, maxU: Infinity, minZ: -Infinity, maxZ: Infinity },
    ]);
    expect(rects).toEqual([{ minU: 10, maxU: 90, minZ: 0, maxZ: 35 }]);
  });

  it('ignores obstacles outside the bounds', () => {
    expect(maximalClearRects(BOX, [{ minU: 120, maxU: 130, minZ: 0, maxZ: 50 }])).toEqual([BOX]);
  });
});

describe('insideWallTextBlock', () => {
  it('blocks a solid bin, which has no cavity', () => {
    const solid = params({ style: 'solid', base: { ...DEFAULT_BIN_PARAMS.base, solid: true } });
    expect(insideWallTextBlock(solid, 'back')).toBe('solid');
  });

  it('blocks only the walls a scoop rises to', () => {
    const scooped = params({
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, side: 'front' },
    });
    expect(insideWallTextBlock(scooped, 'front')).toBe('scoop');
    expect(insideWallTextBlock(scooped, 'back')).toBeNull();
    expect(insideWallTextBlock(params(), 'front')).toBeNull();
  });
});

describe('insideWallBounds', () => {
  it('runs from the floor to below the stacking lip support', () => {
    const p = params();
    const bounds = insideWallBounds(p, DIMS, 'back');
    expect(bounds?.minZ).toBeCloseTo(resolveBinFloorMm(p), 6);
    expect(bounds?.maxZ).toBeCloseTo(DIMS.wallHeight - 2.6, 6);
  });

  it('drops below the click rails a lid hangs into the cavity', () => {
    const p = params({
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'clickRails' },
    });
    expect(insideWallBounds(p, DIMS, 'back')?.maxZ).toBeCloseTo(DIMS.wallHeight - 4.05, 6);
  });

  it('rises above the highest raised compartment floor and its fillet', () => {
    const p = params({
      interiorFilletMm: 2,
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, floorRaises: [3] },
    });
    expect(insideWallBounds(p, DIMS, 'back')?.minZ).toBeCloseTo(resolveBinFloorMm(p) + 5, 6);
  });
});

describe('insideWallSegments', () => {
  it('is one stretch without dividers', () => {
    const p = params();
    const bounds = insideWallBounds(p, DIMS, 'back');
    if (!bounds) throw new Error('no bounds');
    expect(insideWallSegments(p, DIMS, 'back', bounds)).toHaveLength(1);
  });

  it('splits at every divider meeting the wall, and only that wall', () => {
    const p = params({
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 3, rows: 1, cells: [0, 1, 2] },
    });
    const bounds = insideWallBounds(p, DIMS, 'back');
    if (!bounds) throw new Error('no bounds');
    const segments = insideWallSegments(p, DIMS, 'back', bounds);
    expect(segments).toHaveLength(3);
    const firstDivider = -DIMS.innerW / 2 + DIMS.innerW / 3;
    expect(segments[0].maxU).toBeLessThan(firstDivider);
    expect(segments[1].minU).toBeGreaterThan(firstDivider);

    const sideBounds = insideWallBounds(p, DIMS, 'left');
    if (!sideBounds) throw new Error('no bounds');
    expect(insideWallSegments(p, DIMS, 'left', sideBounds)).toHaveLength(1);
  });
});

describe('insideWallObstacles', () => {
  it('blocks the label shelf on the back wall only', () => {
    const p = params({ label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } });
    const back = insideWallObstacles(p, DIMS, 'back');
    expect(back.length).toBeGreaterThan(0);
    for (const o of back) expect(o.maxZ).toBeGreaterThan(DIMS.interiorHeight - 3);
    expect(insideWallObstacles(p, DIMS, 'front')).toEqual([]);
  });

  it('blocks both ends of every wall for magnet pads', () => {
    const p = params({
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'magnetic' },
    });
    for (const side of ['front', 'back', 'left', 'right'] as const) {
      const pads = insideWallObstacles(p, DIMS, side);
      expect(pads.some((o) => o.minU === -Infinity)).toBe(true);
      expect(pads.some((o) => o.maxU === Infinity)).toBe(true);
    }
  });

  it('blocks the corner a front scoop buries into on the side walls', () => {
    const p = params({ scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, side: 'front' } });
    const left = insideWallObstacles(p, DIMS, 'left');
    expect(left).toHaveLength(1);
    expect(left[0].minU).toBeCloseTo(-DIMS.innerD / 2, 6);
    expect(left[0].maxU).toBeGreaterThan(-DIMS.innerD / 2 + 5);
    expect(insideWallObstacles(p, DIMS, 'back')).toEqual([]);
  });

  it('keeps clear area on a bin with nothing inside', () => {
    expect(insideWallObstacles(params(), DIMS, 'back')).toEqual([]);
  });

  it('leaves a usable region below a full-width shelf between magnet pads', () => {
    const p = params({
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'magnetic' },
    });
    const bounds = insideWallBounds(p, DIMS, 'back');
    if (!bounds) throw new Error('no bounds');
    const rects = maximalClearRects(bounds, insideWallObstacles(p, DIMS, 'back'));
    expect(Math.max(...rects.map(area))).toBeGreaterThan(100);
  });
});
