import { gridUnits, heightUnits } from '@gridfinity/branded-types';
import type { LayoutPreview, ThumbnailBin } from '@/core/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { YEAR_REVIEW_YEAR } from '@/shared/yearReview/window';
import type { YearBinRef, YearStats } from '../types';

/** One baked design, as `scripts/gen-your-2026-sample.ts` writes it. */
export interface SampleDesign {
  readonly id: string;
  readonly nameKey: string;
  readonly minutes: number;
  readonly score: number;
  readonly triangles: number;
}

export interface SampleSource {
  /** The design the bake checked is the longest print. */
  readonly longestPrint: string;
  readonly designs: readonly SampleDesign[];
}

export interface SampleNames {
  readonly design: (nameKey: string) => string;
  readonly drawer: string;
  readonly thumbnail: (id: string) => string | null;
}

export interface SampleYear {
  readonly stats: YearStats;
  readonly drawerPreview: LayoutPreview;
}

export const SAMPLE_DRAWER_ID = 'sample-drawer';

const GRID_MM = 42;
const DRAWER_WIDTH = 23;
const DRAWER_DEPTH = 19;

/**
 * The biggest drawer as rows of bins, front to back: each row's widths fill
 * the drawer, except the last bins of one row, which leave a single gap.
 */
const DRAWER_ROWS: readonly { readonly depth: number; readonly widths: readonly number[] }[] = [
  { depth: 2, widths: [3, 2, 4, 2, 3, 2, 4, 3] },
  { depth: 1, widths: [1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 2, 3] },
  { depth: 3, widths: [4, 3, 2, 6, 3, 2, 3] },
  { depth: 1, widths: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3] },
  { depth: 2, widths: [3, 2, 6, 3, 2, 4, 3] },
  { depth: 1, widths: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4] },
  { depth: 3, widths: [3, 2, 4, 2, 5, 3, 4] },
  { depth: 2, widths: [2, 3, 2, 4, 2, 3, 2, 3, 2] },
  { depth: 2, widths: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 2, 2] },
  { depth: 1, widths: [1, 1, 1, 1, 1, 1, 1, 1, 5, 5, 5] },
  { depth: 1, widths: [2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 3, 3, 3] },
];

/** The biggest drawer's bins as [x, y, width, depth]. */
const DRAWER_BINS: readonly (readonly [number, number, number, number])[] = (() => {
  const bins: [number, number, number, number][] = [];
  let y = 0;
  for (const row of DRAWER_ROWS) {
    let x = 0;
    for (const width of row.widths) {
      bins.push([x, y, width, row.depth]);
      x += width;
    }
    y += row.depth;
  }
  return bins;
})();

export function sampleDrawerPreview(): LayoutPreview {
  const binMap: ThumbnailBin[] = DRAWER_BINS.map(([x, y, w, d]) => ({
    x: gridUnits(x),
    y: gridUnits(y),
    w: gridUnits(w),
    d: gridUnits(d),
    c: '#f59e0b',
  }));
  return {
    drawerWidth: gridUnits(DRAWER_WIDTH),
    drawerDepth: gridUnits(DRAWER_DEPTH),
    drawerHeight: heightUnits(6),
    binCount: binMap.length,
    layerCount: 1,
    binMap,
  };
}

/**
 * A believable maker's year for `?demo`: every card shows, October is the
 * busy month, and the longest print earns a type other than Standard Issue.
 */
export function sampleYear(source: SampleSource, names: SampleNames): SampleYear {
  // The sample never generates, so the params only satisfy the type.
  const ref = (design: SampleDesign): YearBinRef => ({
    id: design.id,
    name: names.design(design.nameKey),
    thumbnail: names.thumbnail(design.id),
    params: DEFAULT_BIN_PARAMS,
  });
  const longest = source.designs.find((design) => design.id === source.longestPrint);
  if (!longest) throw new Error(`Sample has no design "${source.longestPrint}"`);
  const longestPrint = { ...ref(longest), minutes: longest.minutes };
  const complexityShortlist = source.designs
    .filter((design) => design !== longest)
    .sort((a, b) => b.score - a.score)
    .map((design) => ({ ...ref(design), score: design.score }));

  return {
    stats: {
      year: YEAR_REVIEW_YEAR,
      drawers: 6,
      binsPlaced: 148,
      drawerAreaMm2: 1_402_000,
      biggestDrawer: {
        layoutId: SAMPLE_DRAWER_ID,
        name: names.drawer,
        widthMm: DRAWER_WIDTH * GRID_MM,
        depthMm: DRAWER_DEPTH * GRID_MM,
      },
      favouriteSize: { width: 1, depth: 1, count: 57 },
      designs: 34,
      busiestMonth: { month: 9, count: 19 },
      monthCounts: [2, 1, 4, 3, 2, 5, 3, 4, 7, 19, 9, 4],
      filament: { grams: 10_240, printMinutes: 26_400 },
      longestPrint,
      complexityShortlist,
      exports: 64,
      type: { id: 'nightShift', values: { name: longestPrint.name, minutes: longest.minutes } },
    },
    drawerPreview: sampleDrawerPreview(),
  };
}

/** Triangle counts the bake measured on the full generated meshes. */
export function sampleTriangles(source: SampleSource): ReadonlyMap<string, number> {
  return new Map(source.designs.map((design) => [design.id, design.triangles]));
}
