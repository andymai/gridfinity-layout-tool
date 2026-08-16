/**
 * Click rails vs. cutouts and handles on a CUSTOM SHAPE.
 *
 * The live half of that issue, and it was live for a reason worth stating: the
 * premise that a polygon bin has no cutouts is false. `wallCutoutsFeature` and
 * `handlesFeature` both declare `supportsCellMask`, `featuresStage` therefore
 * keeps them on a partial mask, and `setCellMask` never clears
 * `walls.enabled` — `FeatureGate` only greys the controls out. So the cut is
 * really made, while `railPlacementsForPolygon` clipped nothing at all and ran
 * a rail the full length of a wall with a window in it.
 *
 * Verified the same way verified the rectangle case, because it is the
 * same kind of defect: an ABSENCE. A rail over a window collides with nothing,
 * so `worstRailInterference` reports clean on a lid that grips nothing there.
 * `ungrippedRailMm` asks the opposite question — wherever the lid has rail,
 * does the bin still have lip — and the control below measures the defect this
 * change removes.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidPolygonGrip.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  lidZOffset,
  ungrippedRailMm,
  worstRailInterferenceDelta,
} from './__kernel-tests__/lidSeating';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';

/** An L: bottom half full, top half only the left two columns. */
const L_MASK: CellMask = {
  cols: 4,
  rows: 4,
  cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0],
};

const CUTOUT_OFF = {
  enabled: false,
  width: 0,
  depth: 0,
  alignment: 'center' as const,
  offset: 0,
  widthMm: null,
};

function walls(
  side: 'front' | 'back' | 'left' | 'right' | null,
  width: number
): BinParams['walls'] {
  const base = {
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: side !== null,
    front: { ...CUTOUT_OFF },
    back: { ...CUTOUT_OFF },
    left: { ...CUTOUT_OFF },
    right: { ...CUTOUT_OFF },
  };
  if (side) {
    base[side] = { enabled: true, width, depth: 50, alignment: 'center', offset: 0, widthMm: null };
  }
  return base;
}

function makeParams(over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 6,
    cellMask: L_MASK,
    walls: walls(null, 0),
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      clickRailCoverage: 100,
      // Pins the CLIPPING path. The relief ring cannot help here — it carves
      // back material that intrudes and cannot restore material a cutout took.
      relieveInterior: false,
    },
    ...over,
  };
}

/**
 * Extra rail interference `params` has over the same L with no openings.
 *
 * A delta because the absolute number is a property of the FOOTPRINT: the
 * probe's outer offsets sample the rail bump inside the lip's undercut, which
 * is the snap fit engaging rather than a defect, and it measures 0.66mm on this
 * L before anything is added to it.
 */
async function railInterferenceDelta(params: BinParams): Promise<number> {
  const { generateLid } = await import('./lidOrchestrator');
  const plain = makeParams();
  const probeBin = getGenerateBin()(params, undefined, false);
  const probeLid = generateLid(params);
  const refBin = getGenerateBin()(plain, undefined, false);
  const refLid = generateLid(plain);
  if (!probeBin || !probeLid || !refBin || !refLid) {
    throw new Error('expected both pairs to build');
  }
  return worstRailInterferenceDelta(
    { bin: probeBin, lid: probeLid, dz: lidZOffset(params) },
    { bin: refBin, lid: refLid, dz: lidZOffset(plain) }
  );
}

async function railsOn(params: BinParams, rotationDeg: number): Promise<number> {
  const { railPlacements } = await import('./lidClickRail');
  const { resolveLidInputs } = await import('./lidInputs');
  return railPlacements(resolveLidInputs(params)).filter((p) => p.rotationDeg === rotationDeg)
    .length;
}

beforeAll(async () => {
  await initBrepjs();
}, 180000);

