import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Layout, Bin, Layer, Category, Drawer } from '../types';
import { createDefaultLayout, generateId, STAGING_ID, CONSTRAINTS, calcMaxGridUnits } from '../constants';
import { canPlaceBin, clamp } from '../utils/validation';
import { fillAllWithSize, fillGaps } from '../utils/fill';
import { checkLayerReorderCollisions } from '../utils/collision';
import { useSettingsStore } from './settings';
import type { Result, LayoutError, ValidationError } from '../result';
import {
  ok,
  err,
  layoutLayerLimit,
  layoutLastEntity,
  layoutInvalidOperation,
  layoutCategoryLimit,
  validationOutOfBounds,
  validationCollision,
  validationInvalidLayer,
} from '../result';

/** Source of the last edit to the layout - used to distinguish local edits from remote imports */
export type EditSource = 'local' | 'remote' | 'init' | null;

interface LayoutState {
  layout: Layout;
  activeLayoutId: string | null;  // ID of the layout in the library (null for unsaved)
  lastEditSource: EditSource;  // Tracks whether last change was local, remote, or initial load

  // Bin operations
  addBin: (bin: Omit<Bin, 'id'>) => string | null;
  addBinResult: (bin: Omit<Bin, 'id'>) => Result<string, ValidationError>;
  updateBin: (id: string, updates: Partial<Bin>) => void;
  deleteBin: (id: string) => void;
  duplicateBin: (id: string) => string | null;
  moveBinToStaging: (id: string) => void;
  moveBinFromStaging: (id: string, layerId: string, x: number, y: number) => boolean;
  moveBinFromStagingResult: (id: string, layerId: string, x: number, y: number) => Result<void, ValidationError>;

  // Layer operations
  addLayer: () => string | null;
  addLayerResult: () => Result<string, LayoutError>;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  deleteLayer: (id: string) => boolean;
  deleteLayerResult: (id: string) => Result<void, LayoutError>;
  reorderLayers: (fromIndex: number, toIndex: number) => { success: boolean; error?: string };
  reorderLayersResult: (fromIndex: number, toIndex: number) => Result<void, LayoutError>;

  // Drawer operations
  updateDrawer: (updates: Partial<Drawer>) => void;

  // Category operations
  addCategory: (category: Omit<Category, 'id'>) => string;
  addCategoryResult: (category: Omit<Category, 'id'>) => Result<string, LayoutError>;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => boolean;
  deleteCategoryResult: (id: string) => Result<void, LayoutError>;

  // Bulk operations
  fillLayer: (layerId: string, width: number, depth: number, categoryId: string, halfBinMode?: boolean) => number;
  fillLayerGaps: (layerId: string, categoryId: string, halfBinMode?: boolean) => number;
  clearLayer: (layerId: string) => number;

  // I/O
  importLayout: (layout: Layout, layoutId?: string, source?: EditSource) => void;

  // Layout library integration
  setActiveLayoutId: (id: string | null) => void;

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

    addBin: (binData) => {
      const { layout } = get();
      const id = generateId();
      const bin: Bin = { ...binData, id };

      if (bin.layerId !== STAGING_ID) {
        const result = canPlaceBin(
          { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth, height: bin.height },
          bin.layerId,
          layout
        );
        if (!result.valid) return null;
      }

      set(state => {
        state.layout.bins.push(bin);
        state.lastEditSource = 'local';
      });

      return id;
    },

    addBinResult: (binData) => {
      const { layout } = get();
      const id = generateId();
      const bin: Bin = { ...binData, id };

      if (bin.layerId !== STAGING_ID) {
        const layer = layout.layers.find(l => l.id === bin.layerId);
        if (!layer) {
          return err(validationInvalidLayer(bin.layerId));
        }

        const validationResult = canPlaceBin(
          { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth, height: bin.height },
          bin.layerId,
          layout
        );
        if (!validationResult.valid) {
          const reason = validationResult.reason ?? 'out_of_bounds';
          if (reason === 'collision') {
            return err(validationCollision());
          }
          return err(validationOutOfBounds(reason, {
            x: bin.x,
            y: bin.y,
            width: bin.width,
            depth: bin.depth,
          }));
        }
      }

      set(state => {
        state.layout.bins.push(bin);
        state.lastEditSource = 'local';
      });

      return ok(id);
    },

