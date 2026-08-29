/**
 * Default bin parameters for the designer.
 */

import type {
  BinParams,
  DesignerUIState,
  GenerationState,
  DesignerHistory,
  HandleConfig,
  HandleCutoutShape,
  HandleSide,
  WallCutout,
  SlotConfig,
  DividerPieceConfig,
  WallPatternConfig,
  WallPatternSides,
  WallPatternType,
  FloorPatternType,
  CutoutConfig,
  SplitConnectorConfig,
} from '../types';
import {
  DEFAULT_FLOOR_PATTERN_CONFIG,
  DEFAULT_PATTERN_SCALE,
  FLOOR_PATTERN_TYPES,
  WALL_PATTERN_TYPES,
} from '../types';
import type { AccentBandConfig, FeatureColorConfig } from '../types/featureColors';
import { makeUniformLipCells, ACCENT_BAND_DEFAULT_MM } from '../types/featureColors';
import { DEFAULT_LID_CONFIG } from '../types/lid';
import { DEFAULT_SLIDE_CONFIG } from '../types/slide';
import { TEXT_PRESETS } from '../types/text';
import { DESIGNER_CONSTRAINTS } from './gridfinity';

/** Default slot configuration: vertical (x-axis) enabled, 20mm pitch */
export const DEFAULT_SLOT_CONFIG: SlotConfig = {
  x: { enabled: true, pitch: 20 },
  y: { enabled: false, pitch: 20 },
  width: 2.0,
  depth: 1.0,
  crossStyle: 'lap',
  longAxis: 'y',
  partialStyle: 'full',
  layout: 'even',
} as const;

/** Default divider piece configuration */
export const DEFAULT_DIVIDER_PIECE_CONFIG: DividerPieceConfig = {
  height: 'auto',
  thickness: 1.6,
  clearance: 0.25,
} as const;

/** Valid wall pattern members — used to coerce crafted/removed values on load. */
export const VALID_WALL_PATTERNS = new Set<WallPatternType>(WALL_PATTERN_TYPES);

/** All four outer walls patterned — the older behaviour. */
export const DEFAULT_WALL_PATTERN_SIDES: WallPatternSides = {
  left: true,
  right: true,
  front: true,
  back: true,
} as const;

/** Default wall pattern configuration: disabled */
export const DEFAULT_WALL_PATTERN_CONFIG: WallPatternConfig = {
  enabled: false,
  pattern: 'honeycomb',
  scale: DEFAULT_PATTERN_SCALE,
  dividers: false,
  sides: DEFAULT_WALL_PATTERN_SIDES,
} as const;

/** Valid floor pattern members — used to coerce crafted/removed values on load. */
export const VALID_FLOOR_PATTERNS = new Set<FloorPatternType>(FLOOR_PATTERN_TYPES);

export { DEFAULT_FLOOR_PATTERN_CONFIG } from '../types';

/**
 * Default position fields shared by all wall cutouts.
 *
 * Deliberately carries no corner radii. An absent field means "defer", which
 * resolves to the square shoulder and automatic bottom fillet every design
 * already had — so leaving them out keeps saved designs, the example gallery
 * and the community dedupe fingerprints byte-identical, and a design only
 * grows the keys once someone sets one.
 */
const DEFAULT_CUTOUT_POSITION = {
  alignment: 'center' as const,
  offset: 0,
  widthMm: null,
};

/** A disabled wall cutout with zeroed dimensions */
export const DISABLED_WALL_CUTOUT: WallCutout = {
  enabled: false,
  width: 0,
  depth: 0,
  ...DEFAULT_CUTOUT_POSITION,
} as const;

/** Default cutout configuration: flush with rim (no offset), held against it */
export const DEFAULT_CUTOUT_CONFIG: CutoutConfig = {
  topOffset: 0,
  fillReference: 'rim',
} as const;

/** Default split connector configuration: enabled with glue-fit tolerances.
 *  Clearance is 0.15mm per side (0.3mm total gap) — loose enough for CA glue
 *  to wick in and easy assembly with wet adhesive, while keeping tongue
 *  features thick enough for reliable OCCT boolean operations. */
