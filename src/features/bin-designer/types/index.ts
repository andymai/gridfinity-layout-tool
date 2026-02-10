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
export type BaseStyle = 'standard' | 'magnet' | 'screw' | 'magnet_and_screw' | 'weighted' | 'flat';

/** Bin wall/style variant */
export type BinStyle = 'standard' | 'slotted' | 'solid';

/** Slot configuration for one axis */
export interface AxisSlotConfig {
  readonly enabled: boolean;
  /** Distance between slot centers in mm */
  readonly pitch: number;
}

/** Slot configuration for removable divider walls */
export interface SlotConfig {
  /** Slots on left/right walls (for Y-axis dividers) */
  readonly x: AxisSlotConfig;
  /** Slots on front/back walls (for X-axis dividers) */
  readonly y: AxisSlotConfig;
  /** Slot opening width in mm */
  readonly width: number;
  /** Slot cut depth into wall in mm */
  readonly depth: number;
}

/** Configuration for removable divider pieces */
export interface DividerPieceConfig {
  /** Height in mm, or 'auto' to match bin interior height */
  readonly height: number | 'auto';
  /** Divider wall thickness in mm */
  readonly thickness: number;
  /** Fit clearance in mm (subtracted from each side) */
  readonly clearance: number;
}

/** Base configuration for bin attachment */
export interface BaseConfig {
  readonly style: BaseStyle;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  readonly screwDiameter: number;
  readonly stackingLip: boolean;
  /** When true, the bin body is a solid block (no cavity). Used by cutouts feature. */
  readonly solid: boolean;
  /** When true, subdivides each cell into 0.5×0.5 half sockets instead of full 1×1 sockets. */
  readonly halfSockets: boolean;
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
}

/** Horizontal alignment of each label tab within its compartment column */
export type LabelTabAlignment = 'left' | 'center' | 'right';

/** Support structure style for the label tab */
export type LabelTabSupport = 'bracket' | 'solid';

/** Label tab configuration for back-wall identification shelf */
export interface LabelTabConfig {
  readonly enabled: boolean;
  /** Support structure: 'bracket' = open gussets, 'solid' = filled triangle */
  readonly support: LabelTabSupport;
  /** Depth of tab from inner back wall (horizontal inward), in mm */
  readonly depth: number;
  /** Width of each tab as percentage of compartment column width (1-100) */
  readonly width: number;
  /** Horizontal alignment within each compartment column */
  readonly alignment: LabelTabAlignment;
}

/** A single wall cutout: width of the U-notch (centered) and depth from wall top */
export interface WallCutout {
  /** Width of the cutout as 0-100% of the wall span (centered) */
  readonly width: number;
  /** Depth of the cutout as 0-100% of the wall height (from top) */
  readonly depth: number;
}

/** Wall cutout configuration per side plus interior divider walls */
export interface WallConfig {
  readonly front: WallCutout;
  readonly back: WallCutout;
  readonly left: WallCutout;
  readonly right: WallCutout;
  /** Uniform cutout applied to all interior compartment divider walls */
  readonly interior: WallCutout;
}

// =============================================================================
// Wall Pattern Types
// =============================================================================

/** Supported wall pattern types. Extensible via pattern registry. */
export type WallPatternType = 'honeycomb';

/** Wall pattern configuration — stored per design in BinParams */
export interface WallPatternConfig {
  readonly enabled: boolean;
  readonly pattern: WallPatternType;
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
  /** Wall thickness in mm (default 1.2) */
  readonly wallThickness: number;
  readonly base: BaseConfig;
  readonly style: BinStyle;
  readonly compartments: CompartmentConfig;
  readonly scoop: ScoopConfig;
  readonly label: LabelTabConfig;
  readonly walls: WallConfig;
  readonly slotConfig: SlotConfig;
  readonly dividerPieces: DividerPieceConfig;
  readonly inserts: Insert[];
  readonly cutouts: Cutout[];
  readonly cutoutConfig: CutoutConfig;
  readonly wallPattern: WallPatternConfig;
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
// Cutout Types (Top-Down Cavity Cuts for Solid Bins)
// =============================================================================

/** Shape of a top-down cutout into solid bin body */
export type CutoutShape = 'rectangle' | 'circle';

/** Global cutout configuration for solid bins */
export interface CutoutConfig {
  /** Global top offset: lowers the solid fill surface below the rim (0 = flush with rim) */
  readonly topOffset: number;
}

/** A positioned cutout instance on the bin top surface */
export interface Cutout {
  readonly id: string;
  readonly shape: CutoutShape;
  /** X position of left edge in mm from bin interior left edge */
  readonly x: number;
  /** Y position of bottom edge in mm from bin interior front edge */
  readonly y: number;
  /** Width in mm (or diameter for circle) */
  readonly width: number;
  /** Depth in mm (ignored for circle) */
  readonly depth: number;
  /** Cavity depth in mm (how deep the cut goes from top surface) */
  readonly cutDepth: number;
  /** Rotation in degrees (0-359) */
  readonly rotation: number;
  /** Corner radius for rectangle shape (mm) */
  readonly cornerRadius: number;
  /** Optional label for the cutout */
  readonly label: string;
  /** Group ID for boolean union (null = ungrouped) */
  readonly groupId: string | null;
  /** Scoop radius in mm — fillets the bottom edges of the cutout for easy access */
  readonly scoopRadius?: number;
  /** When true, the cutout cannot be moved, resized, or rotated */
  readonly locked?: boolean;
  /** When true, the cutout is not rendered or selectable (faint ghost only) */
  readonly hidden?: boolean;
  /** Z-order for rendering layering (higher = rendered on top) */
  readonly zIndex?: number;
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
  readonly indices: Uint32Array | null;
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
  readonly indices: Uint32Array;
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
  /** Whether the full-workspace cutout editor is open (desktop only) */
  readonly cutoutEditorOpen: boolean;
  /** Preview compartments during drag-to-merge/split (shown as ghost in 3D view) */
  readonly previewCompartments: CompartmentConfig | null;
  /** Preview selection info for 3D ghost overlay */
  readonly previewSelection: {
    readonly action: 'merge' | 'split';
    readonly minCol: number;
    readonly maxCol: number;
    readonly minRow: number;
    readonly maxRow: number;
  } | null;
}

/** Undo/redo history for bin parameters with optional mesh cache */
export interface DesignerHistory {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
}

// =============================================================================
// Export File Name Types
// =============================================================================

/** File naming style for exports */
export type FileNameStyle = 'descriptive' | 'compact' | 'custom';

/** Export filename configuration stored per design */
export interface ExportFileNameConfig {
  /** Which naming mode to use */
  readonly style: FileNameStyle;
  /** User-provided filename (without extension) for 'custom' mode */
  readonly customName: string;
}

// =============================================================================
// Storage Types
// =============================================================================

/** Current thumbnail version - increment when changing thumbnail size/quality/format */
export const THUMBNAIL_VERSION = 5;

/** Saved design entry in IndexedDB */
export interface SavedDesign {
  readonly id: string;
  readonly name: string;
  readonly params: BinParams;
  readonly thumbnail: string | null;
  /** Thumbnail format version for detecting outdated thumbnails */
  readonly thumbnailVersion?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Per-design export filename preference (null = use defaults) */
  readonly exportFileNameConfig: ExportFileNameConfig | null;
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
  /** Transaction nesting depth — when > 0, pushHistoryEntry is suppressed */
  transactionDepth: number;

