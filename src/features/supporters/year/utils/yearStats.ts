import type { Bin, Layout } from '@/core/types';
import { isFractional } from '@/core/constants';
import { effectiveGridUnitMmY } from '@/core/types';
import {
  OVERHEAD_MINUTES,
  estimateStandardBinFilament,
  type PrintSettings,
  type StandardBinEstimate,
} from '@/shared/printSettings';
import type { BinParams } from '@/shared/types/bin';
import { getGridBins } from '@/shared/utils/bins';
import { estimateCommunityPrint } from '@/shared/utils/communityPrintCost';
import { outlineSignedArea } from '@/shared/utils/drawerOutlineGeometry';
import type {
  YearDesignRef,
  YearDesignSource,
  YearDrawer,
  YearLayoutSource,
  YearPrintedDesign,
  YearReviewInput,
  YearShortlistEntry,
  YearStats,
} from '../types';
import { compartmentCount, featureScore, hasLabelText, isBinParams } from './designFeatures';
import {
  designCountsForYear,
  inYear,
  layoutCountsForYear,
  yearBounds,
  type YearBounds,
} from '@/shared/yearReview/yearWork';
import { dayKey, monthOf } from './yearDates';
import { pickYearType } from './yearType';

interface BinDesign {
  readonly source: YearDesignSource;
  readonly minutes: number;
  readonly grams: number;
  readonly score: number;
  readonly compartments: number;
  readonly labelled: boolean;
}

/**
 * Every number the year needs from one design, or null for a design that is
 * not a bin. Migration keeps malformed nested values, so a design that throws
 * drops out on its own instead of ending the whole year.
 */
function readBinDesign(source: YearDesignSource, settings: PrintSettings): BinDesign | null {
  if (!isBinParams(source.params)) return null;
  const params: BinParams = source.params;
  try {
    const estimate = estimateCommunityPrint(params, settings);
    return {
      source,
      minutes: estimate.minutes,
      grams: estimate.grams,
      score: featureScore(params, settings.nozzleSizeMm),
      compartments: compartmentCount(params),
      labelled: hasLabelText(params, settings.nozzleSizeMm),
    };
  } catch {
    return null;
  }
}