export const DEFAULT_SPLIT_CONNECTOR_CONFIG: SplitConnectorConfig = {
  enabled: true,
  clearance: 0.15,
  tongueThickness: 2.4, // legacy — unused by scarf lap, kept for saved design compat
  tongueProtrusion: 3.0,
  wallConnector: 'none',
  ridgeWidthFraction: 0.35,
  ridgeHeightFraction: 0.85,
} as const;

/** Handle cutout shapes still supported — used to coerce retired values on load. */
export const VALID_HANDLE_SHAPES: readonly HandleCutoutShape[] = ['rectangle', 'oval', 'scoop'];

/** Default per-side handle config: enabled=false, no per-side overrides */
export const DEFAULT_HANDLE_SIDE: HandleSide = {
  enabled: false,
  width: null,
  height: null,
  cornerRadius: null,
} as const;

/** Default handle configuration: disabled, front + sides enabled when toggled on */
export const DEFAULT_HANDLE_CONFIG: HandleConfig = {
  enabled: false,
  shape: 'rectangle',
  width: 50,
  height: 15,
  cornerRadius: 10,
  verticalPosition: 0.7,
  count: 1,
  chamfer: false,
  interior: false,
  front: { ...DEFAULT_HANDLE_SIDE, enabled: true },
  back: { ...DEFAULT_HANDLE_SIDE, enabled: false },
  left: { ...DEFAULT_HANDLE_SIDE, enabled: true },
  right: { ...DEFAULT_HANDLE_SIDE, enabled: true },
} as const;

/** Default feature color config: all zones use the default bin color (light grey).
 *  Multi-color is opt-in per design — `enabled: false` keeps fresh designs at the
 *  single-body-color baseline until the user flips the toggle. */
export const DEFAULT_FEATURE_COLOR_CONFIG: FeatureColorConfig = {
  enabled: false,
  body: '#d4d8dc',
  lip: {
    corners: 1,
    bands: 1,
    cells: makeUniformLipCells('#d4d8dc'),
  },
  labelTab: '#d4d8dc',
  base: '#d4d8dc',
  scoop: '#d4d8dc',
  dividers: '#d4d8dc',
  text: '#d4d8dc',
  lid: '#d4d8dc',
  // `lidLip` is deliberately ABSENT — absent means "inherits `lid`". Adding it
  // unconditionally would shift every existing design's params fingerprint.
  topAccent: { enabled: false, heightMm: ACCENT_BAND_DEFAULT_MM, color: '#d4d8dc' },
  // `bottomAccent` is deliberately ABSENT — absent means "no band". Adding it
  // unconditionally would shift every existing design's params fingerprint.
} as const;

/** Seed for an accent band the user is enabling for the first time. */
export const DEFAULT_ACCENT_BAND: AccentBandConfig = {
  enabled: true,
  heightMm: ACCENT_BAND_DEFAULT_MM,
  color: '#d4d8dc',
};

/** Starting color when a cutout is first colored: the shadow-board convention
 *  is a high-contrast red backing that shows through the moment a tool is
 *  lifted out. Reads strongly against the default light-grey body. */
export const DEFAULT_CUTOUT_COLOR = '#ef4444';

