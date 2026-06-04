/**
 * Top-down cutout types for solid bins: shapes, pathfinder group ops,
 * bezier path points, scoop edges, and the positioned {@link Cutout} instance.
 */

import type { CutoutTextSide, TextStyleOverride } from './text';

/**
 * Shape of a top-down cutout into solid bin body.
 *
 *  - `polygon` — regular N-gon (hex bits, sockets, Allen keys). Side count is
 *    stored in {@link Cutout.sides}; vertices are derived to fill the
 *    `width × depth` bounding box, so all bounds/resize/rotation math is shared
 *    with the other shapes.
 *  - `slot` — stadium/capsule: a rounded rectangle whose corner radius is
 *    always half its short side (fully rounded ends). For tools laid flat.
 */
export type CutoutShape = 'rectangle' | 'circle' | 'path' | 'polygon' | 'slot';

/** Minimum side count for a polygon cutout (triangle). */
export const MIN_POLYGON_SIDES = 3;
/** Maximum side count for a polygon cutout. */
export const MAX_POLYGON_SIDES = 12;
/** Default side count for a new polygon cutout (hexagon — the bit-organizer staple). */
export const DEFAULT_POLYGON_SIDES = 6;

/**
 * Default insertion clearance (mm) added to an insert-style cutout's nominal
 * size so a part cut to spec (e.g. a 6.35mm hex bit) actually drops in. Applied
 * to circle/polygon/slot only; freeform paths and rectangles cut to exact size.
 */
export const DEFAULT_CUTOUT_CLEARANCE = 0.2;

/** Shapes that accept an insertion {@link Cutout.clearance} offset. */
export const CLEARANCE_SHAPES: readonly CutoutShape[] = ['circle', 'polygon', 'slot'];

/** Largest entry-chamfer width (mm) the editor allows. */
export const MAX_CUTOUT_CHAMFER = 5;

/** Straight wall (mm) that must remain below the bevel, so a chamfer never
 *  consumes the full cut depth. */
const MIN_STRAIGHT_WALL = 0.2;

const ENTRY_CHAMFER_SIZE_FRACTION = 0.1;
const ENTRY_CHAMFER_SNAP = 0.2;
const MIN_ENTRY_CHAMFER = 0.4;
const MAX_ENTRY_CHAMFER_DEFAULT = 0.8;

/**
 * Largest entry-chamfer width (mm) a cut of `cutDepth` can take while keeping a
 * {@link MIN_STRAIGHT_WALL} straight section below the bevel. Returns 0 when the
 * cut is too shallow for any chamfer.
 */
export function maxEntryChamfer(cutDepth: number): number {
  return Math.max(0, Math.min(MAX_CUTOUT_CHAMFER, cutDepth - MIN_STRAIGHT_WALL));
}

/**
 * Smart entry-chamfer width (mm) auto-applied when an insert-style cutout is
 * created. A ~45° bevel at the top rim lets bits/sockets self-center and drop
 * in without binding, and leaves a clean, polished rim. Scales with the hole's
 * tightest dimension (~10%), snapped to the 0.2mm editor grid and clamped to a
 * tasteful 0.4–0.8mm so small holes get a crisp edge-break while large holes
 * never funnel — then capped by cut-depth headroom (a straight wall must remain
 * below the bevel).
 */
export function defaultEntryChamfer(holeSize: number, cutDepth: number): number {
  const raw = ENTRY_CHAMFER_SIZE_FRACTION * holeSize;
  const snapped = Math.round(raw / ENTRY_CHAMFER_SNAP) * ENTRY_CHAMFER_SNAP;
  const tasteful = Math.min(MAX_ENTRY_CHAMFER_DEFAULT, Math.max(MIN_ENTRY_CHAMFER, snapped));
  // toFixed tidies float noise from the snap (e.g. 0.6000000000000001).
  return Number(Math.min(tasteful, maxEntryChamfer(cutDepth)).toFixed(2));
}

