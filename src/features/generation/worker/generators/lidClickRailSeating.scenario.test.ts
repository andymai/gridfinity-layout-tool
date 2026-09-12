/**
 * Does a click-rail lid's rail actually hook the bin's stacking lip?
 *
 * Two claims, and BOTH are needed — each is trivially satisfiable while the
 * other fails, and each has shipped broken on its own:
 *
 *  1. SEATS. Nothing of the lid shares space with the bin when the lid is home.
 *     The profile that preceded this test's rewrite failed here: every face of
 *     the rail sat 0.25mm to 0.6mm inside the lip along its whole length, so
 *     the lid could not go on at all.
 *  2. HOOKS. Lift the seated lid past its designed slack and the rail runs into
 *     the lip's underside. That is what retention IS — the lid is trapped, and
 *     the rail has to flex to release it. #4207 failed here: clean geometry,
 *     correctly seated, and a rail that met the bin nowhere.
 *
 * The earlier version of this file asserted a single INTERFERENCE reading and
 * called it "catch". That cannot distinguish the two — a press fit maximises
 * it, and a press fit is the one thing a snap must not be — and it duly passed
 * throughout the press-fit regression it was written to catch.
 *
 * Probed on the real solids rather than through `worstRailInterference` in
 * `lidSeating.ts`: on a column that metric cannot tell the void beneath the lip
 * from solid (see `RAIL_ENGAGEMENT_CEILING`), which is exactly the region the
 * whole question lives in. Crossings here are read parity-free.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidClickRailSeating.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { lidZOffset, interferenceAt, binLipTopZ } from './__kernel-tests__/lidSeating';
import {
  boundingBox,
  columnCrossings,
  verticalSolidSpans,
} from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import {
  clickRailProfile,
  LID_CLICK_RAIL_CATCH_GAP,
  LID_CORNER_RADIUS,
  LID_FIT_CLEARANCE,
  LID_SNAP_PLUG_CLEARANCE,
} from '@/features/bin-designer/types/lid';
import { GRIDFINITY_SPEC as G } from '@/shared/printSettings/gridfinityGeometry';
import type { BinParams } from '@/features/bin-designer/types';
import type { MeshData } from '@/features/generation/bridge/types';

/** Where the rail's own spine sits, inboard of the lid's outer edge (mm). */
const RAIL_SPINE_INSET = LID_CORNER_RADIUS - LID_FIT_CLEARANCE;

/**
 * Insets from the bin's outer face that fall inside the nub's radial band.
 *
 * The nub spans `LIP_TAPER_WIDTH - catchDepth` out to the lip's throat; these
 * sit inside that with room for tessellation at either end.
 */
const NUB_BAND = [2.25, 2.35, 2.45, 2.55];

function clickRailParams(over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...over,
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'clickRails' },
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
  };
}

/** Every (bin column, lid column) pair on the four rail lines, in the nub band. */
function* nubColumns(
  bin: MeshData,
  lid: MeshData
): Generator<{ bx: number; by: number; lx: number; ly: number }> {
  const lb = boundingBox(lid.vertices);
  const bb = boundingBox(bin.vertices);
  // In from each end: a perpendicular wall's rail occupies the first few mm
  // along this axis, and the corner arc's inward normal is not this axis.
  const skip = RAIL_SPINE_INSET + 2;
  for (const u of NUB_BAND) {
    for (const alongX of [true, false]) {
      const lo = alongX ? lb.minX : lb.minY;
      const hi = alongX ? lb.maxX : lb.maxY;
      for (const far of [true, false]) {
        const lc = far ? (alongX ? lb.maxY : lb.maxX) - u : (alongX ? lb.minY : lb.minX) + u;
        const bc = far ? (alongX ? bb.maxY : bb.maxX) - u : (alongX ? bb.minY : bb.minX) + u;
        for (let s = lo + skip; s <= hi - skip; s += 1) {
          yield alongX ? { bx: s, by: bc, lx: s, ly: lc } : { bx: bc, by: s, lx: lc, ly: s };
        }
      }
    }
  }
}

/** Top of the seated lid's nub at this column, relative to the bin's wall top. */
function nubTopAt(lid: MeshData, x: number, y: number, dz: number, wallTop: number): number | null {
  // The nub is the lid's topmost solid span that still sits below the seat
  // plane; above it is the mating wall and the plate.
  const tops = verticalSolidSpans(lid, x, y)
    .map(([, hi]) => hi + dz - wallTop)
    .filter((z) => z < 0)
    .sort((a, b) => b - a);
  return tops[0] ?? null;
}

/** Lowest bin surface at this column, relative to the wall top — the lip's underside. */
function lipUndersideAt(bin: MeshData, x: number, y: number, wallTop: number): number | null {
  // Parity-free, and the first crossing above the interior: below that are the
  // base socket's own surfaces, which are not what the nub is under.
  const z = columnCrossings(bin, x, y)
    .map((v) => v - wallTop)
    .find((v) => v > -8);
  return z ?? null;
}

