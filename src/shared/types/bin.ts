/**
 * Re-exports bin parameter types for cross-feature consumption.
 *
 * The canonical type definitions live in features/bin-designer/types.
 * This barrel export allows other features (e.g., generation) to
 * depend on these types without a cross-feature import violation.
 */
import type {
  DrawerOutline,
  MagnetAnchor,
  OutlineOverhang,
  ScrewHoleParams,
  SplitOverride,
  StackPrintParams,
} from '@/core/types';

export type {
  ExportFileFormat,
  FileNameStyle,
  ExportFileNameConfig,
  BinParams,
  BaseConfig,
  BaseStyle,
  TrayBottomConfig,
  FootLattice,
  LightweightMode,
  FeetMode,
  BinStyle,
  CompartmentConfig,
  StashedCompartment,
  ScoopConfig,
  ScoopStyle,
  ScoopSide,
  LabelTabConfig,
  LabelTabAlignment,
  LabelTabEdges,
  LabelTabMode,
  WallCutout,
  WallCutoutShape,
  WallConfig,
  WallSide,
  SlotConfig,
  AxisSlotConfig,
  CrossDividerStyle,
  PartialDividerStyle,
  SlotLayout,
  DividerPieceConfig,
  Insert,
  InsertShape,
  Cutout,
  CutoutShape,
  CutoutColorScope,
  CutoutConfig,
  CutoutArrayConfig,
  CutoutScoopEdges,
  GroupOp,
  PathPoint,
  WallPatternConfig,
  WallPatternType,
  WallPatternSides,
  FloorPatternConfig,
  FloorPatternType,
  SplitConnectorConfig,
  WallConnectorStyle,
  HandleConfig,
  HandleCutoutShape,
  HandleSide,
  HandleWallSide,
  LidConfig,
  SlideConfig,
  SlideRailMount,
  LidAttachment,
  LidMagnetConfig,
  LidTrayConfig,
  LidClickRails,
  LidGripConfig,
  LidGripMode,
  LidGripSides,
  LidRailSide,
  LidGripDepthPlan,
  LidGripHeightPlan,
  LidSlideConfig,
  LidSlidePlacement,
  LidSlidePull,
  LidHingeConfig,
  LidHingeCatch,
  FeatureColorConfig,
  AccentBandConfig,
  TextMode,
  TextFontFamily,
  TextAnchor,
  TextOffset,
  TextSizeMode,
  TextCase,
  TextCutProfile,
  TextPresetId,
  CutoutTextSide,
  CutoutTextAnchor,
  CutoutTextOffset,
  TextStyleDefaults,
  TextStyleOverride,
  SurfaceTextConfig,
  WallTextSide,
  WallTextVerticalAlign,
  DividerOverride,
  OverhangConfig,
  WallTaperConfig,
  KnifeSpec,
  KnifeSlotOpenEnd,
  KnifeRestConfig,
  KnifeRestStyle,
} from '@/features/bin-designer/types';

