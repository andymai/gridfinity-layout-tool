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
import { DEFAULT_TRAY_BOTTOM } from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';
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

function mask(cols: number, rows: number, empty: (col: number, row: number) => boolean): CellMask {
  const cells: (0 | 1)[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) cells.push(empty(col, row) ? 0 : 1);
  }
  return { cols, rows, cells };
}
// Mask cells are half grid units, so a 2x2 bin's mask is 4x4.
const L_SHAPE = mask(4, 4, (col, row) => col >= 2 && row >= 2);
const O_SHAPE = mask(6, 6, (col, row) => col >= 2 && col < 4 && row >= 2 && row < 4);
const OVERHANG = { left: 0, right: 10, front: 5, back: 0, feet: false };

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
      name: 'raised tray 2x2x6 at 1.2mm',
      params: bin({ width: 2, depth: 2, height: 6, base: { ...P.base, style: 'lid' } }),
    },
    {
      name: 'raised tray 1x1x3 at 2.0mm',
      params: bin({
        width: 1,
        depth: 1,
        height: 3,
        wallThickness: 2,
        base: { ...P.base, style: 'lid' },
      }),
    },
    {
      name: 'raised friction tray 2x2x3 with 5mm of extra skirt',
      params: bin({
        width: 2,
        depth: 2,
        height: 3,
        base: {
          ...P.base,
          style: 'lid',
          trayBottom: { ...DEFAULT_TRAY_BOTTOM, attachment: 'friction', extraHeightMm: 5 },
        },
      }),
    },
    {
      name: 'raised magnetic tray 4x4x3 with edge magnets',
      params: bin({
        width: 4,
        depth: 4,
        height: 3,
        base: {
          ...P.base,
          style: 'lid',
          trayBottom: {
            ...DEFAULT_TRAY_BOTTOM,
            attachment: 'magnetic',
            retentionMagnet: { ...DEFAULT_TRAY_BOTTOM.retentionMagnet, edgeMagnets: 1 },
          },
        },
      }),
    },
    {
      name: 'nesting tray 3x2x3 without a lip at 0.8mm',
      params: bin({
        width: 3,
        depth: 2,
        height: 3,
        wallThickness: 0.8,
        base: {
          ...P.base,
          style: 'lid',
          stackingLip: false,
          trayBottom: { ...DEFAULT_TRAY_BOTTOM, floorAtBed: true },
        },
      }),
    },
    {
      name: 'flat 2x2x6 overhung on the right and front',
      params: bin({
        width: 2,
        depth: 2,
        height: 6,
        base: { ...P.base, style: 'flat' },
        overhang: OVERHANG,
      }),
    },
    {
      name: 'flat 2x2x6 overhung with a tapered base',
      params: bin({
        width: 2,
        depth: 2,
        height: 6,
        base: { ...P.base, style: 'flat' },
        overhang: {
          ...OVERHANG,
          taper: {
            enabled: true,
            profile: 'chamfer',
            bandHeight: 10,
            left: 0,
            right: 10,
            front: 5,
            back: 0,
          },
        },
      }),
    },
    {
      name: 'raised tray 2x2x6 overhung on the right and front',
      params: bin({
        width: 2,
        depth: 2,
        height: 6,
        base: { ...P.base, style: 'lid' },
        overhang: OVERHANG,
      }),
    },
    {
      name: 'magnetic tray 4x4x3 overhung, with edge magnets',
      params: bin({
        width: 4,
        depth: 4,
        height: 3,
        base: {
          ...P.base,
          style: 'lid',
          trayBottom: {
            ...DEFAULT_TRAY_BOTTOM,
            attachment: 'magnetic',
            retentionMagnet: { ...DEFAULT_TRAY_BOTTOM.retentionMagnet, edgeMagnets: 1 },
          },
        },
        overhang: OVERHANG,
      }),
    },
    {
      name: 'flat L-shaped 2x2x3',
      params: bin({
        width: 2,
        depth: 2,
        height: 3,
        base: { ...P.base, style: 'flat' },
        cellMask: L_SHAPE,
      }),
    },
    {
      name: 'flat O-shaped 3x3x3',
      params: bin({
        width: 3,
        depth: 3,
        height: 3,
        base: { ...P.base, style: 'flat' },
        cellMask: O_SHAPE,
      }),
    },
    {
      name: 'raised tray L-shaped 2x2x3',
      params: bin({
        width: 2,
        depth: 2,
        height: 3,
        base: { ...P.base, style: 'lid' },
        cellMask: L_SHAPE,
      }),
    },
    {
      name: 'raised tray O-shaped 3x3x3',
      params: bin({
        width: 3,
        depth: 3,
        height: 3,
        base: { ...P.base, style: 'lid' },
        cellMask: O_SHAPE,
      }),
    },
    {
      name: 'flat 0.5x0.5 at a 10mm pitch without a lip',
      params: bin({
        width: 0.5,
        depth: 0.5,
        height: 6,
        gridUnitMm: 10,
        base: { ...P.base, style: 'flat', stackingLip: false },
      }),
    },
    {
      name: 'flat 0.5x0.5 at a 10mm pitch',
      params: bin({
        width: 0.5,
        depth: 0.5,
        height: 3,
        gridUnitMm: 10,
        base: { ...P.base, style: 'flat' },
      }),
    },
    {
      name: 'raised tray 0.5x0.5 at a 10mm pitch',
      params: bin({
        width: 0.5,
        depth: 0.5,
        height: 3,
        gridUnitMm: 10,
        base: { ...P.base, style: 'lid' },
      }),
    },
    {
      name: 'flat 0.5x1 at a 15mm pitch',
      params: bin({
        width: 0.5,
        depth: 1,
        height: 6,
        gridUnitMm: 15,
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
    {
      name: 'solid nesting tray 2x2x3',
      params: bin({
        width: 2,
        depth: 2,
        height: 3,
        style: 'solid',
        base: {
          ...P.base,
          style: 'lid',
          solid: true,
          trayBottom: { ...DEFAULT_TRAY_BOTTOM, floorAtBed: true },
        },
        cutoutConfig: { topOffset: 0 },
      }),
    },
    {
      name: 'solid nesting tray 3x2x6 at 2.0mm',
      params: bin({
        width: 3,
        depth: 2,
        height: 6,
        wallThickness: 2,
        style: 'solid',
        base: {
          ...P.base,
          style: 'lid',
          solid: true,
          trayBottom: { ...DEFAULT_TRAY_BOTTOM, floorAtBed: true },
        },
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

  it('fills a custom-shape solid by what the solid adds to the export', async () => {
    const shape = { width: 2, depth: 2, height: 3, cellMask: L_SHAPE };
    const hollow = bin(shape);
    const solid = bin({
      ...shape,
      style: 'solid',
      base: { ...P.base, solid: true },
      cutoutConfig: { topOffset: 0 },
    });
    const measured = (await exportedVolume(solid)) - (await exportedVolume(hollow));
    const estimated = estimatePrint(solid).volumeMm3 - estimatePrint(hollow).volumeMm3;
    expect(Math.abs(estimated - measured) / measured).toBeLessThan(MAX_RESIDUAL);
  }, 60000);

  it('leaves out the rails a tray too small for them never gets', async () => {
    const params = bin({
      width: 0.5,
      depth: 0.5,
      height: 3,
      gridUnitMm: 20,
      base: { ...P.base, style: 'lid' },
    });
    const measured = await exportedVolume(params);
    const estimated = estimatePrint(params).volumeMm3;
    expect(Math.abs(estimated - measured) / measured).toBeLessThan(0.01);
  }, 60000);

  it('rises with the wall by what the exported solid gains', async () => {
    const at = (wallThickness: number): BinParams =>
      bin({ width: 2, depth: 1, height: 6, wallThickness });
    const measuredGain = (await exportedVolume(at(2))) - (await exportedVolume(at(1.2)));
    const estimatedGain = estimatePrint(at(2)).volumeMm3 - estimatePrint(at(1.2)).volumeMm3;
    expect(measuredGain).toBeGreaterThan(0);
    expect(Math.abs(estimatedGain - measuredGain) / measuredGain).toBeLessThan(0.05);
  }, 60000);
});
