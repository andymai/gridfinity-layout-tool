/**
 * Key manifests for the bin BODY: dimensions, base, compartments, walls,
 * label tabs, handles, dividers and overhang. What a bin carries (colours,
 * text, cutouts, lid) lives in `binContentKeys.ts`. See `assert.ts` for the mechanism and `keys.ts` for
 * the registry the drift tests walk.
 */

import type { CellMask } from '@/shared/utils/cellMask';
import type {
  AxisSlotConfig,
  BaseConfig,
  BinParams,
  CompartmentConfig,
  DividerOverride,
  DividerPieceConfig,
  FloorPatternConfig,
  HandleConfig,
  HandleSide,
  LabelTabConfig,
  LidClickRails,
  OverhangConfig,
  ScoopConfig,
  SlideConfig,
  SlotConfig,
  SplitConnectorConfig,
  StashedCompartment,
  TrayBottomConfig,
  WallConfig,
  WallCutout,
  WallPatternConfig,
  WallPatternSides,
  WallTaperConfig,
} from '@/shared/types/bin';
import type { Assert, KeysMatch } from './assert';

// Bin design document

export const OVERHANG_KEYS = [
  'enabled',
  'left',
  'right',
  'front',
  'back',
  'feet',
  'taper',
] as const;
export type _OverhangKeys = Assert<KeysMatch<keyof OverhangConfig, (typeof OVERHANG_KEYS)[number]>>;

export const WALL_TAPER_KEYS = [
  'enabled',
  'profile',
  'bandHeight',
  'left',
  'right',
  'front',
  'back',
] as const;
export type _WallTaperKeys = Assert<
  KeysMatch<keyof WallTaperConfig, (typeof WALL_TAPER_KEYS)[number]>
>;

export const BIN_PARAMS_KEYS = [
  'width',
  'depth',
  'height',
  'fractionalEdgeX',
  'fractionalEdgeY',
  'fractionalEdgeManualX',
  'fractionalEdgeManualY',
  'gridUnitMm',
  'gridUnitMmY',
  'magnetAnchor',
  'nozzleSizeMm',
  'heightUnitMm',
  'wallThickness',
  'base',
  'style',
  'compartments',
  'scoop',
  'label',
  'walls',
  'slide',
  'handles',
  'slotConfig',
  'dividerPieces',
  'inserts',
  'cutouts',
  'cutoutConfig',
  'meshAssets',
  'cutoutGroupNames',
  'wallPattern',
  'floorPattern',
  'splitConnectors',
  'featureColors',
  'textDefaults',
  'surfaceText',
  'lid',
  'knifeRest',
  'cellMask',
  'overhang',
  'extraWallHeightMm',
] as const;
export type _BinParamsKeys = Assert<KeysMatch<keyof BinParams, (typeof BIN_PARAMS_KEYS)[number]>>;

export const BASE_CONFIG_KEYS = [
  'style',
  'magnetDiameter',
  'magnetDepth',
  'screwDiameter',
  'stackingLip',
  'solid',
  'halfSockets',
  'footLatticeX',
  'footLatticeY',
  'lightweight',
  'lightweightMode',
  'feet',
  'feetPinDiameter',
  'spacer',
  'tile',
  'trayBottom',
] as const;
export type _BaseConfigKeys = Assert<
  KeysMatch<keyof BaseConfig, (typeof BASE_CONFIG_KEYS)[number]>
>;

export const TRAY_BOTTOM_KEYS = [
  'attachment',
  'extraHeightMm',
  'clickRails',
  'clickRailCoverage',
  'retentionMagnet',
] as const;
export type _TrayBottomKeys = Assert<
  KeysMatch<keyof TrayBottomConfig, (typeof TRAY_BOTTOM_KEYS)[number]>
>;

export const COMPARTMENT_CONFIG_KEYS = [
  'cols',
  'rows',
  'thickness',
  'cells',
  'compartmentTexts',
  'labelPlateWidths',
  'labelIcons',
  'compartmentColors',
  'compartmentColorScopes',
  'dividerOverrides',
  'drawnUnitCells',
  'stash',
  'dividerHeight',
  'mergeBackground',
  'backgroundIds',
] as const;
export type _CompartmentConfigKeys = Assert<
  KeysMatch<keyof CompartmentConfig, (typeof COMPARTMENT_CONFIG_KEYS)[number]>
>;

export const DIVIDER_OVERRIDE_KEYS = [
  'compartmentA',
  'compartmentB',
  'offsetStart',
  'offsetEnd',
  'rakeDeg',
] as const;
export type _DividerOverrideKeys = Assert<
  KeysMatch<keyof DividerOverride, (typeof DIVIDER_OVERRIDE_KEYS)[number]>
>;

export const STASHED_COMPARTMENT_KEYS = ['w', 'h', 'cells', 'label'] as const;
export type _StashedCompartmentKeys = Assert<
  KeysMatch<keyof StashedCompartment, (typeof STASHED_COMPARTMENT_KEYS)[number]>
>;

export const SCOOP_CONFIG_KEYS = [
  'enabled',
  'side',
  'radius',
  'run',
  'style',
  'autoMaxHeight',
] as const;
export type _ScoopConfigKeys = Assert<
  KeysMatch<keyof ScoopConfig, (typeof SCOOP_CONFIG_KEYS)[number]>
