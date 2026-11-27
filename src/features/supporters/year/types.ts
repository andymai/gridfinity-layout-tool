import type { Layout } from '@/core/types';
import type { PrintSettings } from '@/shared/printSettings';

export interface YearLayoutSource {
  readonly id: string;
  readonly name: string;
  /** Unix ms. A layout pulled by sync carries its modifiedAt here. */
  readonly createdAt: number;
  readonly modifiedAt: number;
  readonly layout: Layout;
}

export interface YearDesignSource {
  readonly id: string;
  readonly name: string;
  /** ISO timestamps, as the design store keeps them. */
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Bin params as stored; absent for tool racks, imported meshes and assemblies. */
  readonly params?: unknown;
  readonly thumbnail: string | null;
  /** True when the design came from a community remix by another author. */
  readonly remixed: boolean;
  /** True while the params still equal the defaults a first designer visit saves. */
  readonly untouched: boolean;
  /** ISO capture times of the design's saved versions. */
  readonly versionDates: readonly string[];
}

export interface YearReviewInput {
  readonly year: number;
  readonly layouts: readonly YearLayoutSource[];
  readonly designs: readonly YearDesignSource[];
  readonly exportCount: number;
  readonly printSettings: PrintSettings;
}

export interface YearDesignRef {
  readonly id: string;
  readonly name: string;
  readonly thumbnail: string | null;
}

export interface YearDrawer {
  readonly layoutId: string;
  readonly name: string;
  readonly widthMm: number;
  readonly depthMm: number;
}

export interface YearPrintedDesign extends YearDesignRef {
  readonly minutes: number;
}

export interface YearShortlistEntry extends YearDesignRef {
  readonly score: number;
}

export const YEAR_TYPE_IDS = [
  'compartmentalist',
  'nightShift',
  'spoolEater',
  'gapFiller',
  'customShop',
  'architect',
  'smallParts',
  'labelMaker',
  'minimalist',
  'heavyDuty',
  'remixer',
  'measureTwice',
  'standardIssue',
] as const;

export type YearTypeId = (typeof YEAR_TYPE_IDS)[number];

export interface YearType {
  readonly id: YearTypeId;
  /** Interpolation values for the type's reason line. */
  readonly values: Readonly<Record<string, string | number>>;
}

export interface YearStats {
  readonly year: number;
  readonly drawers: number;
  readonly binsPlaced: number;
  readonly drawerAreaMm2: number;
  readonly biggestDrawer: YearDrawer | null;
  readonly favouriteSize: {
    readonly width: number;
    readonly depth: number;
    readonly count: number;
  } | null;
  readonly designs: number;
  /** Month index 0-11 in local time, with the number of items touched that month. */
  readonly busiestMonth: { readonly month: number; readonly count: number } | null;
  /** Items touched in each local month, January first. */
  readonly monthCounts: readonly number[];
  readonly filament: { readonly grams: number; readonly printMinutes: number } | null;
  readonly longestPrint: YearPrintedDesign | null;
  /** Bin designs by feature score, highest first, for the triangle-count shortlist. */
  readonly complexityShortlist: readonly YearShortlistEntry[];
  readonly exports: number;
  readonly type: YearType;
}
