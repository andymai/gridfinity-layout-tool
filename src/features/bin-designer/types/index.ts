/**
 * Bin Designer type definitions.
 *
 * Core types for parametric Gridfinity bin configuration,
 * generation state, and designer UI state.
 */

import type { FaceGroupData, CoarseLODData, PerfSnapshot } from '@/shared/types/generation';

/**
 * Lid mesh data as stored in the designer store. Mirrors the shared
 * `LidMeshData` shape but with a mutable `faceGroups` array so the
 * Immer-backed store can ingest it. The bridge converts the worker's
 * readonly payload into this shape via spread in `useGeneration`.
 */
export interface LidMeshDataState {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
  readonly faceGroups?: FaceGroupData[];
}
import type { DesignId } from '@/core/types';
import type { CellMask } from '@/shared/utils/cellMask';
import type { ColorZone, FeatureColorConfig, HoverableZone, LipColorConfig } from './featureColors';
import type { LidConfig } from './lid';
import type { TextStyleDefaults, TextStyleOverride, CutoutTextSide } from './text';

export type {
  TextMode,
  TextFontFamily,
  CutoutTextSide,
  TextStyleDefaults,
  TextStyleOverride,
} from './text';
export { TEXT_MAX_LENGTH } from './text';

/**
 * Eyedropper click anchor: which zone was hit and the viewport coords
 * where the picker should open. Kept in the store so every exit path
 * for `colorTool` (toolbar button, banner X, ESC, multi-color disable)
 * can clear it atomically — otherwise the picker risks floating after
 * the tool exits.
 */
export interface PickerOverlayState {
  readonly zone: ColorZone;
  readonly x: number;
  readonly y: number;
}

/**
 * Optional zone-editing mode overlaid on the 3D preview.
 *  - `'eyedropper'`: click any zone in the mesh to open its picker
 *  - `'swap-pick-first'` / `'swap-pick-second'`: two-step swap-zones flow
 *
 * Mutually exclusive — entering one tool clears any in-progress state from
 * another (so a half-done swap pick doesn't leak into eyedropper mode).
 */
export type ColorTool = 'eyedropper' | 'swap-pick-first' | 'swap-pick-second' | null;

export type { LidConfig, LidClickRails, LidRailSide } from './lid';
export {
  DEFAULT_LID_CONFIG,
  LID_FIT_CLEARANCE,
  LID_CORNER_RADIUS,
  LID_TOP_THICKNESS_BASE,
  LID_MAGNET_CEILING,
  LID_MIN_RAIL_LENGTH,
  LID_CLICK_RAIL_COVERAGE_OPTIONS,
  LID_RAIL_SIDES,
} from './lid';

// Bin Configuration Types

/** Base attachment style for bin-to-baseplate connection */
export type BaseStyle = 'standard' | 'magnet' | 'screw' | 'magnet_and_screw' | 'weighted' | 'flat';

/** True when `style` includes magnet pockets — single source of truth so
 *  callers don't drift if a new magnet-inclusive style is added. */
export function isMagnetStyle(style: BaseStyle): boolean {
  return style === 'magnet' || style === 'magnet_and_screw';
}

/** True when `style` includes screw mounts — paired with `isMagnetStyle`. */
export function isScrewStyle(style: BaseStyle): boolean {
  return style === 'screw' || style === 'magnet_and_screw';
}

/** Bin wall/style variant */
export type BinStyle = 'standard' | 'slotted' | 'solid';

/** Slot configuration for one axis */
export interface AxisSlotConfig {
  readonly enabled: boolean;
  /** Distance between slot centers in mm */
  readonly pitch: number;
}

/** Slot configuration for removable divider walls */
export interface SlotConfig {
  /** Slots on left/right walls (for Y-axis dividers) */
  readonly x: AxisSlotConfig;
  /** Slots on front/back walls (for X-axis dividers) */
  readonly y: AxisSlotConfig;
  /** Slot opening width in mm */
  readonly width: number;
  /** Slot cut depth into wall in mm */
  readonly depth: number;
}

/** Configuration for removable divider pieces */
export interface DividerPieceConfig {
  /** Height in mm, or 'auto' to match bin interior height */
  readonly height: number | 'auto';
  /** Divider wall thickness in mm */
  readonly thickness: number;
  /** Fit clearance in mm (subtracted from each side) */
  readonly clearance: number;
}

