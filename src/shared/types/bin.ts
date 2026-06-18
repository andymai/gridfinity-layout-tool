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

/** Whether an edge is exterior (outside baseplate) or a join between split pieces. */
export type BaseplateEdgeKind = 'join' | 'exterior';

/** Per-side edge classification for split baseplate pieces. */
export interface BaseplateEdges {
  readonly left: BaseplateEdgeKind;
  readonly right: BaseplateEdgeKind;
  readonly front: BaseplateEdgeKind;
  readonly back: BaseplateEdgeKind;
}

/**
 * Full baseplate parameter set for generation bridge.
 *
 * Extends core BaseplateParams with drawer dimensions (width, depth, gridUnitMm)
 * and resolved per-side padding values computed from ratio at generation time.
 */
export interface BaseplateParams {
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
   * (default 'dovetail'). 'dovetailKey' makes both seam edges female and ships a
   * separate hammered-in dovetail key instead of an integral male tongue.
   * 'snapClip' makes both seam edges blind ledged pockets and ships a separate
   * top-insert snap clip ("staple") whose barbs catch the ledges.
   */
  readonly connectorStyle?: 'dovetail' | 'dovetailKey' | 'snapClip';
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
   * Vertical stack-print configuration (experimental). Replication is applied at
   * the mesh/export level (not in the BREP solid), so the generator builds one
   * plate and the preview/export layers duplicate it. Connectors must be
   * stripped by the caller before reaching here. Omit for a single plate.
   */
  readonly stackPrint?: StackPrintParams;
}
