// @vitest-environment node
/**
 * Regression test for issue #1968 — gap in corners when column dividers are
 * added to thin-walled boxes.
 *
 * Repro: a bin with a column divider and a wall thickness below
 * ~1.1mm shows a gap in all four outer corners once the divider is
 * generated. The corners are intact at the default 1.2mm wall.
 *
 * Root cause: the multi-cavity-cut shell path (#1753) subtracts
 * **sharp-cornered** rectangular cavities from a **rounded** outer box
 * (BOX_CORNER_RADIUS = 3.75mm). For a corner compartment, the cavity's
 * sharp corner sits at the bin's inner wall corner. When
 * `wallThickness < BOX_CORNER_RADIUS · (1 − 1/√2) ≈ 1.098mm`, that sharp
 * corner pokes *past* the outer rounded arc, so the cut eats through the
 * outer skin and leaves a notch. The fix rounds each cavity corner that
 * lies on the bin perimeter with the same radius the single-compartment
 * hollow shell uses (`BOX_CORNER_RADIUS − wallThickness`), so the cavity
 * follows the inner wall contour and uniform wall material survives.
 *
 * This is invisible to the manifold tests: the over-cut still yields a
 * watertight solid, just the wrong shape. So we probe the geometry
 * directly. A single-compartment bin of the same outer dimensions is the
 * control — its corners are built by the rounded hollow shell and are
 * always intact. We sample a dense grid of points across all four corner
 * wall regions; every point that is solid in the control must also be
 * solid in the divider bin (the divider is interior and never removes
 * corner material). The corner-gap bug makes ~17% of control-solid corner
 * points vanish in the divider bin; the fix drops that to tessellation
 * noise (a couple percent at the wall surfaces).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { exportBin } from './binExporter';
import { clearAllCaches } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

beforeEach(() => clearAllCaches());

/** Parse a binary STL into a flat triangle-vertex array (9 floats / triangle). */
function trianglesFromStl(stl: ArrayBuffer): Float32Array {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  return parsed.value.vertices;
}

/**
 * Point-in-solid test for a closed triangle mesh via vertical (+Z) ray
 * casting: count triangles directly above `(x, y)` whose XY projection
 * contains the point; an odd count means the point is inside the solid.
 */
function isInsideSolid(tris: Float32Array, x: number, y: number, z: number): boolean {
  let crossings = 0;
  for (let i = 0; i < tris.length; i += 9) {
    const ax = tris[i],
      ay = tris[i + 1],
      az = tris[i + 2];
    const bx = tris[i + 3],
      by = tris[i + 4],
      bz = tris[i + 5];
    const cx = tris[i + 6],
      cy = tris[i + 7],
      cz = tris[i + 8];

    // Barycentric containment of (x, y) in the triangle's XY projection.
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-9) continue; // edge-on triangle: no vertical area
    const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det;
    const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det;
    const l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue;

    const zHit = l1 * az + l2 * bz + l3 * cz;
    if (zHit > z) crossings++;
  }
  return crossings % 2 === 1;
}

interface XYBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function meshBounds(tris: Float32Array): XYBounds {
  const b: XYBounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (let i = 0; i < tris.length; i += 3) {
    b.minX = Math.min(b.minX, tris[i]);
    b.maxX = Math.max(b.maxX, tris[i]);
    b.minY = Math.min(b.minY, tris[i + 1]);
    b.maxY = Math.max(b.maxY, tris[i + 1]);
    b.minZ = Math.min(b.minZ, tris[i + 2]);
    b.maxZ = Math.max(b.maxZ, tris[i + 2]);
  }
  return b;
}

const CORNER_SPAN_MM = 6; // size of the square corner region to sample
const SAMPLE_STEP_MM = 0.25;

/**
 * Fraction of control-solid corner-wall points that are missing (hollow)
 * in the test mesh, sampled across all four outer corners at mid-wall
 * height. Both meshes must share outer dimensions so the corner regions
 * align. A correct divider bin matches the control to within tessellation
 * noise; the corner-gap bug leaves a large fraction missing.
 */
