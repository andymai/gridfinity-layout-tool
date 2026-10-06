// @vitest-environment node
/**
 * Calibration check for the wall-thickness, stacking-lip and stamped-pattern
 * terms in `printEstimates`, against the volume of the EXPORTED solid.
 *
 * Export, not the preview mesh: below a 1mm wall the preview's socket and box
 * are separate overlapping shells, so `meshVolume` of it counts the overlap
 * twice and reads a thin-walled bin as nearly as heavy as a 1mm one.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, unwrap } from 'brepjs';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { clearAllCaches, getLastSolid } from './shapeCache';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
import type * as BinExporterModule from './binExporter';

let exportBin: typeof BinExporterModule.exportBin;

beforeAll(async () => {
  await initBrepjs();
  exportBin = (await import('./binExporter')).exportBin;
}, 30000);

const MAX_RESIDUAL = 0.03;

const P = DEFAULT_BIN_PARAMS;
const bin = (over: Partial<BinParams>): BinParams => ({ ...P, ...over });

async function exportedVolume(params: BinParams): Promise<number> {
  clearAllCaches();
  await exportBin(params, 'stl');
  const solid = getLastSolid();
  if (!solid) throw new Error('export left no solid');
  return unwrap(measureVolume(solid));
}

describe('print estimate — wall thickness', () => {
  const cases: Array<{ name: string; params: BinParams }> = [
    { name: '2x1x6 at 0.6mm', params: bin({ width: 2, depth: 1, height: 6, wallThickness: 0.6 }) },
    { name: '2x1x6 at 2.0mm', params: bin({ width: 2, depth: 1, height: 6, wallThickness: 2 }) },
    {
      name: '3x2x4 without a lip at 0.6mm',
      params: bin({
        width: 3,
        depth: 2,
        height: 4,
        wallThickness: 0.6,
        base: { ...P.base, stackingLip: false },
      }),
    },
    {
      name: '3x2x4 without a lip at 2.4mm',
      params: bin({
        width: 3,
        depth: 2,
        height: 4,
        wallThickness: 2.4,
        base: { ...P.base, stackingLip: false },
      }),
    },
    {
      name: '2x2x4 with dividers at 2.0mm',
      params: bin({
        width: 2,
        depth: 2,
        height: 4,
        wallThickness: 2,
        compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
      }),
    },
    {
      name: '2x2x6 honeycomb at 1.2mm',
      params: bin({
        width: 2,
        depth: 2,
        height: 6,
        wallPattern: { ...P.wallPattern, enabled: true },
      }),
    },
    {
      name: '2x2x6 honeycomb at 2.0mm, a row fewer than at 1.2mm',
      params: bin({
        width: 2,
        depth: 2,
        height: 6,
        wallThickness: 2,
        wallPattern: { ...P.wallPattern, enabled: true },
      }),
    },
    {
      name: '2x1x6 slots at 0.6mm',
      params: bin({
        width: 2,
        depth: 1,
        height: 6,
        wallThickness: 0.6,
        wallPattern: { ...P.wallPattern, enabled: true, pattern: 'slots' },
      }),
    },
    {
      name: 'slotted 2x2x5 at 2.0mm',
      params: bin({ width: 2, depth: 2, height: 5, wallThickness: 2, style: 'slotted' }),
    },
    {
      name: 'flat 1x1x3 without a lip at 0.8mm',
      params: bin({
        width: 1,
        depth: 1,
        height: 3,
        wallThickness: 0.8,
        base: { ...P.base, style: 'flat', stackingLip: false },
      }),
    },
    {
      name: 'flat 2x2x6 at 1.2mm',
      params: bin({ width: 2, depth: 2, height: 6, base: { ...P.base, style: 'flat' } }),
    },
    {
      name: 'flat 3x2x6 at 0.8mm',
      params: bin({
        width: 3,
        depth: 2,
        height: 6,
        wallThickness: 0.8,
        base: { ...P.base, style: 'flat' },
      }),
    },
    {
      name: 'flat 3x2x3 at 2.0mm',
      params: bin({
        width: 3,
        depth: 2,
        height: 3,
        wallThickness: 2,
        base: { ...P.base, style: 'flat' },
      }),
    },
    {
      name: 'flat slotted 2x2x6 at 1.2mm',
      params: bin({
        width: 2,
        depth: 2,
        height: 6,
        style: 'slotted',
        base: { ...P.base, style: 'flat' },
      }),
    },
    {
      name: 'solid 2x2x3 at 2.4mm',
      params: bin({
        width: 2,
        depth: 2,
        height: 3,
        wallThickness: 2.4,
        style: 'solid',
        base: { ...P.base, solid: true },
        cutoutConfig: { topOffset: 0 },
      }),
    },
  ];

  it.each(cases)(
    'is within 3% of the exported solid for $name',
    async ({ params }) => {
      const measured = await exportedVolume(params);
      const estimated = estimatePrint(params).volumeMm3;
      expect(
        Math.abs(estimated - measured) / measured,
        `estimated ${estimated} vs measured ${Math.round(measured)}`
      ).toBeLessThan(MAX_RESIDUAL);
    },
    60000
  );

  it('rises with the wall by what the exported solid gains', async () => {
    const at = (wallThickness: number): BinParams =>
      bin({ width: 2, depth: 1, height: 6, wallThickness });
    const measuredGain = (await exportedVolume(at(2))) - (await exportedVolume(at(1.2)));
    const estimatedGain = estimatePrint(at(2)).volumeMm3 - estimatePrint(at(1.2)).volumeMm3;
    expect(measuredGain).toBeGreaterThan(0);
    expect(Math.abs(estimatedGain - measuredGain) / measuredGain).toBeLessThan(0.05);
  }, 60000);
});
