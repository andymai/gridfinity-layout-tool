// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { insideWallBounds, insideWallSegments, insideWallTextBlock } from './insideWallTextPlan';
import type { InsideWallDims } from './insideWallObstacles';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { resolveBinFloorMm, resolveCompartmentDividerHeight } from './slotMath';
import { planHingeLid } from './hingeLidPlan';

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

  it("drops below a sliding lid's shelf, which hangs deeper than a rail", () => {
    const p = params({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'slide' } });
    expect(insideWallBounds(p, DIMS, 'back')?.maxZ).toBeLessThan(DIMS.wallHeight - 4.05);
  });

  it('leaves the bin its captions when a sliding lid cannot be built', () => {
    const p = params({
      height: 2,
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'slide' },
    });
    const dims = { ...DIMS, wallHeight: 9.25, interiorHeight: 8.55 };
    expect(insideWallBounds(p, dims, 'back')?.maxZ).toBeCloseTo(dims.wallHeight - 2.6, 6);
  });

  it("keeps clear of a hinged lid's detent on the catch wall only, with no interior relief", () => {
    const p = params({
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        enabled: true,
        attachment: 'hinge',
        relieveInterior: false,
      },
    });
    const catchSide = planHingeLid(p).geometry?.catchSide;
    if (!catchSide) throw new Error('hinge not buildable');
    const other = catchSide === 'front' ? 'back' : 'front';
    expect(insideWallBounds(p, DIMS, catchSide)?.maxZ).toBeCloseTo(DIMS.wallHeight - 4.05, 6);
    expect(insideWallBounds(p, DIMS, other)?.maxZ).toBeCloseTo(DIMS.wallHeight - 2.6, 6);
  });

  it("drops below a lid fill plug seated deeper than the lip's support", () => {
    const p = params({
      heightUnitMm: 3,
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        enabled: true,
        attachment: 'magnetic',
        fill: true,
        retentionMagnet: { ...DEFAULT_BIN_PARAMS.lid.retentionMagnet, depth: 6 },
      },
    });
    expect(insideWallBounds(p, DIMS, 'back')?.maxZ).toBeLessThan(DIMS.wallHeight - 4.5);
  });

  it('starts at the base floor, leaving raised floors and the fillet to the obstacles', () => {
    const p = params({
      interiorFilletMm: 2,
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, floorRaises: [3] },
    });
    expect(insideWallBounds(p, DIMS, 'back')?.minZ).toBeCloseTo(resolveBinFloorMm(p), 6);
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

  it("widens a leaning divider's joint by its horizontal section", () => {
    const grid = { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] };
    const gapAt = (rakeDeg: number): number => {
      const p = params({
        compartments: {
          ...grid,
          dividerHeight: 2,
          dividerOverrides: [
            { compartmentA: 0, compartmentB: 1, offsetStart: 0, offsetEnd: 0, rakeDeg },
          ],
        },
      });
      const bounds = insideWallBounds(p, DIMS, 'back');
      if (!bounds) throw new Error('no bounds');
      const [left, right] = insideWallSegments(p, DIMS, 'back', bounds);
      return right.minU - left.maxU;
    };
    // The foot sweeps by the lean over the divider's height; on top of that the
    // 1.2mm section doubles at 60 degrees.
    const sweep = resolveCompartmentDividerHeight(2, DIMS.interiorHeight) * Math.tan(Math.PI / 3);
    expect(gapAt(60) - gapAt(0)).toBeCloseTo(sweep + 1.2, 6);
  });

  it('keeps clear of the long reach of a fillet in an acute divider junction', () => {
    const tilted = (interiorFilletMm: number): number => {
      const p = params({
        interiorFilletMm,
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          cols: 2,
          rows: 1,
          cells: [0, 1],
          dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: -20, offsetEnd: 20 }],
        },
      });
      const bounds = insideWallBounds(p, DIMS, 'back');
      if (!bounds) throw new Error('no bounds');
      const [left, right] = insideWallSegments(p, DIMS, 'back', bounds);
      return right.minU - left.maxU;
    };
    const acute = Math.PI / 2 - Math.atan2(40, DIMS.innerD);
    expect(tilted(4) - tilted(0)).toBeCloseTo((2 * 4) / Math.tan(acute / 2), 6);
  });
});
