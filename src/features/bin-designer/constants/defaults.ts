/**
 * Default bin parameters for the designer.
 */

import type {
  BinParams,
  Cutout,
  DesignerUIState,
  GenerationState,
  DesignerHistory,
  HandleConfig,
  HandleCutoutShape,
  HandleSide,
  WallCutout,
  WallConfig,
  SlotConfig,
  DividerPieceConfig,
  WallPatternConfig,
  CutoutConfig,
  SplitConnectorConfig,
} from '../types';
import type { FeatureColorConfig, LipAxisCount } from '../types/featureColors';
import { makeUniformLipCells, LIP_CELL_ZONES } from '../types/featureColors';
import type { LidConfig } from '../types/lid';
import { DEFAULT_LID_CONFIG, LID_CLICK_RAIL_COVERAGE_OPTIONS } from '../types/lid';
import type { LidClickRails } from '../types/lid';
import type { TextStyleDefaults } from '../types/text';
import { migrateWalls } from './paramMigration';
import type { LegacyWallConfig } from './paramMigration';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '../types/text';

/** Default slot configuration: vertical (x-axis) enabled, 20mm pitch */
const DEFAULT_SLOT_CONFIG: SlotConfig = {
  x: { enabled: true, pitch: 20 },
  y: { enabled: false, pitch: 20 },
  width: 2.0,
  depth: 1.0,
} as const;

/** Default divider piece configuration */
const DEFAULT_DIVIDER_PIECE_CONFIG: DividerPieceConfig = {
  height: 'auto',
  thickness: 1.6,
  clearance: 0.25,
} as const;

/** Default wall pattern configuration: disabled */
const DEFAULT_WALL_PATTERN_CONFIG: WallPatternConfig = {
  enabled: false,
  pattern: 'honeycomb',
} as const;

/** Default position fields shared by all wall cutouts */
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

/** Default cutout configuration: flush with rim (no offset) */
const DEFAULT_CUTOUT_CONFIG: CutoutConfig = {
  topOffset: 0,
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
const VALID_HANDLE_SHAPES: readonly HandleCutoutShape[] = ['rectangle', 'oval', 'scoop'];

/** Default per-side handle config: enabled=false, no per-side overrides */
export const DEFAULT_HANDLE_SIDE: HandleSide = {
  enabled: false,
  width: null,
  height: null,
  cornerRadius: null,
} as const;

/** Default handle configuration: disabled, front + sides enabled when toggled on */
const DEFAULT_HANDLE_CONFIG: HandleConfig = {
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

/**
 * Expand a legacy `clickRails: boolean` into the per-side object shape.
 * Pre-v4.50 designs stored a single boolean; the new model is one flag
 * per wall. `true` → all four sides on; `false` → all four off; an
 * object is passed through (with missing sides backfilled from the
 * default).
 */
function migrateClickRails(raw: unknown): LidClickRails {
  if (raw === true) return { front: true, back: true, left: true, right: true };
  if (raw === false) return { front: false, back: false, left: false, right: false };
  if (raw && typeof raw === 'object') {
    return { ...DEFAULT_LID_CONFIG.clickRails, ...(raw as Partial<LidClickRails>) };
  }
  return DEFAULT_LID_CONFIG.clickRails;
}

/**
 * Snap a persisted `clickRailCoverage` to the nearest supported option.
 * Out-of-range or non-numeric values fall back to the default. Worker
 * geometry breaks if this slips through (rails 2× the wall length etc.).
 */
function migrateClickRailCoverage(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_LID_CONFIG.clickRailCoverage;
  }
  if (LID_CLICK_RAIL_COVERAGE_OPTIONS.includes(raw)) return raw;
  let nearest = LID_CLICK_RAIL_COVERAGE_OPTIONS[0];
  let bestDiff = Math.abs(raw - nearest);
  for (const option of LID_CLICK_RAIL_COVERAGE_OPTIONS) {
    const diff = Math.abs(raw - option);
    if (diff < bestDiff) {
      bestDiff = diff;
      nearest = option;
    }
  }
  return nearest;
}

/** Map legacy FilamentSlotId values (from pre-v4.30 designs) to hex colors for migration */
const LEGACY_SLOT_COLORS: Record<string, string> = {
  slot1: '#d4d8dc',
  slot2: '#3b82f6',
  slot3: '#22c55e',
  slot4: '#ef4444',
};

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
} as const;

