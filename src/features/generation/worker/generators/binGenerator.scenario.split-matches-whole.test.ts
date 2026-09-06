// @vitest-environment node
/**
 * A split piece must be the same shape as the region of the unsplit bin it
 * came from.
 *
 * Split bins leave the lip solid out of the body and fuse a separately-built
 * one onto each piece, to dodge an OCCT crash at the lip-wall junction. Two
 * families of defect come out of that, and both are asserted here as a delta
 * against the same bin unsplit, because a scenario snapshot is a triangle
 * count and every shape involved has a plausible one.
 *
 * 1. The body was told the bin had NO lip (`base.stackingLip` cleared rather
 *    than `omitLipSolid` set), so every feature anchored to the rim moved: the
 *    interior ceiling rose by `LIP_SMALL_TAPER`, and a scoop lost the inward
 *    offset that keeps its exit flush with the lip's inner face.
 * 2. Anything that cuts the wall has to be handed to the separately-built lip
 *    too, or material fused on after the cut fills the opening back in. Wall
 *    cutouts and divider slots were; wall patterns were not.
 *
 * The probes differ because the defects live in different places. A rim-anchored
 * feature moves the top surface over the cavity; a plugged pattern element is a
 * hole inside the wall's own thickness, which a ray over the cavity never
 * touches.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { initBrepjs, getGenerateBin, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';
import { columnCrossings } from './__kernel-tests__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const NO_CONNECTORS: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: false,
};

/**
 * A piece is meshed at preview tolerance and the whole bin at export tolerance,
 * so a ray grazing a curved feature lands on a different facet in each. Both
 * figures below fall to 0.03mm when the piece is re-meshed at export tolerance,
 * which is what makes them meshing rather than shape.
 *
 * Two numbers because the two sweeps cross different surfaces. Over the cavity
 * the ray meets the scoop's ramp and the label shelf's rounded lip, worth
 * 0.045mm, against defects of 0.70mm and 2.40mm. Through the wall it meets only
 * planar stamp faces and measures 0.000mm, so the bound is tight enough for the
 * 0.265mm plug: at 0.3mm this test passed with that fix reverted.
 */
const RIM_TOLERANCE = 0.3;
const WALL_TOLERANCE = 0.1;

const GRID_UNIT = 42;
const WALL_THICKNESS = DEFAULT_BIN_PARAMS.wallThickness;

const BASE: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 3,
  depth: 4,
  height: 5,
  base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
};

/** A split piece read as a mesh, in the bin's own frame rather than its own. */
interface PieceFrame {
  readonly mesh: MeshData;
  readonly centerX: number;
  readonly centerY: number;
  readonly halfW: number;
  readonly halfD: number;
}

function pieceFrames(
  pieces: ReturnType<ReturnType<typeof getGenerateSplitPreview>>['pieces'],
  params: BinParams
): PieceFrame[] {
  const outerW = params.width * GRID_UNIT - 0.5;
  const outerD = params.depth * GRID_UNIT - 0.5;
  return pieces.map((p) => {
    const widthMm = p.widthUnits * GRID_UNIT;
    const depthMm = p.depthUnits * GRID_UNIT;
    return {
      mesh: { ...p, triangleCount: p.indices.length / 3 },
      // tessellatePiece re-centres each piece on its own footprint; undo it.
      centerX: p.offsetX * GRID_UNIT - outerW / 2 + widthMm / 2,
      centerY: p.offsetY * GRID_UNIT - outerD / 2 + depthMm / 2,
      halfW: widthMm / 2,
      halfD: depthMm / 2,
    };
  });
}

interface Sweep {
  readonly worst: number;
  readonly worstAt: string;
  readonly sampled: number;
}

/**
 * Compare the surfaces a vertical ray crosses, whole bin against the piece that
 * owns the column, over every sample point.
 */
function sweep(
  whole: MeshData,
  frames: readonly PieceFrame[],
  points: ReadonlyArray<readonly [number, number]>,
  crossings: (mesh: MeshData, x: number, y: number) => number[]
): Sweep {
  let worst = 0;
  let worstAt = '';
  let sampled = 0;

  for (const [x, y] of points) {
    // Whichever piece owns the column, to its own edges. Keeping a margin off
    // those edges instead would drop every sample on the front and back outer
    // walls, since those walls ARE the edge: the callers exclude the seam by
    // where they put their points, which is the only place a piece legitimately
    // differs.
    const frame = frames.find(
      (f) => Math.abs(x - f.centerX) <= f.halfW + 0.2 && Math.abs(y - f.centerY) <= f.halfD + 0.2
    );
    if (!frame) continue;

    const a = crossings(whole, x, y);
    const b = crossings(frame.mesh, x - frame.centerX, y - frame.centerY);
    if (a.length === 0 && b.length === 0) continue;
    sampled++;

    // A missing surface pair is a hole that one of them does not have at all.
    expect(
      b.length,
      `(${x.toFixed(1)}, ${y.toFixed(1)}): whole bin crosses ${a.length} surfaces, piece crosses ${b.length}`
    ).toBe(a.length);

    for (let i = 0; i < a.length; i++) {
      const delta = Math.abs(a[i] - b[i]);
      if (delta > worst) {
        worst = delta;
        worstAt = `(${x.toFixed(1)}, ${y.toFixed(1)}) surface ${i}: whole=${a[i].toFixed(3)} piece=${b[i].toFixed(3)}`;
      }
    }
  }
  return { worst, worstAt, sampled };
}

