/**
 * Re-exports bin parameter types for cross-feature consumption.
 *
 * The canonical type definitions live in features/bin-designer/types.
 * This barrel export allows other features (e.g., generation) to
 * depend on these types without a cross-feature import violation.
 */
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
  PathPoint,
  WallPatternConfig,
  WallPatternType,
  SplitConnectorConfig,
  HandleConfig,
  HandleCutoutShape,
  HandleSide,
  HandleWallSide,
  LidConfig,
} from '@/features/bin-designer/types';

export {
  MIN_PATH_POINTS,
  LID_FIT_CLEARANCE,
  LID_CORNER_RADIUS,
  LID_TOP_THICKNESS_BASE,
  LID_MAGNET_CEILING,
  LID_MIN_RAIL_LENGTH,
} from '@/features/bin-designer/types';

/**
 * Re-export lid policy helpers so worker-side code can ask "should we
 * generate a lid?" without importing across the feature boundary.
 */
export {
  shouldGenerateLid,
  checkLidCompatibility,
  hasLidBlocker,
} from '@/features/bin-designer/utils/lidCompatibility';
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
  /** Edge classification for split pieces — omit for single (unsplit) baseplates. */
  readonly edges?: BaseplateEdges;
  /** Enable registration nubs/holes on join edges for split piece alignment. */
  readonly connectorNubs?: boolean;
  /** Swap tongue/groove convention on all join edges (default false). */
  readonly invertDovetails?: boolean;
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
}