/** Starting color when a cutout is first colored: the shadow-board convention
 *  is a high-contrast red backing that shows through the moment a tool is
 *  lifted out. Reads strongly against the default light-grey body. */
export const DEFAULT_CUTOUT_COLOR = '#ef4444';

/** Old per-corner lip object (pre quadrant×band grid). */
interface LegacyLipCorners {
  frontLeft?: string;
  frontRight?: string;
  backRight?: string;
  backLeft?: string;
}

/** New quadrant×band lip grid (current shape, possibly partial on reload). */
interface GridLipInput {
  corners?: number;
  bands?: number;
  cells?: { [cellId: string]: string };
}

interface LegacyFeatureColorInput {
  enabled?: boolean;
  body?: string;
  /** Legacy single-color string, legacy 4-corner object, or the new grid. */
  lip?: string | LegacyLipCorners | GridLipInput;
  labelTab?: string;
  base?: string;
  scoop?: string;
  dividers?: string;
  text?: string;
  lid?: string;
}

function resolveColor(raw: string | undefined, fallback: string): string {
  if (raw === undefined) return fallback;
  return LEGACY_SLOT_COLORS[raw] ?? raw;
}

/** Clamp an arbitrary number to the nearest allowed lip axis count {1,2,4}. */
function clampAxisCount(n: number | undefined): LipAxisCount {
  if (n === 2) return 2;
  if (n === 4) return 4;
  return 1;
}

function isGridLip(lip: LegacyLipCorners | GridLipInput): lip is GridLipInput {
  return 'cells' in lip || 'corners' in lip || 'bands' in lip;
}

/**
 * Resolve the lip grid from any of the three eras. Always returns the full
 * 16-cell grid so callers never see a partial config.
 */
function migrateLip(raw: LegacyFeatureColorInput['lip'], body: string): FeatureColorConfig['lip'] {
  // Era 1: single hex string → uniform 1×1.
  if (typeof raw === 'string') {
    return { corners: 1, bands: 1, cells: makeUniformLipCells(resolveColor(raw, body)) };
  }
  if (raw && typeof raw === 'object') {
    // Era 3: already the grid shape → backfill missing cells from body, clamp counts.
    if (isGridLip(raw)) {
      const cells = makeUniformLipCells(body);
      if (raw.cells) {
        for (const id of LIP_CELL_ZONES) {
          if (typeof raw.cells[id] === 'string') cells[id] = raw.cells[id];
        }
      }
      return { corners: clampAxisCount(raw.corners), bands: clampAxisCount(raw.bands), cells };
    }
    // Era 2: legacy 4-corner object. The per-corner editor was rolled back to a
    // single mirrored picker, so mismatched corners were unreachable from the
    // UI; canonicalize to frontLeft → a uniform 1×1 grid (the visible look the
    // rolled-back single picker already produced; discussion #1654).
    const fl = raw.frontLeft ?? body;
    return { corners: 1, bands: 1, cells: makeUniformLipCells(fl) };
  }
  // Missing → uniform body, 1×1.
  return { corners: 1, bands: 1, cells: makeUniformLipCells(body) };
}

/**
 * Migrate featureColors. Handles three eras of saved designs:
 * - Pre-v4.30: slot IDs like 'slot1' → mapped to hex via LEGACY_SLOT_COLORS.
 * - v4.30..pre-corner-lip: `lip` is a single hex string; all four corners inherit it.
 * - New zones (base / scoop / dividers) missing → inherit body so render is unchanged.
 *
 * `enabled` is back-filled on first load — any pre-existing design with any color
 * customization is treated as opted-in so the user's colored designs keep their look.
 */
