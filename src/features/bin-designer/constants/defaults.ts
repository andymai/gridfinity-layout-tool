/**
 * Default bin parameters for the designer.
 */

import type {
  BinParams,
  DesignerUIState,
  GenerationState,
  DesignerHistory,
  WallCutout,
  WallConfig,
  SlotConfig,
  DividerPieceConfig,
  WallPatternConfig,
  CutoutConfig,
} from '../types';

/** Default slot configuration: vertical (x-axis) enabled, 20mm pitch */
export const DEFAULT_SLOT_CONFIG: SlotConfig = {
  x: { enabled: true, pitch: 20 },
  y: { enabled: false, pitch: 20 },
  width: 2.0,
  depth: 1.0,
} as const;

/** Default divider piece configuration */
export const DEFAULT_DIVIDER_PIECE_CONFIG: DividerPieceConfig = {
  height: 'auto',
  thickness: 1.6,
  clearance: 0.25,
} as const;

/** Default wall pattern configuration: disabled */
export const DEFAULT_WALL_PATTERN_CONFIG: WallPatternConfig = {
  enabled: false,
  pattern: 'honeycomb',
} as const;

/** Default cutout configuration: flush with rim (no offset) */
export const DEFAULT_CUTOUT_CONFIG: CutoutConfig = {
  topOffset: 0,
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
    allRows: false,
  },
  label: {
    enabled: false,
    support: 'bracket',
    depth: 12,
    width: 100,
    alignment: 'left',
  },
  walls: {
    front: { width: 0, depth: 0 },
    back: { width: 0, depth: 0 },
    left: { width: 0, depth: 0 },
    right: { width: 0, depth: 0 },
    interior: { width: 0, depth: 0 },
  },
  slotConfig: DEFAULT_SLOT_CONFIG,
  dividerPieces: DEFAULT_DIVIDER_PIECE_CONFIG,
  inserts: [],
  cutouts: [],
  cutoutConfig: DEFAULT_CUTOUT_CONFIG,
  wallPattern: DEFAULT_WALL_PATTERN_CONFIG,
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
};

/** Default empty history */
export const DEFAULT_HISTORY: DesignerHistory = {
  past: [],
  future: [],
} as const;

/**
 * Populate missing bin parameters with default values.
 * Handles backward compatibility for old designs:
 * - scoop was boolean in earlier versions
 * - dividers (DividerConfig) migrates to compartments (CompartmentConfig)
 *
 * @param params - Partial bin parameters to migrate; any fields not provided will be filled from `DEFAULT_BIN_PARAMS`.
 * @returns A complete `BinParams` object with unspecified fields taken from `DEFAULT_BIN_PARAMS`.
 */
