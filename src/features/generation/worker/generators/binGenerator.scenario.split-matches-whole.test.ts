// @vitest-environment node
/**
 * A split piece must be the same shape as the region of the unsplit bin it
 * came from.
 *
 * Split bins leave the lip solid out of the body and fuse a separately-built
 * one onto each piece, to dodge an OCCT crash at the lip-wall junction. Saying
 * so by clearing `base.stackingLip` told every feature builder the bin was
 * lipless, and each one that anchors to the rim moved: the interior ceiling
 * rose by `LIP_SMALL_TAPER` (a label shelf 0.7mm proud, into the band a lid's
 * click rail drops through), and a scoop lost the inward offset that keeps its
 * exit flush with the lip's inner face (2.4mm). `omitLipSolid` says only the
 * one thing instead.
 *
 * Asserted as a delta rather than against numbers of its own: a scenario
 * snapshot is a triangle count, and every shape here has a plausible one. The
 * probe walks a grid of vertical rays and compares the height of the topmost
 * surface over each, which is what "different shape" actually means to the
 * person holding the two halves.
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
 * so a ray crossing the lip's taper lands on a different facet in each. The
 * sweep measures 0.045mm of that; the defects it has to catch are 0.7mm and
 * 2.4mm.
 */
const Z_TOLERANCE = 0.1;

const GRID_UNIT = 42;

const BASE: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 3,
  depth: 4,
  height: 5,
  base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
};

/**
 * The two rim-anchored features whose divergence a vertical ray can see.
 *
 * A wall pattern's band and a handle hole's centre move with `interiorHeight`
 * too, but they are holes in a vertical wall: the same sweep run over them
 * measures 0.045mm either way, so a case here would pass whatever the bug did.
 * `context.test.ts` covers them from the other end, by pinning that the flag
 * moves no dimension at all.
 */
const CASES: ReadonlyArray<{ readonly name: string; readonly params: BinParams }> = [
  {
    // Was 2.4mm low: `computeLipOffset` returns 0 without a lip, so the ramp
    // started at the wall's inner face instead of the lip's.
    name: 'scoop ramp',
    params: { ...BASE, scoop: { ...BASE.scoop, enabled: true } },
  },
  {
    // Was 0.7mm proud: the shelf hangs from `interiorHeight`, which is
    // `wallHeight - LIP_SMALL_TAPER` only on a bin that knows it has a lip.
    name: 'label shelf',
    params: { ...BASE, label: { ...BASE.label, enabled: true } },
  },
];

/** Height of the topmost surface over `(x, y)`, or NaN where nothing is. */
function topSurfaceZ(mesh: MeshData, x: number, y: number): number {
  const crossings = columnCrossings(mesh, x, y);
  return crossings.length > 0 ? crossings[crossings.length - 1] : Number.NaN;
}

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

describe('split pieces are the same shape as the bin they came from', () => {
  it.each(CASES)(
    '$name',
    ({ params }) => {
      const whole = getGenerateBin()(params, undefined, true);
      const split = getGenerateSplitPreview()(params, [], [0], NO_CONNECTORS);
      expect(split.pieces).toHaveLength(2);

      const frames = pieceFrames(split.pieces, params);
      const outerW = params.width * GRID_UNIT - 0.5;
      const outerD = params.depth * GRID_UNIT - 0.5;

      let worst = 0;
      let worstAt = '';
      let sampled = 0;

      for (let x = -outerW / 2 + 1; x <= outerW / 2 - 1; x += 1.5) {
        for (let y = -outerD / 2 + 1; y <= outerD / 2 - 1; y += 1.5) {
          // The seam itself is legitimately different: the cut plane is nudged
          // off any cell boundary and each piece ends in a fresh face there.
          if (Math.abs(y) < 4) continue;
          const frame = frames.find(
            (f) => Math.abs(x - f.centerX) < f.halfW - 2 && Math.abs(y - f.centerY) < f.halfD - 2
          );
          if (!frame) continue;

          const wholeZ = topSurfaceZ(whole, x, y);
          const pieceZ = topSurfaceZ(frame.mesh, x - frame.centerX, y - frame.centerY);
          if (Number.isNaN(wholeZ) || Number.isNaN(pieceZ)) continue;

          sampled++;
          const delta = Math.abs(wholeZ - pieceZ);
          if (delta > worst) {
            worst = delta;
            worstAt = `(${x.toFixed(1)}, ${y.toFixed(1)}) whole=${wholeZ.toFixed(3)} piece=${pieceZ.toFixed(3)}`;
          }
        }
      }

      expect(sampled).toBeGreaterThan(1000);
      expect(worst, `worst column at ${worstAt}`).toBeLessThanOrEqual(Z_TOLERANCE);
    },
    120000
  );
});