function migrateFeatureColors(raw: LegacyFeatureColorInput | undefined): FeatureColorConfig {
  if (!raw) return DEFAULT_FEATURE_COLOR_CONFIG;

  const body = resolveColor(raw.body, DEFAULT_FEATURE_COLOR_CONFIG.body);
  const labelTab = resolveColor(raw.labelTab, body);

  const lip = migrateLip(raw.lip, body);

  const base = resolveColor(raw.base, body);
  const scoop = resolveColor(raw.scoop, body);
  const dividers = resolveColor(raw.dividers, body);
  // Text defaults to the label-tab color so single-color designs see no shift
  // when this field is added by migration.
  const text = resolveColor(raw.text, labelTab);
  const lid = resolveColor(raw.lid, body);

  // Pre-`enabled` design counts as multi-color if body or any zone diverges
  // from the default — zone editors only existed behind the old Labs flag, so
  // any customized color implies multi-color intent.
  const bodyLower = body.toLowerCase();
  const isCustom = (c: string): boolean => c.toLowerCase() !== bodyLower;
  const hasCustomColor =
    bodyLower !== DEFAULT_FEATURE_COLOR_CONFIG.body.toLowerCase() ||
    [labelTab, base, scoop, dividers, text, lid].some(isCustom) ||
    LIP_CELL_ZONES.some((id) => isCustom(lip.cells[id] ?? body));

  return {
    enabled: raw.enabled ?? hasCustomColor,
    body,
    lip,
    labelTab,
    base,
    scoop,
    dividers,
    text,
    lid,
  };
}

/** Default bin parameters: 2x2x3 standard bin with no compartments */
export const DEFAULT_BIN_PARAMS: BinParams = {
  width: 2,
  depth: 2,
  height: 3,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
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
  featureColors: DEFAULT_FEATURE_COLOR_CONFIG,
  lid: DEFAULT_LID_CONFIG,
  textDefaults: DEFAULT_TEXT_STYLE_DEFAULTS,
  overhang: { left: 0, right: 0, front: 0, back: 0, feet: false },
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
  activeTab: 'dimensions',
  exportDialogOpen: false,
  designListOpen: false,
  wireframeMode: false,
  halfGridMode: false,
  cutoutEditorOpen: false,
  previewCompartments: null,
  previewSelection: null,
  splitViewMode: 'exploded',
  splitPieceMeshes: [],
  hoveredColorZone: null,
  hoveredOverhangSide: null,
  colorTool: null,
  swapFirstZone: null,
  pickerOverlay: null,
  shapeEditorOpen: false,
  selectedDividerKey: null,
  hoveredDividerKey: null,
  dividerTiltPreview: null,
  hoveredCompartmentId: null,
};

/** Default empty history */
export const DEFAULT_HISTORY: DesignerHistory = {
  past: [],
  future: [],
} as const;

/** Legacy fields that may appear in saved designs from older versions. */
interface LegacyFields {
  dividers?: { x: number; y: number; thickness: number };
  eco?: {
    honeycombWall?: {
      enabled?: boolean;
      mode?: string;
    };
  };
  walls?: WallConfig | LegacyWallConfig;
}

/** Legacy cutout fields from older versions, accepted by migrateCutout. */
interface LegacyCutoutFields {
  /** Pre-split scoop radius (mm). Migrated to scoopRadiusW + scoopRadiusD. */
  scoopRadius?: number;
}

/** Input type for migrateParams — current params plus known legacy fields. */
type MigrateParamsInput = Partial<BinParams> & LegacyFields;

/**
 * Migrate a single cutout's legacy fields to current shape.
 *
 * Idempotent: re-running on an already-migrated cutout leaves W/D untouched.
 * Only copies legacy scoopRadius into both axes when neither axis is set.
 */
function migrateCutout(cutout: Cutout & LegacyCutoutFields): Cutout {
  const { scoopRadius, ...rest } = cutout;
  if (
    scoopRadius !== undefined &&
    rest.scoopRadiusW === undefined &&
    rest.scoopRadiusD === undefined
  ) {
    return { ...rest, scoopRadiusW: scoopRadius, scoopRadiusD: scoopRadius };
  }
  return rest;
}

/**
 * Populate missing bin parameters with default values.
 * Handles backward compatibility for old designs:
 * - scoop was boolean in earlier versions
 * - dividers (DividerConfig) migrates to compartments (CompartmentConfig)
 *
 * @param params - Partial bin parameters to migrate; any fields not provided will be filled from `DEFAULT_BIN_PARAMS`.
 * @returns A complete `BinParams` object with unspecified fields taken from `DEFAULT_BIN_PARAMS`.
 */