/** Base configuration for bin attachment */
export interface BaseConfig {
  readonly style: BaseStyle;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  readonly screwDiameter: number;
  readonly stackingLip: boolean;
  /** When true, the bin body is a solid block (no cavity). Used by cutouts feature. */
  readonly solid: boolean;
  /** When true, subdivides each cell into 0.5×0.5 half sockets instead of full 1×1 sockets. */
  readonly halfSockets: boolean;
}

/** Divider configuration for compartment splitting (legacy — use CompartmentConfig) */
export interface DividerConfig {
  readonly x: number;
  readonly y: number;
  readonly thickness: number;
}

/**
 * Non-uniform compartment layout using a grid-based cell ownership model.
 *
 * The bin interior is divided into a `cols × rows` grid. Each cell is assigned
 * a compartment ID. Adjacent cells sharing the same ID form one rectangular
 * compartment. Divider walls are derived from boundaries between cells with
 * different IDs.
 *
 * Example: 3×2 grid with one 2-wide compartment on top row:
 *   cells: [0, 0, 1, 2, 3, 4]  →  row 0: [0,0,1], row 1: [2,3,4]
 *   Compartment 0 spans columns 0-1 of row 0.
 */
export interface CompartmentConfig {
  /** Number of columns along width axis (1-8) */
  readonly cols: number;
  /** Number of rows along depth axis (1-8) */
  readonly rows: number;
  /** Divider wall thickness in mm */
  readonly thickness: number;
  /**
   * Cell-to-compartment mapping, stored row-major (length = rows * cols).
   * cells[row * cols + col] = compartment ID for that cell.
   * Cells with the same ID must form a rectangle.
   */
  readonly cells: number[];
  /**
   * Optional per-compartment engraved label text, indexed by compartment ID
   * after `normalizeIds`. Empty / missing entries render no text on the tab.
   * Length need not equal compartment count; trailing slots are treated as
   * empty. Kept in lockstep with `cells` via `normalizeIdsWithRemap`.
   *
   * Element type intentionally `string[]` (not `readonly string[]`) to mirror
   * sibling `cells: number[]`. The whole `params` tree passes through Immer
   * `Draft`s, which require mutable element types.
   */
  readonly compartmentTexts?: string[];
  /**
   * Optional per-divider tilt overrides. Each entry shifts the endpoints of
   * one interior divider away from its axis-aligned grid position, producing
   * an angled (tapered) divider — useful for wedge-shaped compartments
   * (e.g. silverware drawer dividers that follow utensil taper).
   *
   * The override applies to the unique segment between two adjacent
   * compartments identified by `compartmentA < compartmentB` (canonical
   * ordering enforced by the validator). Dropped via
   * `remapDividerOverrides` on any cell mutation that renumbers IDs.
   */
  readonly dividerOverrides?: DividerOverride[];
}

/**
 * One tilted-divider override. The underlying axis-aligned divider exists
 * because two adjacent compartments share a boundary; the override shifts
 * the divider's endpoints away from that boundary line.
 *
 * Coordinate system (relative to the SEGMENT's own endpoints, not the bin
 * walls — an interior divider in a 3+row grid doesn't span the full bin):
 * - For a **vertical** divider segment (compartments stacked horizontally),
 *   `offsetStart` shifts the lower-Y endpoint of the segment in ±X;
 *   `offsetEnd` shifts the higher-Y endpoint in ±X. Positive offsets push
 *   the endpoints in the +X direction.
 * - For a **horizontal** divider segment (compartments stacked vertically),
 *   `offsetStart` shifts the lower-X endpoint in ±Y; `offsetEnd` shifts the
 *   higher-X endpoint in ±Y. Positive offsets push endpoints in +Y.
 *
 * Setting both offsets equal translates the divider without tilting it.
 * Setting `offsetEnd = -offsetStart` produces a symmetric tilt around the
 * divider midpoint.
 */
export interface DividerOverride {
  /** Lower of the two compartment IDs (canonical pair ordering). */
  readonly compartmentA: number;
  /** Higher of the two compartment IDs. Must be > compartmentA. */
  readonly compartmentB: number;
  /** Signed mm shift of the start endpoint perpendicular to the divider axis. */
  readonly offsetStart: number;
  /** Signed mm shift of the end endpoint perpendicular to the divider axis. */
  readonly offsetEnd: number;
}

