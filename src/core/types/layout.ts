import type {
  Mm,
  GridUnits,
  HeightUnits,
  BinId,
  LayerId,
  CategoryId,
  DesignId,
  BaseplateDesignId,
} from '@gridfinity/branded-types';
import type { StoredBaseplateParams } from './baseplate';
import type { DrawerOutline, FractionalEdge, MeasuredDrawerMm } from './drawerOutline';
/**
 * Where magnet holes anchor within each grid cell.
 * - `edge` (default): a constant 8mm from the cell edge, so holes track the
 *   corners at any `gridUnitMm` — the true Gridfinity corner position.
 * - `center`: the legacy fixed 13mm from the cell center. Identical to `edge`
 *   at the standard 42mm grid; on larger grids the holes drift inward. Kept as
 *   a compatibility escape hatch for parts already printed against it (#2525).
 *
 * Layout-scoped so a layout's bins, lids, and baseplate share one anchor and
 * their magnets stay mutually mated. Only observable when `gridUnitMm > 42`.
 */
export type MagnetAnchor = 'edge' | 'center';

/** Default magnet anchor — corner-tracking, the correct Gridfinity position. */
export const DEFAULT_MAGNET_ANCHOR: MagnetAnchor = 'edge';

export interface Layout {
  version: string; // "1.0"
  name: string; // max 64 chars
  drawer: Drawer;
  printBedSize: Mm; // print bed width in mm (e.g., 256 for Prusa MK3)
  printBedDepth?: Mm; // print bed depth in mm (undefined = same as printBedSize)
  gridUnitMm: Mm; // mm per grid unit along X (default 42)
  /**
   * mm per grid unit along the depth (Y) axis for a non-square grid.
   * `undefined` = square: the Y pitch equals {@link gridUnitMm}, and every
   * square layout stays byte-identical. A concrete value edits X and Y
   * independently (mirrors {@link BinParams.gridUnitMmY}). Resolve through
   * {@link effectiveGridUnitMmY} rather than reading this field directly.
   */
  gridUnitMmY?: Mm;
  heightUnitMm: Mm; // mm per height unit (default 7)
  /** Magnet hole placement anchor (default 'edge'). See {@link MagnetAnchor}. */
  magnetAnchor?: MagnetAnchor;
  categories: Category[]; // 1-20 items
  layers: Layer[]; // 1-10 items, index 0 = bottom
  bins: Bin[];
  purpose?: string; // Optional drawer purpose (e.g., "workshop", "electronics")
  baseplateParams?: StoredBaseplateParams; // Per-layout baseplate configuration
  // Pointer to the active baseplate library design. null = detached inline draft
  // (unsaved New/Fork, or orphaned after the source design was deleted).
  activeBaseplateId?: BaseplateDesignId | null;
}

/**
 * Resolve a layout's effective depth-axis (Y) grid pitch. Returns the explicit
 * non-square {@link Layout.gridUnitMmY} when set, otherwise the square
 * {@link Layout.gridUnitMm}. Single source for the `?? gridUnitMm` fallback so
 * the store, canvas, baseplate params, and export path can't drift.
 */
export function effectiveGridUnitMmY(layout: Pick<Layout, 'gridUnitMm' | 'gridUnitMmY'>): Mm {
  return layout.gridUnitMmY ?? layout.gridUnitMm;
}

export interface Drawer {
  width: GridUnits; // 1-50
  depth: GridUnits; // 1-50
  height: HeightUnits; // >= sum of layer heights
  fractionalEdgeX?: FractionalEdge; // 'start' = left, 'end' = right (default)
  fractionalEdgeY?: FractionalEdge; // 'start' = bottom, 'end' = top (default)
  /** Non-rectangular boundary. Absent = full `width × depth` rectangle. */
  outline?: DrawerOutline;
  /** Measured physical drawer size. Absent until the user enters one. */
  measuredMm?: MeasuredDrawerMm;
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
  // Opt-in for this instance to extend its walls into the baseplate's drawer-fit
  // margin on every drawer edge it abuts (#2462). A flag, not mm: the actual
  // per-side overhang is derived live from `baseplateParams.padding*` at
  // render/export, so it tracks later padding changes. Applies only while the
  // bin abuts a padded edge; dormant otherwise.
  extendToMargin?: boolean;
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
