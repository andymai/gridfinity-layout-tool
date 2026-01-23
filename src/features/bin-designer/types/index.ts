/**
 * Bin Designer type definitions.
 *
 * Core types for parametric Gridfinity bin configuration,
 * generation state, and designer UI state.
 */

// =============================================================================
// Bin Configuration Types
// =============================================================================

/** Base attachment style for bin-to-baseplate connection */
export type BaseStyle = 'standard' | 'magnet' | 'screw' | 'weighted';

/** Bin wall/style variant affecting thickness and reinforcement */
export type BinStyle = 'standard' | 'lite' | 'solid' | 'vase' | 'rugged';

/** Base configuration for bin attachment */
export interface BaseConfig {
  readonly style: BaseStyle;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  readonly screwDiameter: number;
  readonly stackingLip: boolean;
}

/** Divider configuration for compartment splitting */
export interface DividerConfig {
  readonly x: number;
  readonly y: number;
  readonly thickness: number;
}

/** Label configuration for front-face text embossing */
export interface LabelConfig {
  readonly enabled: boolean;
  readonly text: string;
  readonly fontSize: 'auto' | number;
}

/** Wall cutout percentages (0-100) per side */
export interface WallConfig {
  readonly front: number;
  readonly back: number;
  readonly left: number;
  readonly right: number;
}

/** Complete bin parameter set for generation */
export interface BinParams {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly base: BaseConfig;
  readonly style: BinStyle;
  readonly dividers: DividerConfig;
  readonly scoop: boolean;
  readonly label: LabelConfig;
  readonly walls: WallConfig;
}

// =============================================================================
// Generation Types
// =============================================================================

/** Current status of the generation engine */
export type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

/** WASM/Worker initialization status */
export type WasmStatus = 'unloaded' | 'loading' | 'ready' | 'error';

/** Result of mesh generation */
export interface GenerationResult {
  readonly vertices: Float32Array | null;
  readonly normals: Float32Array | null;
  readonly error: string | null;
  readonly timingMs: number;
}

/** Generation state tracked in the store */
export interface GenerationState {
  readonly status: GenerationStatus;
  readonly mesh: GenerationResult | null;
  readonly progress: number;
}

// =============================================================================
// Designer UI State Types
// =============================================================================

/** Active tab in the parameter panel */
export type DesignerTab = 'dimensions' | 'base' | 'features' | 'walls' | 'style';

/** UI state for the designer page */
export interface DesignerUIState {
  readonly activeTab: DesignerTab;
  readonly exportDialogOpen: boolean;
  readonly wireframeMode: boolean;
}

/** Undo/redo history for bin parameters */
export interface DesignerHistory {
  readonly past: readonly BinParams[];
  readonly future: readonly BinParams[];
}

// =============================================================================
// Storage Types
// =============================================================================

/** Saved design entry in IndexedDB */
export interface SavedDesign {
  readonly id: string;
  readonly name: string;
  readonly params: BinParams;
  readonly thumbnail: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// =============================================================================
// Store Types
// =============================================================================

/** Complete designer store state */
export interface DesignerState {
  // Data
  params: BinParams;
  generation: GenerationState;
  history: DesignerHistory;
  wasmStatus: WasmStatus;
  ui: DesignerUIState;

  // Param actions
  setParam: <K extends keyof BinParams>(key: K, value: BinParams[K]) => void;
  setParams: (partial: Partial<BinParams>) => void;
  resetToDefaults: () => void;

  // History actions
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Generation actions
  setGenerationStatus: (status: GenerationStatus) => void;
  setGenerationResult: (result: GenerationResult) => void;
  setWasmStatus: (status: WasmStatus) => void;

  // UI actions
  setActiveTab: (tab: DesignerTab) => void;
  setExportDialogOpen: (open: boolean) => void;
  setWireframeMode: (enabled: boolean) => void;
}
