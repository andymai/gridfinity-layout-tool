/**
 * Re-exports bin parameter types for cross-feature consumption.
 *
 * The canonical type definitions live in features/bin-designer/types.
 * This barrel export allows other features (e.g., generation) to
 * depend on these types without a cross-feature import violation.
 */
import type { StackPrintParams } from '@/core/types';

export type {
  ExportFileFormat,
  FileNameStyle,
  ExportFileNameConfig,
  BinParams,
  BaseConfig,
  BaseStyle,
  BinStyle,
  CompartmentConfig,
  ScoopConfig,
  LabelTabConfig,
  LabelTabAlignment,
  LabelTabEdges,
  WallCutout,
  WallCutoutShape,
  WallConfig,
  WallSide,
  SlotConfig,
  AxisSlotConfig,
  DividerPieceConfig,
  Insert,
  InsertShape,
  Cutout,
  CutoutShape,
  CutoutColorScope,
  CutoutArrayConfig,
  CutoutScoopEdges,
  GroupOp,
  PathPoint,
  WallPatternConfig,
  WallPatternType,
  SplitConnectorConfig,
  WallConnectorStyle,
  HandleConfig,
  HandleCutoutShape,
  HandleSide,
  HandleWallSide,
  LidConfig,
  FeatureColorConfig,
  TextMode,
  TextFontFamily,
  CutoutTextSide,
  CutoutTextAnchor,
  CutoutTextOffset,
  TextStyleDefaults,
  TextStyleOverride,
  DividerOverride,
  OverhangConfig,
} from '@/features/bin-designer/types';

export {
  MIN_PATH_POINTS,
  LID_FIT_CLEARANCE,
  LID_CORNER_RADIUS,
  LID_TOP_THICKNESS_BASE,
  LID_MAGNET_CEILING,
  LID_MIN_RAIL_LENGTH,
  DEFAULT_SCOOP_EDGES,
  DEFAULT_GROUP_OP,
  DEFAULT_CUTOUT_COLOR_SCOPE,
  GROUP_OPS,
  TEXT_MAX_LENGTH,
  MIN_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  DEFAULT_POLYGON_SIDES,
  CLEARANCE_SHAPES,
  CHAMFER_SHAPES,
  MAX_ARRAY_INSTANCES,
} from '@/features/bin-designer/types';

/**
 * Re-export lid policy helpers so worker-side code can ask "should we
 * generate a lid?" without importing across the feature boundary.
 */
export {
  shouldGenerateLid,
  checkLidCompatibility,
  hasLidBlocker,
  computeDisabledRails,
} from '@/features/bin-designer/utils/lidCompatibility';

/**
 * Re-export compartment-edge predicates so worker-side feature builders
 * (scoop ramps, label tabs) can ask "does this compartment have a tilted
 * boundary?" without crossing the feature boundary.
 */
export {
  compartmentHasTiltedEdge,
  compartmentHasTiltedBackWall,
  compartmentHasTiltedFrontWall,
  getCompartmentBounds,
  rectStraddlesTiltedDivider,
} from '@/features/bin-designer/utils/compartments';
export type {
  LidCompatibilityIssue,
  LidCompatibilityId,
  LidCompatibilitySeverity,
  LidCompatibilitySide,
} from '@/features/bin-designer/utils/lidCompatibility';

/**
 * Whether an edge is exterior (outside baseplate), a join between split pieces,
 * or a seam to a detached margin rail carrying an opt-in connector (#2414).
 * `marginSeam` is exterior-like for corner/rounding purposes but carries a
 * body↔rail tongue; it must NOT be treated as `join` (no split-piece keys).
 * Canonical edge-kind union; the baseplate feature's `EdgeKind` aliases this, so
 * extend the union here and both stay in sync.
 */
export type BaseplateEdgeKind = 'join' | 'exterior' | 'marginSeam';

/**
 * True for edges on the plate's outer boundary: a plain `exterior` edge or a
 * `marginSeam` (which is exterior + a connector tongue). Corner rounding and
 * squaring treat both identically — the body stays square there and the rail
 * owns the rounded outer corner. Do NOT use this for fingerprinting: a
 * `marginSeam` piece carries a tongue and must not dedupe with a plain
 * exterior piece.
 */
export function isExteriorEdge(kind: BaseplateEdgeKind): boolean {
  return kind === 'exterior' || kind === 'marginSeam';
}

/** Baseplate split-connector styles — derived from the param definition below
 *  so it can't drift when a style is added. */
