// === Branded ID Types ===
// Nominal types that prevent accidentally mixing different ID domains.
// Use constructor helpers (binId, layerId, etc.) at system boundaries.

export type BinId = string & { readonly __brand: 'BinId' };
export type LayerId = string & { readonly __brand: 'LayerId' };
export type CategoryId = string & { readonly __brand: 'CategoryId' };
export type LayoutId = string & { readonly __brand: 'LayoutId' };

/** Brand a raw string as a BinId. Use at system boundaries (deserialization, user input). */
export const binId = (id: string): BinId => id as BinId;
/** Brand a raw string as a LayerId. Use at system boundaries (deserialization, user input). */
export const layerId = (id: string): LayerId => id as LayerId;
/** Brand a raw string as a CategoryId. Use at system boundaries (deserialization, user input). */
export const categoryId = (id: string): CategoryId => id as CategoryId;
/** Brand a raw string as a LayoutId. Use at system boundaries (deserialization, user input). */
export const layoutId = (id: string): LayoutId => id as LayoutId;

// === Core Data Model (from PRD 05-technical-reference.md) ===

export interface Layout {
  version: string; // "1.0"
  name: string; // max 64 chars
  drawer: Drawer;
  printBedSize: number; // print bed size in mm (e.g., 256 for Prusa MK3)
  gridUnitMm: number; // mm per grid unit (default 42)
  heightUnitMm: number; // mm per height unit (default 7)
  categories: Category[]; // 1-20 items
  layers: Layer[]; // 1-10 items, index 0 = bottom
  bins: Bin[];
  purpose?: string; // Optional drawer purpose (e.g., "workshop", "electronics")
  baseplateParams?: BaseplateParams; // Per-layout baseplate configuration
}

/** Baseplate generation parameters stored per-layout.
 * Width/depth/gridUnitMm are derived from the layout's drawer at generation time, not stored here.
 * Per-side padding in mm — user enters directly, total drawer = grid + padding. */
export interface BaseplateParams {
  readonly magnetHoles: boolean;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly paddingFront: number;
  readonly paddingBack: number;
  /** Enable registration nubs/holes on split piece join edges (default false). */
  readonly connectorNubs?: boolean;
}

/** Position of fractional edge when drawer has half-unit dimensions */
export type FractionalEdge = 'start' | 'end';

export interface Drawer {
  width: number; // 1-50
  depth: number; // 1-50
  height: number; // >= sum of layer heights
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
  height: number; // >= 1
}

export interface Bin {
  id: BinId;
  layerId: LayerId; // base layer ID or STAGING_ID
  x: number; // 0-based, from left
  y: number; // 0-based, from bottom
  width: number; // >= 1
  depth: number; // >= 1
  height: number; // >= base layer height, <= space to drawer top
  clearanceHeight?: number; // additional blocked space above bin (for tall contents)
  category: CategoryId; // references Category.id
  label: string; // max 24 chars
  notes: string; // max 256 chars
  customProperties?: Record<string, string>; // custom key-value properties for user-defined metadata
  linkedDesignId?: string; // reference to saved design in bin-designer (for one-to-many linking)
}

// === Coordinate Types ===

export interface Coord {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface Rect3D extends Rect {
  zStart: number;
  zEnd: number;
}

// === Interaction State ===

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

// === UI State ===

export interface UIState {
  activeLayerId: LayerId;
  selectedBinIds: BinId[];
  activeCategoryId: CategoryId;
  zoom: number; // 0.5 - 2.0
  showOtherLayers: boolean;
}

// === Validation Results ===

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

// === Print List ===

export interface PrintPiece {
  width: number;
  depth: number;
  count: number;
}

export interface PrintRow {
  size: string; // "3×2"
  height: number;
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

// === Enhanced Print List Types ===

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

// === Blocked Zone ===

export interface BlockedZone {
  x: number;
  y: number;
  width: number;
  depth: number;
  sourceBinId: BinId;
  sourceLayerId: LayerId;
}

// === Layout Library (Multi-Layout Management) ===

/**
 * Simplified bin data for thumbnail rendering.
 * Compact representation to minimize storage.
 */
export interface ThumbnailBin {
  x: number; // Grid position
  y: number;
  w: number; // Width in grid units
  d: number; // Depth in grid units
  c: string; // Category color (hex)
  l?: string; // Optional label (truncated if needed)
}

/**
 * Preview data cached in library entry for display without loading full layout.
 */
export interface LayoutPreview {
  drawerWidth: number;
  drawerDepth: number;
  drawerHeight: number;
  binCount: number;
  layerCount: number;
  /** Simplified bin positions for thumbnail (top-down view, all layers merged) */
  binMap?: ThumbnailBin[];
}

// === Snapshot Types ===

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
/**
 * State for name suggestion dismissal tracking.
 * Persisted per-layout to remember user's decision across sessions.
 */
export interface NameSuggestionState {
  /** Whether suggestions were dismissed for this layout */
  dismissed: boolean;
  /** When suggestions were dismissed (Unix timestamp) */
  dismissedAt: number;
  /** Number of times dismissed (for analytics) */
  dismissCount: number;
}

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
  nameSuggestionState?: NameSuggestionState; // Name suggestion dismissal tracking
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
