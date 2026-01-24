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

/** Divider configuration for compartment splitting (legacy — use CompartmentConfig) */
export interface DividerConfig {
  readonly x: number;
  readonly y: number;
  readonly thickness: number;
}

/**
 * Non-uniform compartment layout using a grid-based cell ownership model.
 *
 * The bin interior is divided into a `cols × rows` grid. Each cell is assigned
 * a compartment ID. Adjacent cells sharing the same ID form one rectangular
 * compartment. Divider walls are derived from boundaries between cells with
 * different IDs.
 *
 * Example: 3×2 grid with one 2-wide compartment on top row:
 *   cells: [0, 0, 1, 2, 3, 4]  →  row 0: [0,0,1], row 1: [2,3,4]
 *   Compartment 0 spans columns 0-1 of row 0.
 */
export interface CompartmentConfig {
  /** Number of columns along width axis (1-8) */
  readonly cols: number;
  /** Number of rows along depth axis (1-8) */
  readonly rows: number;
  /** Divider wall thickness in mm */
  readonly thickness: number;
  /**
   * Cell-to-compartment mapping, stored row-major (length = rows * cols).
   * cells[row * cols + col] = compartment ID for that cell.
   * Cells with the same ID must form a rectangle.
   */
  readonly cells: number[];
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
  /** Grid unit size in mm (default 42mm per Gridfinity spec) */
  readonly gridUnitMm: number;
  /** Height unit size in mm (default 7mm per Gridfinity spec) */
  readonly heightUnitMm: number;
  /** Wall thickness in mm (default 1.2). Ignored when style is 'solid'. */
  readonly wallThickness: number;
  readonly base: BaseConfig;
  readonly style: BinStyle;
  readonly compartments: CompartmentConfig;
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
  /** Increments on changes needing regeneration; cache hits leave epoch unchanged */
  readonly epoch: number;
}

/** Cached mesh data for undo/redo history entries */
export interface CachedMesh {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly triangleCount: number;
  readonly byteSize: number;
}

/** History entry pairing params with optional cached mesh */
export interface HistoryEntry {
  readonly params: BinParams;
  readonly mesh: CachedMesh | null;
}

// =============================================================================
// Designer UI State Types
// =============================================================================

/** Active tab in the parameter panel */
export type DesignerTab = 'dimensions' | 'base' | 'compartments' | 'walls' | 'style';

/** Auto-save status indicator */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** UI state for the designer page */
export interface DesignerUIState {
  readonly activeTab: DesignerTab;
  readonly exportDialogOpen: boolean;
  readonly designListOpen: boolean;
  readonly wireframeMode: boolean;
  /** Whether half-bin mode is enabled (0.5 grid unit increments for width/depth) */
  readonly halfBinMode: boolean;
}

/** Undo/redo history for bin parameters with optional mesh cache */
export interface DesignerHistory {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
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

  // Compartment actions
  setCompartmentGrid: (cols: number, rows: number) => void;
  mergeCells: (cellIndices: readonly number[]) => void;
  splitCompartment: (compartmentId: number) => void;
  resetCompartments: () => void;

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
  toggleHalfBinMode: () => void;
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
