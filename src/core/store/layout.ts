import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Layout,
  Bin,
  Layer,
  Category,
  Drawer,
  BinId,
  LayerId,
  CategoryId,
  LayoutId,
} from '@/core/types';
import {
  createDefaultLayout,
  generateBinId,
  generateLayerId,
  generateCategoryId,
  STAGING_ID,
  CONSTRAINTS,
  calcMaxGridUnits,
} from '@/core/constants';
import { canPlaceBin, clamp } from '@/shared/utils/validation';
import { fillAllWithSize, fillGaps } from '@/shared/utils/fill';
import { checkLayerReorderCollisions } from '@/shared/utils/collision';
import { useSettingsStore } from './settings';
import { trackBinCreated } from '@/shared/analytics/posthog';
import type { Result, LayoutError, ValidationError } from '@/core/result';
import {
  ok,
  err,
  OK,
  isOk,
  layoutLayerLimit,
  layoutLastEntity,
  layoutInvalidOperation,
  layoutCategoryLimit,
  validationOutOfBounds,
  validationCollision,
  validationInvalidLayer,
} from '@/core/result';

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

interface LayoutState {
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

  // Settings
  setPrintBedSize: (size: number) => void;
  setGridUnitMm: (mm: number) => void;
  setHeightUnitMm: (mm: number) => void;
}

