/**
 * The registry binding the published JSON Schemas to the TypeScript types they
 * describe.
 *
 * Each manifest in `layoutKeys.ts` / `binDesignKeys.ts` is checked in BOTH
 * directions at compile time: a field added to an interface without a manifest
 * entry fails `pnpm run typecheck` naming the field, and a manifest entry for
 * a field that no longer exists fails the same way. `scripts/schema/keys.test.ts`
 * closes the remaining link by asserting each manifest matches the `properties`
 * of its `$defs` entry in the shipped schema, so type -> manifest -> schema
 * cannot drift apart.
 */

export * from './assert';
export * from './layoutKeys';
export * from './binDesignKeys';
export * from './binContentKeys';

import {
  BASEPLATE_PARAMS_KEYS,
  BIN_KEYS,
  CATEGORY_KEYS,
  CORNER_CUT_PARAMS_KEYS,
  CORNER_RADII_KEYS,
  DRAWER_KEYS,
  DRAWER_OUTLINE_KEYS,
  EXPORT_META_KEYS,
  LAYER_KEYS,
  LAYOUT_KEYS,
  LINKED_DESIGN_KEYS,
  MARGIN_TAPER_KEYS,
  MEASURED_DRAWER_KEYS,
  OUTLINE_AUTHORING_KEYS,
  OUTLINE_VERTEX_KEYS,
  SCREW_HOLES_KEYS,
  SPLIT_OVERRIDE_KEYS,
  STACK_PRINT_KEYS,
} from './layoutKeys';
import {
  AXIS_SLOT_KEYS,
  BASE_CONFIG_KEYS,
  BIN_PARAMS_KEYS,
  CELL_MASK_KEYS,
  COMPARTMENT_CONFIG_KEYS,
  DIVIDER_OVERRIDE_KEYS,
  DIVIDER_PIECE_KEYS,
  FLOOR_PATTERN_KEYS,
  HANDLE_CONFIG_KEYS,
  HANDLE_SIDE_KEYS,
  LABEL_TAB_KEYS,
  OVERHANG_KEYS,
  SCOOP_CONFIG_KEYS,
  SIDE_FLAGS_KEYS,
  SLIDE_CONFIG_KEYS,
  SLOT_CONFIG_KEYS,
  SPLIT_CONNECTOR_KEYS,
  STASHED_COMPARTMENT_KEYS,
  TRAY_BOTTOM_KEYS,
  WALL_CONFIG_KEYS,
  WALL_CUTOUT_KEYS,
  WALL_PATTERN_KEYS,
  WALL_PATTERN_SIDES_KEYS,
  WALL_TAPER_KEYS,
} from './binDesignKeys';
import {
  ACCENT_BAND_KEYS,
  BEZIER_HANDLE_KEYS,
  CUTOUT_ARRAY_KEYS,
  CUTOUT_CONFIG_KEYS,
  CUTOUT_KEYS,
  FEATURE_COLOR_KEYS,
  INSERT_KEYS,
  KNIFE_REST_KEYS,
  KNIFE_SPEC_KEYS,
  LID_CONFIG_KEYS,
  LID_GRIP_KEYS,
  LID_HINGE_KEYS,
  LID_MAGNET_KEYS,
  LID_SLIDE_KEYS,
  LID_TRAY_KEYS,
  MESH_ASSET_KEYS,
  MESH_OUTLINE_POINT_KEYS,
  PATH_POINT_KEYS,
  SURFACE_TEXT_KEYS,
  TEXT_OFFSET_KEYS,
  TEXT_STYLE_KEYS,
  TEXT_STYLE_OVERRIDE_KEYS,
} from './binContentKeys';

/**
 * The layout FILE is a `Layout` plus an export envelope: `_meta` (stripped on
 * import), `linkedDesigns` (written by "export with designs"), and an optional
 * `$schema` pointer. Those three are document concerns, not layout state, so
 * they live here rather than in {@link LAYOUT_KEYS}.
 */
export const LAYOUT_DOCUMENT_KEYS = [...LAYOUT_KEYS, 'linkedDesigns', '_meta', '$schema'] as const;

/** The bin design FILE is a wrapper around `BinParams`, not a flat spread. */
export const BIN_DESIGN_DOCUMENT_KEYS = [
  'type',
  'version',
  'name',
  'params',
  '_meta',
  '$schema',
] as const;

/** Root-level property manifests, keyed by schema file name. */
export const SCHEMA_ROOT_KEYS = {
  'layout.schema.json': LAYOUT_DOCUMENT_KEYS,
  'bin-design.schema.json': BIN_DESIGN_DOCUMENT_KEYS,
} as const satisfies Record<string, readonly string[]>;