/**
 * Shapes that accept an entry {@link Cutout.chamferWidth}. Freeform paths are
 * excluded — a constant-offset outset of an arbitrary bezier outline isn't
 * well-defined, so chamfers are limited to the parametric shapes.
 */
export const CHAMFER_SHAPES: readonly CutoutShape[] = ['rectangle', 'circle', 'polygon', 'slot'];

/** Layout mode for a parametric cutout array. */
export type CutoutArrayMode = 'grid' | 'staggered' | 'radial';

/** Ordered mode list for UI rendering + exhaustiveness checks. */
export const CUTOUT_ARRAY_MODES: readonly CutoutArrayMode[] = ['grid', 'staggered', 'radial'];

/** Max instances an array may expand to — a guardrail against runaway geometry. */
export const MAX_ARRAY_INSTANCES = 400;
/** Max per-axis count / radial count in the editor. */
export const MAX_ARRAY_COUNT = 50;

/**
 * Parametric array driven by a single master {@link Cutout}. The master's
 * shape/size/depth/fit all apply to every instance; only the layout
 * (mode + counts + spacing) lives here. Instances are **derived** at
 * generation/render time and never stored, so there's no per-instance state to
 * migrate. A flat config (all modes' fields present) lets the user toggle modes
 * without losing each mode's settings.
 */
export interface CutoutArrayConfig {
  readonly mode: CutoutArrayMode;
  /** grid / staggered: columns (X) and rows (Y), each ≥ 1. */
  readonly cols: number;
  readonly rows: number;
  /** grid / staggered: center-to-center spacing (mm). */
  readonly pitchX: number;
  readonly pitchY: number;
  /** radial: number of instances around the ring, ≥ 1. */
  readonly count: number;
  /** radial: ring radius (mm) from the master center to each instance center. */
  readonly radius: number;
  /** radial: angle (deg) of the first instance, measured CCW from +X. */
  readonly startAngle: number;
  /** radial: when true, each instance is rotated to face the ring center. */
  readonly rotateToCenter: boolean;
}

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
   * Side count for regular-polygon cutouts (required when shape === 'polygon').
   * Clamped to [{@link MIN_POLYGON_SIDES}, {@link MAX_POLYGON_SIDES}]. Ignored
   * for every other shape.
   */
  readonly sides?: number;
  /**
   * Insertion clearance in mm added to the nominal outline so a part cut to
   * spec actually fits. Applied at generation time to {@link CLEARANCE_SHAPES}
   * (circle/polygon/slot); the editor shows the nominal size. Missing/undefined
   * = no clearance, so pre-existing designs are cut identically.
   */
  readonly clearance?: number;
  /**
   * Entry-chamfer width in mm: a ~45° bevel at the top rim that flares the
   * opening outward so parts self-center on insertion. Applied at generation
   * time to {@link CHAMFER_SHAPES}; the 2D editor shows the nominal opening.
   * Missing/undefined/0 = straight walls, so existing designs are unchanged.
   */
  readonly chamferWidth?: number;
  /**
   * Optional parametric array: this cutout is the master, replicated across the
   * grid/ring described by {@link CutoutArrayConfig}. Instances are derived at
   * generation/render time. Missing = a single cutout. Arrays are restricted to
   * ungrouped cutouts (`groupId === null`).
   */
  readonly array?: CutoutArrayConfig;
  /**
   * When true, `label` is also engraved on the bin top adjacent to this
   * cutout. Default false so existing designs render unchanged after
   * adding this field.
   */
  readonly engraveLabel?: boolean;
  /**
   * Which side of the cutout the engraved label sits on, in WORLD coordinates
   * (top = +Y, does not rotate with the cutout — see {@link CutoutTextSide}).
   * Defaults to 'top'. Ignored when `engraveLabel` is false.
   */
  readonly textSide?: CutoutTextSide;
  /**
   * Optional per-cutout style override. When omitted, the design-level
   * `BinParams.textDefaults` apply. Ignored when `engraveLabel` is false.
   */
  readonly textStyle?: TextStyleOverride;
}