/** Default bin parameters: 2x2x3 standard bin with no compartments */
export const DEFAULT_BIN_PARAMS: BinParams = {
  width: 2,
  depth: 2,
  height: 3,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  fractionalEdgeManualX: false,
  fractionalEdgeManualY: false,
  gridUnitMm: 42,
  heightUnitMm: 7,
  wallThickness: 1.2,
  base: {
    style: 'standard',
    magnetDiameter: 6.5,
    magnetDepth: 2,
    screwDiameter: 3,
    stackingLip: true,
    solid: false,
    halfSockets: false,
    lightweight: false,
    spacer: false,
    // `tile` is deliberately ABSENT for the same fingerprint reason as
    // `trayBottom` below: absent means off, and only a design that actually
    // selects the base-only bin carries the key.
    // `trayBottom` is deliberately ABSENT. `params` is hashed wholesale by
    // `communityParamsFingerprint`, so a new always-present default field shifts
    // every design's fingerprint, including already-published designs whose
    // server-side hashes predate the field — silently breaking the community
    // duplicate guard and the REMIX_UNCHANGED check. `migrateParams` backfills
    // it only when the design selects the lid base.
  },
  style: 'standard',
  compartments: {
    cols: 1,
    rows: 1,
    thickness: 1.2,
    cells: [0],
  },
  scoop: {
    enabled: false,
    radius: 'auto',
    style: 'curved',
    autoMaxHeight: DESIGNER_CONSTRAINTS.MAX_SCOOP_RADIUS,
  },
  label: {
    enabled: false,
    support: 'bracket',
    depth: 12,
    width: 100,
    alignment: 'left',
    edges: 'back',
    inset: 0,
  },
  walls: {
    enabled: false,
    shape: 'u-shape',
    width: 0,
    depth: 0,
    front: DISABLED_WALL_CUTOUT,
    back: DISABLED_WALL_CUTOUT,
    left: { enabled: true, width: 70, depth: 50, ...DEFAULT_CUTOUT_POSITION },
    right: { enabled: true, width: 70, depth: 50, ...DEFAULT_CUTOUT_POSITION },
    interior: DISABLED_WALL_CUTOUT,
  },
  handles: DEFAULT_HANDLE_CONFIG,
  slotConfig: DEFAULT_SLOT_CONFIG,
  dividerPieces: DEFAULT_DIVIDER_PIECE_CONFIG,
  inserts: [],
  cutouts: [],
  cutoutConfig: DEFAULT_CUTOUT_CONFIG,
  wallPattern: DEFAULT_WALL_PATTERN_CONFIG,
  floorPattern: DEFAULT_FLOOR_PATTERN_CONFIG,
  featureColors: DEFAULT_FEATURE_COLOR_CONFIG,
  lid: DEFAULT_LID_CONFIG,
  slide: DEFAULT_SLIDE_CONFIG,
  // New designs start on the curated look; a design saved before the type
  // system existed is backfilled with the NEUTRAL defaults by `migrateParams`,
  // so nothing already on a shelf changes.
  textDefaults: TEXT_PRESETS.engineering,
  overhang: { left: 0, right: 0, front: 0, back: 0, feet: false },
  extraWallHeightMm: 0,
} as const;

/** Default generation state */
export const DEFAULT_GENERATION_STATE: GenerationState = {
  status: 'idle',
  mesh: null,
  isDraft: false,
  progress: 0,
  epoch: 0,
  perfHistory: [],
} as const;

/** Default UI state */
export const DEFAULT_UI_STATE: DesignerUIState = {
  activeCategory: 'shape',
  exportDialogOpen: false,
  designListOpen: false,
  versionsOpen: false,
  wireframeMode: false,
  halfGridMode: false,
  cutoutEditorOpen: false,
  cutoutTarget: 'bin',
  bentoWorkspaceOpen: false,
  interiorCard: 'standard',
  previewCompartments: null,
  previewSelection: null,
  splitViewMode: 'exploded',
  splitPieceMeshes: [],
  hoveredColorZone: null,
  hoveredOverhangSide: null,
  colorTool: null,
  swapFirstZone: null,
  pickerOverlay: null,
  measure: { active: false, mode: 'points', points: [] },
  shapeEditorOpen: false,
  selectedDividerKey: null,
  hoveredDividerKey: null,
  dividerTiltPreview: null,
  hoveredCompartmentId: null,
  compartmentLabelMode: false,
  labelFocusCompartmentId: null,
  selectedBentoCompartmentId: null,
  selectedAssemblyPartId: null,
  selectedAssemblyPartIds: [],
  workshopPendingPartType: null,
  workshopPendingCutterShape: null,
  workshopClipboardCount: 0,
  workshopSnapMm: 3.5,
};

/** Default empty history */
export const DEFAULT_HISTORY: DesignerHistory = {
  past: [],
  future: [],
} as const;