export function migrateParams(params: MigrateParamsInput): BinParams {
  // Migrate old boolean scoop format to ScoopConfig
  let scoopConfig = DEFAULT_BIN_PARAMS.scoop;
  if (params.scoop !== undefined) {
    if (typeof params.scoop === 'boolean') {
      // Legacy format: boolean → ScoopConfig
      scoopConfig = { ...DEFAULT_BIN_PARAMS.scoop, enabled: params.scoop };
    } else {
      scoopConfig = { ...DEFAULT_BIN_PARAMS.scoop, ...params.scoop };
    }
    // Strip removed allRows field from old saved designs
    const { allRows: _, ...cleanScoop } = scoopConfig as typeof scoopConfig & { allRows?: unknown };
    scoopConfig = cleanScoop;
  }

  // Migrate old DividerConfig to CompartmentConfig
  let compartmentsConfig = DEFAULT_BIN_PARAMS.compartments;
  if (params.compartments !== undefined) {
    compartmentsConfig = { ...DEFAULT_BIN_PARAMS.compartments, ...params.compartments };
  } else if (params.dividers !== undefined) {
    // Legacy format: DividerConfig → CompartmentConfig
    const { x, y, thickness } = params.dividers;
    const cols = x + 1;
    const rows = y + 1;
    const cells: number[] = [];
    for (let i = 0; i < rows * cols; i++) {
      cells.push(i);
    }
    compartmentsConfig = { cols, rows, thickness, cells };
  }

  // Migrate old number-based WallConfig to WallCutout format
  const wallsConfig = migrateWalls(params.walls, DEFAULT_BIN_PARAMS.walls, DISABLED_WALL_CUTOUT);

  // Migrate legacy base.solid=true → style='solid'
  const baseConfig = { ...DEFAULT_BIN_PARAMS.base, ...(params.base ?? {}) };
  let style = params.style ?? DEFAULT_BIN_PARAMS.style;
  if (baseConfig.solid && style !== 'solid') {
    style = 'solid';
  }

  // Backfill slot config and divider pieces
  const slotConfig: SlotConfig = {
    ...DEFAULT_SLOT_CONFIG,
    ...((params.slotConfig as Partial<SlotConfig> | undefined) ?? {}),
    x: {
      ...DEFAULT_SLOT_CONFIG.x,
      ...(params.slotConfig?.x as Partial<SlotConfig['x']> | undefined),
    },
    y: {
      ...DEFAULT_SLOT_CONFIG.y,
      ...(params.slotConfig?.y as Partial<SlotConfig['y']> | undefined),
    },
  };

  const dividerPieces: DividerPieceConfig = {
    ...DEFAULT_DIVIDER_PIECE_CONFIG,
    ...((params.dividerPieces as Partial<DividerPieceConfig> | undefined) ?? {}),
  };

  // Migrate wallPattern config, handling 3 cases:
  // Fresh object each time — avoid returning shared DEFAULT_WALL_PATTERN_CONFIG reference
  let wallPatternConfig: WallPatternConfig = { enabled: false, pattern: 'honeycomb' };
  if (params.wallPattern !== undefined) {
    wallPatternConfig = { ...wallPatternConfig, ...params.wallPattern };
  } else if (params.eco !== undefined) {
    const honeycombWall = params.eco.honeycombWall;
    if (honeycombWall) {
      wallPatternConfig = {
        enabled:
          typeof honeycombWall.enabled === 'boolean'
            ? honeycombWall.enabled
            : typeof honeycombWall.mode === 'string'
              ? honeycombWall.mode !== 'none'
              : false,
        pattern: 'honeycomb',
      };
    }
  }

  // Migrate cutoutConfig and handle legacy per-cutout topOffset
  const cutoutConfig: CutoutConfig = {
    ...DEFAULT_CUTOUT_CONFIG,
    ...((params.cutoutConfig as Partial<CutoutConfig> | undefined) ?? {}),
  };

  // Migrate handle config (v2: ledges → holes)
  // Strip legacy ledge fields (depth, filletRadius) to prevent storage pollution
  const rawHandles = (params.handles ?? {}) as Record<string, unknown>;
  const { depth: _legacyDepth, filletRadius: _legacyFillet, ...cleanHandles } = rawHandles;
  const handlesConfig: HandleConfig = {
    ...DEFAULT_HANDLE_CONFIG,
    ...(cleanHandles as Partial<HandleConfig>),
    // Coerce removed/unknown shapes (e.g. the retired 'u-shape') back to the
    // default so old saves don't carry a value the type no longer allows.
    shape: VALID_HANDLE_SHAPES.includes(cleanHandles.shape as HandleCutoutShape)
      ? (cleanHandles.shape as HandleCutoutShape)
      : DEFAULT_HANDLE_CONFIG.shape,
    front: { ...DEFAULT_HANDLE_CONFIG.front, ...((rawHandles.front as object | undefined) ?? {}) },
    back: { ...DEFAULT_HANDLE_CONFIG.back, ...((rawHandles.back as object | undefined) ?? {}) },
    left: { ...DEFAULT_HANDLE_CONFIG.left, ...((rawHandles.left as object | undefined) ?? {}) },
    right: { ...DEFAULT_HANDLE_CONFIG.right, ...((rawHandles.right as object | undefined) ?? {}) },
  };

  // Remove legacy and already-handled fields from spread
  const {
    dividers: _legacyDividers,
    eco: _legacyEco,
    handles: _handlesHandled,
    ...rest
  } = params as Record<string, unknown>;

  return {
    ...DEFAULT_BIN_PARAMS,
    ...rest,
    style,
    base: baseConfig,
    compartments: compartmentsConfig,
    scoop: scoopConfig,
    label: { ...DEFAULT_BIN_PARAMS.label, ...(params.label ?? {}) },
    walls: wallsConfig,
    handles: handlesConfig,
    slotConfig,
    dividerPieces,
    inserts: params.inserts ?? DEFAULT_BIN_PARAMS.inserts,
    cutouts: (params.cutouts ?? DEFAULT_BIN_PARAMS.cutouts).map((c) =>
      migrateCutout(c as Cutout & LegacyCutoutFields)
    ),
    cutoutConfig,
    wallPattern: wallPatternConfig,
    featureColors: migrateFeatureColors(params.featureColors),
    lid: (() => {
      // Strip locked-down legacy fields (`fit`, `wallThickness`,
      // `topThickness`) from persisted designs — they're hardcoded in
      // `lidConstants.ts` now and re-spreading them would put unknown
      // properties back onto the typed config.
      const raw = (params.lid as Record<string, unknown> | undefined) ?? {};
      const {
        fit: _legacyFit,
        wallThickness: _legacyWall,
        topThickness: _legacyTop,
        clickRails: rawClickRails,
        clickRailCoverage: rawCoverage,
        ...stored
      } = raw;
      return {
        ...DEFAULT_LID_CONFIG,
        ...(stored as Partial<LidConfig>),
        // `clickRails` evolved from boolean → per-side object. Always
        // route through the migrator so the field is the right shape
        // regardless of how it was persisted.
        clickRails: migrateClickRails(rawClickRails),
        clickRailCoverage: migrateClickRailCoverage(rawCoverage),
      };
    })(),
    ...(params.splitConnectors !== undefined
      ? { splitConnectors: { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, ...params.splitConnectors } }
      : {}),
    textDefaults: {
      ...DEFAULT_TEXT_STYLE_DEFAULTS,
      ...((params as { textDefaults?: Partial<TextStyleDefaults> }).textDefaults ?? {}),
    },
  };
}

