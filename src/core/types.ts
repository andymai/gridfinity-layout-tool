import type { Mm, GridUnits, HeightUnits } from '@gridfinity/branded-types';
export type { Mm, GridUnits, HeightUnits } from '@gridfinity/branded-types';
export {
  mm,
  gridUnits,
  heightUnits,
  gridUnitsToMm,
  heightUnitsToMm,
  mmToGridUnits,
  mmToHeightUnits,
} from '@gridfinity/branded-types';

import type { BinId, LayerId, CategoryId, LayoutId, DesignId } from '@gridfinity/branded-types';
export type { BinId, LayerId, CategoryId, LayoutId, DesignId } from '@gridfinity/branded-types';
export { binId, layerId, categoryId, layoutId, designId } from '@gridfinity/branded-types';
export interface Layout {
  version: string; // "1.0"
  name: string; // max 64 chars
  drawer: Drawer;
  printBedSize: Mm; // print bed width in mm (e.g., 256 for Prusa MK3)
  printBedDepth?: Mm; // print bed depth in mm (undefined = same as printBedSize)
  gridUnitMm: Mm; // mm per grid unit (default 42)
  heightUnitMm: Mm; // mm per height unit (default 7)
  categories: Category[]; // 1-20 items
  layers: Layer[]; // 1-10 items, index 0 = bottom
  bins: Bin[];
  purpose?: string; // Optional drawer purpose (e.g., "workshop", "electronics")
  baseplateParams?: BaseplateParams; // Per-layout baseplate configuration
}

/** Baseplate generation parameters stored per-layout.
 * Width/depth/gridUnitMm are derived from the layout's drawer at generation time unless
 * syncWithLayout is false, in which case baseplateWidth/baseplateDepth override drawer dims.
 * Per-side padding in mm — user enters directly, total drawer = grid + padding. */
export interface BaseplateParams {
  readonly magnetHoles: boolean;
  readonly magnetDiameter: Mm;
  readonly magnetDepth: Mm;
  readonly paddingLeft: Mm;
  readonly paddingRight: Mm;
  readonly paddingFront: Mm;
  readonly paddingBack: Mm;
  /** Enable registration nubs/holes on split piece join edges (default false). */
  readonly connectorNubs?: boolean;
  /** Remove center floor material, keeping only magnet pads (default true). */
  readonly lightweight?: boolean;
  /** When true (or undefined), grid dims are derived from the drawer. */
  readonly syncWithLayout?: boolean;
  /** Custom grid width in units, only used when syncWithLayout is false. */
  readonly baseplateWidth?: GridUnits;
  /** Custom grid depth in units, only used when syncWithLayout is false. */
  readonly baseplateDepth?: GridUnits;
  /** Uniform outer corner radius in mm (default: Gridfinity spec 2.5mm). */
  readonly cornerRadius?: Mm;
  /** Per-corner radius overrides. When set, takes precedence over cornerRadius. */
  readonly cornerRadii?: {
    readonly tl: Mm;
    readonly tr: Mm;
    readonly bl: Mm;
    readonly br: Mm;
  };
}

/** Position of fractional edge when drawer has half-unit dimensions */
export type FractionalEdge = 'start' | 'end';

export interface Drawer {
  width: GridUnits; // 1-50
  depth: GridUnits; // 1-50
  height: HeightUnits; // >= sum of layer heights
  fractionalEdgeX?: FractionalEdge; // 'start' = left, 'end' = right (default)
  fractionalEdgeY?: FractionalEdge; // 'start' = bottom, 'end' = top (default)
}

export interface Category {
  id: CategoryId;
  name: string; // max 24 chars, unique (case-insensitive)
  color: string; // hex color
}

export interface Layer {
  id: LayerId;
  name: string; // max 24 chars
  height: HeightUnits; // >= 1
}

export interface Bin {
  id: BinId;
  layerId: LayerId; // base layer ID or STAGING_ID
  x: GridUnits; // 0-based, from left
  y: GridUnits; // 0-based, from bottom
  width: GridUnits; // >= 1
  depth: GridUnits; // >= 1
  height: HeightUnits; // >= base layer height, <= space to drawer top
  clearanceHeight?: HeightUnits; // additional blocked space above bin (for tall contents)
  category: CategoryId; // references Category.id
  label: string; // max 24 chars
  notes: string; // max 256 chars
  customProperties?: Record<string, string>; // custom key-value properties for user-defined metadata
  linkedDesignId?: DesignId; // reference to saved design in bin-designer (for one-to-many linking)
}
/** Grid coordinate (0-based, origin at bottom-left). */
export interface Coord {
  x: GridUnits;
  y: GridUnits;
}

