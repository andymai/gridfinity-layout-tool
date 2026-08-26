/**
 * Top-down cutout types for solid bins: shapes, pathfinder group ops,
 * bezier path points, scoop edges, and the positioned {@link Cutout} instance.
 */

import type { CutoutTextSide, CutoutTextAnchor, CutoutTextOffset, TextStyleOverride } from './text';
import type { LabelPlateIconId, LabelPlateWidthU } from '@/shared/constants/labelPlates';

/**
 * Shape of a top-down cutout into solid bin body.
 *
 *  - `polygon` — regular N-gon (hex bits, sockets, Allen keys). Side count is
 *    stored in {@link Cutout.sides}; vertices are derived to fill the
 *    `width × depth` bounding box, so all bounds/resize/rotation math is shared
 *    with the other shapes.
 *  - `slot` — stadium/capsule: a rounded rectangle whose corner radius is
 *    always half its short side (fully rounded ends). For tools laid flat.
 *  - `mesh` — 3D imprint from an imported STL: the referenced
 *    {@link Cutout.meshId} asset is boolean-subtracted from the solid top as a
 *    contoured pocket. The 2D editor shows its silhouette footprint
 *    (move/rotate only; the outline is derived from the mesh, never
 *    point-edited).
 *  - `knifeSlot` — a blade slot for an in-drawer knife block: a deep stadium
 *    groove (long axis = local X) whose {@link Cutout.knife} spec records the
 *    knife it was sized for. One end may open through the perimeter wall so
 *    the bolster stops at the block face and the handle lies level beyond it.
 *  - `text` — a standalone caption, not a cavity: {@link Cutout.label} is
 *    engraved or embossed centered on the element's footprint, at the size its
 *    `textStyle` pins and turned by `rotation` (which rotates the glyphs — a
 *    text element IS its text, so `textAngle` is unused). `width`/`depth`
 *    mirror the estimated text block for hit-testing and selection, like a
 *    mesh mirrors its silhouette; the store re-derives them on every caption
 *    or size edit, so resize is disabled. Cuts nothing: no cavity, no fit
 *    fields, no color zone, and inside a group it contributes no solid to the
 *    boolean op.
 */
export type CutoutShape =
  'rectangle' | 'circle' | 'path' | 'polygon' | 'slot' | 'mesh' | 'knifeSlot' | 'text';

/**
 * Which surfaces of a colored cutout take its {@link Cutout.color}:
 *  - `floor` — only the cavity bottom (the classic shadow-board backing).
 *  - `floorAndWalls` — bottom plus the interior side walls.
 * Resolved from face normals at paint time, not baked into geometry, so
 * switching scope recolors without regenerating the mesh.
 */
export type CutoutColorScope = 'floor' | 'floorAndWalls';

/** Scope applied when a cutout is colored but no scope was set. */
export const DEFAULT_CUTOUT_COLOR_SCOPE: CutoutColorScope = 'floorAndWalls';

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

/**
 * Shapes that accept an insertion {@link Cutout.clearance} offset. Parametric
 * shapes grow their profile dimensions; paths offset their flattened outline
 * outward at generation time (same polygon offset used for the path chamfer).
 */
export const CLEARANCE_SHAPES: readonly CutoutShape[] = [
  'circle',
  'polygon',
  'slot',
  'path',
  'mesh',
];

/** Largest insertion clearance (mm) the editor allows. Sized for hand-scanned
 *  meshes whose surfaces wobble a few mm; parametric shapes rarely need >0.5. */
export const MAX_CUTOUT_CLEARANCE = 5;

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
 * Shapes that accept an entry {@link Cutout.chamferWidth}. Paths are included:
 * the generator flattens the outline to a polyline and offsets *that* (a
 * well-defined polygon offset) for the flared top rim, falling back to a
 * straight extrude if the offset/loft can't be built. (A constant-offset of an
 * unflattened arbitrary bezier still isn't well-defined — flattening first is
 * what makes the path case tractable.)
 */
export const CHAMFER_SHAPES: readonly CutoutShape[] = [
  'rectangle',
  'circle',
  'polygon',
  'slot',
  'path',
  'mesh',
  'knifeSlot',
];

/** Steepest {@link Cutout.leanDeg} the editor allows, per direction. */
export const MAX_CUTOUT_LEAN_DEG = 45;

/**
 * Shapes that accept a {@link Cutout.leanDeg} tilt. Mesh imprints are cut in
 * the mesh domain (no BREP tool to tilt); knife slots anchor a horizontal
 * breach channel and a rest saddle that both assume a vertical slot.
 */