    updateBin: (id, updates) => {
      set(state => {
        const bin = state.layout.bins.find(b => b.id === id);
        if (bin) {
          Object.assign(bin, updates);
          state.lastEditSource = 'local';
        }
      });
    },

    deleteBin: (id) => {
      set(state => {
        state.layout.bins = state.layout.bins.filter(b => b.id !== id);
        state.lastEditSource = 'local';
      });
    },

    duplicateBin: (id) => {
      const { layout, addBin } = get();
      const bin = layout.bins.find(b => b.id === id);
      if (!bin) return null;

      if (bin.layerId === STAGING_ID) {
        return addBin({
          layerId: STAGING_ID,
          x: 0,
          y: 0,
          width: bin.width,
          depth: bin.depth,
          height: bin.height,
          clearanceHeight: bin.clearanceHeight,
          category: bin.category,
          label: bin.label,
          notes: bin.notes,
          customProperties: bin.customProperties,
        });
      }

      const offsets = [
        { dx: bin.width, dy: 0 },   // right
        { dx: 0, dy: -bin.depth },  // below (y decreases going down visually)
        { dx: -bin.width, dy: 0 },  // left
        { dx: 0, dy: bin.depth },   // above
      ];

      for (const { dx, dy } of offsets) {
        const newX = bin.x + dx;
        const newY = bin.y + dy;

        const result = canPlaceBin(
          { x: newX, y: newY, width: bin.width, depth: bin.depth, height: bin.height },
          bin.layerId,
          layout
        );

        if (result.valid) {
          return addBin({
            layerId: bin.layerId,
            x: newX,
            y: newY,
            width: bin.width,
            depth: bin.depth,
            height: bin.height,
            clearanceHeight: bin.clearanceHeight,
            category: bin.category,
            label: bin.label,
            notes: bin.notes,
            customProperties: bin.customProperties,
          });
        }
      }

      return addBin({
        layerId: STAGING_ID,
        x: 0,
        y: 0,
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
        clearanceHeight: bin.clearanceHeight,
        category: bin.category,
        label: bin.label,
        notes: bin.notes,
        customProperties: bin.customProperties,
      });
    },

    moveBinToStaging: (id) => {
      set(state => {
        const bin = state.layout.bins.find(b => b.id === id);
        if (bin) {
          bin.layerId = STAGING_ID;
          state.lastEditSource = 'local';
        }
      });
    },

    moveBinFromStaging: (id, layerId, x, y) => {
      const { layout } = get();
      const bin = layout.bins.find(b => b.id === id);
      if (!bin) return false;

      const layer = layout.layers.find(l => l.id === layerId);
      if (!layer) return false;

      const result = canPlaceBin(
        { x, y, width: bin.width, depth: bin.depth, height: layer.height },
        layerId,
        layout,
        id
      );

      if (!result.valid) return false;

      set(state => {
        const b = state.layout.bins.find(b => b.id === id);
        if (b) {
          b.layerId = layerId;
          b.x = x;
          b.y = y;
          b.height = layer.height;
          state.lastEditSource = 'local';
        }
      });

      return true;
    },

    moveBinFromStagingResult: (id, layerId, x, y) => {
      const { layout } = get();
      const bin = layout.bins.find(b => b.id === id);
      if (!bin) {
        return err(validationOutOfBounds('out_of_bounds', { x, y, width: 0, depth: 0 }));
      }

      const layer = layout.layers.find(l => l.id === layerId);
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
        const reason = validationResult.reason ?? 'out_of_bounds';
        if (reason === 'collision') {
          return err(validationCollision());
        }
        return err(validationOutOfBounds(reason, {
          x,
          y,
          width: bin.width,
          depth: bin.depth,
        }));
      }

      set(state => {
        const b = state.layout.bins.find(b => b.id === id);
        if (b) {
          b.layerId = layerId;
          b.x = x;
          b.y = y;
          b.height = layer.height;
          state.lastEditSource = 'local';
        }
      });