/** Axis-aligned rectangle on the grid in grid units. */
export interface Rect {
  x: GridUnits;
  y: GridUnits;
  width: GridUnits;
  depth: GridUnits;
}

/** 3D bounding box extending a grid rect with a vertical range (in height units). */
export interface Rect3D extends Rect {
  zStart: HeightUnits;
  zEnd: HeightUnits;
}
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Handle placement mode for resize handles */
export type HandlePlacement = 'internal' | 'external';

/** Handle variant for styling (primary vs ghost) */
export type HandleVariant = 'primary' | 'ghost';

/** Position configuration for a single handle */
export interface HandlePositionConfig {
  left?: number | string;
  right?: number | string;
  top?: number | string;
  bottom?: number | string;
  width: number | string;
  height: number | string;
  minWidth?: number;
  minHeight?: number;
  cursor: string;
  transform?: string;
}

/** Visual indicator configuration */
export interface HandleVisualConfig {
  width: number | string;
  height: number | string;
  minWidth?: number;
  minHeight?: number;
}

/**
 * Information about a potential swap target during drag.
 * Set when dragging a bin over another bin with compatible size.
 */
export interface SwapTarget {
  /** ID of the target bin that would be swapped */
  binId: BinId;
  /** True if swap requires rotating the dragged bin (e.g., 2×3 onto 3×2) */
  requiresRotation: boolean;
  /** Mobile countdown state (only set on touch devices during long-press) */
  countdown?: {
    /** When countdown started (Date.now()) */
    startTime: number;
    /** Total countdown duration in ms (1000) */
    duration: number;
  };
}

export type Interaction =
  | { type: 'draw'; start: Coord; current: Coord }
  | {
      type: 'drag';
      binIds: BinId[];
      startCoord: Coord;
      currentCoord: Coord;
      valid: boolean;
      isOverGrid: boolean;
      clickOffset?: { x: number; y: number };
      duplicate?: boolean;
      /** True when user is holding Shift (desktop) or long-pressing (mobile) for swap mode */
      swapMode?: boolean;
      /** Target bin for swap if hovering over a compatible bin */
      swapTarget?: SwapTarget;
      /** True when position was auto-adjusted to nearest valid spot (shows amber tint) */
      isSnapped?: boolean;
      /** Why placement is invalid (for user feedback) */
      invalidReason?: ValidationReason;
      /** Details about what's blocking placement */
      blockingInfo?: BlockingInfo;
    }
  | {
      type: 'resize';
      binIds: BinId[];
      handle: ResizeHandle;
      startRects: Map<BinId, Rect>;
      currentRects: Map<BinId, Rect>;
      valid: boolean;
      /** True when size was auto-constrained to collision boundary (shows amber tint) */
      isSnapped?: boolean;
      /** Why resize is invalid (for user feedback) */
      invalidReason?: ValidationReason;
      /** Details about what's blocking the resize */
      blockingInfo?: BlockingInfo;
    }
  | {
      type: 'stagingDrag';
      binId: BinId;
      currentCoord: Coord | null;
      valid: boolean;
      /** True when position was auto-adjusted to nearest valid spot (shows amber tint) */
      isSnapped?: boolean;
      /** Why placement is invalid (for user feedback) */
      invalidReason?: ValidationReason;
      /** Details about what's blocking placement */
      blockingInfo?: BlockingInfo;
    }
  | { type: 'paint'; paintSize: { width: number; depth: number }; start: Coord; current: Coord };
/** Reasons why bin placement may fail */
export type ValidationReason =
  | 'out_of_bounds'
  | 'exceeds_width'
  | 'exceeds_depth'
  | 'exceeds_height'
  | 'invalid_layer'
  | 'collision'
  | 'blocked_zone';

/** Info about what's blocking a placement (for user feedback) */
export interface BlockingInfo {
  /** ID of the bin causing the block */
  binId: BinId;
  /** ID of the layer containing the blocking bin */
  layerId: LayerId;
  /** Name of the layer (for display) */
  layerName: string;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: ValidationReason; blockingInfo?: BlockingInfo };
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
}
export interface PrintListConfig {
  filamentCostPerKg: number; // $/kg - user configurable (default 20)
  metersPerKg: number; // Meters per 1kg spool (~330m for 1.75mm PLA)
}