export const LEAN_SHAPES: readonly CutoutShape[] = [
  'rectangle',
  'circle',
  'polygon',
  'slot',
  'path',
];

/**
 * The lean a cutout actually generates with: 0 for shapes that cannot tilt and
 * for absent/non-finite values, clamped to ±{@link MAX_CUTOUT_LEAN_DEG}
 * otherwise. The worker, the fit-test plan and the editor UI all read the
 * field through this so they cannot disagree about when a lean applies.
 */
export function resolveCutoutLeanDeg(cutout: {
  readonly shape: string;
  readonly leanDeg?: number;
}): number {
  const lean = cutout.leanDeg;
  if (lean === undefined || !Number.isFinite(lean)) return 0;
  if (!(LEAN_SHAPES as readonly string[]).includes(cutout.shape)) return 0;
  return Math.max(-MAX_CUTOUT_LEAN_DEG, Math.min(MAX_CUTOUT_LEAN_DEG, lean));
}

/** Which end of a knife slot's long (local X) axis opens through the wall. */
export type KnifeSlotOpenEnd = 'start' | 'end';

/**
 * The knife a {@link CutoutShape} `knifeSlot` was sized for. The slot's cut
 * geometry lives in the shared `width`/`depth`/`cutDepth` fields (so all
 * bounds/resize/array math is inherited); this spec carries the source
 * measurements that sized them, read by the handle-rest derivation (saddle
 * height needs the handle diameter) and the preview's ghost knife. Clearance
 * is baked into the slot dimensions at creation — these are nominal knife
 * measurements, not cut sizes.
 */
export interface KnifeSpec {
  /** Preset this spec came from (provenance only; absent for custom knives). */
  readonly presetId?: string;
  /** Blade length, heel to tip (mm). */
  readonly bladeLengthMm: number;
  /** Blade height at the heel, edge to spine (mm) — sizes the slot depth. */
  readonly heelHeightMm: number;
  /** Spine thickness at the heel (mm) — sizes the slot width. */
  readonly spineThicknessMm: number;
  /** Handle diameter at its thickest (mm) — sizes the rest saddle height. */
  readonly handleDiameterMm: number;
  /**
   * Which end of the slot opens through the perimeter wall so the handle can
   * lie level past the block face. The cut extends from that end to just
   * beyond the nearest wall along the slot's long axis (axis-aligned
   * rotations only; a tapered interior falls back to an enclosed slot).
   * Absent = enclosed on both ends.
   */
  readonly openEnd?: KnifeSlotOpenEnd;
}

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
  /**
   * Per-instance labels, indexed in the order {@link arrayLabelOrder} gives:
   * reading order for grid/staggered (top row first, left to right), ring order
   * for radial. Absent, which is the common case, leaves every instance
   * labelled with the master's own {@link Cutout.label}, which is how a repeat
   * behaved before the list existed.
   *
   * An entry present in the list wins outright, blank included: a deliberately
   * empty slot is how you leave one hole of an otherwise labelled repeat bare.
   * Instances PAST the end of a short list fall back to the master's label
   * instead, so a half-filled list reads as unfinished rather than as a row of
   * blanks. The editor reports the count mismatch; it does not refuse it.
   */
  readonly labels?: string[];
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

/**
 * Total nesting levels a cutout may sit under, counting its own group.
 *
 * Nothing breaks past it — {@link Cutout.parentGroups} is a path, so a cycle is
 * unrepresentable — but the shape list indents per level and the server has to
 * bound a hand-authored payload somewhere. Mirror in
 * `api/lib/designerValidationConstants.ts`.
 */
export const MAX_GROUP_DEPTH = 10;

/**
 * Length ceiling on {@link Cutout.parentGroups}. One less than
 * {@link MAX_GROUP_DEPTH} because a grouped cutout's own `groupId` is the
 * deepest level and is not repeated in the chain.
 */
export const MAX_PARENT_GROUPS = MAX_GROUP_DEPTH - 1;

/** Longest display name a cutout group may carry. Mirrored in the server validator. */
export const MAX_GROUP_NAME_LENGTH = 60;

/**
 * Ceiling on how many groups a design may name. No product rule caps the group
 * count, so this only has to stop an unbounded map reaching storage. Mirror in
 * `api/lib/designerValidationConstants.ts`.
 */
