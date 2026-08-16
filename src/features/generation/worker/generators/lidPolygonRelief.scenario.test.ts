/**
 * Lid interior relief on a custom shape.
 *
 * The rectangle path cuts a rounded rectangle less its inset copy. A custom
 * shape cannot: an inward offset of the outline self-intersects on a thin neck,
 * pushes an inner loop the wrong way, and needs its notch corners clipped. So
 * the ring is built as one band per outline edge instead (`lidKeepoutSlabs`),
 * which for a rectilinear outline is the same set and needs none of that.
 *
 * ## What this file can and cannot prove
 *
 * The ring CUTS AIR on a polygon bin today, and that is not a defect — it is
 * the reason was deferred in the first place. Everything that could rise
 * into the band is gated off for a partial mask: neither `compartmentWallsFeature`
 * nor `labelTabsFeature` declares `supportsCellMask`, so `featuresStage` drops
 * both, and the cavity under the rim is empty. The ring exists so that tree
 * order already protects the lid on the day either one gains polygon support,
 * which is the whole point of's design.
 *
 * So WHERE the band lies is proven by `lidKeepoutSlabs.test.ts`, which compares
 * it against an independently sampled erosion. What is left for real geometry
 * is the other half — that cutting it HARMS NOTHING:
 *
 *  - the solid still builds and stays sound;
 *  - the stacking lip's undercut is untouched, the failure that leaves a bin
 *    looking perfect and holding nothing;
 *  - the WALL is untouched, including at the reflex corner, where a band that
 *    overshot its neighbour's line would eat into an L's inner corner.
 *
 * The last is the real risk in a union-of-bands construction, and it is stated
 * as bit-identity against the unrelieved bin rather than as a threshold: the
 * ring is supposed to leave every one of these places alone, so any difference
 * at all is the defect.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidPolygonRelief.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { columnCrossings, assertStructurallyValid } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import { isPartialMask } from '@/shared/utils/cellMask';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { lidKeepoutSlabs } from '@/shared/constants/lidKeepout';

/** An L: the bottom half full, the top half only the left two columns. */
const L_MASK: CellMask = {
  cols: 4,
  rows: 4,
  // Bottom-first, matching grid convention (row 0 is y-minimum).
  cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0],
};

/** A U: a notch bitten out of the top middle, giving two reflex corners. */
const U_MASK: CellMask = {
  cols: 4,
  rows: 4,
  cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1],
};

const WALL = DEFAULT_BIN_PARAMS.wallThickness;
const PITCH = DEFAULT_BIN_PARAMS.gridUnitMm;

function makeParams(cellMask: CellMask, relieve: boolean): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 6,
    cellMask,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      clickRailCoverage: 100,
      relieveInterior: relieve,
    },
  };
}

/** Topmost surface at a column, or undefined when the ray misses the solid. */
const topAt = (mesh: Parameters<typeof columnCrossings>[0], x: number, y: number) =>
  columnCrossings(mesh, x, y).at(-1);

/**
 * Columns that sit INSIDE the wall, all the way round a mask's outline.
 *
 * Placed midway between the lip's inner face and the wall's, the band where the
 * lip is the only material — solid above the rim, open pocket below. That makes
 * one probe answer both questions this file asks of the wall: whether the ring
 * shaved the undercut, and whether it ate into the wall itself.
 */
function wallProbes(mask: CellMask): Array<readonly [number, number]> {
  const half = (mask.cols * 0.5 * PITCH) / 2;
  const depth = (GRIDFINITY_SPEC.TOLERANCE / 2 + GRIDFINITY_SPEC.LIP_BIG_TAPER + WALL) / 2;
  const out: Array<readonly [number, number]> = [];
  // Walk a ring of columns just inside the bounding box, keeping only those
  // that land on material — a simple sweep reaches every outer wall of an L or
  // a U without hard-coding where its steps are.
  for (let t = -half + 3; t <= half - 3; t += 3) {
    out.push([t, -half + depth], [t, half - depth], [-half + depth, t], [half - depth, t]);
  }
  return out;
}

beforeAll(async () => {
  await initBrepjs();
}, 180000);

describe('lid interior relief on a custom shape', () => {
  it('plans a band for every edge of a custom outline', () => {
    // Cheap guard against the whole file going vacuous: if the polygon path
    // stopped producing a cutter, every "unchanged" assertion below would pass
    // for the wrong reason.
    expect(isPartialMask(L_MASK)).toBe(true);
    expect(lidKeepoutSlabs(L_MASK, PITCH, PITCH, WALL).length).toBeGreaterThanOrEqual(6);
    expect(lidKeepoutSlabs(U_MASK, PITCH, PITCH, WALL).length).toBeGreaterThanOrEqual(8);
  });

  it.each([
    ['an L-shape', L_MASK],
    ['a U-shape, whose notch has two reflex corners', U_MASK],
  ])(
    'cuts %s without touching its wall or its lip',
    async (_name, mask) => {
      const withRing = getGenerateBin()(makeParams(mask, true), undefined, false);
      const without = getGenerateBin()(makeParams(mask, false), undefined, false);
      if (!withRing || !without) throw new Error('expected both bins to build');
      assertStructurallyValid(withRing, 'relieved polygon bin');

      let compared = 0;
      for (const [x, y] of wallProbes(mask)) {
        const a = topAt(withRing, x, y);
        const b = topAt(without, x, y);
        if (a === undefined || b === undefined) continue; // off the shape
        // Above the wall top means the probe really is in the lip, so the
        // comparison is about the undercut rather than some interior floor.
        if (a <= 6 * DEFAULT_BIN_PARAMS.heightUnitMm) continue;
        expect(a, `wall changed at (${x.toFixed(1)}, ${y.toFixed(1)})`).toBeCloseTo(b, 6);
        compared++;
      }
      // Anti-vacuity: a probe ring that missed the shape entirely would pass.
      expect(compared).toBeGreaterThan(20);
    },
    300000
  );

  it('removes no material anywhere, since nothing rises into the band yet', async () => {
    // Characterisation, and deliberately so. Compartments and label tabs are
    // both gated off for a partial mask, so the ring meets only air. The day
    // either gains polygon support this stops holding, and that is the signal
    // to come back and assert the relief instead — not to relax this.
    //
    // Stated on the top surface rather than the triangle count: the ring's
    // outer face is COINCIDENT with the lip's inner face, so the boolean
    // re-triangulates there (2870 -> 2984 on this bin) while removing nothing.
    // A count is a tessellation fact; where the material ends is a geometry one.
    const withRing = getGenerateBin()(makeParams(L_MASK, true), undefined, false);
    const without = getGenerateBin()(makeParams(L_MASK, false), undefined, false);
    if (!withRing || !without) throw new Error('expected both bins to build');

    const half = (L_MASK.cols * 0.5 * PITCH) / 2;
    let compared = 0;
    for (let x = -half + 1; x <= half - 1; x += 2) {
      for (let y = -half + 1; y <= half - 1; y += 2) {
        const a = topAt(withRing, x, y);
        const b = topAt(without, x, y);
        if (a === undefined || b === undefined) continue;
        // 0.02mm, not bit-identity: the re-triangulation above moves facets on
        // the rounded corner blends, so a ray there lands a few microns apart
        // on the SAME surface (measured 0.0065mm at the outer corners). The
        // defect this guards against is a band eating into the rim, which is
        // whole millimetres.
        expect(
          Math.abs(a - b),
          `material changed at (${x.toFixed(1)}, ${y.toFixed(1)})`
        ).toBeLessThan(0.02);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(300);
  }, 300000);
});
