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
} from '../types';

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
  inserts: [],
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

  // Remove legacy dividers field from spread
  const { dividers: _legacyDividers, ...rest } = params as Record<string, unknown>;

  return {
    ...DEFAULT_BIN_PARAMS,
    ...rest,
    base: { ...DEFAULT_BIN_PARAMS.base, ...(params.base ?? {}) },
    compartments: compartmentsConfig,
    scoop: scoopConfig,
    label: { ...DEFAULT_BIN_PARAMS.label, ...(params.label ?? {}) },
    walls: wallsConfig,
    inserts: params.inserts ?? DEFAULT_BIN_PARAMS.inserts,
  } as BinParams;
}
