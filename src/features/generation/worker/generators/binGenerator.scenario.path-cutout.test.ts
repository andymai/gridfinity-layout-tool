// @vitest-environment node
/**
 * Regression: a pen-tool PATH cutout whose stored points contain a degenerate
 * (duplicate / zero-length) edge must still cut its real polygon shape — not
 * silently collapse to a bounding-box rectangle.
 *
 * Repro seen in session replays: the path looks right in the 2D cut editor
 * (the outline stroke is drawn from the bezier flatten regardless of the
 * degenerate vertex) but the generated bin shows a plain rectangular cavity.
 *
 * Root cause: snap-to-grid (two clicks in one grid cell) and clampPathToBounds
 * can leave two coincident consecutive points in the committed path. The worker
 * builds a wire with a zero-length edge; OpenCascade rejects it on close()/
 * extrude(), and buildUnrotatedCutoutShape's `catch` falls back to
 * `box(width, depth, cutDepth)` — a rectangle the user never drew.
 *
 * We probe the geometry by volume: a non-degenerate polygon cut removes less
 * material than its bounding rectangle, so the path-cut bin must retain
 * meaningfully MORE volume than the same bin cut with a full-bbox rectangle.
 * If the path collapses to a rectangle the two volumes are equal.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { BinParams, PathPoint } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { getPathBounds } from '@/features/bin-designer/components/panel/CutoutsSection/pathGeometry';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { exportBin } from './binExporter';
import { clearAllCaches } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

beforeEach(() => clearAllCaches());

function corner(x: number, y: number): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: true };
}

function solidBinWithCutout(cutout: BinParams['cutouts'][number]): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts: [cutout],
  };
}

/** Exact volume of a closed triangle mesh via the divergence theorem. */
function meshVolume(stl: ArrayBuffer): number {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const t = parsed.value.vertices;
  let v = 0;
  for (let i = 0; i < t.length; i += 9) {
    const ax = t[i],
      ay = t[i + 1],
      az = t[i + 2];
    const bx = t[i + 3],
      by = t[i + 4],
      bz = t[i + 5];
    const cx = t[i + 6],
      cy = t[i + 7],
      cz = t[i + 8];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(v);
}

async function cutVolume(shape: 'path' | 'rectangle', path: PathPoint[]): Promise<number> {
  const b = getPathBounds(path);
  const cutout = {
    id: 'c',
    shape,
    ...(shape === 'path' ? { path } : {}),
    x: b.minX,
    y: b.minY,
    width: b.maxX - b.minX,
    depth: b.maxY - b.minY,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    scoopRadiusW: 0,
    scoopRadiusD: 0,
  } as BinParams['cutouts'][number];
  const out = await exportBin(solidBinWithCutout(cutout), 'stl');
  return meshVolume(out.data);
}

const TIMEOUT = 90_000;

// A convex pentagon with the 3rd vertex duplicated — exactly what snap-to-grid
// produces when two pen clicks land in the same grid cell.
const PENTAGON: PathPoint[] = [
  corner(20, 25),
  corner(55, 20),
  corner(62, 50),
  corner(38, 62),
  corner(20, 50),
];
const PENTAGON_WITH_DUP: PathPoint[] = [
  PENTAGON[0],
  PENTAGON[1],
  PENTAGON[2],
  PENTAGON[2], // duplicate consecutive vertex (zero-length edge)
  PENTAGON[3],
  PENTAGON[4],
];

describe('path cutout robustness — degenerate vertices must not become a rectangle', () => {
  it(
    'a path with a duplicate consecutive vertex cuts the polygon, not its bounding rectangle',
    async () => {
      const b = getPathBounds(PENTAGON_WITH_DUP);
      const bboxVol = (b.maxX - b.minX) * (b.maxY - b.minY) * 5;

      const rectVol = await cutVolume('rectangle', PENTAGON_WITH_DUP);
      clearAllCaches();
      const pathVol = await cutVolume('path', PENTAGON_WITH_DUP);

      // A real pentagon cut leaves a large slice of the bbox uncut (corners),
      // so the path-cut bin keeps clearly more material than the rect-cut bin.
      // A rectangle fallback would make these equal.
      expect(pathVol - rectVol).toBeGreaterThan(0.1 * bboxVol);
    },
    TIMEOUT
  );
});