export {
  MIN_PATH_POINTS,
  DEFAULT_KNIFE_SPEC,
  knifeSlotDimensions,
  knifeBlockTopZMm,
  knifeRestStyle,
  knifeRestGrooveWidthMm,
  knifeRestSaddleZMm,
  knifeRestBodyTopZMm,
  KNIFE_SLOT_EDGE_FLOAT,
  KNIFE_REST_DEFAULT_GAP_MM,
  KNIFE_REST_GROOVE_DEPTH_MM,
  KNIFE_REST_HANDLE_DROP_MM,
  // Tray-bin mating defaults: the worker synthesises a lid config from
  // `base.trayBottom`, so it needs both baselines on this side of the boundary.
  DEFAULT_TRAY_BOTTOM,
  DEFAULT_LID_CONFIG,
  DEFAULT_LID_SLIDE_CONFIG,
  LID_SLIDE_PLACEMENTS,
  LID_SLIDE_PULLS,
  LID_SLIDE_CLEARANCE_MIN_MM,
  LID_SLIDE_CLEARANCE_MAX_MM,
  LID_SLIDE_CLEARANCE_DEFAULT_MM,
  LID_SLIDE_CLEARANCE_STEP_MM,
  isSlideLid,
  LID_HINGE_CATCHES,
  LID_HINGE_PIN_MM,
  LID_HINGE_BORE_MM,
  LID_HINGE_ENTRY_BORE_MM,
  LID_HINGE_KNUCKLE_WALL_MM,
  LID_HINGE_BARREL_RADIUS_MM,
  LID_HINGE_FACE_RELIEF_MM,
  LID_HINGE_STOP_ANGLE_DEG,
  LID_HINGE_STOP_MARGIN_MM,
  LID_HINGE_STOP_SECTOR_DEG,
  LID_HINGE_SEAM_CHAMFER_MM,
  LID_HINGE_FIT_MIN_MM,
  LID_HINGE_FIT_MAX_MM,
  LID_HINGE_FIT_DEFAULT_MM,
  LID_HINGE_FIT_STEP_MM,
  LID_HINGE_KNUCKLE_TARGET_MM,
  LID_HINGE_KNUCKLE_MIN_MM,
  LID_HINGE_DETENT_COVERAGE,
  LID_HINGE_MIN_KNUCKLES,
  LID_HINGE_MAX_KNUCKLES,
  LID_HINGE_CORNER_INSET_MM,
  LID_HINGE_MIN_RUN_MM,
  DEFAULT_LID_HINGE_CONFIG,
  isHingeLid,
  resolveLidHinge,
  isDefaultLidHinge,
  hingeOppositeSide,
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
  LID_MAGNET_CEILING,
  LID_TRAY_FLOOR,
  LID_TOP_THICKNESS_MIN_MM,
  LID_TOP_THICKNESS_MAX_MM,
  LID_TOP_THICKNESS_STEP_MM,
  LID_MIN_RAIL_LENGTH,
  LID_MAGNET_LIP_CLEARANCE,
  // The retention boss footprint. Shared because the lid cutout window draws
  // each boss as a keep-out on the main thread, and the worker mates against
  // the same numbers.
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
  hasBinLipDip,
  lidGripModeAllowed,
  DEFAULT_SCOOP_EDGES,
  DEFAULT_GROUP_OP,
  DEFAULT_CUTOUT_COLOR_SCOPE,
  GROUP_OPS,
  DEFAULT_TEXT_STYLE_DEFAULTS,
  TEXT_MAX_LENGTH,
  TEXT_MAX_LINES,
  TEXT_MAX_TOTAL_LENGTH,
  TEXT_ANCHORS,
  TEXT_CASES,
  TEXT_CUT_PROFILES,
  TEXT_FONT_FAMILIES,
  TEXT_FONT_BOLD_OF,
  EAGER_TEXT_FONT_FAMILIES,
  TEXT_PRESETS,
  TEXT_PRESET_IDS,
  TYPE_SCALE_MM,
  MIN_TEXT_DRAFT_DEG,
  MAX_TEXT_DRAFT_DEG,
  MIN_GLYPH_GAP_MM,
  ZERO_TEXT_OFFSET,
  WALL_ALIGN_TO_ANCHOR,
  applyTextCase,
  autoTrackingEm,
  matchTextPreset,
  normalizeTextInput,
  resolveTextStyle,
  snapToTypeScale,
  splitTextLines,
  MIN_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  DEFAULT_POLYGON_SIDES,
  CLEARANCE_SHAPES,
  CHAMFER_SHAPES,
  MAX_CUTOUT_LEAN_DEG,
  LEAN_SHAPES,
  resolveCutoutLeanDeg,
  MAX_ARRAY_INSTANCES,
  DEFAULT_PATTERN_SCALE,
  WALL_PATTERN_SIDES,
  KUMIKO_PATTERN_TYPES,
  isKumikoPattern,
  FLOOR_PATTERN_TYPES,
  DEFAULT_FLOOR_PATTERN_CONFIG,
  WALL_TEXT_SIDES,
  WALL_TEXT_ALIGNS,
  // A base-only bin's body IS this slab, so the worker and the height readout
  // have to resolve its thickness through the same function.
  resolveTileFloorThickness,
  // The underside relief: one predicate and one offset, so the worker, the
  // constraint engine and the print estimate cannot describe different feet.
  isUndersideRelief,
  UNDERSIDE_RELIEF_BORDER_MM,
  // Detachable feet: the predicate the worker gates on, plus the pin dimensions
  // the foot builder and the floor's hole cutter both have to agree about.
  hasDetachableFeet,
  DEFAULT_FEET_MODE,
  DETACHABLE_PIN_DIAMETERS_MM,
  DEFAULT_DETACHABLE_PIN_DIAMETER_MM,
  DETACHABLE_PIN_HOLE_DIAMETER_MM,
  DETACHABLE_PIN_MEMBRANE_MM,
  DETACHABLE_PIN_MIN_ENGAGEMENT_MM,
  detachablePinEngagementMm,
  detachableFeetFitFloor,
  binFloorMm,
  DETACHABLE_PIN_TARGET_ENGAGEMENT_MM,
  DETACHABLE_PIN_LEAD_IN_MM,
} from '@/features/bin-designer/types';

