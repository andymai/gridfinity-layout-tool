/**
 * Top-down cutout types for solid bins: shapes, pathfinder group ops,
 * bezier path points, scoop edges, and the positioned {@link Cutout} instance.
 */

import type { CutoutTextSide, TextStyleOverride } from './text';

/** Shape of a top-down cutout into solid bin body */
export type CutoutShape = 'rectangle' | 'circle' | 'path';

/**
 * Pathfinder boolean op applied across the members of a cutout group, before
 * the resulting shape is subtracted from the solid bin top.
 *
 *  - `union`     — fuse all members (Illustrator "Unite"; the historical
 *    grouping behavior, kept as the default when `groupOp` is missing).
 *  - `subtract`  — top z-ordered member carves a cavity out of the union of
 *    the rest (Illustrator "Minus Front").
 *  - `intersect` — keep only the region common to every member.
 *  - `exclude`   — symmetric difference: union minus intersection
 *    (Illustrator "Exclude" / XOR).
 */
export type GroupOp = 'union' | 'subtract' | 'intersect' | 'exclude';

/** Default applied when a Cutout's `groupOp` is missing (back-compat). */
export const DEFAULT_GROUP_OP: GroupOp = 'union';

/** Ordered op list for UI rendering and exhaustiveness checks. */
export const GROUP_OPS: readonly GroupOp[] = ['union', 'subtract', 'intersect', 'exclude'];

/** Per-edge enable flags for split-axis cutout scoops, in the cutout's local frame. */
export interface CutoutScoopEdges {
  readonly left: boolean;
  readonly right: boolean;
  readonly front: boolean;
  readonly back: boolean;
}

/** Default scoop edge flags: all enabled. Use when scoopEdges is undefined. */
export const DEFAULT_SCOOP_EDGES: CutoutScoopEdges = {
  left: true,
  right: true,
  front: true,
  back: true,
};

/** Minimum number of anchor points required to form a closed path shape */
export const MIN_PATH_POINTS = 2;

/** A vertex in a bezier path with optional control handles */
export interface PathPoint {
  /** X position in mm from bin interior left edge */
  readonly x: number;
  /** Y position in mm from bin interior front edge */
  readonly y: number;
  /** Incoming bezier control handle (relative offset from point). Null = corner. */
  readonly handleIn: { readonly dx: number; readonly dy: number } | null;
  /** Outgoing bezier control handle (relative offset from point). Null = corner. */
  readonly handleOut: { readonly dx: number; readonly dy: number } | null;
  /** When true, handleIn and handleOut are kept symmetric (mirrored) */
  readonly symmetric: boolean;
}

/** Direction for z-order reordering of cutouts */
export type ReorderDirection = 'forward' | 'backward' | 'front' | 'back';

/** Narrowed property subset for bulk cutout toggling (lock/hide) */
export type CutoutToggleProperties = Partial<Pick<Cutout, 'locked' | 'hidden'>>;

/** Global cutout configuration for solid bins */
export interface CutoutConfig {
  /** Global top offset: lowers the solid fill surface below the rim (0 = flush with rim) */
  readonly topOffset: number;
}

/** A positioned cutout instance on the bin top surface */
export interface Cutout {
  readonly id: string;
  readonly shape: CutoutShape;
  /** X position of left edge in mm from bin interior left edge */
  readonly x: number;
  /** Y position of bottom edge in mm from bin interior front edge */
  readonly y: number;
  /** Width in mm (or diameter for circle) */
  readonly width: number;
  /** Depth in mm (ignored for circle) */
  readonly depth: number;
  /** Cavity depth in mm (how deep the cut goes from top surface) */
  readonly cutDepth: number;
  /** Rotation in degrees (0-359) */
  readonly rotation: number;
  /** Corner radius for rectangle shape (mm) */
  readonly cornerRadius: number;
  /** Optional label for the cutout */
  readonly label: string;
  /** Group ID for pathfinder boolean ops (null = ungrouped) */
  readonly groupId: string | null;
  /**
   * Boolean op shared by all members of this cutout's group.
   * All members of the same `groupId` are required to carry the same value
   * (enforced by the slice). Missing/undefined = `'union'` so pre-pathfinder
   * designs behave identically. Ignored when `groupId` is `null`.
   */
  readonly groupOp?: GroupOp;
  /**
   * Scoop radius along the cutout's local width axis (mm).
   * Fillets the Y-aligned bottom edges (left/right walls in local frame).
   * Default 0 (no fillet). Rectangle shape only — circle/path collapse W and D to one value.
   */
  readonly scoopRadiusW?: number;
  /**
   * Scoop radius along the cutout's local depth axis (mm).
   * Fillets the X-aligned bottom edges (front/back walls in local frame).
   * Default 0 (no fillet).
   */
  readonly scoopRadiusD?: number;
  /**
   * Per-edge enable flags in the cutout's local frame. Default all true.
   * Applies only to ungrouped rectangle cutouts; ignored for circles/paths and grouped cutouts.
   */
  readonly scoopEdges?: CutoutScoopEdges;
  /** When true, the cutout cannot be moved, resized, or rotated */
  readonly locked?: boolean;
  /** When true, the cutout is not rendered or selectable (faint ghost only) */
  readonly hidden?: boolean;
  /** Z-order for rendering layering (higher = rendered on top) */
  readonly zIndex?: number;
  /** Path vertices for pen tool shapes (required when shape === 'path') */
  readonly path?: PathPoint[];
  /**
   * When true, `label` is also engraved on the bin top adjacent to this
   * cutout. Default false so existing designs render unchanged after
   * adding this field.
   */
  readonly engraveLabel?: boolean;
  /**
   * Which side of the cutout (in its local rotated frame) the engraved
   * label sits on. Defaults to 'top' (back-of-cutout in local frame).
   * Ignored when `engraveLabel` is false.
   */
  readonly textSide?: CutoutTextSide;
  /**
   * Optional per-cutout style override. When omitted, the design-level
   * `BinParams.textDefaults` apply. Ignored when `engraveLabel` is false.
   */
  readonly textStyle?: TextStyleOverride;
}
