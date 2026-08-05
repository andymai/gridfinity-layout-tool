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
} from './lid';
export {
  DEFAULT_LID_CONFIG,
  LID_FIT_CLEARANCE,
  LID_CLICK_RAIL_BUMP,
  LID_CLICK_RAIL_ENTRY_CHAMFER,
  LID_CLICK_RAIL_EXIT_CHAMFER,
  LID_CLICK_RAIL_DROP,
  LID_CLICK_RAIL_TAIL,
  LID_CLICK_RAIL_SHOULDER,
  LID_CLICK_RAIL_DROP_BELOW_WALL,
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
} from './cutout';

// Generation Types

/** Auto-save status indicator. Defined in shared — the baseplate page uses it too. */
export type { SaveStatus };

export type { ExampleDesign } from './exampleGallery';
export type { ExampleTechnique } from '@/shared/types/exampleTechniques';
export { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';

export * from './base';
export * from './dividers';
export * from './compartments';
export * from './labelTabs';
export * from './handles';
export * from './walls';
export * from './floor';
export * from './splitConnector';
export * from './binParams';
export * from './generation';
export * from './uiState';
export * from './savedDesign';
export * from './designerState';
