// @vitest-environment node
/**
 * Rounded shoulders on a wall cutout, measured on a real generated bin.
 *
 * The shape under test is a round-over of the MATERIAL corner where a cutout
 * meets the top of the wall, which the cut expresses as a flare: it opens
 * outward as it rises and reaches its full radius exactly at the rim. Nothing
 * about that is visible to a bounding-box, triangle-count or watertight
 * assertion — a square shoulder and a rounded one produce equally valid solids
 * of the same extent — so every check here probes INSIDE the wall and states
 * its result as a delta against the same bin with the radius left off.
 *
 * The outer-wall bins carry no stacking lip on purpose. With one, the rim is
 * the lip's top face and the wall's cross-section up there is the lip's own
 * taper, so a column probe would be reading the lip profile rather than the
 * blend. Without one the rim is the wall top and the wall is a plain slab
 * beneath it, which is the cleanest place to ask the only question that
 * matters: at a given depth, how far outboard of the cut has material been
 * taken away?
 *
 * The interior-divider bins at the bottom of the file do carry one, because
 * that is the case a divider cut anchored to the WALL's rim gets wrong: the
 * lip stands 4.4mm above the divider's own top, and a round-over given the
 * wrong rim spends its whole radius in the air above the divider.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  columnCrossings,
  isSolidThrough,
} from './__kernel-tests__/meshAssertions';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams, WallCutout } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

const { GRID_SIZE, TOLERANCE } = GRIDFINITY;

const WIDTH = 3;
const DEPTH = 2;
const HEIGHT = 3;
const WALL_THICKNESS = 1.2;
const TOP_RADIUS = 5;
/** Cut span as a fraction of the wall, well clear of both ends. */
const CUT_FRACTION = 0.5;

const OUTER_W = WIDTH * GRID_SIZE - TOLERANCE;
const OUTER_D = DEPTH * GRID_SIZE - TOLERANCE;
const INNER_W = OUTER_W - 2 * WALL_THICKNESS;
const CUT_HALF = (INNER_W * CUT_FRACTION) / 2;
/** Mid-thickness of the front wall — inside the slab, off every face plane. */
const WALL_Y = -OUTER_D / 2 + WALL_THICKNESS / 2;

function frontCutout(over: Partial<WallCutout> = {}): BinParams['walls'] {
  const base = buildParams({}).walls;
  return {
    ...base,
    enabled: true,
    shape: 'u-shape',
    front: {
      ...base.front,
      enabled: true,
      width: CUT_FRACTION * 100,
      depth: 60,
      alignment: 'center',
      offset: 0,
      widthMm: null,
      ...over,
    },
    back: { ...base.back, enabled: false },
    left: { ...base.left, enabled: false },
    right: { ...base.right, enabled: false },
    interior: { ...base.interior, enabled: false },
  };
}

function gen(walls: BinParams['walls']): MeshData {
  const defaults = buildParams({});
  return getGenerateBin()(
    buildParams({
      width: WIDTH,
      depth: DEPTH,
      height: HEIGHT,
      wallThickness: WALL_THICKNESS,
      base: { ...defaults.base, stackingLip: false },
      walls,
    }),
    undefined,
    true
  );
}

