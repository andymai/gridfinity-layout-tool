import { describe, it, expect } from 'vitest';
import { designId } from '@/core/types';
import type { Bin } from '@/core/types';
import { createTestBin } from '@/test/testUtils';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { SavedDesign, BinParams } from '@/features/bin-designer';
import { LABEL_PLATE_HEIGHT_MM, labelPlateWidthMm } from '@/shared/constants/labelPlates';
import { planLabelPlateExport } from './planLabelPlateExport';
import type { LoadedDesign } from './planLayoutBinExport';

const BED = 256;

function socketDesign(id: string, name: string, params: Partial<BinParams> = {}): SavedDesign {
  return {
    id: designId(id),
    name,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 1,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'socket', depth: 14 },
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 2,
        rows: 1,
        cells: [0, 1],
        compartmentTexts: ['SCREWS', 'BOLTS'],
      },
      ...params,
    },
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    exportFileNameConfig: null,
  };
}

function linkedBin(idStr: string, overrides: Partial<Bin> = {}): Bin {
  return createTestBin({ linkedDesignId: designId(idStr), ...overrides });
}

describe('planLabelPlateExport', () => {
  it('ignores designs without socket-mode labels', () => {
    const loaded: LoadedDesign[] = [
      {
        id: designId('d1'),
        design: socketDesign('d1', 'Text tabs', {
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        }),
      },
    ];
    const plan = planLabelPlateExport([linkedBin('d1')], loaded, BED, BED);
    expect(plan.groups).toHaveLength(0);
    expect(plan.totalPlates).toBe(0);
  });

  it('multiplies per-compartment plates by placed-bin quantity and collapses manifest duplicates', () => {
    const loaded: LoadedDesign[] = [{ id: designId('d1'), design: socketDesign('d1', 'Hardware') }];
    const bins = [
      linkedBin('d1'),
      { ...linkedBin('d1'), id: createTestBin({ x: 3 }).id, x: 3 },
    ] as Bin[];

    const plan = planLabelPlateExport(bins, loaded, BED, BED);
    expect(plan.totalPlates).toBe(4);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].manifestPlates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'SCREWS', quantity: 2 }),
        expect.objectContaining({ text: 'BOLTS', quantity: 2 }),
      ])
    );
  });

  it('uses per-bin labels (falling back to the design name) for spanning sockets', () => {
    // 4 narrow columns → no per-compartment socket fits → spanning socket.
    const loaded: LoadedDesign[] = [
      {
        id: designId('d1'),
        design: socketDesign('d1', 'Spanner', {
          compartments: {
            ...DEFAULT_BIN_PARAMS.compartments,
            cols: 4,
            rows: 1,
            cells: [0, 1, 2, 3],
          },
        }),
      },
    ];
    const bins = [
      linkedBin('d1', { label: 'Nails' }),
      { ...linkedBin('d1', { label: '' }), id: createTestBin({ x: 3 }).id, x: 3 },
    ] as Bin[];

    const plan = planLabelPlateExport(bins, loaded, BED, BED);
    expect(plan.totalPlates).toBe(2);
    expect(plan.groups[0].manifestPlates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Nails', quantity: 1 }),
        expect.objectContaining({ text: 'Spanner', quantity: 1 }),
      ])
    );
  });

  it('packs plates within the usable bed and centers each sheet', () => {
    const loaded: LoadedDesign[] = [{ id: designId('d1'), design: socketDesign('d1', 'Hardware') }];
    const bins = Array.from({ length: 6 }, (_, i) => ({
      ...linkedBin('d1'),
      id: createTestBin({ x: i }).id,
      x: i,
    })) as Bin[];

    const plan = planLabelPlateExport(bins, loaded, BED, BED);
    const sheets = plan.groups[0].sheets;
    expect(sheets.length).toBeGreaterThan(0);
    const placed = sheets.flat();
    expect(placed).toHaveLength(12);
    for (const p of placed) {
      const halfW = labelPlateWidthMm(p.widthU) / 2;
      expect(Math.abs(p.position[0]) + halfW).toBeLessThanOrEqual(BED / 2);
      expect(Math.abs(p.position[1]) + LABEL_PLATE_HEIGHT_MM / 2).toBeLessThanOrEqual(BED / 2);
    }
  });

  it('splits onto multiple sheets when the bed is small', () => {
    const loaded: LoadedDesign[] = [{ id: designId('d1'), design: socketDesign('d1', 'Hardware') }];
    const bins = Array.from({ length: 10 }, (_, i) => ({
      ...linkedBin('d1'),
      id: createTestBin({ x: i }).id,
      x: i,
    })) as Bin[];

    // Tiny 60mm bed: one 1U plate per row, few rows per sheet.
    const plan = planLabelPlateExport(bins, loaded, 60, 60);
    expect(plan.groups[0].sheets.length).toBeGreaterThan(1);
    const placed = plan.groups[0].sheets.flat();
    expect(placed).toHaveLength(20);
  });

  it('skips plates wider than the usable bed and reports the count', () => {
    // Single-compartment 2U design → 2U plates (78mm). A 60mm bed has only
    // 40mm usable width, so nothing can ship — but the skip is surfaced.
    const loaded: LoadedDesign[] = [
      {
        id: designId('d1'),
        design: socketDesign('d1', 'Wide', {
          compartments: {
            ...DEFAULT_BIN_PARAMS.compartments,
            cols: 1,
            rows: 1,
            cells: [0],
            compartmentTexts: ['BIG'],
          },
        }),
      },
    ];
    const plan = planLabelPlateExport([linkedBin('d1')], loaded, 60, 60);
    expect(plan.totalPlates).toBe(0);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].sheets).toHaveLength(0);
    expect(plan.groups[0].oversizedCount).toBe(1);
  });
});