/**
 * Re-export lid policy helpers so worker-side code can ask "should we
 * generate a lid?" without importing across the feature boundary.
 */
export {
  shouldGenerateLid,
  interiorReliefActive,
  checkLidCompatibility,
  hasLidBlocker,
  computeDisabledRails,
} from '@/features/bin-designer/utils/lidCompatibility';

/**
 * Re-export the sliding-lid plan's entry point for the same reason.
 *
 * ONE adapter, shared by the panel and the worker rather than one each: the
 * channel fused onto the bin, the plate that runs in it, the travel envelope
 * cut out of the cavity and the rejection the panel prints all come from this
 * call, and a second derivation is how a plate and its track end up sized
 * against different bins.
 */
export { slideLidPlanForParams } from '@/features/bin-designer/utils/slideLidPlanForParams';

/**
 * Re-export compartment-edge predicates so worker-side feature builders
 * (scoop ramps, label tabs) can ask "does this compartment have a tilted
 * boundary?" without crossing the feature boundary.
 */
export {
  buildOverrideLookup,
  compartmentHasTiltedEdge,
  compartmentHasTiltedBackWall,
  compartmentHasTiltedFrontWall,
  compartmentTabEligible,
  compartmentTabXSpan,
  dividerFootDrift,
  findPairAwareRuns,
  hasDividerLean,
  getCompartmentBounds,
  isRectangularCompartment,
  overrideKey,
  rectStraddlesTiltedDivider,
  rowHasFullWidthWall,
  spanRegionDepth,
  spanningTabEligible,
} from '@/features/bin-designer/utils/compartments';
export type {
  TabAnchorSide,
  LabelTabFit,
  CompartmentTabSpan,
} from '@/features/bin-designer/utils/compartments';
export type {
  LidCompatibilityIssue,
  LidCompatibilityId,
  LidCompatibilitySeverity,
  LidCompatibilitySide,
} from '@/features/bin-designer/utils/lidCompatibility';

/**
 * Whether an edge is exterior (outside baseplate), a join between split pieces,
 * or a seam to a detached margin rail carrying an opt-in connector.
 * `marginSeam` is exterior-like for corner/rounding purposes but carries a
 * body↔rail tongue; it must NOT be treated as `join` (no split-piece keys).
 * Canonical edge-kind union; the baseplate feature's `EdgeKind` aliases this, so
 * extend the union here and both stay in sync.
 */
export type BaseplateEdgeKind = 'join' | 'exterior' | 'marginSeam';

/**
 * True for edges on the plate's outer boundary: a plain `exterior` edge or a
 * `marginSeam` (which is exterior + a connector tongue). Corner rounding and
 * squaring treat both identically — the body stays square there and the rail
 * owns the rounded outer corner. Do NOT use this for fingerprinting: a
 * `marginSeam` piece carries a tongue and must not dedupe with a plain
 * exterior piece.
 */
export function isExteriorEdge(kind: BaseplateEdgeKind): boolean {
  return kind === 'exterior' || kind === 'marginSeam';
}

