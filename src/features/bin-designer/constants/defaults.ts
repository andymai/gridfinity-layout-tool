/**
 * Default bin parameters for the designer.
 */

import type { BinParams, DesignerUIState, GenerationState, DesignerHistory } from '../types';

/** Default bin parameters: 2x2x3 standard bin with no features */
export const DEFAULT_BIN_PARAMS: BinParams = {
  width: 2,
  depth: 2,
  height: 3,
  base: {
    style: 'standard',
    magnetDiameter: 6,
    magnetDepth: 2.4,
    screwDiameter: 3,
    stackingLip: true,
  },
  style: 'standard',
  dividers: {
    x: 0,
    y: 0,
    thickness: 1.2,
  },
  scoop: {
    enabled: false,
    radius: 'auto',
    allRows: false,
  },
  label: {
    enabled: false,
    text: '',
    fontSize: 'auto',
  },
  walls: {
    front: 0,
    back: 0,
    left: 0,
    right: 0,
  },
  inserts: [],
} as const;

/** Default generation state */
export const DEFAULT_GENERATION_STATE: GenerationState = {
  status: 'idle',
  mesh: null,
  progress: 0,
} as const;

/** Default UI state */
export const DEFAULT_UI_STATE: DesignerUIState = {
  activeTab: 'dimensions',
  exportDialogOpen: false,
  designListOpen: false,
  wireframeMode: false,
} as const;

/** Default empty history */
export const DEFAULT_HISTORY: DesignerHistory = {
  past: [],
  future: [],
} as const;

/**
 * Populate missing bin parameters with default values.
 * Handles backward compatibility for old designs (e.g., scoop was boolean).
 *
 * @param params - Partial bin parameters to migrate; any fields not provided will be filled from `DEFAULT_BIN_PARAMS`.
 * @returns A complete `BinParams` object with unspecified fields taken from `DEFAULT_BIN_PARAMS`.
 */
export function migrateParams(params: Partial<BinParams>): BinParams {
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

  return {
    ...DEFAULT_BIN_PARAMS,
    ...params,
    base: { ...DEFAULT_BIN_PARAMS.base, ...(params.base ?? {}) },
    dividers: { ...DEFAULT_BIN_PARAMS.dividers, ...(params.dividers ?? {}) },
    scoop: scoopConfig,
    label: { ...DEFAULT_BIN_PARAMS.label, ...(params.label ?? {}) },
    walls: { ...DEFAULT_BIN_PARAMS.walls, ...(params.walls ?? {}) },
    inserts: params.inserts ?? DEFAULT_BIN_PARAMS.inserts,
  };
}
