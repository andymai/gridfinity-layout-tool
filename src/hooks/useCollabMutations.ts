/**
 * Adapter hook that provides mutation functions for both collaborative and local modes.
 *
 * In collaborative mode, mutations go through Liveblocks for real-time sync.
 * In local mode, mutations go directly to the Zustand store.
 *
 * All mutations maintain the same Result-based API regardless of mode.
 *
 * @example
 * ```tsx
 * const { addBin, updateBin, deleteBin } = useCollabMutations();
 * const result = addBin({ x: 0, y: 0, width: 2, depth: 2, ... });
 * if (isOk(result)) {
 *   console.log('Added bin:', result.value);
 * }
 * ```
 */

import { useCallback } from 'react';
import { useLayoutStore } from '../store/layout';
import { useMutation, useStorage } from '../liveblocks.config';
import { useCollabMode } from './useCollabMode';
import type { Bin, Layer, Category, Drawer, Layout } from '../types';
import type { Result, ValidationError, LayoutError } from '../result';
import {
  ok,
  err,
  OK,
  validationOutOfBounds,
  validationCollision,
  validationInvalidLayer,
  layoutLayerLimit,
  layoutLastEntity,
  layoutInvalidOperation,
  layoutCategoryLimit,
} from '../result';
import { canPlaceBin, clamp } from '../utils/validation';
import { generateId, STAGING_ID, CONSTRAINTS } from '../constants';
import { useSettingsStore } from '../store/settings';

/**
 * Mutation functions for layout operations.
 * These work identically in both collaborative and local modes.
 */
export interface CollabMutations {
  // Bin operations
  addBin: (bin: Omit<Bin, 'id'>) => Result<string, ValidationError>;
  updateBin: (id: string, updates: Partial<Bin>) => Result<void, LayoutError>;
  deleteBin: (id: string) => Result<void, LayoutError>;
  deleteBins: (ids: string[]) => Result<void, LayoutError>;
  duplicateBin: (id: string) => Result<string, ValidationError | LayoutError>;
  moveBinToStaging: (id: string) => Result<void, LayoutError>;
  moveBinFromStaging: (id: string, layerId: string, x: number, y: number) => Result<void, ValidationError | LayoutError>;

  // Layer operations
  addLayer: () => Result<string, LayoutError>;
  updateLayer: (id: string, updates: Partial<Layer>) => Result<void, LayoutError>;
  deleteLayer: (id: string) => Result<void, LayoutError>;
  reorderLayers: (fromIndex: number, toIndex: number) => Result<void, LayoutError>;

  // Drawer operations
  updateDrawer: (updates: Partial<Drawer>) => void;

  // Category operations
  addCategory: (category: Omit<Category, 'id'>) => Result<string, LayoutError>;
  updateCategory: (id: string, updates: Partial<Category>) => Result<void, LayoutError>;
  deleteCategory: (id: string) => Result<void, LayoutError>;

  // Bulk operations
  fillLayer: (layerId: string, width: number, depth: number, categoryId: string, halfBinMode?: boolean) => number;
  clearLayer: (layerId: string) => number;

  // Layout metadata
  setName: (name: string) => void;
  setPrintBedSize: (size: number) => void;
  setGridUnitMm: (mm: number) => void;
  setHeightUnitMm: (mm: number) => void;
}

/**
 * Returns mutation functions that work in both collaborative and local modes.
 *
 * In collaborative mode, mutations are sent to Liveblocks and synced to all clients.
 * In local mode, mutations go directly to Zustand.
 */