export const useLayoutStore = create<LayoutState>()(
  immer((set, get) => ({
    layout: createDefaultLayout(),
    activeLayoutId: null,
    lastEditSource: null,
    _fillMeta: null,

    addBin: (binData) => {
      const { layout } = get();
      const id = generateBinId();
      const bin: Bin = { ...binData, id };

      if (bin.layerId !== STAGING_ID) {
        const layer = layout.layers.find((l) => l.id === bin.layerId);
        if (!layer) {
          return err(validationInvalidLayer(bin.layerId));
        }

        const validationResult = canPlaceBin(
          { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth, height: bin.height },
          bin.layerId,
          layout
        );
        if (!validationResult.valid) {
          const reason = validationResult.reason;
          if (reason === 'collision') {
            return err(validationCollision());
          }
          return err(
            validationOutOfBounds(reason, {
              x: bin.x,
              y: bin.y,
              width: bin.width,
              depth: bin.depth,
            })
          );
        }
      }

      set((state) => {
        state.layout.bins.push(bin);
        state.lastEditSource = 'local';
      });

      return ok(id);
    },

    updateBin: (id, updates) => {
      const { layout } = get();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('updateBin', `Bin ${id} not found`));
      }

      set((state) => {
        const b = state.layout.bins.find((b) => b.id === id);
        if (b) {
          Object.assign(b, updates);
          state.lastEditSource = 'local';
        }
      });

      return OK;
    },

    deleteBin: (id) => {
      const { layout } = get();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('deleteBin', `Bin ${id} not found`));
      }

      set((state) => {
        state.layout.bins = state.layout.bins.filter((b) => b.id !== id);
        state.lastEditSource = 'local';
      });

      return OK;
    },

    deleteBins: (ids) => {
      if (ids.length === 0) {
        return OK;
      }

      set((state) => {
        const idsSet = new Set(ids);
        state.layout.bins = state.layout.bins.filter((b) => !idsSet.has(b.id));
        state.lastEditSource = 'local';
      });

      return OK;
    },

    duplicateBin: (id) => {
      const { layout, addBin } = get();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('duplicateBin', `Bin ${id} not found`));
      }

      const copyProps = (overrides: { layerId: LayerId; x: number; y: number }) => ({
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
        clearanceHeight: bin.clearanceHeight,
        category: bin.category,
        label: bin.label,
        notes: bin.notes,
        customProperties: bin.customProperties,
        ...overrides,
      });

      const trackDuplicate = () => {
        trackBinCreated({
          method: 'duplicate',
          count: 1,
          width: bin.width,
          depth: bin.depth,
          height: bin.height,
        });
      };

      if (bin.layerId === STAGING_ID) {
        const result = addBin(copyProps({ layerId: STAGING_ID, x: 0, y: 0 }));
        if (isOk(result)) trackDuplicate();
        return result;
      }

      const offsets = [
        { dx: bin.width, dy: 0 }, // right
        { dx: 0, dy: -bin.depth }, // below (y decreases going down visually)
        { dx: -bin.width, dy: 0 }, // left
        { dx: 0, dy: bin.depth }, // above
      ];

      for (const { dx, dy } of offsets) {
        const newX = bin.x + dx;
        const newY = bin.y + dy;

        const placement = canPlaceBin(
          { x: newX, y: newY, width: bin.width, depth: bin.depth, height: bin.height },
          bin.layerId,
          layout
        );

        if (placement.valid) {
          const result = addBin(copyProps({ layerId: bin.layerId, x: newX, y: newY }));
          if (isOk(result)) trackDuplicate();
          return result;
        }
      }

      // Fallback to staging if no adjacent space available
      const result = addBin(copyProps({ layerId: STAGING_ID, x: 0, y: 0 }));
      if (isOk(result)) trackDuplicate();
      return result;
    },

    moveBinToStaging: (id) => {
      const { layout } = get();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('moveBinToStaging', `Bin ${id} not found`));
      }

      set((state) => {
        const b = state.layout.bins.find((b) => b.id === id);
        if (b) {
          b.layerId = STAGING_ID;
          state.lastEditSource = 'local';
        }
      });

      return OK;
    },

    moveBinFromStaging: (id, layerId, x, y) => {
      const { layout } = get();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('moveBinFromStaging', `Bin ${id} not found`));
      }

      const layer = layout.layers.find((l) => l.id === layerId);
      if (!layer) {
        return err(validationInvalidLayer(layerId));
      }

      const validationResult = canPlaceBin(
        { x, y, width: bin.width, depth: bin.depth, height: layer.height },
        layerId,
        layout,
        id
      );

      if (!validationResult.valid) {
        const reason = validationResult.reason;
        if (reason === 'collision') {
          return err(validationCollision());
        }
        return err(
          validationOutOfBounds(reason, {
            x,
            y,
            width: bin.width,
            depth: bin.depth,
          })
        );
      }

      set((state) => {
        const b = state.layout.bins.find((b) => b.id === id);
        if (b) {
          b.layerId = layerId;
          b.x = x;
          b.y = y;
          b.height = layer.height;
          state.lastEditSource = 'local';
        }
      });

      return OK;
    },

    addLayer: () => {
      const { layout } = get();
      if (layout.layers.length >= CONSTRAINTS.LAYERS_MAX) {
        return err(layoutLayerLimit(layout.layers.length, CONSTRAINTS.LAYERS_MAX));
      }

      const totalHeight = layout.layers.reduce((sum, l) => sum + l.height, 0);
      const remaining = layout.drawer.height - totalHeight;
      if (remaining < 1) {
        return err(layoutInvalidOperation('addLayer', 'No remaining height in drawer'));
      }

      // Get default layer height from settings
      const defaultLayerHeight = useSettingsStore.getState().settings.defaultLayerHeight;

      const id = generateLayerId();
      const newLayer: Layer = {
        id,
        name: `Layer ${layout.layers.length + 1}`,
        height: Math.min(remaining, defaultLayerHeight),
      };

      set((state) => {
        state.layout.layers.push(newLayer);
        state.lastEditSource = 'local';
      });

      return ok(id);
    },

    updateLayer: (id, updates) => {
      const { layout } = get();
      const layer = layout.layers.find((l) => l.id === id);
      if (!layer) {
        return err(layoutInvalidOperation('updateLayer', `Layer ${id} not found`));
      }

      set((state) => {
        const l = state.layout.layers.find((l) => l.id === id);
        if (l) {
          if (updates.height !== undefined) {
            const othersHeight = state.layout.layers
              .filter((layer) => layer.id !== id)
              .reduce((sum, layer) => sum + layer.height, 0);
            const maxHeight = state.layout.drawer.height - othersHeight;
            updates.height = clamp(updates.height, 1, maxHeight);
          }
          Object.assign(l, updates);
          state.lastEditSource = 'local';
        }
      });

      return OK;
    },

    deleteLayer: (id) => {
      const { layout } = get();
      if (layout.layers.length <= CONSTRAINTS.LAYERS_MIN) {
        return err(layoutLastEntity('layer'));
      }

      const layer = layout.layers.find((l) => l.id === id);
      if (!layer) {
        return err(layoutInvalidOperation('deleteLayer', `Layer ${id} not found`));
      }

      set((state) => {
        state.layout.layers = state.layout.layers.filter((l) => l.id !== id);
        state.layout.bins = state.layout.bins.filter((b) => b.layerId !== id);
        state.lastEditSource = 'local';
      });

      return OK;
    },

    reorderLayers: (fromIndex, toIndex) => {
      const { layout } = get();

      if (fromIndex === toIndex) return OK;
      if (fromIndex < 0 || fromIndex >= layout.layers.length) {
        return err(layoutInvalidOperation('reorderLayers', 'Invalid source index'));
      }
      if (toIndex < 0 || toIndex >= layout.layers.length) {
        return err(layoutInvalidOperation('reorderLayers', 'Invalid target index'));
      }

      const newLayers = [...layout.layers];
      const [moved] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, moved);

      const collisions = checkLayerReorderCollisions(layout.bins, layout.layers, newLayers);
      if (collisions.length > 0) {
        return err(
          layoutInvalidOperation(
            'reorderLayers',
            `Reordering would cause ${collisions.length} bin collision${collisions.length > 1 ? 's' : ''}`
          )
        );
      }

      set((state) => {
        state.layout.layers = newLayers;
        state.lastEditSource = 'local';
      });

      return OK;
    },

    updateDrawer: (updates) => {
      set((state) => {
        const drawer = state.layout.drawer;

        if (updates.width !== undefined) {
          drawer.width = clamp(updates.width, CONSTRAINTS.GRID_MIN, CONSTRAINTS.GRID_MAX);
        }
        if (updates.depth !== undefined) {
          drawer.depth = clamp(updates.depth, CONSTRAINTS.GRID_MIN, CONSTRAINTS.GRID_MAX);
        }
        if (updates.height !== undefined) {
          const totalLayerHeight = state.layout.layers.reduce((sum, l) => sum + l.height, 0);
          drawer.height = Math.max(totalLayerHeight, updates.height);
        }
        if (updates.fractionalEdgeX !== undefined) {
          drawer.fractionalEdgeX = updates.fractionalEdgeX;
        }
        if (updates.fractionalEdgeY !== undefined) {
          drawer.fractionalEdgeY = updates.fractionalEdgeY;
        }

        // Move out-of-bounds bins to staging
        state.layout.bins = state.layout.bins.map((bin) => {
          if (bin.layerId === STAGING_ID) return bin;

          if (bin.x + bin.width > drawer.width || bin.y + bin.depth > drawer.depth) {
            return { ...bin, layerId: STAGING_ID };
          }
          return bin;
        });
        state.lastEditSource = 'local';
      });
    },

    addCategory: (categoryData) => {
      const { layout } = get();
      if (layout.categories.length >= CONSTRAINTS.CATEGORIES_MAX) {
        return err(layoutCategoryLimit(layout.categories.length, CONSTRAINTS.CATEGORIES_MAX));
      }

      const id = generateCategoryId();
      set((state) => {
        state.layout.categories.push({ ...categoryData, id });
        state.lastEditSource = 'local';
      });
      return ok(id);
    },

    updateCategory: (id, updates) => {
      const { layout } = get();
      const cat = layout.categories.find((c) => c.id === id);
      if (!cat) {
        return err(layoutInvalidOperation('updateCategory', `Category ${id} not found`));
      }

      set((state) => {
        const c = state.layout.categories.find((c) => c.id === id);
        if (c) {
          Object.assign(c, updates);
          state.lastEditSource = 'local';
        }
      });

      return OK;
    },

    deleteCategory: (id) => {
      const { layout } = get();

      const binsUsingCategory = layout.bins.filter((b) => b.category === id);
      if (binsUsingCategory.length > 0) {
        return err(
          layoutInvalidOperation(
            'deleteCategory',
            `Category is in use by ${binsUsingCategory.length} bin${binsUsingCategory.length > 1 ? 's' : ''}`
          )
        );
      }

      if (layout.categories.length <= CONSTRAINTS.CATEGORIES_MIN) {
        return err(layoutLastEntity('category'));
      }

      const category = layout.categories.find((c) => c.id === id);
      if (!category) {
        return err(layoutInvalidOperation('deleteCategory', `Category ${id} not found`));
      }

      set((state) => {
        state.layout.categories = state.layout.categories.filter((c) => c.id !== id);
        state.lastEditSource = 'local';
      });

      return OK;
    },

    fillLayer: (layerId, width, depth, categoryId, halfBinMode = false) => {
      const { layout } = get();
      const result = fillAllWithSize(layout, layerId, width, depth, categoryId, halfBinMode);

      if (result.bins.length > 0) {
        const layer = layout.layers.find((l) => l.id === layerId);
        set((state) => {
          state.layout.bins.push(...result.bins);
          state.lastEditSource = 'local';
          state._fillMeta = {
            type: 'uniform',
            count: result.bins.length,
            layerId,
            width,
            depth,
            layerHeight: layer?.height ?? 1,
          };
        });
      }

      return result.bins.length;
    },

    fillLayerGaps: (layerId, categoryId, halfBinMode = false) => {
      const { layout } = get();
      // Calculate max grid units from print bed size (accounting for gaps)
      const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);
      const result = fillGaps(layout, layerId, categoryId, maxGridUnits, halfBinMode);

      if (result.bins.length > 0) {
        set((state) => {
          state.layout.bins.push(...result.bins);
          state.lastEditSource = 'local';
          state._fillMeta = {
            type: 'gaps',
            count: result.bins.length,
            layerId,
          };
        });
      }

      return result.addedCount;
    },

    clearLayer: (layerId) => {
      const { layout } = get();
      const count = layout.bins.filter((b) => b.layerId === layerId).length;

      set((state) => {
        state.layout.bins = state.layout.bins.filter((b) => b.layerId !== layerId);
        state.lastEditSource = 'local';
      });

      return count;
    },

    importLayout: (newLayout, layoutId, source = 'local') => {
      set((state) => {
        state.layout = newLayout;
        state.activeLayoutId = layoutId ?? null;
        state.lastEditSource = source;
      });
    },

    setActiveLayoutId: (id) => {
      set((state) => {
        state.activeLayoutId = id;
      });
    },

    setName: (name) => {
      set((state) => {
        state.layout.name = name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
        state.lastEditSource = 'local';
      });
    },

    setPrintBedSize: (size) => {
      set((state) => {
        state.layout.printBedSize = clamp(size, 42, 500);
        state.lastEditSource = 'local';
      });
    },

    setGridUnitMm: (mm) => {
      set((state) => {
        state.layout.gridUnitMm = clamp(mm, 1, 200);
        state.lastEditSource = 'local';
      });
    },

    setHeightUnitMm: (mm) => {
      set((state) => {
        state.layout.heightUnitMm = clamp(mm, 1, 50);
        state.lastEditSource = 'local';
      });
    },
  }))
);