describe('wall cutout rounded shoulders', () => {
  let square: MeshData;
  let rounded: MeshData;
  let rimZ: number;

  beforeAll(async () => {
    await initBrepjs();
    square = gen(frontCutout());
    rounded = gen(frontCutout({ cornerRadiusTop: TOP_RADIUS }));
    rimZ = boundingBox(square.vertices).maxZ;
  }, 120_000);

  /** Is the front wall solid at `x`, `depth` mm below the rim? */
  const wallSolidAt = (mesh: MeshData, x: number, depth: number): boolean =>
    isSolidThrough(mesh, x, WALL_Y, rimZ - depth - 0.02, rimZ - depth + 0.02);

  /** How far the opening has widened per side at `depth` below the rim. */
  const openingAt = (depth: number): number =>
    TOP_RADIUS - Math.sqrt(TOP_RADIUS * TOP_RADIUS - (TOP_RADIUS - depth) ** 2);

  it('produces a valid solid either way', () => {
    assertStructurallyValid(square, 'square shoulder');
    assertStructurallyValid(rounded, 'rounded shoulder');
    // The blend is tangent to the wall's own top face, so the cutter grazes
    // that plane along a line rather than crossing it. That is the boolean
    // case most likely to leave a sliver face or fail outright.
    assertWatertight(rounded, 'rounded shoulder');
  });

  it('leaves the two bins the same size', () => {
    // Stated so the probes below cannot be read as measuring a bin that simply
    // came out different: the round-over takes material from inside the
    // footprint and moves no outer face.
    const a = boundingBox(square.vertices);
    const b = boundingBox(rounded.vertices);
    for (const k of ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'] as const) {
      expect(b[k], k).toBeCloseTo(a[k], 3);
    }
  });

  it('takes the shoulder away just under the rim', () => {
    // 0.3mm down a 5mm blend has already opened 3.3mm per side, so a column
    // 1mm outboard of the cut edge is void — and is solid on the square bin,
    // which is the whole delta.
    expect(openingAt(0.3)).toBeGreaterThan(1);
    expect(wallSolidAt(square, CUT_HALF + 1, 0.3), 'square bin, 1mm outboard').toBe(true);
    expect(wallSolidAt(rounded, CUT_HALF + 1, 0.3), 'rounded bin, 1mm outboard').toBe(false);
  });

  it('stops at the radius, leaving the rest of the wall standing', () => {
    // Past the blend's reach the wall is untouched. Without this the test
    // would pass just as well on a cutout that had simply been widened.
    expect(wallSolidAt(rounded, CUT_HALF + TOP_RADIUS + 1, 0.3)).toBe(true);
  });

  it('is back to the plain opening below the blend', () => {
    // The arc lands tangent on the cut's own side a radius down, so from there
    // to the floor the two bins are the same wall.
    for (const depth of [TOP_RADIUS + 1, TOP_RADIUS + 3]) {
      expect(wallSolidAt(square, CUT_HALF + 0.4, depth), `square at ${depth}mm`).toBe(true);
      expect(wallSolidAt(rounded, CUT_HALF + 0.4, depth), `rounded at ${depth}mm`).toBe(true);
    }
  });

  it('narrows the way an arc does, not the way a chamfer does', () => {
    // Both soften the same corner and reach the same width at the rim; they
    // differ in how fast they close. Probing at the depth where the arc has
    // shrunk to 0.35mm per side but a chamfer would still be 4mm separates
    // them — a column at 1mm outboard is solid only on the arc.
    const depth = TOP_RADIUS - 1;
    expect(openingAt(depth)).toBeLessThan(1);
    expect(wallSolidAt(rounded, CUT_HALF + 1, depth)).toBe(true);
  });
});

/**
 * The same round-over, on an interior divider.
 *
 * A divider has no stacking lip over it, so its own top face is the rim its
 * shoulder blend is tangent to. Cut against the wall's rim instead — 4.4mm
 * higher on a bin with a lip — a 5mm blend reaches the divider 0.036mm wide,
 * which is what "the dividers don't have the correct shape" looked like.
 *
 * Every number here is read off the mesh rather than restated from the
 * constant chain, because the chain is the thing under test: the divider's top
 * is measured on the divider, and the floor on a compartment's own floor.
 */
