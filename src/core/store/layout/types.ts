import type {
  Layout,
  BaseplateParams,
  Bin,
  Layer,
  Category,
  Drawer,
  BinId,
  LayerId,
  CategoryId,
  LayoutId,
} from '@/core/types';
import type { Result, LayoutError, ValidationError } from '@/core/result';

/** Metadata about a fill operation, set by the store and consumed by the analytics subscriber. */
export interface FillMeta {
  type: 'uniform' | 'gaps';
  count: number;
  layerId: LayerId;
  width?: number;
  depth?: number;
  layerHeight?: number;
}

/** Source of the last edit to the layout - used to distinguish local edits from remote imports */
export type EditSource = 'local' | 'remote' | 'init' | null;

export interface LayoutState {
  layout: Layout;
  activeLayoutId: LayoutId | null; // ID of the layout in the library (null for unsaved)
  lastEditSource: EditSource; // Tracks whether last change was local, remote, or initial load
  _fillMeta: FillMeta | null; // Transient metadata for analytics subscriber (cleared after read)

  // Bin operations - all return Result for consistent error handling
  addBin: (bin: Omit<Bin, 'id'>) => Result<BinId, ValidationError>;
  updateBin: (id: BinId, updates: Partial<Bin>) => Result<void, LayoutError>;
  deleteBin: (id: BinId) => Result<void, LayoutError>;
  deleteBins: (ids: BinId[]) => Result<void, LayoutError>;
  duplicateBin: (id: BinId) => Result<BinId, ValidationError | LayoutError>;
  moveBinToStaging: (id: BinId) => Result<void, LayoutError>;
  moveBinFromStaging: (
    id: BinId,
    layerId: LayerId,
    x: number,
    y: number
  ) => Result<void, ValidationError | LayoutError>;

  // Layer operations
  addLayer: () => Result<LayerId, LayoutError>;
  updateLayer: (id: LayerId, updates: Partial<Layer>) => Result<void, LayoutError>;
  deleteLayer: (id: LayerId) => Result<void, LayoutError>;
  reorderLayers: (fromIndex: number, toIndex: number) => Result<void, LayoutError>;

  // Drawer operations
  updateDrawer: (updates: Partial<Drawer>) => void;

  // Category operations
  addCategory: (category: Omit<Category, 'id'>) => Result<CategoryId, LayoutError>;
  updateCategory: (id: CategoryId, updates: Partial<Category>) => Result<void, LayoutError>;
  deleteCategory: (id: CategoryId) => Result<void, LayoutError>;

  // Bulk operations
  fillLayer: (
    layerId: LayerId,
    width: number,
    depth: number,
    categoryId: CategoryId,
    halfBinMode?: boolean
  ) => number;
  fillLayerGaps: (layerId: LayerId, categoryId: CategoryId, halfBinMode?: boolean) => number;
  clearLayer: (layerId: LayerId) => number;

  // I/O
  importLayout: (layout: Layout, layoutId?: LayoutId, source?: EditSource) => void;

  // Layout library integration
  setActiveLayoutId: (id: LayoutId | null) => void;

  // Name
  setName: (name: string) => void;

  // Baseplate
  setBaseplateParams: (params: BaseplateParams) => void;

  setPrintBedSize: (size: number) => void;
  setGridUnitMm: (mm: number) => void;
  setHeightUnitMm: (mm: number) => void;

  // History restoration (used by history store for undo/redo)
  restoreLayout: (layout: Layout) => void;
}

/** Zustand immer `set` function — receives a mutator that operates on the mutable draft */
export type ImmerSet = (fn: (state: LayoutState) => void) => void;
/** Zustand `get` function — returns the current immutable state snapshot */
export type GetState = () => LayoutState;
/** Wrapper around `set` that also marks the edit source as 'local' */
export type SetLocal = (fn: (state: LayoutState) => void) => void;