export type BaseplateConnectorStyle = NonNullable<ResolvedBaseplateParams['connectorStyle']>;

/**
 * Whether the margin-seam connector (#2414) engages for a given connector
 * style. Scoped to the integral tongue/groove families — dovetail and puzzle —
 * because snapClip/dovetailKey would need a separate printed part the seam must
 * not emit. `undefined` is the stored default for dovetail (the ConnectorPicker
 * persists dovetail as absent), so it counts as a tongue/groove style.
 */
export function isSeamConnectorStyle(style: BaseplateConnectorStyle | undefined): boolean {
  return style === undefined || style === 'dovetail' || style === 'puzzle';
}

/** Per-side edge classification for split baseplate pieces. */
export interface BaseplateEdges {
  readonly left: BaseplateEdgeKind;
  readonly right: BaseplateEdgeKind;
  readonly front: BaseplateEdgeKind;
  readonly back: BaseplateEdgeKind;
}

/** A plate corner, named by the integral plate's exterior face pair. */
export type MarginCorner = 'tl' | 'tr' | 'bl' | 'br';

/**
 * A detached drawer-fit padding "rail" — its own printable piece (issue #2392).
 *
 * Rails butt-join: one axis pair is `long` (spans the full outer extent and owns
 * the plate corners), the perpendicular pair is `short` (fits between the long
 * rails). When a long rail is absent on an end, the adjacent short rail extends
 * to that corner and owns it instead — so every rounded outer corner of the
 * integral plate is carried by exactly one rail (see `ownedCorners`).
 *
 * Lives in shared (not the baseplate feature) so the generation worker can build
 * a rail without a cross-feature import.
 */
export interface MarginPiece {
  /** Stable id/label, e.g. "margin-front-A". */
  readonly id: string;
  readonly side: 'left' | 'right' | 'front' | 'back';
  readonly role: 'long' | 'short';
  /**
   * Column/row of the body piece this segment runs alongside. A split plate
   * emits one segment per outer body piece (so segments fit the bed and explode
   * in lockstep with their piece); an unsplit plate is a single 0,0 piece.
   */
  readonly col: number;
  readonly row: number;
  /** Extent along the rail's running axis (mm). */
  readonly lengthMm: number;
  /** Padding-band depth perpendicular to the running axis (mm). */
  readonly bandThicknessMm: number;
  /** Outer corners this rail rounds; the rest of its corners are square (seams). */
  readonly ownedCorners: readonly MarginCorner[];
  /** Rail-center position in the plate-centered world frame (mm). */
  readonly worldOffsetMm: { readonly x: number; readonly y: number };
  /**
   * Layout of the opt-in tongue-and-groove seam connector for a `long` rail
   * (absent on short/friction-fit rails). The body grows one tongue per mating
   * grid cell and the rail carves matching grooves; both sides recompute the same
   * cell-center set from `cellUnits`/`fractionalEdge` so they can't drift, and
   * `centerOffsetMm` re-anchors them onto the body wall on a corner-owning end
   * segment (which extends over the perpendicular padding and so is no longer
   * centered on the wall it joins — #2427/#2428).
   */
  readonly seamConnector?: {
    /** Grid units of the mating body wall along the rail's running axis. */
    readonly cellUnits: number;
    /** Rail-local position (mm) of the body grid center along the running axis. */
    readonly centerOffsetMm: number;
    readonly fractionalEdge: 'start' | 'end';
  };
  readonly overTile: boolean;
  readonly overTileHalfGrid: boolean;
  readonly overTileHalfGridSolidLeftover: boolean;
}

/**
 * Resolved (generation-time) full baseplate parameter set for the generation bridge.
 *
 * Extends the persisted {@link StoredBaseplateParams} with drawer dimensions
 * (width, depth, gridUnitMm) and resolved per-side padding values computed at
 * generation time. Produced from the stored config via buildFullParams.
 */
