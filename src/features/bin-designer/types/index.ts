/**
 * Bin Designer type definitions.
 *
 * Core types for parametric Gridfinity bin configuration,
 * generation state, and designer UI state.
 */

import type { SaveStatus } from '@/shared/types/saveStatus';

export type {
  ColorZone,
  FeatureColorConfig,
  HoverableZone,
  LipColorConfig,
  TopAccentConfig,
} from './featureColors';

export type {
  TextMode,
  TextFontFamily,
  CutoutTextSide,
  CutoutTextAnchor,
  CutoutTextOffset,
  TextStyleDefaults,
  TextStyleOverride,
  SurfaceTextConfig,
  WallTextSide,
  WallTextVerticalAlign,
} from './text';
export {
  TEXT_MAX_LENGTH,
  TEXT_SIDE_TO_ANCHOR,
  withFontSizeOverride,
  WALL_TEXT_SIDES,
  WALL_TEXT_ALIGNS,
} from './text';

export type {
  LidConfig,
  LidClickRails,
  LidRailSide,
  LidAttachment,
  LidMagnetConfig,
  LidTrayConfig,
  LidGripConfig,
  LidGripMode,
  LidGripSides,
  LidGripDepthPlan,
  LidGripHeightPlan,
  LidSlideConfig,
  LidSlidePlacement,
  LidSlidePull,
} from './lid';
export {
  DEFAULT_LID_CONFIG,
  DEFAULT_LID_SLIDE_CONFIG,
  LID_SLIDE_PLACEMENTS,
  LID_SLIDE_PULLS,
  LID_SLIDE_CLEARANCE_MIN_MM,
  LID_SLIDE_CLEARANCE_MAX_MM,
  LID_SLIDE_CLEARANCE_DEFAULT_MM,
  LID_SLIDE_CLEARANCE_STEP_MM,
  isSlideLid,
  LID_FIT_CLEARANCE,
  LID_MIN_CORNER_RADIUS,
  LID_CLICK_RAIL_BUMP,
  LID_CLICK_RAIL_ENTRY_CHAMFER,
  LID_CLICK_RAIL_EXIT_CHAMFER,
  LID_CLICK_RAIL_DROP,
  LID_CLICK_RAIL_TAIL,
  LID_CLICK_RAIL_SHOULDER,
  LID_CLICK_RAIL_TOP_CHAMFER,
  LID_CLICK_RAIL_OUT,
  LID_CLICK_RAIL_INNER,
  LID_CLICK_RAIL_DROP_BELOW_WALL,
  LID_CLICK_RAIL_BAND_BELOW_WALL_TOP,
  trayBottomSkirtDepth,
  LID_MAGNETIC_EXTRA_CLEARANCE,
  resolveLidFootprintClearance,
  resolveLidPlateThickness,
  resolveLidTrayBreakdown,
  resolveLidCavityExtraMm,
  LID_EXTRA_HEIGHT,
  LID_MAGNET_SEAT_GAP,
  lidAnchorZ,
  lidWallBottomZ,
  lidRetentionInterfaceZ,
  LID_CORNER_RADIUS,
  LID_TOP_THICKNESS_BASE,
  LID_TOP_THICKNESS_MIN_MM,
  LID_TOP_THICKNESS_MAX_MM,
  LID_TOP_THICKNESS_STEP_MM,
  LID_MAGNET_CEILING,
  LID_TRAY_FLOOR,
  LID_MIN_RAIL_LENGTH,
  LID_CLICK_RAIL_COVERAGE_OPTIONS,
  LID_RAIL_SIDES,
  LID_ATTACHMENTS,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_STEP_MM,
  LID_MAGNET_DIAMETER_MIN_MM,
  LID_MAGNET_DIAMETER_MAX_MM,
  LID_MAGNET_DEPTH_MIN_MM,
  LID_MAGNET_DEPTH_MAX_MM,
  LID_MAGNET_DIMENSION_STEP_MM,
  LID_MAGNET_EDGE_COUNT_MIN,
  LID_MAGNET_EDGE_COUNT_MAX,
  LID_MAGNET_EDGE_COUNT_STEP,
  LID_TRAY_DEPTH_MIN_MM,
  LID_TRAY_DEPTH_MAX_MM,
  LID_TRAY_WALL_MIN_MM,
  LID_TRAY_WALL_MAX_MM,
  LID_TRAY_DIMENSION_STEP_MM,
  LID_MAGNET_LIP_CLEARANCE,
  LID_MAGNET_BOSS_WALL,
  retentionBossRadius,
  retentionMagnetInset,
  MAX_LID_CUTOUTS,
  LID_GRIP_MODES,
  LID_GRIP_SPAN_MIN_MM,
  LID_GRIP_SPAN_MAX_MM,
  LID_GRIP_COVERAGE_MIN,
  LID_GRIP_COVERAGE_MAX,
  LID_GRIP_COVERAGE_STEP,
  LID_GRIP_COVERAGE_DEFAULT,
  LID_GRIP_MIN_WALL_MM,
  LID_GRIP_MIN_USEFUL_DEPTH_MM,
  LID_GRIP_CHAMFER_MM,
  LID_GRIP_REVEAL_DEPTH_MM,
  LID_GRIP_REVEAL_HEIGHT_MM,
  LID_GRIP_SCALLOP_DEPTH_MM,
  LID_GRIP_SCALLOP_HEIGHT_MM,
  LID_GRIP_TOP_SKIN_MM,
  LID_GRIP_HEIGHT_MIN_MM,
  LID_GRIP_HEIGHT_MAX_MM,
  LID_GRIP_HEIGHT_STEP_MM,
  resolveLidGripHeightPlan,
  lidGripRequestedHeightMm,
  lidGripHeightAdjustable,
  resolveLidGripSpanMm,
  resolveLidGripDepth,
  lidGripRequestedDepthMm,
  lidGripHeightMm,
  hasLidGrip,
  hasAnyLidGripSide,
  hasBinLipDip,
  lidGripModeAllowed,
} from './lid';