      return ok(undefined);
    },

    addLayer: () => {
      const { layout } = get();
      if (layout.layers.length >= CONSTRAINTS.LAYERS_MAX) return null;

      const totalHeight = layout.layers.reduce((sum, l) => sum + l.height, 0);
      const remaining = layout.drawer.height - totalHeight;
      if (remaining < 1) return null;

      // Get default layer height from settings
      const defaultLayerHeight = useSettingsStore.getState().settings.defaultLayerHeight;

      const id = generateId();
      const newLayer: Layer = {
        id,
        name: `Layer ${layout.layers.length + 1}`,
        height: Math.min(remaining, defaultLayerHeight),
      };

      set(state => {
        state.layout.layers.push(newLayer);
        state.lastEditSource = 'local';
      });

      return id;
    },

    addLayerResult: () => {
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

      const id = generateId();
      const newLayer: Layer = {
        id,
        name: `Layer ${layout.layers.length + 1}`,
        height: Math.min(remaining, defaultLayerHeight),
      };

      set(state => {
        state.layout.layers.push(newLayer);
        state.lastEditSource = 'local';
      });

      return ok(id);
    },

    updateLayer: (id, updates) => {
      set(state => {
        const layer = state.layout.layers.find(l => l.id === id);
        if (layer) {
          if (updates.height !== undefined) {
            const othersHeight = state.layout.layers
              .filter(l => l.id !== id)
              .reduce((sum, l) => sum + l.height, 0);
            const maxHeight = state.layout.drawer.height - othersHeight;
            updates.height = clamp(updates.height, 1, maxHeight);
          }
          Object.assign(layer, updates);
          state.lastEditSource = 'local';
        }
      });
    },

    deleteLayer: (id) => {
      const { layout } = get();
      if (layout.layers.length <= CONSTRAINTS.LAYERS_MIN) return false;

      set(state => {
        state.layout.layers = state.layout.layers.filter(l => l.id !== id);
        state.layout.bins = state.layout.bins.filter(b => b.layerId !== id);
        state.lastEditSource = 'local';
      });

      return true;
    },

    deleteLayerResult: (id) => {
      const { layout } = get();
      if (layout.layers.length <= CONSTRAINTS.LAYERS_MIN) {
        return err(layoutLastEntity('layer'));
      }

      const layer = layout.layers.find(l => l.id === id);
      if (!layer) {
        return err(layoutInvalidOperation('deleteLayer', `Layer ${id} not found`));
      }

      set(state => {
        state.layout.layers = state.layout.layers.filter(l => l.id !== id);
        state.layout.bins = state.layout.bins.filter(b => b.layerId !== id);
        state.lastEditSource = 'local';
      });

      return ok(undefined);
    },

    reorderLayers: (fromIndex, toIndex) => {
      const { layout } = get();

      if (fromIndex === toIndex) return { success: true };
      if (fromIndex < 0 || fromIndex >= layout.layers.length) return { success: false, error: 'Invalid source index' };
      if (toIndex < 0 || toIndex >= layout.layers.length) return { success: false, error: 'Invalid target index' };

      const newLayers = [...layout.layers];
      const [moved] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, moved);

      const collisions = checkLayerReorderCollisions(layout.bins, layout.layers, newLayers);
      if (collisions.length > 0) {
        return {
          success: false,
          error: `Reordering would cause ${collisions.length} bin collision${collisions.length > 1 ? 's' : ''}`,
        };
      }

      set(state => {
        state.layout.layers = newLayers;
        state.lastEditSource = 'local';
      });

      return { success: true };
    },

    reorderLayersResult: (fromIndex, toIndex) => {
      const { layout } = get();

      if (fromIndex === toIndex) return ok(undefined);
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
        return err(layoutInvalidOperation(
          'reorderLayers',
          `Reordering would cause ${collisions.length} bin collision${collisions.length > 1 ? 's' : ''}`
        ));
      }

      set(state => {
        state.layout.layers = newLayers;
        state.lastEditSource = 'local';
      });

      return ok(undefined);
    },

    updateDrawer: (updates) => {
      set(state => {
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
        state.layout.bins = state.layout.bins.map(bin => {
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
      const id = generateId();
      set(state => {
        state.layout.categories.push({ ...categoryData, id });
        state.lastEditSource = 'local';
      });
      return id;
    },

    addCategoryResult: (categoryData) => {
      const { layout } = get();
      if (layout.categories.length >= CONSTRAINTS.CATEGORIES_MAX) {
        return err(layoutCategoryLimit(layout.categories.length, CONSTRAINTS.CATEGORIES_MAX));
      }

      const id = generateId();
      set(state => {
        state.layout.categories.push({ ...categoryData, id });
        state.lastEditSource = 'local';
      });
      return ok(id);
    },

    updateCategory: (id, updates) => {
      set(state => {
        const cat = state.layout.categories.find(c => c.id === id);
        if (cat) {
          Object.assign(cat, updates);
          state.lastEditSource = 'local';
        }
      });
    },

    deleteCategory: (id) => {
      const { layout } = get();

      if (layout.bins.some(b => b.category === id)) return false;
      if (layout.categories.length <= CONSTRAINTS.CATEGORIES_MIN) return false;

      set(state => {
        state.layout.categories = state.layout.categories.filter(c => c.id !== id);
        state.lastEditSource = 'local';
      });

      return true;
    },

    deleteCategoryResult: (id) => {
      const { layout } = get();

      const binsUsingCategory = layout.bins.filter(b => b.category === id);
      if (binsUsingCategory.length > 0) {
        return err(layoutInvalidOperation(
          'deleteCategory',
          `Category is in use by ${binsUsingCategory.length} bin${binsUsingCategory.length > 1 ? 's' : ''}`
        ));
      }

      if (layout.categories.length <= CONSTRAINTS.CATEGORIES_MIN) {
        return err(layoutLastEntity('category'));
      }

      const category = layout.categories.find(c => c.id === id);
      if (!category) {
        return err(layoutInvalidOperation('deleteCategory', `Category ${id} not found`));
      }

      set(state => {
        state.layout.categories = state.layout.categories.filter(c => c.id !== id);
        state.lastEditSource = 'local';
      });

      return ok(undefined);
    },

    fillLayer: (layerId, width, depth, categoryId, halfBinMode = false) => {
      const { layout } = get();
      const result = fillAllWithSize(layout, layerId, width, depth, categoryId, halfBinMode);

      if (result.bins.length > 0) {
        set(state => {
          state.layout.bins.push(...result.bins);
          state.lastEditSource = 'local';
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
        set(state => {
          state.layout.bins.push(...result.bins);
          state.lastEditSource = 'local';
        });
      }

      return result.addedCount;
    },

    clearLayer: (layerId) => {
      const { layout } = get();
      const count = layout.bins.filter(b => b.layerId === layerId).length;

      set(state => {
        state.layout.bins = state.layout.bins.filter(b => b.layerId !== layerId);
        state.lastEditSource = 'local';
      });

      return count;
    },

    importLayout: (newLayout, layoutId, source = 'local') => {
      set(state => {
        state.layout = newLayout;
        state.activeLayoutId = layoutId ?? null;
        state.lastEditSource = source;
      });
    },

    setActiveLayoutId: (id) => {
      set(state => {
        state.activeLayoutId = id;
      });
    },

    setName: (name) => {
      set(state => {
        state.layout.name = name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
        state.lastEditSource = 'local';
      });
    },

    setPrintBedSize: (size) => {
      set(state => {
        state.layout.printBedSize = clamp(size, 42, 500);
        state.lastEditSource = 'local';
      });
    },

    setGridUnitMm: (mm) => {
      set(state => {
        state.layout.gridUnitMm = clamp(mm, 1, 200);
        state.lastEditSource = 'local';
      });
    },

    setHeightUnitMm: (mm) => {
      set(state => {
        state.layout.heightUnitMm = clamp(mm, 1, 50);
        state.lastEditSource = 'local';
      });
    },
  }))
);
