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
  HandleSide,
  WallCutout,
  WallConfig,
  WallCutoutShape,
  SlotConfig,
  DividerPieceConfig,
  WallPatternConfig,
  CutoutConfig,
  SplitConnectorConfig,
} from '../types';
import type { FeatureColorConfig } from '../types/featureColors';
import type { LidConfig } from '../types/lid';
import { DEFAULT_LID_CONFIG, LID_CLICK_RAIL_COVERAGE_OPTIONS } from '../types/lid';
import type { LidClickRails } from '../types/lid';
import type { TextStyleDefaults } from '../types/text';
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
  ridgeWidthFraction: 0.35,
  ridgeHeightFraction: 0.8,
} as const;

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
    frontLeft: '#d4d8dc',
    frontRight: '#d4d8dc',
    backRight: '#d4d8dc',
    backLeft: '#d4d8dc',
  },
  labelTab: '#d4d8dc',
  base: '#d4d8dc',
  scoop: '#d4d8dc',
  dividers: '#d4d8dc',
  text: '#d4d8dc',
} as const;

interface LegacyFeatureColorInput {
  enabled?: boolean;
  body?: string;
  /** Legacy single-color string or the new 4-corner object. */
  lip?: string | Partial<FeatureColorConfig['lip']>;
  labelTab?: string;
  base?: string;
  scoop?: string;
  dividers?: string;
  text?: string;
}

function resolveColor(raw: string | undefined, fallback: string): string {
  if (raw === undefined) return fallback;
  return LEGACY_SLOT_COLORS[raw] ?? raw;
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

  let lip: FeatureColorConfig['lip'];
  if (typeof raw.lip === 'string') {
    const single = resolveColor(raw.lip, body);
    lip = { frontLeft: single, frontRight: single, backRight: single, backLeft: single };
  } else if (raw.lip && typeof raw.lip === 'object') {
    lip = {
      frontLeft: raw.lip.frontLeft ?? body,
      frontRight: raw.lip.frontRight ?? body,
      backRight: raw.lip.backRight ?? body,
      backLeft: raw.lip.backLeft ?? body,
    };
  } else {
    lip = { frontLeft: body, frontRight: body, backRight: body, backLeft: body };
  }

  const base = resolveColor(raw.base, body);
  const scoop = resolveColor(raw.scoop, body);
  const dividers = resolveColor(raw.dividers, body);
  // Text defaults to the label-tab color so single-color designs see no shift
  // when this field is added by migration.
  const text = resolveColor(raw.text, labelTab);

  // Pre-`enabled` design counts as multi-color if body or any zone diverges
  // from the default — zone editors only existed behind the old Labs flag, so
  // any customized color implies multi-color intent.
  const bodyLower = body.toLowerCase();
  const isCustom = (c: string): boolean => c.toLowerCase() !== bodyLower;
  const hasCustomColor =
    bodyLower !== DEFAULT_FEATURE_COLOR_CONFIG.body.toLowerCase() ||
    [labelTab, base, scoop, dividers, text].some(isCustom) ||
    [lip.frontLeft, lip.frontRight, lip.backRight, lip.backLeft].some(isCustom);

  return {
    enabled: raw.enabled ?? hasCustomColor,
    body,
    lip,
    labelTab,
    base,
    scoop,
    dividers,
    text,
  };
}

/** Default bin parameters: 2x2x3 standard bin with no compartments */
export const DEFAULT_BIN_PARAMS: BinParams = {
  width: 2,
  depth: 2,
  height: 3,
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
} as const;

/** Default generation state */
export const DEFAULT_GENERATION_STATE: GenerationState = {
  status: 'idle',
  mesh: null,
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
  colorTool: null,
  swapFirstZone: null,
  pickerOverlay: null,
  shapeEditorOpen: false,
  selectedDividerKey: null,
  hoveredDividerKey: null,
};

/** Default empty history */
export const DEFAULT_HISTORY: DesignerHistory = {
  past: [],
  future: [],
} as const;