>;

export const WALL_CONFIG_KEYS = [
  'enabled',
  'shape',
  'width',
  'depth',
  'cornerRadiusTop',
  'cornerRadiusBottom',
  'front',
  'back',
  'left',
  'right',
  'interior',
] as const;
export type _WallConfigKeys = Assert<
  KeysMatch<keyof WallConfig, (typeof WALL_CONFIG_KEYS)[number]>
>;

export const WALL_CUTOUT_KEYS = [
  'enabled',
  'width',
  'depth',
  'alignment',
  'offset',
  'widthMm',
  'cornerRadiusTop',
  'cornerRadiusBottom',
] as const;
export type _WallCutoutKeys = Assert<
  KeysMatch<keyof WallCutout, (typeof WALL_CUTOUT_KEYS)[number]>
>;

export const WALL_PATTERN_KEYS = ['enabled', 'pattern', 'scale', 'dividers', 'sides'] as const;
export type _WallPatternKeys = Assert<
  KeysMatch<keyof WallPatternConfig, (typeof WALL_PATTERN_KEYS)[number]>
>;

export const WALL_PATTERN_SIDES_KEYS = ['left', 'right', 'front', 'back'] as const;
export type _WallPatternSidesKeys = Assert<
  KeysMatch<keyof WallPatternSides, (typeof WALL_PATTERN_SIDES_KEYS)[number]>
>;

export const LABEL_TAB_KEYS = [
  'enabled',
  'mode',
  'plateFitOffset',
  'socketStyle',
  'support',
  'depth',
  'width',
  'height',
  'lip',
  'lipHeight',
  'alignment',
  'edges',
  'inset',
  'textStyle',
  'span',
  'rowTexts',
] as const;
export type _LabelTabKeys = Assert<
  KeysMatch<keyof LabelTabConfig, (typeof LABEL_TAB_KEYS)[number]>
>;

export const HANDLE_CONFIG_KEYS = [
  'enabled',
  'shape',
  'width',
  'height',
  'cornerRadius',
  'verticalPosition',
  'count',
  'chamfer',
  'interior',
  'front',
  'back',
  'left',
  'right',
] as const;
export type _HandleConfigKeys = Assert<
  KeysMatch<keyof HandleConfig, (typeof HANDLE_CONFIG_KEYS)[number]>
>;

export const HANDLE_SIDE_KEYS = ['enabled', 'width', 'height', 'cornerRadius'] as const;
export type _HandleSideKeys = Assert<
  KeysMatch<keyof HandleSide, (typeof HANDLE_SIDE_KEYS)[number]>
>;

export const SLOT_CONFIG_KEYS = [
  'x',
  'y',
  'width',
  'depth',
  'crossStyle',
  'longAxis',
  'partialStyle',
  'layout',
  'customGrid',
] as const;
export type _SlotConfigKeys = Assert<
  KeysMatch<keyof SlotConfig, (typeof SLOT_CONFIG_KEYS)[number]>
>;

export const AXIS_SLOT_KEYS = ['enabled', 'pitch'] as const;
export type _AxisSlotKeys = Assert<
  KeysMatch<keyof AxisSlotConfig, (typeof AXIS_SLOT_KEYS)[number]>
>;

export const DIVIDER_PIECE_KEYS = ['height', 'thickness', 'clearance', 'floorGroove'] as const;
export type _DividerPieceKeys = Assert<
  KeysMatch<keyof DividerPieceConfig, (typeof DIVIDER_PIECE_KEYS)[number]>
>;

export const SLIDE_CONFIG_KEYS = [
  'enabled',
  'railMount',
  'trayWidthUnits',
  'trayDepthMm',
  'trayWallMm',
  'railDropMm',
  'railProtrusionMm',
  'railThicknessMm',
  'clearanceMm',
] as const;
export type _SlideConfigKeys = Assert<
  KeysMatch<keyof SlideConfig, (typeof SLIDE_CONFIG_KEYS)[number]>
>;

export const FLOOR_PATTERN_KEYS = ['enabled', 'pattern', 'scale'] as const;
export type _FloorPatternKeys = Assert<
  KeysMatch<keyof FloorPatternConfig, (typeof FLOOR_PATTERN_KEYS)[number]>
>;

export const SPLIT_CONNECTOR_KEYS = [
  'enabled',
  'clearance',
  'tongueProtrusion',
  'tongueThickness',
  'wallConnector',
  'ridgeWidthFraction',
  'ridgeHeightFraction',
  'nozzleSizeMm',
] as const;
export type _SplitConnectorKeys = Assert<
  KeysMatch<keyof SplitConnectorConfig, (typeof SPLIT_CONNECTOR_KEYS)[number]>
>;

export const CELL_MASK_KEYS = ['cols', 'rows', 'cells'] as const;
export type _CellMaskKeys = Assert<KeysMatch<keyof CellMask, (typeof CELL_MASK_KEYS)[number]>>;

export const SIDE_FLAGS_KEYS = ['front', 'back', 'left', 'right'] as const;
export type _SideFlagsKeys = Assert<
  KeysMatch<keyof LidClickRails, (typeof SIDE_FLAGS_KEYS)[number]>
>;