export interface EnhancedPrintRow extends PrintRow {
  area: number; // width * depth (for sorting)
  costEstimate: number; // $ based on filament usage
  spoolPercentage: number; // % of 1kg spool
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
export interface BlockedZone {
  x: GridUnits;
  y: GridUnits;
  width: GridUnits;
  depth: GridUnits;
  sourceBinId: BinId;
  sourceLayerId: LayerId;
}
/**
 * Simplified bin data for thumbnail rendering.
 * Compact representation to minimize storage.
 */
export interface ThumbnailBin {
  x: GridUnits; // Grid position
  y: GridUnits;
  w: GridUnits; // Width in grid units
  d: GridUnits; // Depth in grid units
  c: string; // Category color (hex)
  l?: string; // Optional label (truncated if needed)
}

/**
 * Preview data cached in library entry for display without loading full layout.
 */
export interface LayoutPreview {
  drawerWidth: GridUnits;
  drawerDepth: GridUnits;
  drawerHeight: HeightUnits;
  binCount: number;
  layerCount: number;
  /** Simplified bin positions for thumbnail (top-down view, all layers merged) */
  binMap?: ThumbnailBin[];
}
/**
 * A point-in-time snapshot of a layout, displayed in the History panel.
 * The actual layout data is stored compressed in IndexedDB — only metadata is kept in memory.
 */
export interface Snapshot {
  /** Unique ID: `${layoutId}-${timestamp}` */
  id: string;
  /** The layout this snapshot belongs to */
  layoutId: string;
  /** When the snapshot was created (Unix ms) */
  timestamp: number;
  /** Optional user annotation (labeled snapshots are exempt from rolling eviction) */
  label?: string;
  /** Cached preview metadata for UI display without decompressing */
  preview: LayoutPreview;
}

/**
 * Internal storage format — layout stored as compressed string in IndexedDB.
 */
export interface CompressedSnapshot {
  id: string;
  layoutId: string;
  timestamp: number;
  label?: string;
  preview: LayoutPreview;
  compressedLayout: string;
}

/**
 * Permission level for collaborative editing.
 */
export type SharePermission = 'view' | 'edit';

/**
 * Cloud share metadata stored locally for re-sharing.
 * Shares are permanent (no expiration) as of collaborative editing update.
 */
export interface CloudShareInfo {
  id: string; // 12-char share ID
  deleteToken: string; // 32-char hex token (stored locally only)
  sharedAt: number; // Unix timestamp
  permission: SharePermission; // Permission level ('view' or 'edit')
  lastUpdatedAt?: number; // Unix timestamp of last server update
  // Note: expiresAt removed - shares are now permanent
}

/**
 * Entry for a layout shared with you by another user.
 * Unlike LayoutEntry, this references a cloud share you don't own.
 */
export interface SharedWithMeEntry {
  id: string; // Local UUID for this entry
  sourceShareId: string; // Cloud share ID (12-char)
  name: string; // Layout name at time of access
  authorName?: string; // Author who shared it
  permission: SharePermission; // 'view' | 'edit'
  addedAt: number; // When first accessed
  lastAccessedAt: number; // When last accessed
  preview?: LayoutPreview; // Cached preview
  status: 'available' | 'deleted' | 'unknown';
}

/**
 * Metadata entry for a layout in the library.
 * The actual layout data is stored separately by ID.
 */
export interface LayoutEntry {
  id: LayoutId; // UUID for identification and future sharing
  name: string; // Display name (max 64 chars)
  createdAt: number; // Unix timestamp
  modifiedAt: number; // Unix timestamp
  author?: string; // Optional author name for sharing
  forkedFrom?: {
    // If imported/forked from another layout
    name: string;
    author?: string;
  };
  preview: LayoutPreview; // Cached preview data
  cloudShare?: CloudShareInfo; // Cloud sharing metadata (if shared)
  /** Optional folder ID for organization. null/undefined = root level (future feature) */
  folderId?: string | null;
}

/**
 * Folder definition for layout organization.
 * @future Implement folder creation/management UI
 */
export interface LayoutFolder {
  id: string;
  name: string; // max 32 chars
  color?: string; // optional accent color
  parentId?: string | null; // for nested folders (future)
  createdAt: number;
  modifiedAt: number;
}

/**
 * The layout library index stored in localStorage.
 * Individual layouts are stored separately by their ID.
 */
export interface LayoutLibrary {
  version: '1.0';
  activeLayoutId: LayoutId; // Currently active layout ID
  settings: {
    authorName?: string; // Default author name for new layouts
  };
  entries: LayoutEntry[]; // All layout entries (metadata only)
  /** Folder definitions for layout organization (future feature) */
  folders?: LayoutFolder[];
}
