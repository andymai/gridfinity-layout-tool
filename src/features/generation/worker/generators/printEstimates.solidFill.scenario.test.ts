// @vitest-environment node
/**
 * Calibration check for the solid-bin fill term in `printEstimates`.
 *
 * The shell model the estimator is built on prices every bin as a hollow box.
 * A solid bin is that box with its cavity filled, and until `solidFillVolume`
 * existed nothing added it: measured against generated geometry, solid bins
 * came out at 19-35% of their real volume, and a shadow board's estimate never
 * moved however many pockets were carved into it.
 *
 * This is the reproduction of that calibration, not a restatement of it. The
 * expected value comes from `meshVolume` of the real generated bin — asserting
 * the analytic term against a second copy of its own arithmetic would pass on
 * any constant at all.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { meshVolume } from './__kernel-tests__/meshAssertions';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

/** Worst residual the fitted constant is allowed to drift to. */
const MAX_RESIDUAL = 0.03;

const cutout = (over: Partial<Cutout>): Cutout => ({
  id: 'c1',
  shape: 'circle',
  x: 10,
  y: 10,
  width: 12,
  depth: 12,
  cutDepth: 8,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...over,
});

function solidBin(over: Partial<BinParams> = {}, cutouts: Cutout[] = []): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 3,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts,
    cutoutConfig: { topOffset: 0 },
    ...over,
  };
}

describe('print estimate — solid bin fill', () => {
  const cases: Array<{ name: string; params: BinParams }> = [
    { name: '2x2x3u', params: solidBin() },
    { name: '2x2x6u', params: solidBin({ height: 6 }) },
    { name: '3x2x4u', params: solidBin({ width: 3, height: 4 }) },
    { name: '2x2x3u with a pocket', params: solidBin({}, [cutout({ cutDepth: 8 })]) },
    {
      name: '2x2x3u with a deep channel',
      params: solidBin({}, [
        cutout({ id: 'd', shape: 'rectangle', x: 8, y: 8, width: 40, depth: 20, cutDepth: 14 }),
      ]),
    },
  ];

  it.each(cases)(
    'is within 3% of the generated solid for $name',
    ({ params }) => {
      const measured = meshVolume(getGenerateBin()(params));
      const estimated = estimatePrint(params).volumeMm3;
      const residual = Math.abs(estimated - measured) / measured;
      expect(residual, `estimated ${estimated} vs measured ${Math.round(measured)}`).toBeLessThan(
        MAX_RESIDUAL
      );
    },
    120000
  );

  it('still prices a hollow bin exactly as before', () => {
    const hollow: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 3,
      style: 'standard',
    };
    const measured = meshVolume(getGenerateBin()(hollow));
    const estimated = estimatePrint(hollow).volumeMm3;
    expect(Math.abs(estimated - measured) / measured).toBeLessThan(0.02);
  }, 120000);

  it('falls as material is carved out, which it did not before', () => {
    // The bug this term fixes was not only scale: a solid bin's estimate was
    // completely insensitive to its cutouts, so a heavily carved board and a
    // blank one reported the same number.
    const blank = estimatePrint(solidBin()).volumeMm3;
    const carved = estimatePrint(
      solidBin({}, [
        cutout({ id: 'd', shape: 'rectangle', x: 8, y: 8, width: 40, depth: 20, cutDepth: 14 }),
      ])
    ).volumeMm3;
    expect(carved).toBeLessThan(blank);
    // 40 x 20 x 14 of material, so the drop is the pocket, not a rounding wobble.
    expect(blank - carved).toBeCloseTo(40 * 20 * 14, -2);
  });
});