export function useCollabMutations(): CollabMutations {
  const { isCollaborative } = useCollabMode();

  // Get local store functions
  const store = useLayoutStore();

  // Get remote layout for validation in collab mode
  const remoteLayout = useStorage((root) => root?.layout) as Layout | null;

  // Liveblocks mutation for updating layout
  const updateLiveblocksLayout = useMutation(
    ({ storage }, updater: (layout: Layout) => Layout) => {
      const currentLayout = storage.get('layout') as Layout;
      const newLayout = updater(currentLayout);
      storage.set('layout', newLayout);
    },
    []
  );

  // Helper to get current layout (remote in collab mode, local otherwise)
  const getLayout = useCallback((): Layout => {
    if (isCollaborative && remoteLayout) {
      return remoteLayout;
    }
    return store.layout;
  }, [isCollaborative, remoteLayout, store.layout]);

  // ====== BIN OPERATIONS ======

  const addBin = useCallback(
    (binData: Omit<Bin, 'id'>): Result<string, ValidationError> => {
      const layout = getLayout();
      const id = generateId();
      const bin: Bin = { ...binData, id };

      // Validate placement (skip for staging)
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

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: [...currentLayout.bins, bin],
        }));
        return ok(id);
      } else {
        // Local mode: return the ID from store.addBin() which generates its own ID
        return store.addBin(binData);
      }
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  const updateBin = useCallback(
    (id: string, updates: Partial<Bin>): Result<void, LayoutError> => {
      const layout = getLayout();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('updateBin', `Bin ${id} not found`));
      }

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        }));
      } else {
        store.updateBin(id, updates);
      }

      return OK;
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  const deleteBin = useCallback(
    (id: string): Result<void, LayoutError> => {
      const layout = getLayout();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('deleteBin', `Bin ${id} not found`));
      }

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.filter((b) => b.id !== id),
        }));
      } else {
        store.deleteBin(id);
      }

      return OK;
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  const deleteBins = useCallback(
    (ids: string[]): Result<void, LayoutError> => {
      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.filter((b) => !ids.includes(b.id)),
        }));
      } else {
        // Delete each bin individually in local mode
        ids.forEach((id) => store.deleteBin(id));
      }

      return OK;
    },
    [isCollaborative, updateLiveblocksLayout, store]
  );

  const duplicateBin = useCallback(
    (id: string): Result<string, ValidationError | LayoutError> => {
      const layout = getLayout();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('duplicateBin', `Bin ${id} not found`));
      }

      // For staging bins, just create a copy in staging
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

      // Try adjacent positions
      const offsets = [
        { dx: bin.width, dy: 0 },
        { dx: 0, dy: -bin.depth },
        { dx: -bin.width, dy: 0 },
        { dx: 0, dy: bin.depth },
      ];

      for (const { dx, dy } of offsets) {
        const newX = bin.x + dx;
        const newY = bin.y + dy;

        const result = canPlaceBin(
          { x: newX, y: newY, width: bin.width, depth: bin.depth, height: bin.height },
          bin.layerId,
          layout,
          id
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

      // Fallback to staging
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
    [getLayout, addBin]
  );

  const moveBinToStaging = useCallback(
    (id: string): Result<void, LayoutError> => {
      const layout = getLayout();
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('moveBinToStaging', `Bin ${id} not found`));
      }

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.map((b) =>
            b.id === id ? { ...b, layerId: STAGING_ID } : b
          ),
        }));
      } else {
        store.moveBinToStaging(id);
      }

      return OK;
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  const moveBinFromStaging = useCallback(
    (id: string, layerId: string, x: number, y: number): Result<void, ValidationError | LayoutError> => {
      const layout = getLayout();
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
        const reason = validationResult.reason ?? 'out_of_bounds';
        if (reason === 'collision') {
          return err(validationCollision());
        }
        return err(validationOutOfBounds(reason, { x, y, width: bin.width, depth: bin.depth }));
      }

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.map((b) =>
            b.id === id
              ? { ...b, layerId, x, y, height: layer.height }
              : b
          ),
        }));
      } else {
        store.moveBinFromStaging(id, layerId, x, y);
      }

      return OK;
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  // ====== LAYER OPERATIONS ======

  const addLayer = useCallback((): Result<string, LayoutError> => {
    const layout = getLayout();

    if (layout.layers.length >= CONSTRAINTS.LAYERS_MAX) {
      return err(layoutLayerLimit(layout.layers.length, CONSTRAINTS.LAYERS_MAX));
    }

    const totalHeight = layout.layers.reduce((sum, l) => sum + l.height, 0);
    const remaining = layout.drawer.height - totalHeight;
    if (remaining < 1) {
      return err(layoutInvalidOperation('addLayer', 'No remaining height in drawer'));
    }

    const defaultLayerHeight = useSettingsStore.getState().settings.defaultLayerHeight;
    const id = generateId();
    const newLayer: Layer = {
      id,
      name: `Layer ${layout.layers.length + 1}`,
      height: Math.min(remaining, defaultLayerHeight),
    };

    if (isCollaborative) {
      updateLiveblocksLayout((currentLayout) => ({
        ...currentLayout,
        layers: [...currentLayout.layers, newLayer],
      }));
      return ok(id);
    } else {
      // In local mode, store generates its own ID - return that instead
      return store.addLayer();
    }
  }, [isCollaborative, getLayout, updateLiveblocksLayout, store]);

  const updateLayer = useCallback(
    (id: string, updates: Partial<Layer>): Result<void, LayoutError> => {
      const layout = getLayout();
      const layer = layout.layers.find((l) => l.id === id);
      if (!layer) {
        return err(layoutInvalidOperation('updateLayer', `Layer ${id} not found`));
      }

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => {
          const processedUpdates = { ...updates };

          // Clamp height if provided
          if (processedUpdates.height !== undefined) {
            const othersHeight = currentLayout.layers
              .filter((l) => l.id !== id)
              .reduce((sum, l) => sum + l.height, 0);
            const maxHeight = currentLayout.drawer.height - othersHeight;
            processedUpdates.height = clamp(processedUpdates.height, 1, maxHeight);
          }

          return {
            ...currentLayout,
            layers: currentLayout.layers.map((l) =>
              l.id === id ? { ...l, ...processedUpdates } : l
            ),
          };
        });
      } else {
        store.updateLayer(id, updates);
      }

      return OK;
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  const deleteLayer = useCallback(
    (id: string): Result<void, LayoutError> => {
      const layout = getLayout();

      if (layout.layers.length <= CONSTRAINTS.LAYERS_MIN) {
        return err(layoutLastEntity('layer'));
      }

      const layer = layout.layers.find((l) => l.id === id);
      if (!layer) {
        return err(layoutInvalidOperation('deleteLayer', `Layer ${id} not found`));
      }

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          layers: currentLayout.layers.filter((l) => l.id !== id),
          bins: currentLayout.bins.filter((b) => b.layerId !== id),
        }));
      } else {
        store.deleteLayer(id);
      }

      return OK;
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  const reorderLayers = useCallback(
    (fromIndex: number, toIndex: number): Result<void, LayoutError> => {
      if (fromIndex === toIndex) return OK;

      const layout = getLayout();
      if (fromIndex < 0 || fromIndex >= layout.layers.length) {
        return err(layoutInvalidOperation('reorderLayers', 'Invalid source index'));
      }
      if (toIndex < 0 || toIndex >= layout.layers.length) {
        return err(layoutInvalidOperation('reorderLayers', 'Invalid target index'));
      }

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => {
          const newLayers = [...currentLayout.layers];
          const [moved] = newLayers.splice(fromIndex, 1);
          newLayers.splice(toIndex, 0, moved);
          return { ...currentLayout, layers: newLayers };
        });
      } else {
        store.reorderLayers(fromIndex, toIndex);
      }

      return OK;
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  // ====== DRAWER OPERATIONS ======

  const updateDrawer = useCallback(
    (updates: Partial<Drawer>): void => {
      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => {
          const drawer = { ...currentLayout.drawer };

          if (updates.width !== undefined) {
            drawer.width = clamp(updates.width, CONSTRAINTS.GRID_MIN, CONSTRAINTS.GRID_MAX);
          }
          if (updates.depth !== undefined) {
            drawer.depth = clamp(updates.depth, CONSTRAINTS.GRID_MIN, CONSTRAINTS.GRID_MAX);
          }
          if (updates.height !== undefined) {
            const totalLayerHeight = currentLayout.layers.reduce((sum, l) => sum + l.height, 0);
            drawer.height = Math.max(totalLayerHeight, updates.height);
          }
          if (updates.fractionalEdgeX !== undefined) {
            drawer.fractionalEdgeX = updates.fractionalEdgeX;
          }
          if (updates.fractionalEdgeY !== undefined) {
            drawer.fractionalEdgeY = updates.fractionalEdgeY;
          }

          // Move out-of-bounds bins to staging
          const bins = currentLayout.bins.map((bin) => {
            if (bin.layerId === STAGING_ID) return bin;
            if (bin.x + bin.width > drawer.width || bin.y + bin.depth > drawer.depth) {
              return { ...bin, layerId: STAGING_ID };
            }
            return bin;
          });

          return { ...currentLayout, drawer, bins };
        });
      } else {
        store.updateDrawer(updates);
      }
    },
    [isCollaborative, updateLiveblocksLayout, store]
  );

  // ====== CATEGORY OPERATIONS ======

  const addCategory = useCallback(
    (categoryData: Omit<Category, 'id'>): Result<string, LayoutError> => {
      const layout = getLayout();

      if (layout.categories.length >= CONSTRAINTS.CATEGORIES_MAX) {
        return err(layoutCategoryLimit(layout.categories.length, CONSTRAINTS.CATEGORIES_MAX));
      }

      const id = generateId();

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          categories: [...currentLayout.categories, { ...categoryData, id }],
        }));
        return ok(id);
      } else {
        // In local mode, store generates its own ID - return that instead
        return store.addCategory(categoryData);
      }
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  const updateCategory = useCallback(
    (id: string, updates: Partial<Category>): Result<void, LayoutError> => {
      const layout = getLayout();
      const category = layout.categories.find((c) => c.id === id);
      if (!category) {
        return err(layoutInvalidOperation('updateCategory', `Category ${id} not found`));
      }

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          categories: currentLayout.categories.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
      } else {
        store.updateCategory(id, updates);
      }

      return OK;
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  const deleteCategory = useCallback(
    (id: string): Result<void, LayoutError> => {
      const layout = getLayout();

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

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          categories: currentLayout.categories.filter((c) => c.id !== id),
        }));
      } else {
        store.deleteCategory(id);
      }

      return OK;
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  // ====== BULK OPERATIONS ======

  const fillLayer = useCallback(
    (layerId: string, width: number, depth: number, categoryId: string, halfBinMode = false): number => {
      // TODO: Implement collaborative-aware fillLayer for Phase 4
      // Current limitation: Delegates to local store and relies on sync hook.
      // This may cause race conditions if multiple users fill simultaneously.
      // For MVP, this is acceptable as fill is typically an owner-only operation.
      if (isCollaborative && import.meta.env.DEV) {
        console.warn(
          '[useCollabMutations] fillLayer is not yet collaborative-aware. ' +
          'Concurrent fills by multiple users may cause conflicts.'
        );
      }
      return store.fillLayer(layerId, width, depth, categoryId, halfBinMode);
    },
    [store, isCollaborative]
  );

  const clearLayer = useCallback(
    (layerId: string): number => {
      const layout = getLayout();
      const count = layout.bins.filter((b) => b.layerId === layerId).length;

      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          bins: currentLayout.bins.filter((b) => b.layerId !== layerId),
        }));
      } else {
        store.clearLayer(layerId);
      }

      return count;
    },
    [isCollaborative, getLayout, updateLiveblocksLayout, store]
  );

  // ====== LAYOUT METADATA ======

  const setName = useCallback(
    (name: string): void => {
      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          name: name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH),
        }));
      } else {
        store.setName(name);
      }
    },
    [isCollaborative, updateLiveblocksLayout, store]
  );

  const setPrintBedSize = useCallback(
    (size: number): void => {
      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          printBedSize: clamp(size, 42, 500),
        }));
      } else {
        store.setPrintBedSize(size);
      }
    },
    [isCollaborative, updateLiveblocksLayout, store]
  );

  const setGridUnitMm = useCallback(
    (mm: number): void => {
      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          gridUnitMm: clamp(mm, 1, 200),
        }));
      } else {
        store.setGridUnitMm(mm);
      }
    },
    [isCollaborative, updateLiveblocksLayout, store]
  );

  const setHeightUnitMm = useCallback(
    (mm: number): void => {
      if (isCollaborative) {
        updateLiveblocksLayout((currentLayout) => ({
          ...currentLayout,
          heightUnitMm: clamp(mm, 1, 50),
        }));
      } else {
        store.setHeightUnitMm(mm);
      }
    },
    [isCollaborative, updateLiveblocksLayout, store]
  );

  return {
    addBin,
    updateBin,
    deleteBin,
    deleteBins,
    duplicateBin,
    moveBinToStaging,
    moveBinFromStaging,
    addLayer,
    updateLayer,
    deleteLayer,
    reorderLayers,
    updateDrawer,
    addCategory,
    updateCategory,
    deleteCategory,
    fillLayer,
    clearLayer,
    setName,
    setPrintBedSize,
    setGridUnitMm,
    setHeightUnitMm,
  };
}