/** Scoop ramp configuration for compartment accessibility */
export interface ScoopConfig {
  readonly enabled: boolean;
  /** Scoop radius in mm. 'auto' = min(compartmentSize/3, 15mm) */
  readonly radius: number | 'auto';
}

/** Horizontal alignment of each label tab within its compartment column */
export type LabelTabAlignment = 'left' | 'center' | 'right';

/** Support structure style for the label tab */
export type LabelTabSupport = 'bracket' | 'solid' | 'fillet';

/**
 * Which compartment edges receive label tabs. 'back' (default) is the legacy
 * behavior. 'front' anchors tabs to the front wall instead, 'both' renders a
 * tab at each edge — the tuck-under-ledge use case from #1898.
 */
export type LabelTabEdges = 'back' | 'front' | 'both';

/** Label tab configuration for back-wall identification shelf */
export interface LabelTabConfig {
  readonly enabled: boolean;
  /** Support structure: 'bracket' = open gussets, 'solid' = filled triangle */
  readonly support: LabelTabSupport;
  /** Depth of tab from inner back wall (horizontal inward), in mm */
  readonly depth: number;
  /** Width of each tab as percentage of compartment column width (1-100) */
  readonly width: number;
  /**
   * Z position of the shelf TOP above the cavity floor, in mm. When absent
   * (default), the shelf anchors to the wall top — identical to the original
   * label-tab behavior. Lowering this value drops the shelf down, creating a
   * tuck-under pocket between the stacking rim and the shelf (useful for
   * keeping springy contents from popping out — see issue #1898).
   *
   * Bounds enforced by the UI: `[tabDepth + 1, interiorHeight]`. The geometry
   * layer also guards against degenerate configs (returns null when the
   * gusset has no room).
   */
  readonly height?: number;
  /** Horizontal alignment within each compartment column */
  readonly alignment: LabelTabAlignment;
  /**
   * Which edges of each compartment receive tabs. When absent (default),
   * tabs anchor to the back wall — identical to the original behavior.
   * 'front' anchors to the front wall; 'both' renders a tab at each edge,
   * which is what the tuck-under-ledge use case from #1898 needs.
   *
   * For 'both' on a multi-row layout: each compartment with both a back
   * AND a front edge gets two tabs (mirroring how the existing back-tab
   * logic already places one tab per back-edge group, outer or interior).
   */
  readonly edges?: LabelTabEdges;
  /**
   * Distance in mm the tab moves INWARD from its anchor wall. For 'back',
   * positive `inset` moves toward the front; for 'front', positive moves
   * toward the back; for 'both', both tabs move inward symmetrically.
   *
   * Bounds: `[0, MAX_LABEL_TAB_INSET]`, with a runtime clamp based on the
   * compartment depth so the tab can't pass the opposite wall. When 'both'
   * tabs would collide (2·depth + 2·inset > compartmentDepth), the front
   * tab is silently dropped and the UI shows an inline warning.
   */
  readonly inset?: number;
  /**
   * Optional per-design style override for engraved compartment text on
   * label tabs. When omitted, `BinParams.textDefaults` apply unchanged.
   */
  readonly textStyle?: TextStyleOverride;
}

/** Handle-eligible wall sides (outer walls only, no interior dividers) */
export type HandleWallSide = 'front' | 'back' | 'left' | 'right';

/** Handle cutout shape */
export type HandleCutoutShape = 'rectangle' | 'oval' | 'scoop' | 'u-shape';

/** Per-side handle configuration */
export interface HandleSide {
  /** Whether this side's handle is individually enabled */
  readonly enabled: boolean;
  /** Per-side width override (% of wall span). Null = use global. */
  readonly width: number | null;
  /** Per-side height override (mm). Null = use global. */
  readonly height: number | null;
  /** Per-side corner radius override (mm). Null = use global. */
  readonly cornerRadius: number | null;
}

/** Handle configuration for through-hole grip cutouts */
export interface HandleConfig {
  /** Master toggle for the handles feature */
  readonly enabled: boolean;
  /** Cutout shape applied globally to all sides */
  readonly shape: HandleCutoutShape;
  /** Hole width as % of wall interior span (10-100). Default: 50 */
  readonly width: number;
  /** Hole height in mm (vertical extent). Default: 15 */
  readonly height: number;
  /** Corner radius in mm (0 = sharp rectangle). Default: 10. Used for rectangle and u-shape only. */
  readonly cornerRadius: number;
  /** Vertical position as fraction 0-1 from floor. Default: 0.7. Ignored for u-shape (auto-anchored to bottom). */
  readonly verticalPosition: number;
  /** Number of handles per wall side (1-3). Default: 1 */
  readonly count: number;
  /** Whether to enable chamfer around handle edges */
  readonly chamfer: boolean;
  /** Whether to cut handles into interior divider walls */
  readonly interior: boolean;
  readonly front: HandleSide;
  readonly back: HandleSide;
  readonly left: HandleSide;
  readonly right: HandleSide;
}

