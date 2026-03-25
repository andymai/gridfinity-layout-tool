/**
 * Default bin parameters for the designer.
 */

import type {
  BinParams,
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

/** Default feature color config: all zones use the primary filament slot */
export const DEFAULT_FEATURE_COLOR_CONFIG: FeatureColorConfig = {
  body: 'slot1',
  lip: 'slot1',
  labelTab: 'slot1',
} as const;

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
} as const;

/** Default generation state */
export const DEFAULT_GENERATION_STATE: GenerationState = {
  status: 'idle',
  mesh: null,
  progress: 0,
  epoch: 0,
} as const;

/** Default UI state */
export const DEFAULT_UI_STATE: DesignerUIState = {
  activeTab: 'dimensions',
  exportDialogOpen: false,
  designListOpen: false,
  wireframeMode: false,
  halfBinMode: false,
  cutoutEditorOpen: false,
  previewCompartments: null,
  previewSelection: null,
  splitViewMode: 'exploded',
  splitPieceMeshes: [],
  hoveredColorZone: null,
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

/** Input type for migrateParams — current params plus known legacy fields. */
type MigrateParamsInput = Partial<BinParams> & LegacyFields;

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
    cutouts: params.cutouts ?? DEFAULT_BIN_PARAMS.cutouts,
    cutoutConfig,
    wallPattern: wallPatternConfig,
    featureColors: params.featureColors
      ? { ...DEFAULT_FEATURE_COLOR_CONFIG, ...params.featureColors }
      : DEFAULT_FEATURE_COLOR_CONFIG,
    ...(params.splitConnectors !== undefined
      ? { splitConnectors: { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, ...params.splitConnectors } }
      : {}),
  } as BinParams;
}