export const MAX_CUTOUT_GROUP_NAMES = 1000;

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

/**
 * Minimum number of *anchor* points to form a closed path. Two is enough
 * because a 2-anchor path with bezier handles closes into a curve (a lens).
 * The separate *geometric* minimum — ≥3 distinct flattened points for a
 * fillable/printable area — is enforced on the flattened polyline by the
 * renderer (`MIN_POLYLINE_POINTS`) and the worker, not here.
 */
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

/**
 * How a cutout's label is realised on the board.
 *
 *  - `engrave`: the caption is cut (or raised) into the fill surface. The
 *    original behaviour, and the default for any cutout without the field.
 *  - `socket`:  a pocket is cut for a swappable plate carrying the caption,
 *    so the label can be re-printed without re-printing the board.
 *
 * Mutually exclusive: socket mode moves the caption onto the plate, so nothing
 * is engraved beside the cutout.
 */
export type CutoutLabelMode = 'engrave' | 'socket';

/** Ordered mode list for UI rendering and exhaustiveness checks. */
export const CUTOUT_LABEL_MODES: readonly CutoutLabelMode[] = ['engrave', 'socket'];

/** Direction for z-order reordering of cutouts */
export type ReorderDirection = 'forward' | 'backward' | 'front' | 'back';

/**
 * The per-cutout editor properties the shape list and context menu toggle:
 * lock, hide, and the display name. All are set through `setCutoutProperty`.
 */
export type CutoutToggleProperties = Partial<Pick<Cutout, 'locked' | 'hidden' | 'name'>>;

/**
 * Which end of the bin the fill level is anchored to.
 *
 * Only `topOffset` describes the geometry; this says what should stay fixed
 * when the bin gets taller or shorter. Anchored to the rim, the recess above
 * the fill keeps its depth and the fill grows with the bin. Anchored to the
 * floor, the fill keeps its height and the recess absorbs the change, which is
 * what you want when the fill height is set by what goes in the pockets (#3697).
 */
export type CutoutFillReference = 'rim' | 'floor';

export const CUTOUT_FILL_REFERENCES: readonly CutoutFillReference[] = ['rim', 'floor'];