/** A single wall cutout: per-side override with its own enabled flag */
export interface WallCutout {
  /** Whether this side's cutout is individually enabled */
  readonly enabled: boolean;
  /** Width of the cutout as 0-100% of the wall span */
  readonly width: number;
  /** Depth of the cutout as 0-100% of the wall height (from top) */
  readonly depth: number;
  /** Horizontal alignment of the cutout within the wall span */
  readonly alignment: LabelTabAlignment;
  /** Horizontal offset from the alignment anchor in mm (positive = toward right/back) */
  readonly offset: number;
  /** Absolute cutout width in mm. When null, the percentage `width` field is used instead. */
  readonly widthMm: number | null;
}

/** Wall side identifier for per-side operations */
export type WallSide = 'front' | 'back' | 'left' | 'right' | 'interior';

/** Cutout shape style: u-shape (rectangular notch), scoop (semicircle), funnel (tapered U) */
export type WallCutoutShape = 'u-shape' | 'scoop' | 'funnel';

/** Wall cutout configuration: global defaults + per-side overrides */
export interface WallConfig {
  /** Master toggle for the wall cutouts feature */
  readonly enabled: boolean;
  /** Cutout shape applied globally to all sides */
  readonly shape: WallCutoutShape;
  /** Global default width % (0-100) applied to sides without individual overrides */
  readonly width: number;
  /** Global default depth % (0-100) applied to sides without individual overrides */
  readonly depth: number;
  readonly front: WallCutout;
  readonly back: WallCutout;
  readonly left: WallCutout;
  readonly right: WallCutout;
  /** Uniform cutout applied to all interior compartment divider walls */
  readonly interior: WallCutout;
}

// Wall Pattern Types

/** Supported wall pattern types. Extensible via pattern registry. */
export type WallPatternType = 'honeycomb';

/** Wall pattern configuration — stored per design in BinParams */
export interface WallPatternConfig {
  readonly enabled: boolean;
  readonly pattern: WallPatternType;
}

/**
 * Style of alignment connector added to the exterior side walls at each cut.
 * `'none'` disables wall connectors; `'key'` is the press-together alignment key.
 * Extend this union (and the dispatcher in `splitConnectorBuilder.ts`) to add
 * new wall connector types — the dispatcher's exhaustive switch will flag every
 * place that must handle the new member.
 */
export type WallConnectorStyle = 'none' | 'key';

/** Configuration for alignment connectors on split bin cut faces */
export interface SplitConnectorConfig {
  /** Whether to add alignment connectors (default: true when split needed) */
  readonly enabled: boolean;
  /** FDM fit clearance applied to groove/channel dimensions per side, normal to surface (mm, 0.05–0.3) */
  readonly clearance: number;
  /** Legacy tongue protrusion depth; kept for backward compat, unused by current scarf lap (mm) */
  readonly tongueProtrusion: number;
  /** Tongue cross-section thickness — kept for backward compat, unused by scarf lap (mm) */
  readonly tongueThickness: number;
  /** Wall connector style added to exterior side walls at each cut (default: 'none'). */
  readonly wallConnector?: WallConnectorStyle;
  /**
   * Reserved: nominal key width hint as a fraction of wall thickness. Actual width is
   * clamped to the FDM minimum and driven by the local pilaster, since raw thin walls
   * (≈1.2mm) yield sub-printable widths.
   */
  readonly ridgeWidthFraction?: number;
  /**
   * Wall key height as a fraction of interior wall height (default 0.8). The key
   * stops below the rim so it never collides with the stacking lip.
   */
  readonly ridgeHeightFraction?: number;
}