/** Legacy wall config where sides could be numbers instead of WallCutout objects. */
interface LegacyWallConfig {
  enabled?: boolean;
  shape?: WallCutoutShape;
  width?: number;
  depth?: number;
  front?: number | Partial<WallCutout>;
  back?: number | Partial<WallCutout>;
  left?: number | Partial<WallCutout>;
  right?: number | Partial<WallCutout>;
  interior?: Partial<WallCutout>;
}

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
  let wallsConfig: WallConfig = DEFAULT_BIN_PARAMS.walls;
  if (params.walls !== undefined) {
    const raw = params.walls as LegacyWallConfig;

    // Helper: infer enabled from non-zero values
    const inferEnabled = (cutout: WallCutout): WallCutout => ({
      ...cutout,
      enabled: cutout.enabled || cutout.width > 0 || cutout.depth > 0,
    });

    // Detect legacy format: values are numbers instead of WallCutout objects
    if (
      typeof raw.front === 'number' ||
      typeof raw.back === 'number' ||
      typeof raw.left === 'number' ||
      typeof raw.right === 'number'
    ) {
      const toWallCutout = (val: number | Partial<WallCutout> | undefined): WallCutout => {
        if (typeof val === 'number') {
          return {
            ...DISABLED_WALL_CUTOUT,
            enabled: val > 0,
            width: val,
            depth: val > 0 ? 100 : 0,
          };
        }
        if (val && typeof val === 'object' && 'width' in val) {
          return inferEnabled({
            ...DEFAULT_BIN_PARAMS.walls.front,
            ...val,
          });
        }
        return DEFAULT_BIN_PARAMS.walls.front;
      };
      const front = toWallCutout(raw.front);
      const back = toWallCutout(raw.back);
      const left = toWallCutout(raw.left);
      const right = toWallCutout(raw.right);
      const interior = raw.interior
        ? inferEnabled({
            ...DEFAULT_BIN_PARAMS.walls.interior,
            ...raw.interior,
          })
        : DEFAULT_BIN_PARAMS.walls.interior;
      const anySideEnabled =
        front.enabled || back.enabled || left.enabled || right.enabled || interior.enabled;
      wallsConfig = {
        enabled: anySideEnabled,
        shape: DEFAULT_BIN_PARAMS.walls.shape,
        width: DEFAULT_BIN_PARAMS.walls.width,
        depth: DEFAULT_BIN_PARAMS.walls.depth,
        front,
        back,
        left,
        right,
        interior,
      };
    } else {
      // New/current format: merge each side with defaults
      const mergeSide = (
        defaultSide: WallCutout,
        rawSide: Partial<WallCutout> | undefined
      ): WallCutout => {
        const merged = { ...defaultSide, ...rawSide };
        // Backfill enabled for old saves that lack the field
        if (rawSide && !('enabled' in rawSide)) {
          return inferEnabled(merged);
        }
        return merged;
      };
      const asCutout = (
        v: number | Partial<WallCutout> | undefined
      ): Partial<WallCutout> | undefined => (typeof v === 'number' ? undefined : v);
      const front = mergeSide(DEFAULT_BIN_PARAMS.walls.front, asCutout(raw.front));
      const back = mergeSide(DEFAULT_BIN_PARAMS.walls.back, asCutout(raw.back));
      const left = mergeSide(DEFAULT_BIN_PARAMS.walls.left, asCutout(raw.left));
      const right = mergeSide(DEFAULT_BIN_PARAMS.walls.right, asCutout(raw.right));
      const interior = mergeSide(DEFAULT_BIN_PARAMS.walls.interior, raw.interior);

      // Backfill top-level enabled/width/depth for old saves missing these fields
      const hasGlobalEnabled = 'enabled' in raw && typeof raw.enabled === 'boolean';
      const anySideEnabled =
        front.enabled || back.enabled || left.enabled || right.enabled || interior.enabled;
      const VALID_SHAPES: readonly WallCutoutShape[] = ['u-shape', 'scoop', 'funnel'];
      wallsConfig = {
        enabled: hasGlobalEnabled ? raw.enabled === true : anySideEnabled,
        shape:
          raw.shape && VALID_SHAPES.includes(raw.shape)
            ? raw.shape
            : DEFAULT_BIN_PARAMS.walls.shape,
        width: typeof raw.width === 'number' ? raw.width : DEFAULT_BIN_PARAMS.walls.width,
        depth: typeof raw.depth === 'number' ? raw.depth : DEFAULT_BIN_PARAMS.walls.depth,
        front,
        back,
        left,
        right,
        interior,
      };
    }
  }

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