describe('polygon click rails keep lip to grip', () => {
  it('an L with no openings keeps a rail on every edge', async () => {
    // Control in the other direction: the clipping must not cost a rail that
    // nothing takes, or every clean result below is meaningless.
    const params = makeParams();
    expect(await railsOn(params, 180)).toBeGreaterThan(0);
    const bin = getGenerateBin()(params, undefined, false);
    const { generateLid } = await import('./lidOrchestrator');
    const lid = generateLid(params);
    if (!bin || !lid) throw new Error('expected the pair to build');
    expect(ungrippedRailMm(bin, lid, params, lidZOffset(params))).toBe(0);
  }, 300000);

  it('a cutout on the long front wall leaves a rail either side', async () => {
    const params = makeParams({ walls: walls('front', 40) });
    // Two rails, not one full-length rail straight over the window.
    expect(await railsOn(params, 180)).toBe(2);

    const bin = getGenerateBin()(params, undefined, false);
    const { generateLid } = await import('./lidOrchestrator');
    const lid = generateLid(params);
    if (!bin || !lid) throw new Error('expected the pair to build');
    const dz = lidZOffset(params);
    expect(ungrippedRailMm(bin, lid, params, dz)).toBe(0);
    // Nothing was moved INTO anything either. Stated as a DELTA against the
    // same L with no cutout: `worstRailInterference` is 0.66mm on this
    // footprint before any feature is added — that is the rail bump sitting in
    // the lip's undercut, the snap engaging, and an absolute threshold would
    // either fail on a good bin or have to be tuned per shape.
    expect(await railInterferenceDelta(params)).toBeLessThan(0.05);
  }, 300000);

  it('a cutout on the short back wall spares the other back-facing edge', async () => {
    // The reason a gap carries its edge's coordinate rather than a side name.
    // An L faces back with two edges — the short top of the tall arm and the
    // step's shelf — and a cutout sits on exactly one of them. Blocking by side
    // would take the rail off both.
    const params = makeParams({ walls: walls('back', 40) });
    const plain = makeParams();
    const cutRails = await railsOn(params, 0);
    const allRails = await railsOn(plain, 0);
    // The cut edge splits in two, and every other back-facing edge is untouched.
    expect(cutRails).toBeGreaterThanOrEqual(allRails);

    const bin = getGenerateBin()(params, undefined, false);
    const { generateLid } = await import('./lidOrchestrator');
    const lid = generateLid(params);
    if (!bin || !lid) throw new Error('expected the pair to build');
    expect(ungrippedRailMm(bin, lid, params, lidZOffset(params))).toBe(0);
  }, 300000);

  it('the probe can see a polygon rail with no lip under it', async () => {
    // Control for the whole file, and the measurement of the defect itself:
    // a bin WITH a full-width front cutout, and a lid built as though it had
    // none — which is exactly what shipped before this change.
    const params = makeParams({ walls: walls('front', 100) });
    const bin = getGenerateBin()(params, undefined, false);
    const { generateLid } = await import('./lidOrchestrator');
    const blindLid = generateLid(makeParams());
    if (!bin || !blindLid) throw new Error('expected the pair to build');

    const dz = lidZOffset(params);
    expect(ungrippedRailMm(bin, blindLid, params, dz)).toBeGreaterThan(20);
    // ...while interference sees NOTHING: the blind lid's rails hang over an
    // opening, so they touch no more material than the correct lid's do. That
    // is the whole reason this probe exists — 20mm+ of rail gripping air, and
    // the sweep that catches every other lid defect reports no change at all.
    const { generateLid: gen } = await import('./lidOrchestrator');
    const plain = makeParams();
    const refBin = getGenerateBin()(plain, undefined, false);
    const refLid = gen(plain);
    if (!refBin || !refLid) throw new Error('expected the reference pair to build');
    expect(
      worstRailInterferenceDelta(
        { bin, lid: blindLid, dz },
        { bin: refBin, lid: refLid, dz: lidZOffset(plain) }
      )
    ).toBeLessThan(0.05);
  }, 300000);
});
