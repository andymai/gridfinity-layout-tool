// @vitest-environment node
/**
 * The stacking lip's angled support must not reach past the wall it sits on.
 *
 * `buildTopShapeLoft` builds that 45° wedge hanging `LIP_TAPER_WIDTH` (2.6mm)
 * BELOW the lip's own base plane, and that plane is the wall top.
 * So on a wall shorter than 2.6mm the wedge reaches below the wall bottom — which
 * IS the socket top — and back-fills the socket's upper 45° taper out to full
 * outer width. The bin then rests on the baseplate's pocket mouth instead of
 * dropping in.
 *
 * Two legal configurations fall below that wall, and are the reason
 * `dim.lipHasSupport` exists:
 *   - a 1u spacer at the default 7mm height unit (wall 2.0mm)
 *   - any 2u bin at a 3mm height unit (wall 1.0mm)
 *
 * Neither is visible to a bounding-box, triangle-count or watertight assertion:
 * both solids are fine, the bin is exactly as tall as it should be, and the extra
 * material is a 0.7mm wedge tucked under the wall. So this mates the bin to a
 * generated plate and lets it fall, reusing the `binSeating` probe rather than
 * restating the profile arithmetic the defect lives in.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lipSupportSeating.kernel
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams, ResolvedBaseplateParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { initTestKernel } from '@/test/initTestKernel';
import { seatDepth, type Placement } from './__kernel-tests__/binSeating';

let generateBin: (params: BinParams) => MeshData;
let generateBaseplate: (
  params: ResolvedBaseplateParams,
  onProgress: (stage: string, progress: number) => void,
  forExport: boolean
) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
  generateBaseplate = (await import('./baseplateGenerator')).generateBaseplate;
}, 60000);

/**
 * Tolerance on a seat-depth COMPARISON, in mm. Not a seated/proud threshold: the
 * whole point below is that a fixed threshold hides this defect. The overreach a
 * short wall produces equals `LIP_TAPER_WIDTH - wall`, which is
 * 0.6mm for a 1u spacer — comfortably inside the 1mm of slack a
 * "seated is within 4mm of a 5mm pocket" rule leaves, and invisible to it.
 */
const SEAT_TOLERANCE_MM = 0.15;

const ON_GRID: Placement = { dx: 0, dy: 0 };

let plate: MeshData;
function plateMesh(): MeshData {
  plate ??= generateBaseplate(
    {
      width: 4,
      depth: 4,
      gridUnitMm: 42,
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2.4,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      fractionalEdgeX: 'end',
      fractionalEdgeY: 'end',
      lightweight: false,
    },
    () => {},
    false
  );
  return plate;
}

/** `base` is deep-partial here so a case can set one flag without restating it. */
type BinOverrides = Omit<Partial<BinParams>, 'base'> & {
  readonly base?: Partial<BinParams['base']>;
};

function makeBin(overrides: BinOverrides, stackingLip: boolean): MeshData {
  return generateBin({
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    ...overrides,
    base: { ...DEFAULT_BIN_PARAMS.base, ...(overrides.base ?? {}), stackingLip },
  });
}

/**
 * How much shallower the bin seats with its lip than without.
 *
 * A DELTA, because the lip is the only variable: the same feet, the same plate,
 * the same placement. Anything positive is the lip's support pushing the foot out
 * of its pocket, and the sign of the answer does not depend on picking a
 * seated/proud threshold correctly — which is what let a 0.7mm defect ship.
 */
function lipSeatCost(overrides: BinOverrides): number {
  const withLip = seatDepth(makeBin(overrides, true), plateMesh(), ON_GRID);
  const without = seatDepth(makeBin(overrides, false), plateMesh(), ON_GRID);
  return without.mm - withLip.mm;
}

describe('stacking lip support vs. the socket taper', () => {
  it('costs a 1u spacer nothing', () => {
    // Wall 2.0mm, so the support overreaches by 0.7mm: small enough that a fixed
    // seated/proud threshold reads the result as seated.
    expect(lipSeatCost({ height: 1, base: { spacer: true } })).toBeLessThan(SEAT_TOLERANCE_MM);
  }, 240_000);

  it('costs a 2u bin at a 3mm height unit nothing', () => {
    // Wall 1.0mm — the shortest an ordinary socketed bin can have, and a 1.7mm
    // overreach. Nothing relaxed about this input: MIN_HEIGHT is 2u.
    expect(lipSeatCost({ height: 2, heightUnitMm: 3 })).toBeLessThan(SEAT_TOLERANCE_MM);
  }, 240_000);

  it('costs an ordinary bin nothing either', () => {
    // Control: a 21mm wall carries the support with room to spare. Catches a
    // change that dropped the support everywhere, and proves the delta reads ~0
    // when nothing is wrong.
    expect(lipSeatCost({ height: 3 })).toBeLessThan(SEAT_TOLERANCE_MM);
  }, 240_000);

  it('and the probe can still see a foot that does not seat', () => {
    // Guards the guard: if the plate or the probe regressed so that every column
    // reported the full pocket depth, every assertion above would pass on a bin
    // resting on the rim. A full-cell foot at a half-cell offset cannot seat.
    const { mm } = seatDepth(makeBin({ height: 3 }, true), plateMesh(), { dx: 21, dy: 21 });
    expect(mm).toBeLessThan(1);
  }, 240_000);
});
