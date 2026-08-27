/**
 * Key manifests for what a bin CARRIES rather than what it is: colours,
 * engraved text, cutouts, inserts, and the companion solids (lid, knife rest).
 * Split from `binDesignKeys.ts`, which covers the bin body itself.
 *
 * See `assert.ts` for the compile-time mechanism and `keys.ts` for the
 * registry the drift tests walk.
 */

import type { MeshAsset, MeshOutlinePoint } from '@/shared/generation/meshAsset';
import type {
  AccentBandConfig,
  Cutout,
  CutoutScoopEdges,
  CutoutArrayConfig,
  CutoutConfig,
  FeatureColorConfig,
  Insert,
  KnifeRestConfig,
  KnifeSpec,
  LidConfig,
  LidGripConfig,
  LidHingeConfig,
  LidMagnetConfig,
  LidSlideConfig,
  LidTrayConfig,
  PathPoint,
  SurfaceTextConfig,
  TextOffset,
  TextStyleDefaults,
  TextStyleOverride,
} from '@/shared/types/bin';
import type { Assert, KeysMatch } from './assert';

export const FEATURE_COLOR_KEYS = [
  'enabled',
  'body',
  'lip',
  'labelTab',
  'base',
  'scoop',
  'dividers',
  'text',
  'lid',
  'lidLip',
  'topAccent',
  'bottomAccent',
] as const;
export type _FeatureColorKeys = Assert<
  KeysMatch<keyof FeatureColorConfig, (typeof FEATURE_COLOR_KEYS)[number]>
>;

export const ACCENT_BAND_KEYS = ['enabled', 'color', 'heightMm'] as const;
export type _AccentBandKeys = Assert<
  KeysMatch<keyof AccentBandConfig, (typeof ACCENT_BAND_KEYS)[number]>
>;

export const TEXT_STYLE_KEYS = [
  'font',
  'mode',
  'depth',
  'margin',
  'minFontSize',
  'maxFontSize',
  'anchor',
  'offset',
  'sizeMode',
  'fixedSize',
  'snapToScale',
  'uniformAcrossWalls',
  'tracking',
  'autoTracking',
  'textCase',
  'lineScale',
  'lineGap',
  'cutProfile',
  'draftAngleDeg',
] as const;
export type _TextStyleKeys = Assert<
  KeysMatch<keyof TextStyleDefaults, (typeof TEXT_STYLE_KEYS)[number]>
>;

export const TEXT_STYLE_OVERRIDE_KEYS = [...TEXT_STYLE_KEYS, 'fontSizeOverride'] as const;
export type _TextStyleOverrideKeys = Assert<
  KeysMatch<keyof TextStyleOverride, (typeof TEXT_STYLE_OVERRIDE_KEYS)[number]>
>;

export const TEXT_OFFSET_KEYS = ['x', 'y'] as const;
export type _TextOffsetKeys = Assert<
  KeysMatch<keyof TextOffset, (typeof TEXT_OFFSET_KEYS)[number]>
>;

export const SURFACE_TEXT_KEYS = [
  'lidText',
  'walls',
  'wallAlign',
  'style',
  'lidStyle',
  'wallStyles',
] as const;
export type _SurfaceTextKeys = Assert<
  KeysMatch<keyof SurfaceTextConfig, (typeof SURFACE_TEXT_KEYS)[number]>
>;

export const LID_CONFIG_KEYS = [
  'enabled',
  'attachment',
  'stackableTop',
  'stackLipOnly',
  'magnetHoles',
  'separateStackPlate',
  'clickRails',
  'clickRailCoverage',
  'extraHeightMm',
  'topThicknessMm',
  'retentionMagnet',
  'tray',
  'grip',
  'relieveInterior',
  'slide',
  'hinge',
  'cutouts',
] as const;
export type _LidConfigKeys = Assert<KeysMatch<keyof LidConfig, (typeof LID_CONFIG_KEYS)[number]>>;

export const LID_MAGNET_KEYS = ['diameter', 'depth', 'edgeMagnets'] as const;
export type _LidMagnetKeys = Assert<
  KeysMatch<keyof LidMagnetConfig, (typeof LID_MAGNET_KEYS)[number]>
>;

export const LID_TRAY_KEYS = ['enabled', 'depthMm', 'wallMm'] as const;
export type _LidTrayKeys = Assert<KeysMatch<keyof LidTrayConfig, (typeof LID_TRAY_KEYS)[number]>>;

export const LID_GRIP_KEYS = ['mode', 'sides', 'coverage', 'heightMm', 'binDip'] as const;
export type _LidGripKeys = Assert<KeysMatch<keyof LidGripConfig, (typeof LID_GRIP_KEYS)[number]>>;