function cornerMaterialMissingFraction(control: Float32Array, test: Float32Array): number {
  const b = meshBounds(control);
  // Corner regions are derived from the control's bounds and reused to probe
  // the test mesh, so the two must share outer dimensions or the comparison
  // is meaningless. Fail loudly if a caller passes mismatched bins.
  const tb = meshBounds(test);
  const align = SAMPLE_STEP_MM / 2;
  expect(tb.minX, 'control/test minX must align').toBeCloseTo(b.minX, 1);
  expect(tb.maxX, 'control/test maxX must align').toBeCloseTo(b.maxX, 1);
  expect(tb.minY, 'control/test minY must align').toBeCloseTo(b.minY, 1);
  expect(tb.maxY, 'control/test maxY must align').toBeCloseTo(b.maxY, 1);
  expect(Math.abs(tb.maxZ - b.maxZ), 'control/test height must align').toBeLessThan(align);
  const z = b.minZ + (b.maxZ - b.minZ) * 0.7; // upper wall band, below the rim
  const cornersX: Array<[number, number]> = [
    [b.minX, 1],
    [b.maxX, -1],
  ];
  const cornersY: Array<[number, number]> = [
    [b.minY, 1],
    [b.maxY, -1],
  ];
  let controlSolid = 0;
  let missing = 0;
  for (const [baseX, signX] of cornersX) {
    for (const [baseY, signY] of cornersY) {
      for (let a = SAMPLE_STEP_MM; a <= CORNER_SPAN_MM; a += SAMPLE_STEP_MM) {
        for (let c = SAMPLE_STEP_MM; c <= CORNER_SPAN_MM; c += SAMPLE_STEP_MM) {
          const x = baseX + signX * a;
          const y = baseY + signY * c;
          if (!isInsideSolid(control, x, y, z)) continue;
          controlSolid++;
          if (!isInsideSolid(test, x, y, z)) missing++;
        }
      }
    }
  }
  expect(
    controlSolid,
    'control should have solid corner material to compare against'
  ).toBeGreaterThan(100);
  return missing / controlSolid;
}

function thinWalledBin(overrides: Partial<BinParams>): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    wallThickness: 0.8,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: false },
    ...overrides,
  };
}

const TEST_TIMEOUT_MS = 90_000;
// Corner material that may flip between independently tessellated meshes
// at the wall surfaces. The bug leaves ~17% missing; the fix lands well
// under this.
const NOISE_TOLERANCE = 0.05;

/**
 * Assert a divider bin keeps its corners intact, using a single-compartment
 * bin of the same outer dimensions as the control. `dividers` overrides only
 * the compartment grid (and optionally dividerOverrides) on top of `dims`.
 */
async function expectCornersIntact(
  dims: Partial<BinParams>,
  dividers: BinParams['compartments']
): Promise<void> {
  const control = thinWalledBin({
    ...dims,
    compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
  });
  const test = thinWalledBin({ ...dims, compartments: dividers });
  const controlTris = trianglesFromStl((await exportBin(control, 'stl')).data);
  clearAllCaches();
  const testTris = trianglesFromStl((await exportBin(test, 'stl')).data);
  expect(cornerMaterialMissingFraction(controlTris, testTris)).toBeLessThan(NOISE_TOLERANCE);
}

describe('issue #1968 — corner gap with dividers on thin-walled bins', () => {
  it(
    'single column divider keeps the corners intact (2×2, 0.8mm wall)',
    () =>
      expectCornersIntact(
        { width: 2, depth: 2 },
        { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] }
      ),
    TEST_TIMEOUT_MS
  );

  it(
    "reporter's config — 2-col × 4-row grid keeps the corners intact (0.8mm wall)",
    () =>
      expectCornersIntact(
        { width: 2, depth: 4 },
        { cols: 2, rows: 4, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5, 6, 7] }
      ),
    TEST_TIMEOUT_MS
  );

  it(
    // Narrow corner cells can't fit the full corner radius, so the cut path
    // would only partially round them and reopen the gap — these bins must
    // fall back to the additive path. 8 columns on a 1-wide bin ≈ 5mm cells.
    'narrow corner cells stay intact via the additive fallback (1×1, 8 cols, 0.8mm wall)',
    () =>
      expectCornersIntact(
        { width: 1, depth: 1 },
        { cols: 8, rows: 1, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5, 6, 7] }
      ),
    TEST_TIMEOUT_MS
  );

  it(
    // Tilted dividers take the cut path too; exterior corners are never tilted,
    // so they must still round cleanly.
    'tilted divider keeps the corners intact (2×4 bin, 1×2 grid, ±20mm tilt, 0.8mm wall)',
    () =>
      expectCornersIntact(
        { width: 2, depth: 4 },
        {
          cols: 1,
          rows: 2,
          thickness: 1.2,
          cells: [0, 1],
          dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: -20, offsetEnd: 20 }],
        }
      ),
    TEST_TIMEOUT_MS
  );
});
