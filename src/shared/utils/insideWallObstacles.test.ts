// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { insideWallObstacles, type InsideWallDims } from './insideWallObstacles';
import { insideWallBounds } from './insideWallTextPlan';
import { maximalClearRects, type WallRect } from './maximalClearRects';
import { planHingeLid } from './hingeLidPlan';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { resolveLidHinge } from '@/shared/types/bin';

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

const area = (r: WallRect): number => (r.maxU - r.minU) * (r.maxZ - r.minZ);

describe('insideWallObstacles', () => {
  it('blocks the label shelf on the back wall only', () => {
    const p = params({ label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } });
    const back = insideWallObstacles(p, DIMS, 'back', 0);
    expect(back.length).toBeGreaterThan(0);
    for (const o of back) expect(o.maxZ).toBeGreaterThan(DIMS.interiorHeight - 3);
    expect(insideWallObstacles(p, DIMS, 'front', 0)).toEqual([]);
  });

  it("places a hinge's magnet catch pads on its catch side only", () => {
    const p = params({
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        enabled: true,
        attachment: 'hinge',
        hinge: { ...resolveLidHinge(DEFAULT_BIN_PARAMS.lid), catchMode: 'magnets' },
      },
    });
    const catchSide = planHingeLid(p).geometry?.catchSide;
    expect(catchSide).toBe('front');
    expect(insideWallObstacles(p, DIMS, 'front', 0).length).toBeGreaterThan(0);
    expect(insideWallObstacles(p, DIMS, 'back', 0)).toEqual([]);
    for (const o of insideWallObstacles(p, DIMS, 'left', 0)) expect(o.maxU).toBeLessThan(0);
  });

  it('blocks both ends of every wall for magnet pads', () => {
    const p = params({
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'magnetic' },
    });
    for (const side of ['front', 'back', 'left', 'right'] as const) {
      const pads = insideWallObstacles(p, DIMS, side, 0);
      expect(pads.some((o) => o.minU === -Infinity)).toBe(true);
      expect(pads.some((o) => o.maxU === Infinity)).toBe(true);
    }
  });

  it('blocks the corner a front scoop buries into on the side walls', () => {
    const p = params({ scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, side: 'front' } });
    const left = insideWallObstacles(p, DIMS, 'left', 0);
    expect(left).toHaveLength(1);
    expect(left[0].minU).toBeCloseTo(-DIMS.innerD / 2, 6);
    expect(left[0].maxU).toBeGreaterThan(-DIMS.innerD / 2 + 5);
    expect(insideWallObstacles(p, DIMS, 'back', 0)).toEqual([]);
  });

  it('keeps clear area on a bin with nothing inside', () => {
    expect(insideWallObstacles(params(), DIMS, 'back', 0)).toEqual([]);
  });

  it('leaves a usable region below a full-width shelf between magnet pads', () => {
    const p = params({
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'magnetic' },
    });
    const bounds = insideWallBounds(p, DIMS, 'back');
    if (!bounds) throw new Error('no bounds');
    const rects = maximalClearRects(bounds, insideWallObstacles(p, DIMS, 'back', 0));
    expect(Math.max(...rects.map(area))).toBeGreaterThan(100);
  });
});

describe('insideWallObstacles, features beyond the corner', () => {
  it('blocks the ramp end of every compartment against the wall, not only the corner one', () => {
    const p = params({
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 1, rows: 2, cells: [0, 1] },
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, side: 'front' },
    });
    const left = insideWallObstacles(p, DIMS, 'left', 0);
    expect(left).toHaveLength(2);
    const [outer, inner] = [...left].sort((a, b) => a.minU - b.minU);
    expect(outer.minU).toBeCloseTo(-DIMS.innerD / 2, 6);
    expect(outer.maxZ).toBe(Infinity);
    expect(inner.minU).toBeCloseTo(0, 6);
    expect(Number.isFinite(inner.maxZ)).toBe(true);
  });

  it('blocks a label tab inset from the wall only within the caption reach', () => {
    const p = params({
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid', inset: 1 },
    });
    expect(insideWallObstacles(p, DIMS, 'back', 0)).toEqual([]);
    expect(insideWallObstacles(p, DIMS, 'back', 1.5).length).toBeGreaterThan(0);
  });

  it('blocks the ends of interior slide rails on the side walls', () => {
    const p = params({
      slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true, railDropMm: 0, railProtrusionMm: 6 },
    });
    const rails = insideWallObstacles(p, DIMS, 'front', 0);
    expect(rails.length).toBeGreaterThan(0);
    const ends = insideWallObstacles(p, DIMS, 'left', 0);
    expect(ends.some((o) => o.minU < -DIMS.innerD / 2 + 10)).toBe(true);
    expect(ends.some((o) => o.maxU > DIMS.innerD / 2 - 10)).toBe(true);
  });

  it('blocks the end of a wall that a tapered neighbour leans over, below its band', () => {
    const p = params({
      overhang: {
        left: 0,
        right: 6,
        front: 0,
        back: 0,
        feet: false,
        taper: {
          enabled: true,
          profile: 'chamfer',
          bandHeight: 12,
          left: 0,
          right: 6,
          front: 0,
          back: 0,
        },
      },
    });
    const back = insideWallObstacles(p, DIMS, 'back', 0);
    expect(back).toHaveLength(1);
    expect(back[0].maxU).toBe(Infinity);
    expect(back[0].minU).toBeCloseTo(DIMS.innerW / 2 - 6, 6);
    expect(back[0].maxZ).toBeCloseTo(12, 6);
  });

  it('widens a wall cutout by its rounded top shoulders', () => {
    const walls = {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      back: { ...DEFAULT_BIN_PARAMS.walls.left, cornerRadiusTop: 10 },
    };
    const shoulders = insideWallObstacles(params({ walls }), DIMS, 'back', 0);
    expect(shoulders).toHaveLength(1);
    const nominal = 0.7 * DIMS.innerW;
    expect(shoulders[0].maxU - shoulders[0].minU).toBeGreaterThan(nominal + 19);
  });

  it('holds a large shoulder radius to what the cutout builder can fit', () => {
    const walls = {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      back: { ...DEFAULT_BIN_PARAMS.walls.left, width: 40, depth: 20, cornerRadiusTop: 25 },
    };
    const short = { ...DIMS, wallHeight: 9.25, interiorHeight: 8.55 };
    const [shoulders] = insideWallObstacles(params({ height: 2, walls }), short, 'back', 0);
    expect(shoulders.maxU - shoulders.minU).toBeLessThan(DIMS.innerW);
    expect(shoulders.minZ).toBeGreaterThan(short.wallHeight - 9.25 * 0.2);
  });

  it('skips the ramp end of a compartment the worker builds no ramp for', () => {
    const p = params({
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 2, cells: [0, 0, 0, 1] },
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, side: 'front' },
    });
    expect(insideWallObstacles(p, DIMS, 'left', 0)).toEqual([]);
  });
});