/** Complete bin parameter set for generation */
export interface BinParams {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /** Grid unit size in mm (default 42mm per Gridfinity spec) */
  readonly gridUnitMm: number;
  /** Height unit size in mm (default 7mm per Gridfinity spec) */
  readonly heightUnitMm: number;
  /** Wall thickness in mm (default 1.2) */
  readonly wallThickness: number;
  readonly base: BaseConfig;
  readonly style: BinStyle;
  readonly compartments: CompartmentConfig;
  readonly scoop: ScoopConfig;
  readonly label: LabelTabConfig;
  readonly walls: WallConfig;
  readonly handles: HandleConfig;
  readonly slotConfig: SlotConfig;
  readonly dividerPieces: DividerPieceConfig;
  readonly inserts: Insert[];
  readonly cutouts: Cutout[];
  readonly cutoutConfig: CutoutConfig;
  readonly wallPattern: WallPatternConfig;
  /** Split connector config. If omitted/undefined, default split connector settings are applied (connectors enabled with defaults). */
  readonly splitConnectors?: SplitConnectorConfig;
  /** Per-feature filament color assignment for multi-color 3MF export. */
  readonly featureColors: FeatureColorConfig;
  /**
   * Design-level defaults for engraved text geometry on label tabs and
   * adjacent to cutouts. Individual instances may attach a
   * `TextStyleOverride` that selectively overrides these fields.
   */
  readonly textDefaults: TextStyleDefaults;
  /** Click-lock lid configuration. Lid is generated as a separate companion solid. */
  readonly lid: LidConfig;
  /**
   * Optional custom footprint mask (non-rectangular bins).
   *
   * When omitted or when every cell is filled, the bin is treated as a
   * rectangle and uses the rectangle code path (no perf regression).
   * When present and partial, the generator builds a polygon footprint
   * and places sockets only on filled cells. Features that cannot yet
   * operate on non-rectangular footprints (compartments, cutouts, walls,
   * handles, inserts, scoops, label tabs) are skipped.
   *
   * Stored at half-bin resolution unconditionally — a `width × depth`
   * bin has a `(2*width) × (2*depth)` mask.
   */
  readonly cellMask?: CellMask;
}

// Insert Types

/** Shape of a cavity cut into the bin floor */
export type InsertShape = 'rectangle' | 'circle' | 'hexagon' | 'rounded-rect' | 'slot';

/** A placed insert instance on the bin floor */
export interface Insert {
  readonly id: string;
  readonly templateId: string | null;
  readonly shape: InsertShape;
  /** X position in mm from bin interior left edge */
  readonly x: number;
  /** Y position in mm from bin interior front edge */
  readonly y: number;
  /** Width in mm (or diameter for circle/hexagon) */
  readonly width: number;
  /** Depth in mm (ignored for circle/hexagon) */
  readonly depth: number;
  /** Cavity depth in mm (how deep the cut goes) */
  readonly cutDepth: number;
  /** Rotation in degrees (0, 90, 180, 270) */
  readonly rotation: 0 | 90 | 180 | 270;
  /** Corner radius for rounded-rect shape (mm) */
  readonly cornerRadius: number;
  /** Optional label for the insert */
  readonly label: string;
}

// Cutout Types (Top-Down Cavity Cuts for Solid Bins)

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

// Generation Types

/** Current status of the generation engine */
export type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

/** WASM/Worker initialization status */
export type WasmStatus = 'unloaded' | 'loading' | 'ready' | 'error';

/** Result of mesh generation */
export interface GenerationResult {
  readonly vertices: Float32Array | null;
  readonly normals: Float32Array | null;
  readonly indices: Uint32Array | null;
  readonly edgeVertices: Float32Array | null;
  readonly error: string | null;
  readonly timingMs: number;
  /** Optional per-face feature groups for provenance-based coloring. */
  readonly faceGroups?: FaceGroupData[];
  /** Coarse LOD mesh for distance-based rendering (preview only) */
  readonly coarseLOD?: CoarseLODData;
  /** Optional companion lid mesh, present only when the bin has a lid enabled. */
  readonly lidMesh?: LidMeshDataState;
}

/** Generation state tracked in the store */
export interface GenerationState {
  readonly status: GenerationStatus;
  readonly mesh: GenerationResult | null;
  readonly progress: number;
  /** Increments on changes needing regeneration; cache hits leave epoch unchanged */
  readonly epoch: number;
  /**
   * Rolling buffer of recent generation timing snapshots (most recent
   * last, capped at PERF_HISTORY_LIMIT). Powers the dev PerfOverlay.
   */
  readonly perfHistory: readonly PerfSnapshot[];
}

