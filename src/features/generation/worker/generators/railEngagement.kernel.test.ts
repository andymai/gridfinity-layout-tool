/**
 * Pins the datum every rail-clearance assertion is stated against.
 *
 * `worstRailInterference` does not read zero on a bin that seats perfectly: the
 * click rail's bump protrudes past its spine and sits inside the stacking lip's
 * undercut, which is the snap fit engaging. Every clearance suite therefore
 * asserts `< RAIL_ENGAGEMENT_CEILING + tolerance`, and that only means anything
 * while the ceiling matches what a feature-free bin actually measures.
 *
 * If this fails, the rail profile or the probe moved. Re-measure and update the
 * constant deliberately — do not widen the tolerances that depend on it.
 *
 *   pnpm run test:run src/features/generation/worker/generators/railEngagement.kernel
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  lidZOffset,
  RAIL_ENGAGEMENT_CEILING,
  worstRailInterference,
} from './__kernel-tests__/lidSeating';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { LID_CLICK_RAIL_OUT } from '@/shared/types/bin';
import { LID_CLICK_RAIL_INSET } from './lidConstants';
import type { BinParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 180_000);

/** A bin with a click-rail lid and nothing inside it to clash with. */
function featureFree(width: number, depth: number): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width,
    depth,
    height: 6,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      relieveInterior: false,
    },
  };
}

async function floorFor(width: number, depth: number): Promise<number> {
  const { generateLid } = await import('./lidOrchestrator');
  const params = featureFree(width, depth);
  const bin = getGenerateBin()(params, undefined, false);
  const lid = generateLid(params);
  if (!bin || !lid) throw new Error(`expected the ${width}x${depth} pair to build`);
  return worstRailInterference(bin, lid, lidZOffset(params));
}

describe('rail engagement datum', () => {
  it.each([
    [2, 2],
    [2, 3],
    [3, 2],
    [3, 3],
  ])(
    'a feature-free %ix%i reads the ceiling',
    async (w, d) => {
      expect(await floorFor(w, d)).toBeCloseTo(RAIL_ENGAGEMENT_CEILING, 2);
    },
    300_000
  );

  it('the ceiling is the rail bump reaching into the lip, not slack', () => {
    // The bump protrudes OUT - INSET past the spine. The measured ceiling sits
    // just above it, which is what identifies the reading as the snap fit
    // rather than a clash someone tuned a threshold around.
    const designedReach = LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET;
    expect(RAIL_ENGAGEMENT_CEILING).toBeGreaterThanOrEqual(designedReach);
    expect(RAIL_ENGAGEMENT_CEILING - designedReach).toBeLessThan(0.5);
  });
});
