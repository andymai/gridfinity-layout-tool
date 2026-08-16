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
 * The bins carry no stacking lip on purpose. With one, the rim is the lip's
 * top face and the wall's cross-section up there is the lip's own taper, so a
 * column probe would be reading the lip profile rather than the blend. Without
 * one the rim is the wall top and the wall is a plain slab beneath it, which is
 * the cleanest place to ask the only question that matters: at a given depth,
 * how far outboard of the cut has material been taken away?
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
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