  // Persistence
  currentDesignId: string | null;
  designName: string;
  saveStatus: SaveStatus;
  exportFileNameConfig: ExportFileNameConfig;
  pendingBinLink: string | null;
  /** True when we need to capture thumbnail after next successful generation */
  needsThumbnailUpdate: boolean;

  // Param actions
  setParam: <K extends keyof BinParams>(key: K, value: BinParams[K]) => void;
  setParams: (partial: Partial<BinParams>) => void;
  resetToDefaults: () => void;

  // Scoped updaters (merge partial into nested config, push history)
  updateBase: (partial: Partial<BaseConfig>) => void;
  updateLabel: (partial: Partial<LabelTabConfig>) => void;
  updateScoop: (partial: Partial<ScoopConfig>) => void;

  // History actions
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Persistence actions
  setCurrentDesignId: (id: string | null) => void;
  setDesignName: (name: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setExportFileNameConfig: (config: ExportFileNameConfig) => void;
  setPendingBinLink: (binId: string | null) => void;
  clearPendingBinLink: () => void;
  setNeedsThumbnailUpdate: (needed: boolean) => void;
  newDesign: () => void;
  loadDesign: (design: SavedDesign) => void;

  // Compartment actions
  setCompartmentGrid: (cols: number, rows: number) => void;
  mergeCells: (cellIndices: readonly number[]) => void;
  splitCompartment: (compartmentId: number) => void;
  resetCompartments: () => void;

  // Wall pattern actions
  updateWallPattern: (partial: Partial<WallPatternConfig>) => void;

  // Cutout configuration actions
  updateCutoutConfig: (partial: Partial<CutoutConfig>) => void;

  // Insert actions
  addInsert: (insert: Insert) => void;
  removeInsert: (id: string) => void;
  updateInsert: (id: string, updates: Partial<Insert>) => void;
  clearInserts: () => void;

  // Cutout actions
  addCutout: (cutout: Cutout) => void;
  removeCutout: (id: string) => void;
  updateCutout: (id: string, updates: Partial<Cutout>) => void;
  clearCutouts: () => void;
  duplicateCutouts: (cutoutIds: readonly string[]) => void;
  groupCutouts: (cutoutIds: readonly string[]) => void;
  ungroupCutouts: (cutoutIds: readonly string[]) => void;

  // Transaction + batch cutout actions
  startTransaction: () => void;
  commitTransaction: () => void;
  updateCutoutsBatch: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  removeCutoutsBatch: (ids: readonly string[]) => void;

  // Lock/hide/layer ordering actions
  lockCutouts: (ids: readonly string[]) => void;
  unlockCutouts: (ids: readonly string[]) => void;
  hideCutouts: (ids: readonly string[]) => void;
  showCutouts: (ids: readonly string[]) => void;
  showAllCutouts: () => void;
  bringForward: (ids: readonly string[]) => void;
  sendBackward: (ids: readonly string[]) => void;
  bringToFront: (ids: readonly string[]) => void;
  sendToBack: (ids: readonly string[]) => void;

  // Generation actions
  setGenerationStatus: (status: GenerationStatus) => void;
  setGenerationResult: (result: GenerationResult) => void;
  setWasmStatus: (status: WasmStatus) => void;

  // UI actions
  setActiveTab: (tab: DesignerTab) => void;
  setExportDialogOpen: (open: boolean) => void;
  setDesignListOpen: (open: boolean) => void;
  setWireframeMode: (enabled: boolean) => void;
  setCutoutEditorOpen: (open: boolean) => void;
  setPreviewCompartments: (preview: CompartmentConfig | null) => void;
  setPreviewSelection: (
    selection: {
      action: 'merge' | 'split';
      minCol: number;
      maxCol: number;
      minRow: number;
      maxRow: number;
    } | null
  ) => void;
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