/**
 * Baseplate split-connector styles — the single source of truth for the union,
 * as a runtime tuple so zod schemas can derive their enum from it instead of
 * restating the strings (three copies had already drifted). The
 * `ResolvedBaseplateParams.connectorStyle` field and this type both point here.
 */
export const BASEPLATE_CONNECTOR_STYLES = [
  'dovetail',
  'puzzle',
  'dovetailKey',
  'snapClip',
] as const;

export type BaseplateConnectorStyle = (typeof BASEPLATE_CONNECTOR_STYLES)[number];

/**
 * Whether the margin-seam connector engages for a given connector
 * style. Scoped to the integral tongue/groove families — dovetail and puzzle —
 * because snapClip/dovetailKey would need a separate printed part the seam must
 * not emit. `undefined` is the stored default for dovetail (the ConnectorPicker
 * persists dovetail as absent), so it counts as a tongue/groove style.
 */
export function isSeamConnectorStyle(style: BaseplateConnectorStyle | undefined): boolean {
  return style === undefined || style === 'dovetail' || style === 'puzzle';
}

/**
 * Whether the margin-seam connector can be built for a given style at
 * all: the integral tongue/groove families, plus `dovetailKey`, which
 * makes both sides of the body↔rail seam female and seats the same separate key
 * the split seams use. `snapClip` stays friction-fit — its top-insert clip has no
 * seated form at a body↔rail seam.
 *
 * `undefined` counts, as in {@link isSeamConnectorStyle}: it's the stored default
 * for dovetail (the ConnectorPicker persists dovetail as absent).
 */
export function isMarginSeamStyle(style: BaseplateConnectorStyle | undefined): boolean {
  return isSeamConnectorStyle(style) || style === 'dovetailKey';
}

/**
 * Whether the detached-margin seam is keyed rather than tongued: both the body
 * wall and the rail get a female groove and a separate key spans them.
 * Shared so the body geometry, the rail geometry, and the key
 * count/placement can't disagree about where those grooves go.
 */
export function hasMarginSeamKeys(params: ResolvedBaseplateParams): boolean {
  return (
    params.detachMargins === true &&
    params.detachMarginConnector === true &&
    params.connectorStyle === 'dovetailKey'
  );
}

/**
 * Whether a connector style makes BOTH sides of every seam female and ships a
 * separate seated part (the hammered-in dovetail key, the snap clip). Only these
 * styles can carry {@link ResolvedBaseplateParams.connectorSlotsAllEdges} — an
 * integral tongue/groove style would grow a male tongue past the plate's outer
 * wall and break the drawer fit.
 */
export function isSeatedConnectorStyle(style: BaseplateConnectorStyle | undefined): boolean {
  return style === 'dovetailKey' || style === 'snapClip';
}

/**
 * Whether {@link ResolvedBaseplateParams.connectorSlotsAllEdges} is actually in
 * effect. Shared so the geometry (`buildConnectors`), the mesh cache key, and
 * the dedup fingerprint can never disagree about which edges carry a slot.
 */
export function hasAllEdgeSlots(params: ResolvedBaseplateParams): boolean {
  return (
    params.connectorSlotsAllEdges === true &&
    params.connectorNubs === true &&
    isSeatedConnectorStyle(params.connectorStyle)
  );
}

/**
 * Whether all-edge slots actually add anything to THIS piece: it needs at least
 * one padding-free exterior edge. An interior piece (every edge a join seam), or
 * one whose exterior edges all carry drawer-fit padding, is byte-identical with
 * the option on or off — so the mesh cache must fold the flag out for it rather
 * than mint a second entry for the same geometry.
 *
 * Deliberately NOT used by `computePieceFingerprint`: the fingerprint has to pick
 * one keying scheme for the whole plate, or a fully-slotted interior piece and a
 * fully-slotted edge piece would be keyed differently and never dedupe — which is
 * the merge the option exists to enable.
 */
