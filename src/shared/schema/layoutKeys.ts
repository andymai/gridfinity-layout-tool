/**
 * Key manifests for the layout document, checked against `@/core/types` at
 * compile time. See `assert.ts` for the mechanism and `keys.ts` for the
 * registry the drift tests walk.
 */

import type {
  Bin,
  Category,
  Drawer,
  DrawerOutline,
  Layer,
  Layout,
  MeasuredDrawerMm,
  OutlineVertex,
  ScrewHoleParams,
  SplitOverride,
  StackPrintParams,
  StoredBaseplateParams,
} from '@/core/types';
import type { Assert, KeysMatch } from './assert';

// Layout document

export const LAYOUT_KEYS = [
  'version',
  'name',
  'drawer',
  'printBedSize',
  'printBedDepth',
  'gridUnitMm',
  'gridUnitMmY',
  'heightUnitMm',
  'magnetAnchor',
  'categories',
  'layers',
  'bins',
  'purpose',
  'baseplateParams',
  'activeBaseplateId',
] as const;
export type _LayoutKeys = Assert<KeysMatch<keyof Layout, (typeof LAYOUT_KEYS)[number]>>;

export const DRAWER_KEYS = [
  'width',
  'depth',
  'height',
  'fractionalEdgeX',
  'fractionalEdgeY',
  'outline',
  'gridShiftX',
  'gridShiftY',
  'measuredMm',
] as const;
export type _DrawerKeys = Assert<KeysMatch<keyof Drawer, (typeof DRAWER_KEYS)[number]>>;

export const LAYER_KEYS = ['id', 'name', 'height'] as const;
export type _LayerKeys = Assert<KeysMatch<keyof Layer, (typeof LAYER_KEYS)[number]>>;

export const CATEGORY_KEYS = ['id', 'name', 'color'] as const;
export type _CategoryKeys = Assert<KeysMatch<keyof Category, (typeof CATEGORY_KEYS)[number]>>;

export const BIN_KEYS = [
  'id',
  'layerId',
  'x',
  'y',
  'width',
  'depth',
  'height',
  'clearanceHeight',
  'category',
  'label',
  'notes',
  'customProperties',
  'linkedDesignId',
  'extendToMargin',
  'marginTaper',
  'overhang',
  'locked',
  'pairId',
  'pairRole',
] as const;
export type _BinKeys = Assert<KeysMatch<keyof Bin, (typeof BIN_KEYS)[number]>>;

export const MARGIN_TAPER_KEYS = ['profile', 'bandHeight', 'enabled', 'flare'] as const;
export type _MarginTaperKeys = Assert<
  KeysMatch<keyof NonNullable<Bin['marginTaper']>, (typeof MARGIN_TAPER_KEYS)[number]>
>;

export const OUTLINE_VERTEX_KEYS = ['x', 'y', 'bulge'] as const;
export type _OutlineVertexKeys = Assert<
  KeysMatch<keyof OutlineVertex, (typeof OUTLINE_VERTEX_KEYS)[number]>
>;

export const DRAWER_OUTLINE_KEYS = ['vertices', 'authoring'] as const;
export type _DrawerOutlineKeys = Assert<
  KeysMatch<keyof DrawerOutline, (typeof DRAWER_OUTLINE_KEYS)[number]>
>;

export const OUTLINE_AUTHORING_KEYS = ['kind', 'corners'] as const;
export type _OutlineAuthoringKeys = Assert<
  KeysMatch<keyof NonNullable<DrawerOutline['authoring']>, (typeof OUTLINE_AUTHORING_KEYS)[number]>
>;

export const CORNER_CUT_PARAMS_KEYS = ['tl', 'tr', 'bl', 'br'] as const;

export const MEASURED_DRAWER_KEYS = ['width', 'depth', 'height'] as const;
export type _MeasuredDrawerKeys = Assert<
  KeysMatch<keyof MeasuredDrawerMm, (typeof MEASURED_DRAWER_KEYS)[number]>
>;

// Baseplate parameters, carried inside the layout document

export const BASEPLATE_PARAMS_KEYS = [
  'magnetHoles',
  'magnetDiameter',
  'magnetDepth',
  'paddingLeft',
  'paddingRight',
  'paddingFront',
  'paddingBack',
  'paddingAnchor',
  'overTile',
  'overTileHalfGrid',
  'overTileHalfGridSolidLeftover',
  'wholeCellsOnly',
  'connectorNubs',
  'lightweight',
  'solidFloor',
  'solidFloorThickness',
  'syncWithLayout',
  'baseplateWidth',
  'baseplateDepth',
  'invertDovetails',
  'preferIdenticalPieces',
  'connectorStyle',
  'connectorSlotsAllEdges',
  'connectorFitOffset',
  'cornerRadius',
  'cornerRadii',
  'fractionalEdgeX',
  'fractionalEdgeY',
  'detachMargins',
  'detachMarginConnector',
  'stackPrint',
  'splitOverride',
  'screwHoles',
] as const;
export type _BaseplateParamsKeys = Assert<
  KeysMatch<keyof StoredBaseplateParams, (typeof BASEPLATE_PARAMS_KEYS)[number]>
>;

export const CORNER_RADII_KEYS = ['tl', 'tr', 'bl', 'br'] as const;
export type _CornerRadiiKeys = Assert<
  KeysMatch<
    keyof NonNullable<StoredBaseplateParams['cornerRadii']>,
    (typeof CORNER_RADII_KEYS)[number]
  >
>;

export const STACK_PRINT_KEYS = ['enabled', 'gapMm', 'copies'] as const;
export type _StackPrintKeys = Assert<
  KeysMatch<keyof StackPrintParams, (typeof STACK_PRINT_KEYS)[number]>
>;

export const SPLIT_OVERRIDE_KEYS = ['cols', 'rows'] as const;
export type _SplitOverrideKeys = Assert<
  KeysMatch<keyof SplitOverride, (typeof SPLIT_OVERRIDE_KEYS)[number]>
>;

export const SCREW_HOLES_KEYS = [
  'enabled',
  'diameter',
  'headStyle',
  'headDiameter',
  'counterboreDepth',
  'screwsPerPiece',
] as const;
export type _ScrewHolesKeys = Assert<
  KeysMatch<keyof ScrewHoleParams, (typeof SCREW_HOLES_KEYS)[number]>
>;

export const LINKED_DESIGN_KEYS = ['id', 'name', 'params'] as const;

export const EXPORT_META_KEYS = ['exportedFrom', 'exportedAt'] as const;