// Bin Configuration Types

export type {
  CutoutShape,
  GroupOp,
  CutoutScoopEdges,
  PathPoint,
  ReorderDirection,
  CutoutToggleProperties,
  CutoutConfig,
  Cutout,
  CutoutColorScope,
  CutoutArrayMode,
  CutoutArrayConfig,
  CutoutLabelMode,
  KnifeSpec,
  KnifeSlotOpenEnd,
} from './cutout';
export {
  DEFAULT_GROUP_OP,
  DEFAULT_CUTOUT_COLOR_SCOPE,
  GROUP_OPS,
  DEFAULT_SCOOP_EDGES,
  MIN_PATH_POINTS,
  MIN_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  DEFAULT_POLYGON_SIDES,
  DEFAULT_CUTOUT_CLEARANCE,
  CLEARANCE_SHAPES,
  defaultEntryChamfer,
  maxEntryChamfer,
  MAX_CUTOUT_CLEARANCE,
  MAX_CUTOUT_CHAMFER,
  CHAMFER_SHAPES,
  CUTOUT_ARRAY_MODES,
  MAX_ARRAY_INSTANCES,
  MAX_ARRAY_COUNT,
  CUTOUT_LABEL_MODES,
  DEFAULT_KNIFE_SPEC,
} from './cutout';

export type { KnifeRestStyle, KnifeRestConfig, KnifeSlotDimensions } from './knifeBlock';
export {
  KNIFE_SLOT_LENGTH_MARGIN,
  KNIFE_SLOT_WIDTH_CLEARANCE,
  KNIFE_SLOT_MIN_WIDTH,
  KNIFE_SLOT_EDGE_FLOAT,
  KNIFE_SLOT_DEFAULT_CHAMFER,
  knifeSlotDimensions,
  KNIFE_REST_DEFAULT_GAP_MM,
  KNIFE_REST_GROOVE_DEPTH_MM,
  KNIFE_REST_GROOVE_EXTRA_WIDTH_MM,
  KNIFE_REST_HANDLE_DROP_MM,
  KNIFE_REST_MAX_GAP_MM,
  KNIFE_REST_MIN_DEPTH_U,
  KNIFE_REST_MAX_DEPTH_U,
  KNIFE_REST_MIN_GROOVE_DEPTH_MM,
  KNIFE_REST_MAX_GROOVE_DEPTH_MM,
  knifeRestStyle,
  knifeRestGrooveWidthMm,
  knifeRestSaddleZMm,
  knifeRestBodyTopZMm,
} from './knifeBlock';

// Generation Types

/** Auto-save status indicator. Defined in shared — the baseplate page uses it too. */
export type { SaveStatus };

export type { ExampleDesign } from './exampleGallery';
export type { ExampleTechnique } from '@/shared/types/exampleTechniques';
export { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';

export * from './base';
export * from './dividers';
export * from './compartments';
export * from './interior';
export * from './labelTabs';
export * from './handles';
export * from './walls';
export * from './slide';
export * from './floor';
export * from './splitConnector';
export * from './binParams';
export * from './generation';
export * from './uiState';
export * from './savedDesign';
export * from './designerState';
