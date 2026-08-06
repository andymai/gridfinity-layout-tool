import type {
  GridUnits,
  HeightUnits,
  BinId,
  CategoryId,
  DesignId,
} from '@gridfinity/branded-types';

export interface PrintPiece {
  width: GridUnits;
  depth: GridUnits;
  count: number;
}

export interface PrintRow {
  size: string; // "3×2"
  height: HeightUnits;
  binCount: number;
  pieces: PrintPiece[];
  totalPieces: number;
  needsSplit: boolean;
  filament: number; // Estimated filament in meters
  categoryIds: CategoryId[]; // Category IDs for bins of this size (for color display)
  labels: string[]; // Non-empty labels from bins of this size
  notes: string; // Notes (only for labeled/individual bins)
  binIds: BinId[]; // Original bin IDs for click-to-select
  customProperties?: Record<string, string>; // Custom properties (only for individual bins)
  linkedDesignId?: DesignId; // Shared by all bins in the row (part of the group key)
}
export interface PrintListConfig {
  filamentCostPerKg: number; // $/kg - user configurable (default 20)
  metersPerKg: number; // Meters per 1kg spool (~330m for 1.75mm PLA)
}

export interface EnhancedPrintRow extends PrintRow {
  area: number; // width * depth (for sorting)
  costEstimate: number; // $ based on filament usage
  spoolPercentage: number; // % of 1kg spool
  labelPlateCount?: number; // Swappable label plates this row needs (socket-mode designs)
  /** The linked design has label tabs on with no text on any of them, so every
   *  tab in this row prints blank. Absent when there is text, or no tabs. */
  labelTabsWithoutText?: boolean;
}

export interface PrintListGroup {
  categoryId: CategoryId;
  categoryName: string;
  categoryColor: string;
  rows: EnhancedPrintRow[];
  totalFilament: number;
  totalCost: number;
  totalBins: number;
}

export type PrintListSortKey = 'default' | 'area' | 'height' | 'filament';
export type PrintListSortOrder = 'asc' | 'desc';

export interface PrintListFilters {
  hiddenCategoryIds: Set<CategoryId>;
  sortKey: PrintListSortKey;
  sortOrder: PrintListSortOrder;
  groupByCategory: boolean;
}