/**
 * `$defs` with no fixed key set to check: `CornerCut` is a discriminated union
 * expressed as `oneOf` with no top-level `properties`, and `CustomProperties`
 * is a `Record<string, string>`. `keys.test.ts` skips them rather than
 * asserting an empty manifest.
 */
export const UNCHECKED_DEFS = ['CornerCut', 'CustomProperties'] as const;

/**
 * Every checked `$def` name mapped to its manifest. `keys.test.ts` walks this
 * against the shipped schemas, so a `$def` added without a manifest (or a
 * manifest without a `$def`) fails.
 */
export const SCHEMA_KEYS = {
  AccentBandConfig: ACCENT_BAND_KEYS,
  AxisSlotConfig: AXIS_SLOT_KEYS,
  BaseConfig: BASE_CONFIG_KEYS,
  BezierHandle: BEZIER_HANDLE_KEYS,
  BaseplateParams: BASEPLATE_PARAMS_KEYS,
  Bin: BIN_KEYS,
  BinParams: BIN_PARAMS_KEYS,
  Category: CATEGORY_KEYS,
  CellMask: CELL_MASK_KEYS,
  CompartmentConfig: COMPARTMENT_CONFIG_KEYS,
  CornerCutParams: CORNER_CUT_PARAMS_KEYS,
  CornerRadii: CORNER_RADII_KEYS,
  Cutout: CUTOUT_KEYS,
  CutoutArrayConfig: CUTOUT_ARRAY_KEYS,
  CutoutConfig: CUTOUT_CONFIG_KEYS,
  DividerOverride: DIVIDER_OVERRIDE_KEYS,
  DividerPieceConfig: DIVIDER_PIECE_KEYS,
  Drawer: DRAWER_KEYS,
  DrawerOutline: DRAWER_OUTLINE_KEYS,
  ExportMeta: EXPORT_META_KEYS,
  FeatureColorConfig: FEATURE_COLOR_KEYS,
  FloorPatternConfig: FLOOR_PATTERN_KEYS,
  HandleConfig: HANDLE_CONFIG_KEYS,
  HandleSide: HANDLE_SIDE_KEYS,
  Insert: INSERT_KEYS,
  KnifeRestConfig: KNIFE_REST_KEYS,
  KnifeSpec: KNIFE_SPEC_KEYS,
  LabelTabConfig: LABEL_TAB_KEYS,
  Layer: LAYER_KEYS,
  LidConfig: LID_CONFIG_KEYS,
  LidGripConfig: LID_GRIP_KEYS,
  LidHingeConfig: LID_HINGE_KEYS,
  LidMagnetConfig: LID_MAGNET_KEYS,
  LidSlideConfig: LID_SLIDE_KEYS,
  LidTrayConfig: LID_TRAY_KEYS,
  LinkedDesign: LINKED_DESIGN_KEYS,
  MarginTaper: MARGIN_TAPER_KEYS,
  MeasuredDrawerMm: MEASURED_DRAWER_KEYS,
  MeshAsset: MESH_ASSET_KEYS,
  MeshOutlinePoint: MESH_OUTLINE_POINT_KEYS,
  OutlineAuthoring: OUTLINE_AUTHORING_KEYS,
  OutlineVertex: OUTLINE_VERTEX_KEYS,
  OverhangConfig: OVERHANG_KEYS,
  PathPoint: PATH_POINT_KEYS,
  ScoopConfig: SCOOP_CONFIG_KEYS,
  SideFlags: SIDE_FLAGS_KEYS,
  ScrewHoleParams: SCREW_HOLES_KEYS,
  SlideConfig: SLIDE_CONFIG_KEYS,
  SlotConfig: SLOT_CONFIG_KEYS,
  SplitConnectorConfig: SPLIT_CONNECTOR_KEYS,
  SplitOverride: SPLIT_OVERRIDE_KEYS,
  StackPrintParams: STACK_PRINT_KEYS,
  StashedCompartment: STASHED_COMPARTMENT_KEYS,
  SurfaceTextConfig: SURFACE_TEXT_KEYS,
  TextOffset: TEXT_OFFSET_KEYS,
  TextStyleDefaults: TEXT_STYLE_KEYS,
  TextStyleOverride: TEXT_STYLE_OVERRIDE_KEYS,
  TrayBottomConfig: TRAY_BOTTOM_KEYS,
  WallConfig: WALL_CONFIG_KEYS,
  WallCutout: WALL_CUTOUT_KEYS,
  WallPatternConfig: WALL_PATTERN_KEYS,
  WallPatternSides: WALL_PATTERN_SIDES_KEYS,
  WallTaperConfig: WALL_TAPER_KEYS,
} as const satisfies Record<string, readonly string[]>;