/** Cap for `generation.perfHistory`. Tiny payloads; safe to keep many. */
export const PERF_HISTORY_LIMIT = 50;

/** Cached mesh data for undo/redo history entries */
export interface CachedMesh {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
  readonly byteSize: number;
}

/** History entry pairing params with optional cached mesh */
export interface HistoryEntry {
  readonly params: BinParams;
  readonly mesh: CachedMesh | null;
}

// Designer UI State Types

/** Active tab in the parameter panel */
export type DesignerTab = 'dimensions' | 'base' | 'compartments' | 'walls' | 'style';

/** View mode for split bin preview: assembled (no gaps) or exploded (gaps between pieces). */
export type SplitViewMode = 'assembled' | 'exploded';

/** Mesh data for a single split bin piece, used for Three.js rendering */
export interface SplitPieceMeshEntry {
  readonly label: string;
  readonly col: number;
  readonly row: number;
  readonly widthUnits: number;
  readonly depthUnits: number;
  /** X offset in grid units from bin origin (left edge) */
  readonly offsetX: number;
  /** Y offset in grid units from bin origin (bottom edge) */
  readonly offsetY: number;
  readonly mesh: {
    readonly vertices: Float32Array | null;
    readonly normals: Float32Array | null;
    readonly indices: Uint32Array | null;
    readonly edgeVertices: Float32Array | null;
  };
}

/** Auto-save status indicator */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** UI state for the designer page */
export interface DesignerUIState {
  readonly activeTab: DesignerTab;
  readonly exportDialogOpen: boolean;
  readonly designListOpen: boolean;
  readonly wireframeMode: boolean;
  /** Whether half-bin mode is enabled (0.5 grid unit increments for width/depth) */
  readonly halfGridMode: boolean;
  /** Whether the full-workspace cutout editor is open (desktop only) */
  readonly cutoutEditorOpen: boolean;
  /** Preview compartments during drag-to-merge/split (shown as ghost in 3D view) */
  readonly previewCompartments: CompartmentConfig | null;
  /** Preview selection info for 3D ghost overlay */
  readonly previewSelection: {
    readonly action: 'merge' | 'split';
    readonly minCol: number;
    readonly maxCol: number;
    readonly minRow: number;
    readonly maxRow: number;
  } | null;
  /** View mode for split preview overlay (assembled=no gaps, exploded=gaps between pieces) */
  readonly splitViewMode: SplitViewMode;
  /** Per-piece mesh data for split bin preview (populated when exploded mode is active) */
  readonly splitPieceMeshes: readonly SplitPieceMeshEntry[];
  /** Currently hovered color zone in the panel (for 3D preview glow feedback) */
  readonly hoveredColorZone: HoverableZone | null;
  /**
   * Active color tool overlay. `'eyedropper'` lets the user click a zone in
   * the 3D preview to recolor it; `'swap-pick-first'` and `'swap-pick-second'`
   * drive the two-step swap-zones flow. `null` = no tool active.
   * Each tool gates pointer behavior in PreviewCanvas and shows a banner.
   */
  readonly colorTool: ColorTool;
  /**
   * First zone picked in the swap flow (set during `'swap-pick-second'`).
   * Captured at pick time; the second pick triggers the swap transaction.
   */
  readonly swapFirstZone: ColorZone | null;
  /**
   * Anchor + zone for the eyedropper's click-anchored picker. Lives in
   * the store so any path that clears `colorTool` also clears it (no
   * orphaned picker after a toolbar toggle or multi-color disable).
   */
  readonly pickerOverlay: PickerOverlayState | null;
  /**
   * Whether the Custom-shape editor section is expanded. Tracks the toggle
   * independently of the mask because the store auto-clears fully-filled
   * masks to undefined (fast path) — we can't infer "editor should be open"
   * from `params.cellMask` alone when the user hasn't painted anything yet.
   */
  readonly shapeEditorOpen: boolean;
  /**
   * Key of the divider currently open in the Diagonal-dividers inspector,
   * or null when the panel is showing the modified-list view. Format is
   * `"{compartmentA}-{compartmentB}"` (canonical pair). The hook derives
   * the actual row from this lazily, so a stale key after a grid mutation
   * harmlessly falls back to list mode.
   */
  readonly selectedDividerKey: string | null;
  /**
   * Key of the divider being hovered (either in the list or on the 2D
   * canvas). Same format as `selectedDividerKey`. Drives the bidirectional
   * highlight between list rows, canvas divider lines, and adjacent
   * compartment fills.
   */
  readonly hoveredDividerKey: string | null;
}