describe('interior divider cutout', () => {
  const D_WIDTH = 3;
  const D_DEPTH = 1;
  const D_HEIGHT = 3;
  const D_RADIUS = 5;
  const D_CUT_FRACTION = 0.5;
  const D_DEPTH_PCT = 60;

  const D_INNER_W = D_WIDTH * GRID_SIZE - TOLERANCE - 2 * WALL_THICKNESS;
  const D_INNER_D = D_DEPTH * GRID_SIZE - TOLERANCE - 2 * WALL_THICKNESS;
  /** Along-divider half-span of the window: the divider runs the full interior. */
  const D_CUT_HALF = (D_INNER_D * D_CUT_FRACTION) / 2;
  /** First column boundary of a 3-column grid, where a divider stands. */
  const DIVIDER_X = -D_INNER_W / 2 + D_INNER_W / 3;

  function interiorWalls(over: Partial<WallCutout> = {}): BinParams['walls'] {
    const base = buildParams({}).walls;
    const off = { ...base.front, enabled: false };
    return {
      ...base,
      enabled: true,
      shape: 'u-shape',
      front: off,
      back: off,
      left: off,
      right: off,
      interior: {
        ...base.interior,
        enabled: true,
        width: D_CUT_FRACTION * 100,
        depth: D_DEPTH_PCT,
        alignment: 'center',
        offset: 0,
        widthMm: null,
        ...over,
      },
    };
  }

  function genDivided(walls: BinParams['walls'], dividerHeight?: number): MeshData {
    const defaults = buildParams({});
    return getGenerateBin()(
      buildParams({
        width: D_WIDTH,
        depth: D_DEPTH,
        height: D_HEIGHT,
        wallThickness: WALL_THICKNESS,
        base: { ...defaults.base, stackingLip: true },
        compartments: {
          ...defaults.compartments,
          cols: 3,
          rows: 1,
          cells: [0, 1, 2],
          thickness: WALL_THICKNESS,
          ...(dividerHeight === undefined ? {} : { dividerHeight }),
        },
        walls,
      }),
      undefined,
      true
    );
  }

  /** Highest surface over a column — the top face of whatever stands there. */
  const topAt = (mesh: MeshData, x: number, y: number): number => {
    const crossings = columnCrossings(mesh, x, y);
    return crossings[crossings.length - 1] ?? NaN;
  };

  let square: MeshData;
  let rounded: MeshData;
  let dividerTopZ: number;

  beforeAll(async () => {
    await initBrepjs();
    square = genDivided(interiorWalls());
    rounded = genDivided(interiorWalls({ cornerRadiusTop: D_RADIUS }));
    // Well past the blend's reach, so it reads the untouched divider.
    dividerTopZ = topAt(square, DIVIDER_X, D_CUT_HALF + D_RADIUS + 2);
  }, 180_000);

  it('produces a valid solid either way', () => {
    assertStructurallyValid(square, 'square divider shoulder');
    assertStructurallyValid(rounded, 'rounded divider shoulder');
    assertWatertight(rounded, 'rounded divider shoulder');
  });

  it('leaves the two bins the same size', () => {
    const a = boundingBox(square.vertices);
    const b = boundingBox(rounded.vertices);
    for (const k of ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'] as const) {
      expect(b[k], k).toBeCloseTo(a[k], 3);
    }
  });

  it('rounds the divider shoulder tangent to the divider top', () => {
    // Quarter arc centred a radius inboard and a radius down from the corner:
    // it reaches full width at the divider's top face and dies out a radius
    // below it. Anchored to the wall's rim instead, every one of these is 0.
    for (const out of [0.3, 1, 3]) {
      const expected = D_RADIUS - Math.sqrt(D_RADIUS ** 2 - (D_RADIUS - out) ** 2);
      const drop = dividerTopZ - topAt(rounded, DIVIDER_X, D_CUT_HALF + out);
      // Loose to the mesh's own facet sag on a curved face, tight enough that a
      // chamfer (2mm at 3mm out, against the arc's 0.42) could not pass.
      expect(drop, `${out}mm outboard`).toBeCloseTo(expected, 1);
      expect(topAt(square, DIVIDER_X, D_CUT_HALF + out), `square at ${out}mm`).toBeCloseTo(
        dividerTopZ,
        3
      );
    }
  });

  it('leaves the divider standing past the blend', () => {
    expect(topAt(rounded, DIVIDER_X, D_CUT_HALF + D_RADIUS + 1)).toBeCloseTo(dividerTopZ, 3);
  });

  it('cuts the asked-for fraction of the divider a shortened one leaves standing', () => {
    // A numeric divider height takes the additive path, where the divider ends
    // well below the rim. Measured against the rim the cut used to take 13% of
    // this divider; the contract is that it takes the depth percentage of what
    // stands above the floor.
    const short = genDivided(interiorWalls(), 8);
    const floorZ = topAt(short, 0, 0);
    const topZ = topAt(short, DIVIDER_X, D_CUT_HALF + 2);
    const cutFloorZ = topAt(short, DIVIDER_X, 0);
    expect(topZ).toBeLessThan(dividerTopZ);
    expect(topZ - cutFloorZ).toBeCloseTo((topZ - floorZ) * (D_DEPTH_PCT / 100), 3);
  }, 120_000);
});