function isLength(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

/** Imported, shared and synced layouts skip the editor's checks on the measured size. */
function drawerMm(layout: Layout): { widthMm: number; depthMm: number } {
  const measured = layout.drawer.measuredMm;
  if (measured && isLength(measured.width) && isLength(measured.depth)) {
    return { widthMm: measured.width, depthMm: measured.depth };
  }
  return {
    widthMm: layout.drawer.width * layout.gridUnitMm,
    depthMm: layout.drawer.depth * effectiveGridUnitMmY(layout),
  };
}

function footprintKey(bin: Pick<Bin, 'width' | 'depth'>): string {
  const long = Math.max(bin.width, bin.depth);
  const short = Math.min(bin.width, bin.depth);
  return `${long}x${short}`;
}

/** Grid cells the drawer can hold: a shaped outline holds less than its bounding box. */
function drawerCells(layout: Layout): number {
  const box = layout.drawer.width * layout.drawer.depth;
  const outline = layout.drawer.outline;
  if (!outline) return box;
  const cellMm2 = layout.gridUnitMm * effectiveGridUnitMmY(layout);
  const cells = Math.abs(outlineSignedArea(outline)) / cellMm2;
  return cells > 0 ? Math.min(box, cells) : box;
}

function bottomLayerFill(layout: Layout, bins: readonly Bin[]): number | null {
  const bottom = layout.layers.at(0);
  const capacity = drawerCells(layout);
  if (!bottom || capacity <= 0) return null;
  const covered = bins
    .filter((bin) => bin.layerId === bottom.id)
    .reduce((sum, bin) => sum + bin.width * bin.depth, 0);
  return Math.min(1, covered / capacity);
}

function ref(source: YearDesignSource): YearDesignRef {
  return { id: source.id, name: source.name, thumbnail: source.thumbnail };
}

function busiestMonth(
  layouts: readonly YearLayoutSource[],
  designs: readonly YearDesignSource[],
  bounds: YearBounds
): YearStats['busiestMonth'] {
  const months = new Map<number, Set<string>>();
  const touch = (key: string, date: number | string): void => {
    if (!inYear(date, bounds)) return;
    const month = monthOf(date);
    const items = months.get(month) ?? new Set<string>();
    items.add(key);
    months.set(month, items);
  };
  for (const source of layouts) touch(`layout:${source.id}`, source.createdAt);
  for (const design of designs) {
    for (const date of [design.createdAt, ...design.versionDates]) {
      touch(`design:${design.id}`, date);
    }
  }
  let best: { month: number; count: number } | null = null;
  for (const [month, items] of [...months].sort(([a], [b]) => a - b)) {
    if (!best || items.size > best.count) best = { month, count: items.size };
  }
  return best && best.count >= 2 ? best : null;
}

/**
 * Totals of extrusion time plus one bed heat per print job: adding every
 * bin's own estimate would charge the fixed overhead once per bin.
 */
function printMinutes(estimates: readonly number[], jobs: number): number {
  const extrusion = estimates.reduce(
    (sum, minutes) => sum + Math.max(0, minutes - OVERHEAD_MINUTES),
    0
  );
  return Math.round(extrusion + OVERHEAD_MINUTES * jobs);
}

function estimateLayoutBin(layout: Layout, bin: Bin, settings: PrintSettings): StandardBinEstimate {
  return estimateStandardBinFilament(
    bin.width,
    bin.depth,
    bin.height,
    settings,
    layout.gridUnitMm,
    layout.heightUnitMm,
    effectiveGridUnitMmY(layout),
    layout.lowProfileBase === true
  );
}

export function computeYearStats(input: YearReviewInput): YearStats {
  const bounds = yearBounds(input.year);
  const settings = input.printSettings;

  const layouts = input.layouts.filter((source) =>
    layoutCountsForYear(
      { createdAt: source.createdAt, gridBinCount: getGridBins(source.layout.bins).length },
      bounds
    )
  );
  const designs = input.designs.filter((design) => designCountsForYear(design, bounds));
  const estimated = new Map<string, BinDesign | null>();
  const binDesignOf = (source: YearDesignSource): BinDesign | null => {
    const cached = estimated.get(source.id);
    if (cached !== undefined) return cached;
    const design = readBinDesign(source, settings);
    estimated.set(source.id, design);
    return design;
  };
  const sourceById = new Map(input.designs.map((source) => [source.id, source]));
  const binDesigns = designs.map(binDesignOf).filter((design) => design !== null);

  let binsPlaced = 0;
  let drawerAreaMm2 = 0;
  let biggestDrawer: YearDrawer | null = null;
  let maxLayers = 0;
  let heightSum = 0;
  let halfBins = false;
  const fills: number[] = [];
  const footprints = new Map<string, { width: number; depth: number; count: number }>();
  const binMinutes: number[] = [];
  let grams = 0;
  let jobs = 0;
  const placedDesignIds = new Set<string>();

  for (const source of layouts) {
    const { layout } = source;
    const bins = getGridBins(layout.bins);
    const size = drawerMm(layout);
    const area = size.widthMm * size.depthMm;
    drawerAreaMm2 += area;
    if (!biggestDrawer || area > biggestDrawer.widthMm * biggestDrawer.depthMm) {
      biggestDrawer = { layoutId: source.id, name: source.name, ...size };
    }
    maxLayers = Math.max(maxLayers, layout.layers.length);
    binsPlaced += bins.length;
    halfBins ||= bins.some((bin) => isFractional(bin.width) || isFractional(bin.depth));
    const fill = bottomLayerFill(layout, bins);
    if (fill !== null) fills.push(fill);
    if (bins.length > 0) jobs += 1;

    for (const bin of bins) {
      heightSum += bin.height;
      const key = footprintKey(bin);
      const entry = footprints.get(key) ?? {
        width: Math.max(bin.width, bin.depth),
        depth: Math.min(bin.width, bin.depth),
        count: 0,
      };
      footprints.set(key, { ...entry, count: entry.count + 1 });

      const linkedSource = bin.linkedDesignId ? sourceById.get(bin.linkedDesignId) : undefined;
      const linked = linkedSource ? binDesignOf(linkedSource) : null;
      if (linked) {
        placedDesignIds.add(linked.source.id);
        binMinutes.push(linked.minutes);
        grams += linked.grams;
      } else {
        const estimate = estimateLayoutBin(layout, bin, settings);
        binMinutes.push(estimate.printTimeMinutes);
        grams += estimate.gramsFilament;
      }
    }
  }

  for (const design of binDesigns) {
    if (placedDesignIds.has(design.source.id)) continue;
    binMinutes.push(design.minutes);
    grams += design.grams;
    jobs += 1;
  }

  let favouriteSize: YearStats['favouriteSize'] = null;
  for (const entry of footprints.values()) {
    if (!favouriteSize || entry.count > favouriteSize.count) favouriteSize = entry;
  }
  if (favouriteSize && favouriteSize.count < 2) favouriteSize = null;

  let longestPrint: YearPrintedDesign | null = null;
  for (const design of binDesigns) {
    if (!longestPrint || design.minutes > longestPrint.minutes) {
      longestPrint = { ...ref(design.source), minutes: design.minutes };
    }
  }

  const complexityShortlist: YearShortlistEntry[] = binDesigns
    .map((design) => ({ ...ref(design.source), score: design.score }))
    .sort((a, b) => b.score - a.score);

  let maxCompartments: { count: number; name: string } | null = null;
  for (const design of binDesigns) {
    const count = design.compartments;
    if (!maxCompartments || count > maxCompartments.count) {
      maxCompartments = { count, name: design.source.name };
    }
  }

  let mostVersionedDesign: { days: number; name: string } | null = null;
  for (const design of designs) {
    const days = new Set(design.versionDates.filter((date) => inYear(date, bounds)).map(dayKey))
      .size;
    if (days > 0 && (!mostVersionedDesign || days > mostVersionedDesign.days)) {
      mostVersionedDesign = { days, name: design.name };
    }
  }

  const filament =
    binMinutes.length > 0
      ? { grams: Math.round(grams), printMinutes: printMinutes(binMinutes, jobs) }
      : null;

  const type = pickYearType({
    drawers: layouts.length,
    binsPlaced,
    designs: designs.length,
    binDesigns: binDesigns.length,
    maxCompartments,
    longestPrint,
    filamentGrams: filament?.grams ?? 0,
    fillRatio: fills.length > 0 ? fills.reduce((a, b) => a + b, 0) / fills.length : null,
    biggestDrawerAreaMm2: biggestDrawer ? biggestDrawer.widthMm * biggestDrawer.depthMm : 0,
    maxLayers,
    favouriteSize,
    halfBins,
    labelledDesigns: binDesigns.filter((design) => design.labelled).length,
    averageBinHeight: binsPlaced > 0 ? heightSum / binsPlaced : null,
    remixes: designs.filter((design) => design.remixed).length,
    mostVersionedDesign,
  });

  return {
    year: input.year,
    drawers: layouts.length,
    binsPlaced,
    drawerAreaMm2,
    biggestDrawer,
    favouriteSize,
    designs: designs.length,
    busiestMonth: busiestMonth(layouts, designs, bounds),
    filament,
    longestPrint,
    complexityShortlist,
    exports: input.exportCount,
    type,
  };
}

export function hasYearActivity(stats: Pick<YearStats, 'drawers' | 'designs'>): boolean {
  return stats.drawers > 0 || stats.designs > 0;
}