describe('click-rail lid seating', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  const CASES: Array<[string, Partial<BinParams>]> = [
    ['2x2x3 (default footprint)', { width: 2, depth: 2, height: 3 }],
    ['3x3x6', { width: 3, depth: 3, height: 6 }],
    ['2x3x5', { width: 2, depth: 3, height: 5 }],
  ];

  it.each(CASES)(
    'seats with the rail clear of the lip on a plain %s bin',
    async (_label, over) => {
      const { generateLid } = await import('./lidOrchestrator');
      const params = clickRailParams(over);
      const bin = getGenerateBin()(params, undefined, false);
      const lid = generateLid(params);
      if (!bin || !lid) throw new Error('expected a bin and lid to build');
      const dz = lidZOffset(params);
      const wallTop = binLipTopZ(params) - G.LIP_HEIGHT;

      // CLAIM 1. Every nub sits in clear air, by the slack it was built with.
      let tightest = Infinity;
      let samples = 0;
      for (const c of nubColumns(bin, lid)) {
        const nub = nubTopAt(lid, c.lx, c.ly, dz, wallTop);
        const lip = lipUndersideAt(bin, c.bx, c.by, wallTop);
        if (nub === null || lip === null) continue;
        samples++;
        tightest = Math.min(tightest, lip - nub);
      }
      // The probe has to have found rail, or "no contact" is vacuous.
      expect(samples).toBeGreaterThan(20);
      // 0.02mm for tessellation on the 45 degree faces.
      expect(tightest).toBeGreaterThan(-0.02);
      expect(tightest).toBeLessThan(LID_CLICK_RAIL_CATCH_GAP + 0.05);
    },
    120_000
  );

  it.each(CASES)(
    'traps the lid: lifting it drives the rail into the lip on a %s bin',
    async (_label, over) => {
      const { generateLid } = await import('./lidOrchestrator');
      const params = clickRailParams(over);
      const bin = getGenerateBin()(params, undefined, false);
      const lid = generateLid(params);
      if (!bin || !lid) throw new Error('expected a bin and lid to build');
      const profile = clickRailProfile(
        RAIL_SPINE_INSET,
        params.wallThickness,
        LID_SNAP_PLUG_CLEARANCE
      );
      expect(profile.catchDepth).toBeGreaterThan(0);

      // CLAIM 2. Past the slack, the nub's top face is INSIDE the lip. Measured
      // against the lid's own unlifted position, so a probe that simply found
      // nothing cannot pass: the same columns read clear above and fouled here.
      const dz = lidZOffset(params);
      const wallTop = binLipTopZ(params) - G.LIP_HEIGHT;
      const lift = LID_CLICK_RAIL_CATCH_GAP + 0.1;

      let fouled = 0;
      let checked = 0;
      for (const c of nubColumns(bin, lid)) {
        const nub = nubTopAt(lid, c.lx, c.ly, dz, wallTop);
        const lip = lipUndersideAt(bin, c.bx, c.by, wallTop);
        if (nub === null || lip === null) continue;
        checked++;
        if (nub + lift > lip) fouled++;
      }
      expect(checked).toBeGreaterThan(20);
      // Every column carrying nub under lip must foul — the catch runs the
      // whole length of every rail, not just at one lucky sample.
      expect(fouled).toBe(checked);
    },
    120_000
  );

  it('reads clear when the lid is the one thing that changed (sensitivity proof)', async () => {
    // Control for claim 1: a lid whose rails are switched off has no nub to
    // find, so the probe must come up empty rather than quietly "passing".
    const { generateLid } = await import('./lidOrchestrator');
    const params = clickRailParams({ width: 2, depth: 2, height: 3 });
    const bin = getGenerateBin()(params, undefined, false);
    const railless = generateLid({
      ...params,
      lid: {
        ...params.lid,
        clickRails: { front: false, back: false, left: false, right: false },
      },
    });
    if (!bin || !railless) throw new Error('expected a bin and lid to build');
    const dz = lidZOffset(params);
    const wallTop = binLipTopZ(params) - G.LIP_HEIGHT;

    let samples = 0;
    for (const c of nubColumns(bin, railless)) {
      if (nubTopAt(railless, c.lx, c.ly, dz, wallTop) !== null) samples++;
    }
    expect(samples).toBe(0);
  }, 120_000);

  it('never lets the seated rail touch the lip anywhere on the way in', async () => {
    // The press-fit regression stated directly: sweep the rail lines for shared
    // Z at the seat plane. A rail jammed in the lip reads whole millimetres.
    const { generateLid } = await import('./lidOrchestrator');
    const params = clickRailParams({ width: 2, depth: 2, height: 3 });
    const bin = getGenerateBin()(params, undefined, false);
    const lid = generateLid(params);
    if (!bin || !lid) throw new Error('expected a bin and lid to build');
    const dz = lidZOffset(params);
    const bb = boundingBox(lid.vertices);
    const cy = (bb.minY + bb.maxY) / 2;
    const railY = bb.maxY - RAIL_SPINE_INSET;

    // Offsets landing on the SHANK and the mating wall — everything above the
    // nub, where any shared Z at all is a press fit rather than the undercut.
    let worst = 0;
    for (let x = cy - 15; x <= cy + 15; x += 1) {
      for (const off of [-0.6, -0.2, 0, 0.6]) {
        worst = Math.max(worst, interferenceAt(bin, lid, x, railY + off, dz));
      }
    }
    expect(worst).toBeLessThan(0.05);
  }, 120_000);
});