export function cutsExtraEdgeSlots(params: ResolvedBaseplateParams): boolean {
  const { edges } = params;
  if (!edges || !hasAllEdgeSlots(params)) return false;
  const added = (kind: BaseplateEdgeKind, paddingMm: number): boolean =>
    kind !== 'join' && edgeCarriesSlot(kind, true, paddingMm);
  return (
    added(edges.left, params.paddingLeft) ||
    added(edges.right, params.paddingRight) ||
    added(edges.front, params.paddingFront) ||
    added(edges.back, params.paddingBack)
  );
}

/**
 * Whether an edge of a split piece carries a seam connector at all, given the
 * piece's padding on that side.
 *
 * A `join` edge always does — whichever half the style puts there (a tongue, a
 * groove, or a both-female slot); this predicate answers "is there a feature
 * here", not "which half". An `exterior` edge only does under
 * {@link hasAllEdgeSlots}, and then it is always the female slot, since that
 * option is restricted to the both-female styles; it additionally needs that side
 * to be padding-free, because a padded edge's wall sits `padding` mm outside the
 * grid and its slot would not line up with a neighbouring plate's. `marginSeam`
 * is handled by the margin-seam connector, not here.
 */
export function edgeCarriesSlot(
  kind: BaseplateEdgeKind,
  allEdgeSlots: boolean,
  paddingMm: number
): boolean {
  if (kind === 'join') return true;
  return allEdgeSlots && kind === 'exterior' && paddingMm === 0;
}

/** Per-side edge classification for split baseplate pieces. */
export interface BaseplateEdges {
  readonly left: BaseplateEdgeKind;
  readonly right: BaseplateEdgeKind;
  readonly front: BaseplateEdgeKind;
  readonly back: BaseplateEdgeKind;
}

/**
 * Per-side allowed connector positions along a join seam (piece-centered mm on
 * the seam's boundary axis). See `ResolvedBaseplateParams.connectorFilter`.
 */
export type ConnectorBoundaryFilter = Partial<
  Record<'left' | 'right' | 'front' | 'back', readonly number[]>
>;

/** A plate corner, named by the integral plate's exterior face pair. */
export type MarginCorner = 'tl' | 'tr' | 'bl' | 'br';

/**
 * A detached drawer-fit padding "rail" — its own printable piece.
 *
 * Rails butt-join: one axis pair is `long` (spans the full outer extent and owns
 * the plate corners), the perpendicular pair is `short` (fits between the long
 * rails). When a long rail is absent on an end, the adjacent short rail extends
 * to that corner and owns it instead — so every rounded outer corner of the
 * integral plate is carried by exactly one rail (see `ownedCorners`).
 *
 * Lives in shared (not the baseplate feature) so the generation worker can build
 * a rail without a cross-feature import.
 */
export interface MarginPiece {
  /** Stable id/label, e.g. "margin-front-A". */
  readonly id: string;
  readonly side: 'left' | 'right' | 'front' | 'back';
  readonly role: 'long' | 'short';
  /**
   * Column/row of the body piece this segment runs alongside. A split plate
   * emits one segment per outer body piece (so segments fit the bed and explode
   * in lockstep with their piece); an unsplit plate is a single 0,0 piece.
   */
  readonly col: number;
  readonly row: number;
  /** Extent along the rail's running axis (mm). */
  readonly lengthMm: number;
  /** Padding-band depth perpendicular to the running axis (mm). */
  readonly bandThicknessMm: number;
  /** Outer corners this rail rounds; the rest of its corners are square (seams). */
  readonly ownedCorners: readonly MarginCorner[];
  /** Rail-center position in the plate-centered world frame (mm). */
  readonly worldOffsetMm: { readonly x: number; readonly y: number };
  /**
   * Layout of the opt-in tongue-and-groove seam connector for a `long` rail
   * (absent on short/friction-fit rails). The body grows one tongue per mating
   * grid cell and the rail carves matching grooves; both sides recompute the same
   * cell-center set from `cellUnits`/`fractionalEdge` so they can't drift, and
   * `centerOffsetMm` re-anchors them onto the body wall on a corner-owning end
   * segment (which extends over the perpendicular padding and so is no longer
   * centered on the wall it joins —/#2428).
   */
  readonly seamConnector?: {
    /** Grid units of the mating body wall along the rail's running axis. */
    readonly cellUnits: number;
    /** Rail-local position (mm) of the body grid center along the running axis. */
    readonly centerOffsetMm: number;
    readonly fractionalEdge: 'start' | 'end';
  };
  readonly overTile: boolean;
  readonly overTileHalfGrid: boolean;
  readonly overTileHalfGridSolidLeftover: boolean;
}