/**
 * Per-design geometry keys that are NOT carried into a user's custom
 * "default for new bins". These describe a *specific* bin, not a reusable
 * style, so they reset to the factory baseline on every new design.
 *
 * Implemented as a denylist (rather than an allowlist of style keys) so
 * that future style parameters added to `BinParams` automatically flow
 * into saved user defaults without anyone remembering to update a list.
 *
 * `migrateParams()` backfills each of these from `DEFAULT_BIN_PARAMS` when a
 * stored partial is loaded, so stripping them is a safe reset-to-factory.
 */
export const STYLE_DEFAULT_OMIT_KEYS = [
  'cellMask',
  'compartments',
  'cutouts',
  'inserts',
  'handles',
  'walls',
  'overhang',
] as const satisfies readonly (keyof BinParams)[];

/**
 * Extract the style/feature preferences from a full set of bin params,
 * dropping per-design geometry (see `STYLE_DEFAULT_OMIT_KEYS`). The result
 * is a partial suitable for persisting as the user's default for new bins;
 * `migrateParams()` re-completes it on load.
 */
export function extractStyleDefaults(params: BinParams): Partial<BinParams> {
  const omit = new Set<string>(STYLE_DEFAULT_OMIT_KEYS);
  return Object.fromEntries(Object.entries(params).filter(([key]) => !omit.has(key)));
}
