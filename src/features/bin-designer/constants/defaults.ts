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
  scoop: false,
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
  wireframeMode: false,
} as const;

/** Default empty history */
export const DEFAULT_HISTORY: DesignerHistory = {
  past: [],
  future: [],
} as const;