/**
 * Resolved (generation-time) full baseplate parameter set for the generation bridge.
 *
 * Extends the persisted {@link StoredBaseplateParams} with drawer dimensions
 * (width, depth, gridUnitMm) and resolved per-side padding values computed at
 * generation time. Produced from the stored config via buildFullParams.
 */
export interface ResolvedBaseplateParams {
  readonly width: number;
  readonly depth: number;
  readonly gridUnitMm: number;
  /**
   * Depth-axis (Y) pitch for a non-square plate. Absent = square (equals
   * {@link gridUnitMm}). Resolve with `gridUnitMmY ?? gridUnitMm`.
   */
  readonly gridUnitMmY?: number;
  readonly magnetHoles: boolean;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  /**
   * Magnet hole placement anchor (default 'edge'). See `MagnetAnchor` in
   * `@/core/types`. Layout-scoped so the plate matches its bins/lids.
   */
  readonly magnetAnchor?: MagnetAnchor;
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
  /**
   * Half-grid variant of over-tile: pack true 21mm (0.5-unit) functional
   * half-sockets into each margin before the sub-half-unit leftover falls back to
   * the standard clipped tile. Only meaningful when {@link overTile} is true.
   */
  readonly overTileHalfGrid?: boolean;
  /**
   * When half-grid is on, leave the sub-21mm leftover after the packed
   * half-sockets as solid plastic instead of a clipped grid pocket.
   * Only meaningful when {@link overTileHalfGrid} is true. Default false.
   */
  readonly overTileHalfGridSolidLeftover?: boolean;
  /**
   * Fit the grid to a custom perimeter by whole cells only: a cell the outline
   * crosses is dropped and the solid plate fills the margin, instead of keeping
   * a socket sliced to the outline. Sliced sockets hold nothing and leave the
   * boundary unfinished. Only meaningful with an `outline`.
   * Default false (sliced sockets kept).
   */
  readonly wholeCellsOnly?: boolean;
  /** Edge classification for split pieces — omit for single (unsplit) baseplates. */
  readonly edges?: BaseplateEdges;
  /**
   * Per-side allowed connector positions along a join seam, in piece-centered
   * mm on the seam's boundary axis (the same coordinate `buildConnectors`
   * places dovetails at). Present only when a shaped plate keeps a seam but
   * gates its connectors to the sub-span whose one-cell bands sit fully inside
   * the perimeter. Absent side (or absent map) = every interior cell
   * boundary carries a connector, byte-identical to unshaped plates.
   */
  readonly connectorFilter?: ConnectorBoundaryFilter;
  /**
   * Non-rectangular plate boundary in plate-local mm (origin bottom-left of
   * the plate's outer extent). Cells fully inside get standard pockets; cells
   * partially inside stay solid (or get outline-clipped pockets under
   * `overTile`); the slab is intersected with the extruded outline. Absent =
   * full rectangle (exact legacy behavior, cache-stable). For split plates
   * this is piece-local (pre-translated by the planner).
   */
  readonly outline?: DrawerOutline;
  /**
   * Extra plate-local material the `outline` reaches beyond `[0, totalW] ×
   * [0, totalD]`, per side in mm.
   *
   * The grid frame renders the grid fixed and translates the perimeter, so a
   * grid shift toward an edge the shape already touches — or an imported
   * perimeter drawn larger than the drawer — puts part of the perimeter
   * outside the nominal extent. The slab the outline is intersected against
   * must cover it, or that strip is cut off the printed plate. The socket
   * lattice is NOT affected: it stays anchored to the nominal extent, which
   * is exactly what makes the shift a grid shift. Absent/zero = the outline
   * fits the extent (every plate before this existed), which keeps the slab
   * byte-identical and cache-stable.
   *
   * A split piece's slab IS its clip window, so this is never inherited
   * wholesale — that would let every piece swallow its neighbours. Only the
   * pieces on the parent's outer edge carry it, and only on the side they sit
   * on, matching the windows the planner widened for them; interior pieces
   * carry nothing and stay byte-identical to unshifted plates.
   */
  readonly outlineOverhang?: OutlineOverhang;
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
   * (default 'dovetail'). 'puzzle' is a stronger integral jigsaw-tab connector
   * that mechanically locks (legacy 'dovetail' is an unchanged near-flat slip fit).
   * 'dovetailKey' makes both seam edges female and ships a separate hammered-in
   * dovetail key instead of an integral male tongue. 'snapClip' makes both seam
   * edges blind ledged pockets and ships a separate top-insert snap clip
   * ("staple") whose barbs catch the ledges.
   */
  readonly connectorStyle?: BaseplateConnectorStyle;
  /**
   * Cut the seam slot on the plate's EXTERIOR edges too, not just on the join
   * seams between split pieces. Every piece then reads as a
   * standard 42mm-grid tile that can key into any other plate later, and
   * same-size pieces dedupe instead of splitting into edge/corner/interior
   * variants. See {@link hasAllEdgeSlots} / {@link edgeCarriesSlot} for when it
   * engages (both-female styles only, padding-free edges only).
   */
  readonly connectorSlotsAllEdges?: boolean;
  /**
   * User fit offset (mm) added to the per-side groove clearance to compensate
   * for printer/filament variation. Positive = looser, negative =
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
  /**
   * Leave a solid floor under every socket instead of through-cutting the
   * pockets — a rigid/weighted plate. The floor is added below the 5mm socket
   * (plate grows by {@link solidFloorThickness}; pocket depth unchanged). With
   * magnets it keeps the underside continuous and the holes are cut into it.
   */
  readonly solidFloor?: boolean;
  /** Thickness (mm) of the {@link solidFloor}; defaults to 0.8mm when omitted. */
  readonly solidFloorThickness?: number;
  /**
   * Mount-down screw holes. Omitted ⇒ none, keeping plates saved before
   * this field byte-identical.
   */
  readonly screwHoles?: ScrewHoleParams;
  /**
   * Extra slab thickness (mm) a floor-sited screw needs to recess its head, or 0
   * when every screw rides the solid margin.
   *
   * Resolved ONCE at plate level (`buildFullParams`, via `screwPadThicknessMm`)
   * and handed to every piece, because pieces of one plate share a slab height:
   * if any piece needs the pad, all of them must carry it or the assembly comes
   * out stepped. Never recompute this per piece.
   */
  readonly screwPadThicknessMm?: number;
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
   * Detach the drawer-fit padding into separate printable rail pieces. When set,
   * the body slab is generated padding-free on detached sides and the margin
   * rails are emitted as `BaseplateTiling.margins`. Composes with `stackPrint`
   *: rails export as flat pieces alongside the stacked towers.
   * Omit/false = padding stays integral.
   */
  readonly detachMargins?: boolean;
  /**
   * Opt-in body↔long-rail connector for detached margins. When true and
   * `detachMargins` is set, the detached exterior seam becomes a `marginSeam`
   * edge carrying a tongue (body side) that mates a groove in the rail, using
   * the body's `connectorStyle`. Scoped to long rails; short rails/corners stay
   * friction-fit. Omit/false = friction-fit only.
   */
  readonly detachMarginConnector?: boolean;
  /**
   * Vertical stack-print configuration (experimental). Replication is applied at
   * the mesh/export level (not in the BREP solid), so the generator builds one
   * plate and the preview/export layers duplicate it. Connectors must be
   * stripped by the caller before reaching here. Omit for a single plate.
   */
  readonly stackPrint?: StackPrintParams;
  /**
   * User-drawn split plan that `computeBaseplateTiling` uses in place of
   * its search. Already normalized by `buildFullParams` — present here only when
   * it still matches `width`/`depth`. It never reaches the generator: it selects
   * which pieces exist, and each piece's own params carry everything the mesh
   * depends on, so it is deliberately absent from `meshCacheKey`.
   */
  readonly splitOverride?: SplitOverride;
}