/** Undo/redo history for bin parameters with optional mesh cache */
export interface DesignerHistory {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
}

// Export File Name Types

/** File naming style for exports */
export type FileNameStyle = 'descriptive' | 'compact' | 'custom';

/** Export file format for the primary bin download */
export type ExportFileFormat = 'stl' | 'step' | '3mf';

/** Export filename configuration stored per design */
export interface ExportFileNameConfig {
  /** Which naming mode to use */
  readonly style: FileNameStyle;
  /** User-provided filename (without extension) for 'custom' mode */
  readonly customName: string;
  /** Export file format. Optional for backward compat with saved designs pre-format selection. */
  readonly format?: ExportFileFormat;
}

// Storage Types

/** Current thumbnail version - increment when changing thumbnail size/quality/format */
export const THUMBNAIL_VERSION = 6;

/** Saved design entry in IndexedDB */
export interface SavedDesign {
  readonly id: DesignId;
  readonly name: string;
  readonly params: BinParams;
  readonly thumbnail: string | null;
  /** Thumbnail format version for detecting outdated thumbnails */
  readonly thumbnailVersion?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Per-design export filename preference (null = use defaults) */
  readonly exportFileNameConfig: ExportFileNameConfig | null;
}

// Store Types

/** Complete designer store state */
export interface DesignerState {
  // Data
  params: BinParams;
  generation: GenerationState;
  history: DesignerHistory;
  wasmStatus: WasmStatus;
  ui: DesignerUIState;
  /** Transaction nesting depth — when > 0, pushHistoryEntry is suppressed */
  transactionDepth: number;

  // Persistence
  currentDesignId: string | null;
  designName: string;
  saveStatus: SaveStatus;
  exportFileNameConfig: ExportFileNameConfig;
  pendingBinLink: string | null;
  /** True when we need to capture thumbnail after next successful generation */
  needsThumbnailUpdate: boolean;

  // Param actions
  setParam: <K extends keyof BinParams>(key: K, value: BinParams[K]) => void;
  setParams: (partial: Partial<BinParams>) => void;
  resetToDefaults: () => void;

  // Scoped updaters (merge partial into nested config, push history)
  updateBase: (partial: Partial<BaseConfig>) => void;
  updateLabel: (partial: Partial<LabelTabConfig>) => void;
  updateScoop: (partial: Partial<ScoopConfig>) => void;
  updateWalls: (partial: Partial<WallConfig>) => void;
  updateWallSide: (side: WallSide, partial: Partial<WallCutout>) => void;
  updateHandles: (partial: Partial<HandleConfig>) => void;
  updateHandleSide: (side: HandleWallSide, partial: Partial<HandleSide>) => void;
  updateFeatureColors: (patch: {
    enabled?: boolean;
    body?: string;
    lip?: Partial<LipColorConfig>;
    labelTab?: string;
    base?: string;
    scoop?: string;
    dividers?: string;
    text?: string;
    lid?: string;
  }) => void;
  updateLid: (partial: Partial<LidConfig>) => void;

