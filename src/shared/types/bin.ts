/**
 * Re-exports bin parameter types for cross-feature consumption.
 *
 * The canonical type definitions live in features/bin-designer/types.
 * This barrel export allows other features (e.g., generation) to
 * depend on these types without a cross-feature import violation.
 */
export type {
  ExportFileFormat,
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
} from '@/features/bin-designer/types';

export { MIN_PATH_POINTS } from '@/features/bin-designer/types';

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
}
