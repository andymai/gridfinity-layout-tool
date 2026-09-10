/**
 * Does a click-rail lid's rail actually catch the bin's stacking lip?
 *
 * `lidClickRailRetention.test.ts` proves the rail's cross-section has a
 * healthy catch once it lands on the lip — the bump stands proud of the fit
 * clearance, the chamfers are real ramps. It is a pure geometric budget and
 * never builds a solid, so it cannot see where the rail's absolute position
 * ends up relative to the bin's — and #4207 shipped with that budget green
 * throughout: `LID_CLICK_RAIL_OUT`/`INSET` put the bump's catching body
 * 2.70mm inset from the wall face, past the lip's own ~2.6mm maximum
 * overhang reach, so on a stock 2x2 bin the rail met the bin nowhere along
 * its entire run. `lidSeatInterference.matrix.test.ts` is a DELTA test
 * against the same design with its interior emptied and would not have
 * caught this either — 0mm³ minus 0mm³ is 0, a pass.
 *
 * This probes the real solids directly rather than through
 * `worstRailInterference` in `lidSeating.ts`: that helper derives the rail's
 * spine from `LID_CORNER_RADIUS` alone, 0.25mm off the
 * `LID_CORNER_RADIUS - LID_FIT_CLEARANCE` every real rail placement uses, and
 * on this exact bug's narrow catch band that miss is enough to read 0mm
 * regardless of this fix. Fixing that helper properly is a much larger,
 * separately-scoped change — dozens of other tests assert against it with an
 * absolute near-zero floor that the SAME bug was quietly keeping green — so
 * this test computes its own, correctly-placed probe line instead of
 * widening that blast radius here.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidClickRailSeating.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { lidZOffset, interferenceAt } from './__kernel-tests__/lidSeating';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { LID_CORNER_RADIUS, LID_FIT_CLEARANCE } from '@/features/bin-designer/types/lid';
import type { BinParams } from '@/features/bin-designer/types';
import type { MeshData } from '@/features/generation/bridge/types';

/**
 * Floor (mm) for a real catch, not a boolean sliver.
 *
 * Comfortably below the ~1.7mm this measures on every footprint below, and
 * comfortably above the 0.05mm tessellation-noise tolerance
 * `lidSeatInterference.matrix` uses on curved corners — a rail that only
 * grazes the lip measures in the hundredths, not tenths, of a millimetre.
 */
const REAL_CATCH_FLOOR_MM = 0.3;

/** Where the rail's own spine sits, inboard of the lid's outer edge (mm). */
const RAIL_SPINE_INSET = LID_CORNER_RADIUS - LID_FIT_CLEARANCE;

/** Offsets from the spine to sample, spanning the rail's own cross-section. */
const PROBE_OFFSETS = [-0.6, -0.2, 0, 0.6, 1.4, 1.8];

function clickRailParams(over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...over,
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'clickRails' },
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
  };
}

/** Worst engagement found sweeping the back wall's rail, at its true spine. */
function worstBackRailCatch(bin: MeshData, lid: MeshData, dz: number): number {
  const bb = boundingBox(lid.vertices);
  const cx = (bb.minX + bb.maxX) / 2;
  const railY = bb.maxY - RAIL_SPINE_INSET;
  let worst = 0;
  for (let x = cx - 15; x <= cx + 15; x += 3) {
    for (const off of PROBE_OFFSETS) {
      worst = Math.max(worst, interferenceAt(bin, lid, x, railY + off, dz));
    }
  }
  return worst;
}

describe('click-rail lid seating', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  it.each<[string, Partial<BinParams>]>([
    ['2x2x3 (default footprint)', { width: 2, depth: 2, height: 3 }],
    ['3x3x6', { width: 3, depth: 3, height: 6 }],
    ['2x3x5', { width: 2, depth: 3, height: 5 }],
  ])(
    'catches the lip on a plain %s bin',
    async (_label, over) => {
      const { generateLid } = await import('./lidOrchestrator');
      const params = clickRailParams(over);
      const bin = getGenerateBin()(params, undefined, false);
      const lid = generateLid(params);
      if (!bin || !lid) throw new Error('expected a bin and lid to build');
      const dz = lidZOffset(params);
      expect(worstBackRailCatch(bin, lid, dz)).toBeGreaterThan(REAL_CATCH_FLOOR_MM);
    },
    120_000
  );
});