/** Height of the topmost surface over `(x, y)`, as a one-entry list. */
function topSurface(mesh: MeshData, x: number, y: number): number[] {
  const all = columnCrossings(mesh, x, y);
  return all.length > 0 ? [all[all.length - 1]] : [];
}

/**
 * Every surface above the socket.
 *
 * The feet are rounded and meshed at preview tolerance in a piece and export
 * tolerance in the whole bin, so a ray grazing a foot's corner arc lands on a
 * different facet in each, worth ~1.8mm. That is meshing, and it is the same on
 * a bin with no features at all.
 */
function bodySurfaces(mesh: MeshData, x: number, y: number): number[] {
  return columnCrossings(mesh, x, y).filter((z) => z > 5.5);
}

describe('rim-anchored features sit where the unsplit bin puts them', () => {
  const CASES: ReadonlyArray<{ readonly name: string; readonly params: BinParams }> = [
    {
      // Was 2.40mm low: `computeLipOffset` returns 0 without a lip, so the ramp
      // started at the wall's inner face instead of the lip's.
      name: 'scoop ramp',
      params: { ...BASE, scoop: { ...BASE.scoop, enabled: true } },
    },
    {
      // Was 0.70mm proud: the shelf hangs from `interiorHeight`, which is
      // `wallHeight - LIP_SMALL_TAPER` only on a bin that knows it has a lip.
      name: 'label shelf',
      params: { ...BASE, label: { ...BASE.label, enabled: true } },
    },
  ];

  it.each(CASES)(
    '$name',
    ({ params }) => {
      const whole = getGenerateBin()(params, undefined, true);
      const split = getGenerateSplitPreview()(params, [], [0], NO_CONNECTORS);
      expect(split.pieces).toHaveLength(2);

      const outerW = params.width * GRID_UNIT - 0.5;
      const outerD = params.depth * GRID_UNIT - 0.5;
      const points: Array<readonly [number, number]> = [];
      for (let x = -outerW / 2 + 1; x <= outerW / 2 - 1; x += 1.5) {
        for (let y = -outerD / 2 + 1; y <= outerD / 2 - 1; y += 1.5) {
          if (Math.abs(y) < 4) continue;
          points.push([x, y] as const);
        }
      }

      const result = sweep(whole, pieceFrames(split.pieces, params), points, topSurface);
      expect(result.sampled).toBeGreaterThan(1000);
      expect(result.worst, `worst column at ${result.worstAt}`).toBeLessThanOrEqual(RIM_TOLERANCE);
    },
    120000
  );
});

describe('a wall pattern is not plugged by the lip fused on after it', () => {
  // Bold enough that the top row of stamps reaches above
  // `wallHeight - LIP_TAPER_WIDTH`, which is where the lip's
  // angled support reaches DOWN to. At the default scale the row stops short and
  // nothing is plugged, which is why this needs a scale of its own.
  const params: BinParams = {
    ...BASE,
    wallPattern: { ...BASE.wallPattern, enabled: true, scale: 0.85 },
  };

  it('keeps the top row of stamps open through the wall', () => {
    const whole = getGenerateBin()(params, undefined, true);
    const split = getGenerateSplitPreview()(params, [], [0], NO_CONNECTORS);
    expect(split.pieces).toHaveLength(2);

    const outerW = params.width * GRID_UNIT - 0.5;
    const outerD = params.depth * GRID_UNIT - 0.5;

    // Mid-thickness of each outer wall, which is the only place a stamp is:
    // a ray over the cavity passes beside every one of them.
    const points: Array<readonly [number, number]> = [];
    for (let x = -outerW / 2 + 6; x <= outerW / 2 - 6; x += 0.4) {
      points.push([x, -outerD / 2 + WALL_THICKNESS / 2] as const);
      points.push([x, outerD / 2 - WALL_THICKNESS / 2] as const);
    }
    for (let y = -outerD / 2 + 6; y <= outerD / 2 - 6; y += 0.4) {
      if (Math.abs(y) < 5) continue;
      points.push([-outerW / 2 + WALL_THICKNESS / 2, y] as const);
      points.push([outerW / 2 - WALL_THICKNESS / 2, y] as const);
    }

    const result = sweep(whole, pieceFrames(split.pieces, params), points, bodySurfaces);
    // Both axes' walls, or the sweep is only looking at half the bin.
    expect(result.sampled).toBeGreaterThan(1200);
    expect(result.worst, `worst column at ${result.worstAt}`).toBeLessThanOrEqual(WALL_TOLERANCE);
  }, 120000);
});