export const LID_HINGE_KEYS = ['side', 'catchMode', 'fitClearanceMm'] as const;
export type _LidHingeKeys = Assert<
  KeysMatch<keyof LidHingeConfig, (typeof LID_HINGE_KEYS)[number]>
>;

export const LID_SLIDE_KEYS = ['placement', 'entrySide', 'clearanceMm', 'pull', 'detent'] as const;
export type _LidSlideKeys = Assert<
  KeysMatch<keyof LidSlideConfig, (typeof LID_SLIDE_KEYS)[number]>
>;

export const KNIFE_REST_KEYS = [
  'enabled',
  'style',
  'gapMm',
  'depthU',
  'grooveDepthMm',
  'color',
] as const;
export type _KnifeRestKeys = Assert<
  KeysMatch<keyof KnifeRestConfig, (typeof KNIFE_REST_KEYS)[number]>
>;

export const CUTOUT_CONFIG_KEYS = ['topOffset', 'fillReference'] as const;
export type _CutoutConfigKeys = Assert<
  KeysMatch<keyof CutoutConfig, (typeof CUTOUT_CONFIG_KEYS)[number]>
>;

export const CUTOUT_KEYS = [
  'id',
  'shape',
  'x',
  'y',
  'width',
  'depth',
  'cutDepth',
  'rotation',
  'cornerRadius',
  'label',
  'groupId',
  'groupOp',
  'parentGroups',
  'scoopRadiusW',
  'scoopRadiusD',
  'scoopEdges',
  'name',
  'locked',
  'hidden',
  'zIndex',
  'path',
  'sides',
  'clearance',
  'chamferWidth',
  'leanDeg',
  'array',
  'engraveLabel',
  'textSide',
  'textAnchor',
  'textOffset',
  'textAngle',
  'textStyle',
  'color',
  'colorScope',
  'labelMode',
  'labelPlateWidthU',
  'labelIcon',
  'meshId',
  'knife',
] as const;
export type _CutoutKeys = Assert<KeysMatch<keyof Cutout, (typeof CUTOUT_KEYS)[number]>>;

export const CUTOUT_ARRAY_KEYS = [
  'mode',
  'cols',
  'rows',
  'pitchX',
  'pitchY',
  'count',
  'radius',
  'startAngle',
  'rotateToCenter',
  'labels',
] as const;
export type _CutoutArrayKeys = Assert<
  KeysMatch<keyof CutoutArrayConfig, (typeof CUTOUT_ARRAY_KEYS)[number]>
>;

export const KNIFE_SPEC_KEYS = [
  'presetId',
  'bladeLengthMm',
  'heelHeightMm',
  'spineThicknessMm',
  'handleWidthMm',
  'handleHeightMm',
  'openEnd',
] as const;
export type _KnifeSpecKeys = Assert<KeysMatch<keyof KnifeSpec, (typeof KNIFE_SPEC_KEYS)[number]>>;

export const INSERT_KEYS = [
  'id',
  'templateId',
  'shape',
  'x',
  'y',
  'width',
  'depth',
  'cutDepth',
  'rotation',
  'cornerRadius',
  'label',
] as const;
export type _InsertKeys = Assert<KeysMatch<keyof Insert, (typeof INSERT_KEYS)[number]>>;

export const PATH_POINT_KEYS = ['x', 'y', 'handleIn', 'handleOut', 'symmetric'] as const;
export type _PathPointKeys = Assert<KeysMatch<keyof PathPoint, (typeof PATH_POINT_KEYS)[number]>>;

export const BEZIER_HANDLE_KEYS = ['dx', 'dy'] as const;
export type _BezierHandleKeys = Assert<
  KeysMatch<keyof NonNullable<PathPoint['handleIn']>, (typeof BEZIER_HANDLE_KEYS)[number]>
>;

export const CUTOUT_SCOOP_EDGES_KEYS = ['left', 'right', 'front', 'back'] as const;
export type _CutoutScoopEdgesKeys = Assert<
  KeysMatch<keyof CutoutScoopEdges, (typeof CUTOUT_SCOOP_EDGES_KEYS)[number]>
>;

export const MESH_OUTLINE_POINT_KEYS = ['x', 'y'] as const;
export type _MeshOutlinePointKeys = Assert<
  KeysMatch<keyof MeshOutlinePoint, (typeof MESH_OUTLINE_POINT_KEYS)[number]>
>;

export const MESH_ASSET_KEYS = ['name', 'data', 'triangleCount', 'sizeMm', 'outlines'] as const;
export type _MeshAssetKeys = Assert<KeysMatch<keyof MeshAsset, (typeof MESH_ASSET_KEYS)[number]>>;
