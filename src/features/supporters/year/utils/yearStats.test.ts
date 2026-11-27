import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { STAGING_ID } from '@/core/constants';
import { binId, designId, gridUnits, heightUnits, layerId, mm } from '@/core/types';
import {
  DEFAULT_PRINT_SETTINGS,
  OVERHEAD_MINUTES,
  estimateStandardBinFilament,
} from '@/shared/printSettings';
import type { BinParams } from '@/shared/types/bin';
import { estimateCommunityPrint } from '@/shared/utils/communityPrintCost';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import type { YearDesignSource, YearLayoutSource } from '../types';
import { computeYearStats, hasYearActivity } from './yearStats';

const local = (year: number, month: number, day: number): number =>
  new Date(year, month, day, 12).getTime();
const iso = (year: number, month: number, day: number): string =>
  new Date(local(year, month, day)).toISOString();

const twelveCompartments: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  compartments: {
    ...DEFAULT_BIN_PARAMS.compartments,
    rows: 3,
    cols: 4,
    cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
};
const oldParams: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 6 };

const workbench: YearLayoutSource = {
  id: 'workbench',
  name: 'Workbench',
  createdAt: local(2026, 2, 10),
  modifiedAt: local(2026, 2, 20),
  layout: createTestLayout({
    bins: [
      createTestBin({ id: binId('a'), x: gridUnits(0) }),
      createTestBin({ id: binId('b'), x: gridUnits(1) }),
      createTestBin({ id: binId('c'), x: gridUnits(2), linkedDesignId: designId('old') }),
      createTestBin({ id: binId('d'), x: gridUnits(3), width: gridUnits(2) }),
      createTestBin({ id: binId('e'), x: gridUnits(5), depth: gridUnits(2) }),
      createTestBin({
        id: binId('stash'),
        layerId: STAGING_ID,
        width: gridUnits(4),
        depth: gridUnits(4),
      }),
    ],
  }),
};

const garage: YearLayoutSource = {
  id: 'garage',
  name: 'Garage',
  createdAt: local(2026, 5, 4),
  modifiedAt: local(2026, 6, 4),
  layout: createTestLayout({
    drawer: {
      width: gridUnits(14),
      depth: gridUnits(10),
      height: heightUnits(12),
      measuredMm: { width: 600, depth: 450 },
    },
    layers: [
      { id: layerId('layer1'), name: 'Bottom', height: heightUnits(3) },
      { id: layerId('layer2'), name: 'Middle', height: heightUnits(3) },
      { id: layerId('layer3'), name: 'Top', height: heightUnits(3) },
    ],
    bins: [
      createTestBin({
        id: binId('half'),
        x: gridUnits(0.5),
        width: gridUnits(0.5),
        height: heightUnits(6),
      }),
    ],
  }),
};

const openedNotStarted: YearLayoutSource = {
  id: 'old-drawer',
  name: 'Old drawer',
  createdAt: local(2025, 4, 1),
  modifiedAt: local(2026, 8, 1),
  layout: createTestLayout({ bins: [createTestBin()] }),
};

const design = (overrides: Partial<YearDesignSource>): YearDesignSource => ({
  id: 'design',
  name: 'Design',
  createdAt: iso(2026, 2, 15),
  updatedAt: iso(2026, 2, 15),
  params: DEFAULT_BIN_PARAMS,
  thumbnail: null,
  remixed: false,
  untouched: false,
  versionDates: [],
  ...overrides,
});

const caddy = design({
  id: 'caddy',
  name: 'Tool caddy',
  params: twelveCompartments,
  thumbnail: 'data:image/webp;base64,caddy',
});
const oldDesign = design({
  id: 'old',
  name: 'Old design',
  createdAt: iso(2025, 1, 1),
  updatedAt: iso(2026, 9, 2),
  params: oldParams,
});
const rack = design({
  id: 'rack',
  name: 'Screwdriver rack',
  createdAt: iso(2026, 7, 1),
  params: undefined,
  remixed: true,
});
const untitled = design({ id: 'untitled', name: 'Untitled Bin', untouched: true });

function stats() {
  return computeYearStats({
    year: 2026,
    layouts: [workbench, garage, openedNotStarted],
    designs: [caddy, oldDesign, rack, untitled],
    exportCount: 31,
    printSettings: DEFAULT_PRINT_SETTINGS,
  });
}

