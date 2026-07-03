import { describe, it, expect } from 'vitest';
import { designId } from '@/core/types';
import type { Bin } from '@/core/types';
import { createTestBin } from '@/test/testUtils';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { SavedDesign, BinParams } from '@/features/bin-designer';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';
import { planLayoutBinExport } from './planLayoutBinExport';
import type { LoadedDesign } from './planLayoutBinExport';

function design(id: string, name: string, params: Partial<BinParams> = {}): SavedDesign {
  return {
    id: designId(id),
    name,
    params: { ...DEFAULT_BIN_PARAMS, ...params },
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    exportFileNameConfig: null,
  };
}

function linkedBin(idStr: string, overrides: Partial<Bin> = {}): Bin {
  return createTestBin({ linkedDesignId: designId(idStr), ...overrides });
}

const CONFIG = { style: 'descriptive', customName: '', format: 'stl' } as const;

describe('planLayoutBinExport', () => {
  it('dedupes by design and counts quantity per design', () => {
    const bins = [
      linkedBin('d1', { id: createTestBin({}).id }),
      { ...linkedBin('d1'), id: createTestBin({ x: 1 }).id, x: 1 },
      { ...linkedBin('d2'), id: createTestBin({ x: 2 }).id, x: 2 },
    ] as Bin[];
    const loaded: LoadedDesign[] = [
      { id: designId('d1'), design: design('d1', 'Box', { width: 1, depth: 1, height: 6 }) },
      { id: designId('d2'), design: design('d2', 'Tray', { width: 2, depth: 2, height: 3 }) },
    ];

    const plan = planLayoutBinExport(bins, loaded, 'stl', CONFIG, DEFAULT_PRINT_SETTINGS);

    expect(plan.exportable).toHaveLength(2);
    expect(plan.manifestBins.find((b) => b.designName === 'Box')?.quantity).toBe(2);
    expect(plan.manifestBins.find((b) => b.designName === 'Tray')?.quantity).toBe(1);
  });

  it('buckets unlinked, non-bin, and missing designs as skipped', () => {
    const bins = [
      linkedBin('d1'),
      createTestBin({ id: createTestBin({ x: 9 }).id, x: 9 }), // unlinked
    ] as Bin[];
    const loaded: LoadedDesign[] = [
      { id: designId('d1'), design: design('d1', 'Box') },
      { id: designId('d2'), design: { ...design('d2', 'Rack'), params: undefined } }, // non-bin
      { id: designId('d3'), design: null }, // missing
    ];

    const plan = planLayoutBinExport(bins, loaded, 'stl', CONFIG, DEFAULT_PRINT_SETTINGS);

    expect(plan.skipped.unlinkedBins).toBe(1);
    expect(plan.skipped.nonBinDesigns).toBe(1);
    expect(plan.skipped.missingDesigns).toBe(1);
    expect(plan.exportable).toHaveLength(1);
  });

  it('dedupes colliding file names so no bin overwrites another', () => {
    const bins = [linkedBin('d1'), { ...linkedBin('d2'), x: 1 }] as Bin[];
    // Two distinct designs, identical dims + name → same generated name.
    const loaded: LoadedDesign[] = [
      { id: designId('d1'), design: design('d1', 'Box', { width: 1, depth: 1, height: 6 }) },
      { id: designId('d2'), design: design('d2', 'Box', { width: 1, depth: 1, height: 6 }) },
    ];

    const plan = planLayoutBinExport(bins, loaded, 'stl', CONFIG, DEFAULT_PRINT_SETTINGS);
    const paths = plan.exportable.map((e) => e.path);
    expect(new Set(paths).size).toBe(2);
  });

  it('flags designs with removable dividers as companions', () => {
    const bins = [linkedBin('d1')] as Bin[];
    const loaded: LoadedDesign[] = [
      { id: designId('d1'), design: design('d1', 'Slotted', { style: 'slotted' }) },
    ];
    const plan = planLayoutBinExport(bins, loaded, 'stl', CONFIG, DEFAULT_PRINT_SETTINGS);
    expect(plan.exportable[0].companions).toContain('dividers');
    expect(plan.manifestBins[0].companions).toContain('dividers');
  });

  it('marks plain designs as having no companions', () => {
    const bins = [linkedBin('d1')] as Bin[];
    const loaded: LoadedDesign[] = [{ id: designId('d1'), design: design('d1', 'Box') }];
    const plan = planLayoutBinExport(bins, loaded, 'stl', CONFIG, DEFAULT_PRINT_SETTINGS);
    expect(plan.exportable[0].companions).toEqual([]);
  });

  it('sums totals as per-bin estimate × quantity', () => {
    const bins = [linkedBin('d1'), { ...linkedBin('d1'), x: 1 }] as Bin[];
    const loaded: LoadedDesign[] = [
      { id: designId('d1'), design: design('d1', 'Box', { width: 1, depth: 1, height: 6 }) },
    ];
    const plan = planLayoutBinExport(bins, loaded, 'stl', CONFIG, DEFAULT_PRINT_SETTINGS);
    const per = plan.manifestBins[0];
    expect(plan.totals.filamentGrams).toBeCloseTo(per.filamentGrams * 2, 5);
  });
});