/** Global cutout configuration for solid bins */
export interface CutoutConfig {
  /** Global top offset: lowers the solid fill surface below the rim (0 = flush with rim) */
  readonly topOffset: number;
  /**
   * Which end {@link topOffset} is held against when the bin's wall height
   * changes. Absent is treated as `'rim'`, which is how it behaved before the
   * option existed.
   */
  readonly fillReference?: CutoutFillReference;
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
   * Enclosing groups, OUTERMOST first, excluding this cutout's own
   * {@link groupId}. Absent or empty = the cutout sits at the top level, which
   * is every design authored before nesting existed.
   *
   * A parent group is an arrange-only container: it binds subgroups and loose
   * shapes into one rigid body for move/align/distribute/repeat and carries no
   * {@link groupOp}. Only `groupId` reaches the generator, so the worker
   * partitions cutouts exactly as it always has and nesting cannot change what
   * gets cut.
   *
   * A loose shape can be a direct child of a parent group — that is
   * `groupId: null` with a non-empty `parentGroups`, which is why membership
   * tests must not shortcut through `groupId === null`.
   *
   * Denormalized onto every member, like {@link groupOp}: all members of a
   * group are required to carry an identical chain (enforced by the slice).
   * Depth is capped at {@link MAX_GROUP_DEPTH} levels including `groupId`.
   */
  readonly parentGroups?: string[];
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
  /**
   * Editor-only display name shown in the shape list. Optional —
   * unset rows fall back to a label derived from the shape and its size, so
   * most designs never carry one.
   *
   * Deliberately NOT {@link label}: that is the text physically engraved on the
   * bin, so renaming a row must never change what gets cut into the part.
   */
  readonly name?: string;
  /** When true, the cutout cannot be moved, resized, or rotated */
  readonly locked?: boolean;
  /** When true, the cutout is not rendered or selectable (faint ghost only) */
  readonly hidden?: boolean;
  /**
   * Z-order: higher draws on top and wins the click on overlap. Also orders
   * boolean ops within a group (`cutoutGroupOps.ts`). Absent = 0; the editor
   * re-stacks to contiguous 0..n-1 whenever anything is reordered.
   */
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
   * Tilt of the pocket's axis off vertical, in degrees (±{@link
   * MAX_CUTOUT_LEAN_DEG}), so an item slides in at a slope. The pocket is the
   * drawn cross-section rotated about its own opening along the shape's local
   * depth axis (positive tips the floor toward the shape's top edge in the
   * editor); `rotation` carries the tilt to any direction. `cutDepth` is
   * measured along the tilted axis. Absent = 0 (straight down), so existing
   * designs' fingerprints are untouched; ignored for shapes outside
   * {@link LEAN_SHAPES}.
   */
  readonly leanDeg?: number;
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
   * @deprecated Superseded by {@link textAnchor}. Read only to migrate
   * pre-anchor designs (via `TEXT_SIDE_TO_ANCHOR`); new writes set `textAnchor`
   * and leave this untouched. Ignored when `textAnchor` is present.
   */
  readonly textSide?: CutoutTextSide;
  /**
   * Nine-point anchor positioning the engraved label relative to the cutout, in
   * WORLD coordinates (does not rotate with the cutout — see
   * {@link CutoutTextAnchor}). Defaults to 'top'; migrated from the legacy
   * {@link textSide} when absent. Ignored when `engraveLabel` is false.
   */
  readonly textAnchor?: CutoutTextAnchor;
  /**
   * Free fine-tune nudge (mm, WORLD coords) added to the anchored label center.
   * Default {x:0,y:0}. Set by the X/Y offset inputs and by dragging the label
   * in the 2D editor. Ignored when `engraveLabel` is false.
   */
  readonly textOffset?: CutoutTextOffset;
  /**
   * Label rotation in degrees about its own center (0 = upright/world-up;
   * positive = counter-clockwise). Default 0. Ignored when `engraveLabel` is
   * false.
   */
  readonly textAngle?: number;
  /**
   * Optional per-cutout style override. When omitted, the design-level
   * `BinParams.textDefaults` apply. Ignored when `engraveLabel` is false.
   */
  readonly textStyle?: TextStyleOverride;
  /**
   * Multi-color: hex filament color for this cutout's cavity (shadow-board
   * backing). Absent = inherits the body color (no material split). Grouped
   * cutouts share one color across all members (like {@link groupOp}); array
   * instances inherit the master's. Purely cosmetic — read at paint time from
   * the baked face tags, so recoloring never regenerates geometry.
   */
  readonly color?: string;
  /**
   * Which cavity surfaces {@link color} paints. Defaults to
   * {@link DEFAULT_CUTOUT_COLOR_SCOPE} when a color is set. Ignored when
   * `color` is absent.
   */
  readonly colorScope?: CutoutColorScope;
  /**
   * Whether this cutout's label is engraved into the board or carried on a
   * swappable plate. Absent = `'engrave'`, so designs predating sockets are
   * built identically.
   */
  readonly labelMode?: CutoutLabelMode;
  /**
   * Pin the plate to a narrower standard width than the largest that fits.
   * Ignored outside socket mode, and ignored when the pinned width does not
   * fit. The plan never offers a plate its pocket would reject.
   */
  readonly labelPlateWidthU?: LabelPlateWidthU;
  /**
   * Hardware icon printed beside the caption on this cutout's plate. Ignored
   * outside socket mode.
   */
  readonly labelIcon?: LabelPlateIconId;
  /**
   * Key into `BinParams.meshAssets` (required when shape === 'mesh', ignored
   * otherwise). Assets live in a design-level map so duplicates and array
   * instances share one stored mesh; the store GCs an asset when its last
   * referencing cutout is deleted. For mesh cutouts `width`/`depth` mirror the
   * asset footprint bbox (kept for hit-testing and label anchoring — resize is
   * disabled) and `cutDepth` is the pocket depth the mesh is sunk to.
   */
  readonly meshId?: string;
  /**
   * Knife measurements for `knifeSlot` cutouts (required at creation for that
   * shape, ignored otherwise). Optional on the type so existing designs'
   * fingerprints are untouched; a knife slot missing it falls back to
   * {@link DEFAULT_KNIFE_SPEC} at read time.
   */
  readonly knife?: KnifeSpec;
}

/**
 * Fallback knife measurements for a `knifeSlot` whose spec was stripped (an
 * imported design edited by hand). An 8" chef knife — the preset the creation
 * flow also defaults to.
 */
export const DEFAULT_KNIFE_SPEC: KnifeSpec = {
  bladeLengthMm: 205,
  heelHeightMm: 47,
  spineThicknessMm: 2.3,
  handleDiameterMm: 23,
  openEnd: 'end',
};