describe('computeYearStats', () => {
  it('counts drawers started in the year, and leaves out the stash and drawers only opened', () => {
    const result = stats();
    expect(result.drawers).toBe(2);
    expect(result.binsPlaced).toBe(6);
  });

  it('measures drawers in mm, preferring the measured size', () => {
    const result = stats();
    expect(result.drawerAreaMm2).toBe(10 * 42 * 8 * 42 + 600 * 450);
    expect(result.biggestDrawer).toEqual({
      layoutId: 'garage',
      name: 'Garage',
      widthMm: 600,
      depthMm: 450,
    });
  });

  it('treats a turned footprint as the same size', () => {
    expect(stats().favouriteSize).toEqual({ width: 1, depth: 1, count: 3 });
  });

  it('counts designs of every kind made in the year, but not an untouched default or a rewritten old one', () => {
    expect(stats().designs).toBe(2);
  });

  it('counts an older design once a version is saved in the year', () => {
    const result = computeYearStats({
      year: 2026,
      layouts: [],
      designs: [design({ createdAt: iso(2025, 3, 1), versionDates: [iso(2026, 4, 1)] })],
      exportCount: 0,
      printSettings: DEFAULT_PRINT_SETTINGS,
    });
    expect(result.designs).toBe(1);
  });

  it('finds the month with the most drawers started and designs made', () => {
    expect(stats().busiestMonth).toEqual({ month: 2, count: 2 });
  });

  it('estimates a linked bin from its design, even one from an earlier year', () => {
    const result = stats();
    const standard = (width: number, depth: number, height: number) =>
      estimateStandardBinFilament(
        width,
        depth,
        height,
        DEFAULT_PRINT_SETTINGS,
        mm(42),
        mm(7),
        mm(42),
        false
      );
    const plainBins = [
      standard(1, 1, 3),
      standard(1, 1, 3),
      standard(2, 1, 3),
      standard(1, 2, 3),
      standard(0.5, 1, 6),
    ];
    const linked = estimateCommunityPrint(oldParams, DEFAULT_PRINT_SETTINGS);
    const unplaced = estimateCommunityPrint(twelveCompartments, DEFAULT_PRINT_SETTINGS);
    const grams =
      plainBins.reduce((sum, e) => sum + e.gramsFilament, 0) + linked.grams + unplaced.grams;
    const minutes = [...plainBins.map((e) => e.printTimeMinutes), linked.minutes, unplaced.minutes];
    const jobs = 3;
    expect(result.filament?.grams).toBe(Math.round(grams));
    expect(result.filament?.printMinutes).toBe(
      Math.round(
        minutes.reduce((sum, m) => sum + m - OVERHEAD_MINUTES, 0) + OVERHEAD_MINUTES * jobs
      )
    );
  });

  it('names the longest print and ranks only bin designs for the mesh shortlist', () => {
    const result = stats();
    expect(result.longestPrint).toMatchObject({ id: 'caddy', name: 'Tool caddy' });
    expect(result.complexityShortlist.map((entry) => entry.id)).toEqual(['caddy']);
  });

  it('passes the export count through', () => {
    expect(stats().exports).toBe(31);
  });

  it('picks the strongest type: 1×1 bins with a half bin outrank 12 compartments, just over 9', () => {
    expect(stats().type).toEqual({ id: 'smallParts', values: { count: 3 } });
  });

  it('leaves out an empty drawer, such as the default layout of a first visit', () => {
    const empty: YearLayoutSource = {
      id: 'default',
      name: 'My first layout',
      createdAt: local(2026, 10, 1),
      modifiedAt: local(2026, 10, 1),
      layout: createTestLayout({ bins: [createTestBin({ layerId: STAGING_ID })] }),
    };
    const result = computeYearStats({
      year: 2026,
      layouts: [empty],
      designs: [untitled],
      exportCount: 0,
      printSettings: DEFAULT_PRINT_SETTINGS,
    });
    expect(result.drawers).toBe(0);
    expect(hasYearActivity(result)).toBe(false);
  });

  it('reports no activity for a library with only earlier work', () => {
    const result = computeYearStats({
      year: 2026,
      layouts: [openedNotStarted],
      designs: [oldDesign],
      exportCount: 0,
      printSettings: DEFAULT_PRINT_SETTINGS,
    });
    expect(hasYearActivity(result)).toBe(false);
    expect(result.filament).toBeNull();
    expect(result.busiestMonth).toBeNull();
    expect(result.type.id).toBe('standardIssue');
  });
});
