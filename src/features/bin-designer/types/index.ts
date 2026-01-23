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
export type BaseStyle = 'standard' | 'magnet' | 'screw' | 'magnet_and_screw' | 'weighted';

/** Bin wall/style variant affecting thickness and reinforcement */
export type BinStyle = 'standard' | 'lite' | 'solid';

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

/** Scoop ramp configuration for compartment accessibility */
export interface ScoopConfig {
  readonly enabled: boolean;
  /** Scoop radius in mm. 'auto' = min(compartmentSize/3, 15mm) */
  readonly radius: number | 'auto';
  /** Whether to add scoops to all compartment rows (true) or only front row (false) */
  readonly allRows: boolean;
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
  readonly scoop: ScoopConfig;
  readonly label: LabelConfig;
  readonly walls: WallConfig;
  readonly inserts: Insert[];
}

// =============================================================================
// Insert Types
// =============================================================================

/** Shape of a cavity cut into the bin floor */
export type InsertShape = 'rectangle' | 'circle' | 'hexagon' | 'rounded-rect' | 'slot';

/** Template category for grouping */
export type TemplateCategory = 'electronics' | 'hardware' | 'tools';

/** A placed insert instance on the bin floor */
export interface Insert {
  readonly id: string;
  readonly templateId: string | null;
  readonly shape: InsertShape;
  /** X position in mm from bin interior left edge */
  readonly x: number;
  /** Y position in mm from bin interior front edge */
  readonly y: number;
  /** Width in mm (or diameter for circle/hexagon) */
  readonly width: number;
  /** Depth in mm (ignored for circle/hexagon) */
  readonly depth: number;
  /** Cavity depth in mm (how deep the cut goes) */
  readonly cutDepth: number;
  /** Rotation in degrees (0, 90, 180, 270) */
  readonly rotation: 0 | 90 | 180 | 270;
  /** Corner radius for rounded-rect shape (mm) */
  readonly cornerRadius: number;
  /** Optional label for the insert */
  readonly label: string;
}

/** A configurable parameter on a template */
export interface ConfigurableParam {
  readonly key: keyof Insert;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
}

/** A pre-built insert template definition */
export interface InsertTemplate {
  readonly id: string;
  readonly name: string;
  readonly category: TemplateCategory;
  readonly description: string;
  readonly shape: InsertShape;
  /** Default insert values (position excluded — set on placement) */
  readonly defaults: Omit<Insert, 'id' | 'templateId' | 'x' | 'y'>;
  /** Which parameters users can adjust after placing */
  readonly configurableParams: readonly ConfigurableParam[];
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

/** Auto-save status indicator */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** UI state for the designer page */
export interface DesignerUIState {
  readonly activeTab: DesignerTab;
  readonly exportDialogOpen: boolean;
  readonly designListOpen: boolean;
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

  // Persistence
  currentDesignId: string | null;
  designName: string;
  saveStatus: SaveStatus;

  // Param actions
  setParam: <K extends keyof BinParams>(key: K, value: BinParams[K]) => void;
  setParams: (partial: Partial<BinParams>) => void;
  resetToDefaults: () => void;

  // History actions
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Persistence actions
  setCurrentDesignId: (id: string | null) => void;
  setDesignName: (name: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
  newDesign: () => void;
  loadDesign: (design: SavedDesign) => void;

  // Insert actions
  addInsert: (insert: Insert) => void;
  removeInsert: (id: string) => void;
  updateInsert: (id: string, updates: Partial<Insert>) => void;
  clearInserts: () => void;

  // Generation actions
  setGenerationStatus: (status: GenerationStatus) => void;
  setGenerationResult: (result: GenerationResult) => void;
  setWasmStatus: (status: WasmStatus) => void;

  // UI actions
  setActiveTab: (tab: DesignerTab) => void;
  setExportDialogOpen: (open: boolean) => void;
  setDesignListOpen: (open: boolean) => void;
  setWireframeMode: (enabled: boolean) => void;
}

// =============================================================================
// Export Cart Types
// =============================================================================

/** A snapshot of a design queued for batch export */
export interface CartItem {
  readonly id: string;
  readonly name: string;
  readonly params: BinParams;
  readonly thumbnail: string | null;
  readonly addedAt: string;
}

/** Batch export cart store state */
export interface CartState {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'addedAt'>) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
}