  // History actions
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Persistence actions
  setCurrentDesignId: (id: string | null) => void;
  setDesignName: (name: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setExportFileNameConfig: (config: ExportFileNameConfig) => void;
  setPendingBinLink: (binId: string | null) => void;
  clearPendingBinLink: () => void;
  setNeedsThumbnailUpdate: (needed: boolean) => void;
  newDesign: () => void;
  loadDesign: (design: SavedDesign) => void;

  // Compartment actions
  setCompartmentGrid: (cols: number, rows: number) => void;
  mergeCells: (cellIndices: readonly number[]) => void;
  splitCompartment: (compartmentId: number) => void;
  resetCompartments: () => void;
  setCompartmentText: (compartmentId: number, text: string) => void;

  // Angled-divider override actions
  setDividerOverride: (
    compartmentA: number,
    compartmentB: number,
    offsetStart: number,
    offsetEnd: number
  ) => void;
  removeDividerOverride: (compartmentA: number, compartmentB: number) => void;
  clearDividerOverrides: () => void;

  // Text style actions (engraved text on label tabs and cutouts)
  setTextDefaults: (partial: Partial<TextStyleDefaults>) => void;
  setLabelTabTextStyle: (overrides: TextStyleOverride | null) => void;

  // Wall pattern actions
  updateWallPattern: (partial: Partial<WallPatternConfig>) => void;

  // Cutout configuration actions
  updateCutoutConfig: (partial: Partial<CutoutConfig>) => void;

  // Insert actions
  addInsert: (insert: Insert) => void;
  removeInsert: (id: string) => void;
  updateInsert: (id: string, updates: Partial<Insert>) => void;
  clearInserts: () => void;

  // Custom bin shape
  setCellMask: (mask: CellMask | undefined) => void;

  // Cutout actions
  addCutout: (cutout: Cutout) => void;
  removeCutout: (id: string) => void;
  updateCutout: (id: string, updates: Partial<Cutout>) => void;
  clearCutouts: () => void;
  duplicateCutouts: (cutoutIds: readonly string[]) => void;
  groupCutouts: (cutoutIds: readonly string[], op?: GroupOp) => void;
  ungroupCutouts: (cutoutIds: readonly string[]) => void;
  setGroupOp: (groupId: string, op: GroupOp) => void;

  // Transaction + batch cutout actions
  startTransaction: () => void;
  commitTransaction: () => void;
  updateCutoutsBatch: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  removeCutoutsBatch: (ids: readonly string[]) => void;

  // Consolidated cutout property + z-order actions
  setCutoutProperty: (ids: readonly string[], partial: CutoutToggleProperties) => void;
  reorderCutouts: (ids: readonly string[], direction: ReorderDirection) => void;
  showAllCutouts: () => void;

  // Convenience wrappers (delegate to setCutoutProperty/reorderCutouts)
  lockCutouts: (ids: readonly string[]) => void;
  unlockCutouts: (ids: readonly string[]) => void;
  hideCutouts: (ids: readonly string[]) => void;
  showCutouts: (ids: readonly string[]) => void;
  bringForward: (ids: readonly string[]) => void;
  sendBackward: (ids: readonly string[]) => void;
  bringToFront: (ids: readonly string[]) => void;
  sendToBack: (ids: readonly string[]) => void;

  // Generation actions
  setGenerationStatus: (status: GenerationStatus) => void;
  setGenerationResult: (result: GenerationResult) => void;
  setWasmStatus: (status: WasmStatus) => void;
  pushPerfSnapshot: (snapshot: PerfSnapshot) => void;
  clearPerfHistory: () => void;

  // UI actions
  setActiveTab: (tab: DesignerTab) => void;
  setExportDialogOpen: (open: boolean) => void;
  setDesignListOpen: (open: boolean) => void;
  setWireframeMode: (enabled: boolean) => void;
  setCutoutEditorOpen: (open: boolean) => void;
  setShapeEditorOpen: (open: boolean) => void;
  setSplitViewMode: (mode: SplitViewMode) => void;
  setSplitPieceMeshes: (meshes: readonly SplitPieceMeshEntry[]) => void;
  setHoveredColorZone: (zone: HoverableZone | null) => void;
  setSelectedDividerKey: (key: string | null) => void;
  setHoveredDividerKey: (key: string | null) => void;
  /** Enter a color tool overlay, or pass null to exit any active tool. */
  setColorTool: (tool: ColorTool) => void;
  /**
   * Anchor + zone for the eyedropper picker. Pass null to dismiss; the
   * picker is also auto-cleared when `setColorTool(null)` runs or when
   * multi-color gets disabled.
   */
  setPickerOverlay: (overlay: PickerOverlayState | null) => void;
  /**
   * Pick a zone in the active flow. Behavior depends on `ui.colorTool`:
   *  - `'swap-pick-first'`: store the zone and advance to `'swap-pick-second'`
   *  - `'swap-pick-second'`: swap colors between stored zone and this one,
   *    in a single undo entry, then exit the tool — returns the pair that
   *    was swapped so the caller can show a localized toast.
   *  - any other state: no-op (eyedropper opens the picker via UI, not state)
   */
  pickSwapZone: (zone: ColorZone) => { first: ColorZone; second: ColorZone } | null;
  setPreviewCompartments: (preview: CompartmentConfig | null) => void;
  setPreviewSelection: (
    selection: {
      action: 'merge' | 'split';
      minCol: number;
      maxCol: number;
      minRow: number;
      maxRow: number;
    } | null
  ) => void;
  toggleHalfGridMode: () => void;
}