export interface ResolvedBaseplateParams {
  readonly width: number;
  readonly depth: number;
  readonly gridUnitMm: number;
  readonly magnetHoles: boolean;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly paddingFront: number;
  readonly paddingBack: number;
  /** Where the half-unit cell sits on the X axis ('start' = left, 'end' = right) */
  readonly fractionalEdgeX: 'start' | 'end';
  /** Where the half-unit cell sits on the Y axis ('start' = front, 'end' = back) */
  readonly fractionalEdgeY: 'start' | 'end';
  /**
   * Over-tile mode: fill the drawer-fit padding with functional grid instead of
   * a solid plastic margin. Each axis's leftover becomes one clipped tile on the
   * `fractionalEdge` anchor; a sub-threshold sliver falls back to solid padding.
   * Default false (standard centered grid + padding).
   */
  readonly overTile?: boolean;
  /**
   * Half-grid variant of over-tile: pack true 21mm (0.5-unit) functional
   * half-sockets into each margin before the sub-half-unit leftover falls back to
   * the standard clipped tile. Only meaningful when {@link overTile} is true.
   */
  readonly overTileHalfGrid?: boolean;
  /**
   * When half-grid is on, leave the sub-21mm leftover after the packed
   * half-sockets as solid plastic instead of a clipped grid pocket (#2397).
   * Only meaningful when {@link overTileHalfGrid} is true. Default false.
   */
  readonly overTileHalfGridSolidLeftover?: boolean;
  /** Edge classification for split pieces — omit for single (unsplit) baseplates. */
  readonly edges?: BaseplateEdges;
  /** Enable registration nubs/holes on join edges for split piece alignment. */
  readonly connectorNubs?: boolean;
  /** Swap tongue/groove convention on all join edges (default false). */
  readonly invertDovetails?: boolean;
  /**
   * When true, dovetails on join edges use a 180°-rotationally symmetric
   * pattern (M+F pair per cell boundary) so pieces of equivalent size that
   * are 180° rotations of each other share an identical canonical mesh. The
   * split planner also prefers max-uniform tilings when this is set.
   */
  readonly preferIdenticalPieces?: boolean;
  /**
   * Connector geometry on join edges when `connectorNubs` is enabled
   * (default 'dovetail'). 'puzzle' is a stronger integral jigsaw-tab connector
   * that mechanically locks (legacy 'dovetail' is an unchanged near-flat slip fit).
   * 'dovetailKey' makes both seam edges female and ships a separate hammered-in
   * dovetail key instead of an integral male tongue. 'snapClip' makes both seam
   * edges blind ledged pockets and ships a separate top-insert snap clip
   * ("staple") whose barbs catch the ledges.
   */
  readonly connectorStyle?: 'dovetail' | 'puzzle' | 'dovetailKey' | 'snapClip';
  /**
   * User fit offset (mm) added to the per-side groove clearance to compensate
   * for printer/filament variation (issue #2024). Positive = looser, negative =
   * tighter; clamped so effective clearance never goes negative. Default 0
   * leaves the nominal clearance unchanged. See `effectiveClearance` in
   * `@/shared/constants/connectors`.
   */
  readonly connectorFitOffset?: number;
  /**
   * Nozzle diameter (mm) the baseplate + connectors print with. Dovetail-key and
   * snap-clip feature sizes and pocket clearances scale up with it so they stay
   * printable on wider nozzles. Omitted/undefined = 0.4mm baseline (geometry
   * unchanged from pre-nozzle-aware behavior). Mirrors `settings.printSettings.nozzleSizeMm`.
   */
  readonly nozzleSizeMm?: number;
  /** Remove center floor material, keeping only magnet pads. */
  readonly lightweight?: boolean;
  /** Uniform outer corner radius in mm. */
  readonly cornerRadius?: number;
  /** Per-corner radius overrides (tl/tr/bl/br in mm). */
  readonly cornerRadii?: {
    readonly tl: number;
    readonly tr: number;
    readonly bl: number;
    readonly br: number;
  };
  /**
   * Detach the drawer-fit padding into separate printable rail pieces. When set,
   * the body slab is generated padding-free on detached sides and the margin
   * rails are emitted as `BaseplateTiling.margins`. Mutually exclusive with
   * `stackPrint` (stackPrint wins). Omit/false = padding stays integral.
   */
  readonly detachMargins?: boolean;
  /**
   * Opt-in body↔long-rail connector for detached margins (#2414). When true and
   * `detachMargins` is set, the detached exterior seam becomes a `marginSeam`
   * edge carrying a tongue (body side) that mates a groove in the rail, using
   * the body's `connectorStyle`. Scoped to long rails; short rails/corners stay
   * friction-fit. Omit/false = friction-fit only.
   */
  readonly detachMarginConnector?: boolean;
  /**
   * Vertical stack-print configuration (experimental). Replication is applied at
   * the mesh/export level (not in the BREP solid), so the generator builds one
   * plate and the preview/export layers duplicate it. Connectors must be
   * stripped by the caller before reaching here. Omit for a single plate.
   */
  readonly stackPrint?: StackPrintParams;
}
