// @vitest-environment node
/**
 * Calibration check for the scoop term in `printEstimates`.
 *
 * A scoop is a ramp fused into the wall-floor corner of each compartment, so
 * it ADDS material: the wedge under its arc, across the compartment's merged
 * extent. The estimator used to subtract a quarter-ellipse per grid cell, which
 * priced the reported 5x5 bento bin at 5 g against 210 g sliced (#4085). The
 * expected values come from `meshVolume` of the generated bin, never from the
 * estimator's own arithmetic.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { meshVolume } from './__kernel-tests__/meshAssertions';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

/** Residual allowed on the ramp material alone (estimate delta vs measured
 *  delta). The model prices the wedge, the lip strip less the lip's angled
 *  support, and the divider halves the ramp shares; the worst case measured
 *  is 2.1%. */
const MAX_RAMP_RESIDUAL = 0.05;
/** Residual allowed on the whole bin where the shell model is calibrated. */
const MAX_BIN_RESIDUAL = 0.05;

/** The reported layout: a full-width front tray, a deep left bay, two
 *  double-width compartments and a quad, so ramps span merged extents. */
const BENTO_CELLS = [0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 1, 6, 6, 7, 7, 1, 8, 8, 8, 8, 9, 10, 11, 12, 13];

const rowsOf = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const noLip = { ...DEFAULT_BIN_PARAMS.base, stackingLip: false };
const compartments = (cols: number, rows: number, cells: number[]): BinParams['compartments'] => ({
  ...DEFAULT_BIN_PARAMS.compartments,
  cols,
  rows,
  cells,
});

function bin(over: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 3, style: 'standard', ...over };
}

function bento(over: Partial<BinParams> = {}): BinParams {
  return bin({
    width: 5,
    depth: 5,
    height: 4,
    compartments: compartments(5, 5, BENTO_CELLS),
    ...over,
  });
}

const scooped = (p: BinParams, over: Partial<BinParams['scoop']> = {}): BinParams => ({
  ...p,
  scoop: { ...p.scoop, enabled: true, radius: 'auto', style: 'curved', ...over },
});
const unscooped = (p: BinParams): BinParams => ({ ...p, scoop: { ...p.scoop, enabled: false } });

describe('print estimate — scoop ramps', () => {
  const cases: Array<{ name: string; params: BinParams }> = [
    { name: '2x2x3u, one compartment, lipped', params: scooped(bin()) },
    { name: '2x2x3u, one compartment, no lip', params: scooped(bin({ base: noLip })) },
    { name: '2x2x3u, thin 0.95 wall', params: scooped(bin({ wallThickness: 0.95 })) },
    {
      name: '2x2x3u, two rows (one interior ramp)',
      params: scooped(bin({ compartments: compartments(1, 2, rowsOf(2)) })),
    },
    {
      name: '2x2x3u, 2x2 grid, left, straight',
      params: scooped(bin({ compartments: compartments(2, 2, rowsOf(4)) }), {
        side: 'left',
        style: 'straight',
      }),
    },
    { name: '2x2x6u, tall', params: scooped(bin({ height: 6 })) },
    { name: '5x5x4u, one compartment', params: scooped(bin({ width: 5, depth: 5, height: 4 })) },
    {
      name: '5x5x4u, fixed 10mm ramp',
      params: scooped(bin({ width: 5, depth: 5, height: 4 }), { radius: 10, run: 10 }),
    },
    {
      name: '5x5x4u, five full-width rows',
      params: scooped(
        bin({ width: 5, depth: 5, height: 4, compartments: compartments(1, 5, rowsOf(5)) })
      ),
    },
    { name: '5x5x4u bento (#4085)', params: scooped(bento()) },
    {
      name: '5x5x4u bento, detachable feet',
      params: scooped(bento({ base: { ...DEFAULT_BIN_PARAMS.base, feet: 'detachable' } })),
    },
  ];

  it.each(cases)(
    'prices the ramps within 5% of the generated ones for $name',
    ({ params }) => {
      const generate = getGenerateBin();
      const measured =
        meshVolume(generate(params, undefined, true)) -
        meshVolume(generate(unscooped(params), undefined, true));
      const estimated =
        estimatePrint(params).volumeMm3 - estimatePrint(unscooped(params)).volumeMm3;
      expect(measured).toBeGreaterThan(0);
      expect(estimated).toBeGreaterThan(0);
      const residual = Math.abs(estimated - measured) / measured;
      expect(residual, `estimated +${estimated} vs measured +${Math.round(measured)}`).toBeLessThan(
        MAX_RAMP_RESIDUAL
      );
    },
    180000
  );

  it('prices the reported bento bin within 5% of its generated volume', () => {
    const params = scooped(bento());
    const measured = meshVolume(getGenerateBin()(params, undefined, true));
    const estimated = estimatePrint(params).volumeMm3;
    const residual = Math.abs(estimated - measured) / measured;
    expect(residual, `estimated ${estimated} vs measured ${Math.round(measured)}`).toBeLessThan(
      MAX_BIN_RESIDUAL
    );
  }, 180000);
});