export function migrateParams(
  params: Partial<BinParams> & { dividers?: { x: number; y: number; thickness: number } }
): BinParams {
  // Migrate old boolean scoop format to ScoopConfig
  let scoopConfig = DEFAULT_BIN_PARAMS.scoop;
  if (params.scoop !== undefined) {
    if (typeof params.scoop === 'boolean') {
      // Legacy format: boolean → ScoopConfig
      scoopConfig = { ...DEFAULT_BIN_PARAMS.scoop, enabled: params.scoop };
    } else {
      scoopConfig = { ...DEFAULT_BIN_PARAMS.scoop, ...params.scoop };
    }
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
    const raw = params.walls as unknown as Record<string, unknown>;
    // Detect legacy format: values are numbers instead of WallCutout objects
    if (
      typeof raw.front === 'number' ||
      typeof raw.back === 'number' ||
      typeof raw.left === 'number' ||
      typeof raw.right === 'number'
    ) {
      const toWallCutout = (val: unknown): WallCutout => {
        if (typeof val === 'number') {
          return { width: val, depth: val > 0 ? 100 : 0 };
        }
        if (val && typeof val === 'object' && 'width' in val) {
          return { ...DEFAULT_BIN_PARAMS.walls.front, ...(val as Partial<WallCutout>) };
        }
        return DEFAULT_BIN_PARAMS.walls.front;
      };
      wallsConfig = {
        front: toWallCutout(raw.front),
        back: toWallCutout(raw.back),
        left: toWallCutout(raw.left),
        right: toWallCutout(raw.right),
        interior:
          raw.interior && typeof raw.interior === 'object'
            ? { ...DEFAULT_BIN_PARAMS.walls.interior, ...(raw.interior as Partial<WallCutout>) }
            : DEFAULT_BIN_PARAMS.walls.interior,
      };
    } else {
      // New format: merge each side with defaults
      wallsConfig = {
        front: { ...DEFAULT_BIN_PARAMS.walls.front, ...((raw.front as Partial<WallCutout>) ?? {}) },
        back: { ...DEFAULT_BIN_PARAMS.walls.back, ...((raw.back as Partial<WallCutout>) ?? {}) },
        left: { ...DEFAULT_BIN_PARAMS.walls.left, ...((raw.left as Partial<WallCutout>) ?? {}) },
        right: { ...DEFAULT_BIN_PARAMS.walls.right, ...((raw.right as Partial<WallCutout>) ?? {}) },
        interior: {
          ...DEFAULT_BIN_PARAMS.walls.interior,
          ...((raw.interior as Partial<WallCutout>) ?? {}),
        },
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
    x: { ...DEFAULT_SLOT_CONFIG.x, ...((params.slotConfig?.x as Partial<SlotConfig['x']>) ?? {}) },
    y: { ...DEFAULT_SLOT_CONFIG.y, ...((params.slotConfig?.y as Partial<SlotConfig['y']>) ?? {}) },
  };

  const dividerPieces: DividerPieceConfig = {
    ...DEFAULT_DIVIDER_PIECE_CONFIG,
    ...((params.dividerPieces as Partial<DividerPieceConfig> | undefined) ?? {}),
  };

  // Migrate wallPattern config, handling 3 cases:
  // 1. New `wallPattern` field → merge with defaults
  // 2. Legacy `eco` field → map eco.honeycombWall.enabled / legacy mode string → wallPattern
  // 3. Neither → fresh default
  // Fresh object each time — avoid returning shared DEFAULT_WALL_PATTERN_CONFIG reference
  let wallPatternConfig: WallPatternConfig = { enabled: false, pattern: 'honeycomb' };
  const rawParams = params as unknown as Record<string, unknown>;
  if (params.wallPattern !== undefined) {
    wallPatternConfig = { ...wallPatternConfig, ...params.wallPattern };
  } else if (rawParams.eco !== undefined) {
    const rawEco = rawParams.eco as Record<string, unknown>;
    if (rawEco.honeycombWall && typeof rawEco.honeycombWall === 'object') {
      const rawWall = rawEco.honeycombWall as Record<string, unknown>;
      // Legacy format had mode: 'none' | 'pocketed' | 'perforated'; new format uses enabled boolean only
      const hadMode = typeof rawWall.mode === 'string';
      const hadEnabled = typeof rawWall.enabled === 'boolean';
      wallPatternConfig = {
        enabled: hadEnabled
          ? (rawWall.enabled as boolean)
          : hadMode
            ? rawWall.mode !== 'none'
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

  // Remove legacy dividers and eco fields from spread
  const { dividers: _legacyDividers, eco: _legacyEco, ...rest } = params as Record<string, unknown>;

  return {
    ...DEFAULT_BIN_PARAMS,
    ...rest,
    style,
    base: baseConfig,
    compartments: compartmentsConfig,
    scoop: scoopConfig,
    label: { ...DEFAULT_BIN_PARAMS.label, ...(params.label ?? {}) },
    walls: wallsConfig,
    slotConfig,
    dividerPieces,
    inserts: params.inserts ?? DEFAULT_BIN_PARAMS.inserts,
    cutouts: params.cutouts ?? DEFAULT_BIN_PARAMS.cutouts,
    cutoutConfig,
    wallPattern: wallPatternConfig,
  } as BinParams;
}
