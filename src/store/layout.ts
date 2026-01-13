import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Layout, Bin, Layer, Category, Drawer } from '../types';
import { createDefaultLayout, generateId, STAGING_ID, CONSTRAINTS, calcMaxGridUnits } from '../constants';
import { canPlaceBin, clamp } from '../utils/validation';
import { fillAllWithSize, fillGaps } from '../utils/fill';
import { checkLayerReorderCollisions } from '../utils/collision';
import { useSettingsStore } from './settings';

/** Source of the last edit to the layout - used to distinguish local edits from remote imports */
export type EditSource = 'local' | 'remote' | 'init' | null;

interface LayoutState {
  layout: Layout;
  activeLayoutId: string | null;  // ID of the layout in the library (null for unsaved)
  lastEditSource: EditSource;  // Tracks whether last change was local, remote, or initial load

  // Bin operations
  addBin: (bin: Omit<Bin, 'id'>) => string | null;
  updateBin: (id: string, updates: Partial<Bin>) => void;
  deleteBin: (id: string) => void;
  duplicateBin: (id: string) => string | null;
  moveBinToStaging: (id: string) => void;
  moveBinFromStaging: (id: string, layerId: string, x: number, y: number) => boolean;

  // Layer operations
  addLayer: () => string | null;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  deleteLayer: (id: string) => boolean;
  reorderLayers: (fromIndex: number, toIndex: number) => { success: boolean; error?: string };

  // Drawer operations
  updateDrawer: (updates: Partial<Drawer>) => void;

  // Category operations
  addCategory: (category: Omit<Category, 'id'>) => string;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => boolean;

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
      });

      return id;
    },

    updateBin: (id, updates) => {
      set(state => {
        const bin = state.layout.bins.find(b => b.id === id);
        if (bin) {
          Object.assign(bin, updates);
        }
      });
    },

    deleteBin: (id) => {
      set(state => {
        state.layout.bins = state.layout.bins.filter(b => b.id !== id);
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
        }
      });

      return true;
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
      });

      return id;
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
        }
      });
    },

    deleteLayer: (id) => {
      const { layout } = get();
      if (layout.layers.length <= CONSTRAINTS.LAYERS_MIN) return false;

      set(state => {
        state.layout.layers = state.layout.layers.filter(l => l.id !== id);
        state.layout.bins = state.layout.bins.filter(b => b.layerId !== id);
      });

      return true;
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
      });

      return { success: true };
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
      });
    },

    addCategory: (categoryData) => {
      const id = generateId();
      set(state => {
        state.layout.categories.push({ ...categoryData, id });
      });
      return id;
    },

    updateCategory: (id, updates) => {
      set(state => {
        const cat = state.layout.categories.find(c => c.id === id);
        if (cat) {
          Object.assign(cat, updates);
        }
      });
    },

    deleteCategory: (id) => {
      const { layout } = get();

      if (layout.bins.some(b => b.category === id)) return false;
      if (layout.categories.length <= CONSTRAINTS.CATEGORIES_MIN) return false;

      set(state => {
        state.layout.categories = state.layout.categories.filter(c => c.id !== id);
      });

      return true;
    },

    fillLayer: (layerId, width, depth, categoryId, halfBinMode = false) => {
      const { layout } = get();
      const result = fillAllWithSize(layout, layerId, width, depth, categoryId, halfBinMode);

      if (result.bins.length > 0) {
        set(state => {
          state.layout.bins.push(...result.bins);
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
        });
      }

      return result.addedCount;
    },

    clearLayer: (layerId) => {
      const { layout } = get();
      const count = layout.bins.filter(b => b.layerId === layerId).length;

      set(state => {
        state.layout.bins = state.layout.bins.filter(b => b.layerId !== layerId);
      });

      return count;
    },

    importLayout: (layout, layoutId, source = 'local') => {
      set({ layout, activeLayoutId: layoutId ?? null, lastEditSource: source });
    },

    setActiveLayoutId: (id) => {
      set({ activeLayoutId: id });
    },

    setName: (name) => {
      set(state => {
        state.layout.name = name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
      });
    },

    setPrintBedSize: (size) => {
      set(state => {
        state.layout.printBedSize = clamp(size, 42, 500);
      });
    },

    setGridUnitMm: (mm) => {
      set(state => {
        state.layout.gridUnitMm = clamp(mm, 1, 200);
      });
    },

    setHeightUnitMm: (mm) => {
      set(state => {
        state.layout.heightUnitMm = clamp(mm, 1, 50);
      });
    },
  }))
);
