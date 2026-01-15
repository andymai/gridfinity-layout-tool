/* eslint-disable react-refresh/only-export-components */
/**
 * Mutations Context - Provides a unified interface for layout mutations.
 *
 * This context abstracts whether we're in collaborative or local mode:
 * - In collaborative mode: mutations go through Liveblocks for real-time sync
 * - In local mode: mutations go directly to the Zustand store
 *
 * Components use `useMutations()` hook and don't need to know which mode they're in.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { addBin, deleteBin } = useMutations();
 *   // Works the same in both collaborative and local mode
 * }
 * ```
 */

import { createContext, useContext, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLayoutStore } from '../store/layout';
import type { Bin, Layer, Category, Drawer } from '../types';
import type { Result, ValidationError, LayoutError } from '../result';
import {
  ok,
  err,
  OK,
  validationOutOfBounds,
  validationCollision,
  validationInvalidLayer,
  layoutLastEntity,
  layoutInvalidOperation,
} from '../result';
import { canPlaceBin, clamp } from '../utils/validation';
import { generateId, STAGING_ID, CONSTRAINTS } from '../constants';

// Note: Some imports above are used only by useLocalMutations hook

/**
 * Mutation functions interface - same for both collaborative and local mode.
 */
export interface Mutations {
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

const MutationsContext = createContext<Mutations | null>(null);

/**
 * Hook to access mutations. Works in both collaborative and local mode.
 * Falls back to local mutations when not in a provider (for backwards compatibility in tests).
 */
export function useMutations(): Mutations {
  const context = useContext(MutationsContext);
  const localMutations = useLocalMutations();

  // If in a provider, use context mutations (could be collaborative or local)
  // Otherwise, fall back to local mutations (for tests and backwards compatibility)
  return context ?? localMutations;
}

/**
 * Hook that provides local mutations directly from the store.
 * Used as fallback when not in a MutationsProvider.
 */
function useLocalMutations(): Mutations {
  const store = useLayoutStore();

  const addBinLocal = useCallback(
    (binData: Omit<Bin, 'id'>): Result<string, ValidationError> => {
      const layout = store.layout;
      const id = generateId();
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

      store.addBin(binData);
      return ok(id);
    },
    [store]
  );

  const updateBinLocal = useCallback(
    (id: string, updates: Partial<Bin>): Result<void, LayoutError> => {
      const bin = store.layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('updateBin', `Bin ${id} not found`));
      }
      store.updateBin(id, updates);
      return OK;
    },
    [store]
  );

  const deleteBinLocal = useCallback(
    (id: string): Result<void, LayoutError> => {
      const bin = store.layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('deleteBin', `Bin ${id} not found`));
      }
      store.deleteBin(id);
      return OK;
    },
    [store]
  );

  const deleteBinsLocal = useCallback(
    (ids: string[]): Result<void, LayoutError> => {
      ids.forEach((id) => store.deleteBin(id));
      return OK;
    },
    [store]
  );

  const duplicateBinLocal = useCallback(
    (id: string): Result<string, ValidationError | LayoutError> => {
      const layout = store.layout;
      const bin = layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('duplicateBin', `Bin ${id} not found`));
      }

      if (bin.layerId === STAGING_ID) {
        return addBinLocal({
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
          return addBinLocal({
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

      return addBinLocal({
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
    [store.layout, addBinLocal]
  );

  const moveBinToStagingLocal = useCallback(
    (id: string): Result<void, LayoutError> => {
      const bin = store.layout.bins.find((b) => b.id === id);
      if (!bin) {
        return err(layoutInvalidOperation('moveBinToStaging', `Bin ${id} not found`));
      }
      store.moveBinToStaging(id);
      return OK;
    },
    [store]
  );

  const moveBinFromStagingLocal = useCallback(
    (id: string, layerId: string, x: number, y: number): Result<void, ValidationError | LayoutError> => {
      const layout = store.layout;
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

      store.moveBinFromStaging(id, layerId, x, y);
      return OK;
    },
    [store]
  );

  const addLayerLocal = useCallback((): Result<string, LayoutError> => {
    // Store already does validation and returns the generated ID
    return store.addLayer();
  }, [store]);

  const updateLayerLocal = useCallback(
    (id: string, updates: Partial<Layer>): Result<void, LayoutError> => {
      const layer = store.layout.layers.find((l) => l.id === id);
      if (!layer) {
        return err(layoutInvalidOperation('updateLayer', `Layer ${id} not found`));
      }
      store.updateLayer(id, updates);
      return OK;
    },
    [store]
  );

  const deleteLayerLocal = useCallback(
    (id: string): Result<void, LayoutError> => {
      const layout = store.layout;

      if (layout.layers.length <= CONSTRAINTS.LAYERS_MIN) {
        return err(layoutLastEntity('layer'));
      }

      const layer = layout.layers.find((l) => l.id === id);
      if (!layer) {
        return err(layoutInvalidOperation('deleteLayer', `Layer ${id} not found`));
      }

      store.deleteLayer(id);
      return OK;
    },
    [store]
  );

  const reorderLayersLocal = useCallback(
    (fromIndex: number, toIndex: number): Result<void, LayoutError> => {
      if (fromIndex === toIndex) return OK;

      const layout = store.layout;
      if (fromIndex < 0 || fromIndex >= layout.layers.length) {
        return err(layoutInvalidOperation('reorderLayers', 'Invalid source index'));
      }
      if (toIndex < 0 || toIndex >= layout.layers.length) {
        return err(layoutInvalidOperation('reorderLayers', 'Invalid target index'));
      }

      store.reorderLayers(fromIndex, toIndex);
      return OK;
    },
    [store]
  );

  const updateDrawerLocal = useCallback(
    (updates: Partial<Drawer>): void => {
      store.updateDrawer(updates);
    },
    [store]
  );

  const addCategoryLocal = useCallback(
    (categoryData: Omit<Category, 'id'>): Result<string, LayoutError> => {
      // Store already does validation and returns the generated ID
      return store.addCategory(categoryData);
    },
    [store]
  );

  const updateCategoryLocal = useCallback(
    (id: string, updates: Partial<Category>): Result<void, LayoutError> => {
      const category = store.layout.categories.find((c) => c.id === id);
      if (!category) {
        return err(layoutInvalidOperation('updateCategory', `Category ${id} not found`));
      }
      store.updateCategory(id, updates);
      return OK;
    },
    [store]
  );

  const deleteCategoryLocal = useCallback(
    (id: string): Result<void, LayoutError> => {
      const layout = store.layout;

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

      store.deleteCategory(id);
      return OK;
    },
    [store]
  );

  const fillLayerLocal = useCallback(
    (layerId: string, width: number, depth: number, categoryId: string, halfBinMode = false): number => {
      return store.fillLayer(layerId, width, depth, categoryId, halfBinMode);
    },
    [store]
  );

  const clearLayerLocal = useCallback(
    (layerId: string): number => {
      const count = store.layout.bins.filter((b) => b.layerId === layerId).length;
      store.clearLayer(layerId);
      return count;
    },
    [store]
  );

  const setNameLocal = useCallback(
    (name: string): void => {
      store.setName(name);
    },
    [store]
  );

  const setPrintBedSizeLocal = useCallback(
    (size: number): void => {
      store.setPrintBedSize(clamp(size, 42, 500));
    },
    [store]
  );

  const setGridUnitMmLocal = useCallback(
    (mm: number): void => {
      store.setGridUnitMm(clamp(mm, 1, 200));
    },
    [store]
  );

  const setHeightUnitMmLocal = useCallback(
    (mm: number): void => {
      store.setHeightUnitMm(clamp(mm, 1, 50));
    },
    [store]
  );

  return useMemo<Mutations>(
    () => ({
      addBin: addBinLocal,
      updateBin: updateBinLocal,
      deleteBin: deleteBinLocal,
      deleteBins: deleteBinsLocal,
      duplicateBin: duplicateBinLocal,
      moveBinToStaging: moveBinToStagingLocal,
      moveBinFromStaging: moveBinFromStagingLocal,
      addLayer: addLayerLocal,
      updateLayer: updateLayerLocal,
      deleteLayer: deleteLayerLocal,
      reorderLayers: reorderLayersLocal,
      updateDrawer: updateDrawerLocal,
      addCategory: addCategoryLocal,
      updateCategory: updateCategoryLocal,
      deleteCategory: deleteCategoryLocal,
      fillLayer: fillLayerLocal,
      clearLayer: clearLayerLocal,
      setName: setNameLocal,
      setPrintBedSize: setPrintBedSizeLocal,
      setGridUnitMm: setGridUnitMmLocal,
      setHeightUnitMm: setHeightUnitMmLocal,
    }),
    [
      addBinLocal,
      updateBinLocal,
      deleteBinLocal,
      deleteBinsLocal,
      duplicateBinLocal,
      moveBinToStagingLocal,
      moveBinFromStagingLocal,
      addLayerLocal,
      updateLayerLocal,
      deleteLayerLocal,
      reorderLayersLocal,
      updateDrawerLocal,
      addCategoryLocal,
      updateCategoryLocal,
      deleteCategoryLocal,
      fillLayerLocal,
      clearLayerLocal,
      setNameLocal,
      setPrintBedSizeLocal,
      setGridUnitMmLocal,
      setHeightUnitMmLocal,
    ]
  );
}

/**
 * Provider for local (non-collaborative) mutations.
 * Reuses useLocalMutations hook to provide the same Result-based interface.
 */
export function LocalMutationsProvider({ children }: { children: ReactNode }) {
  const mutations = useLocalMutations();

  return (
    <MutationsContext.Provider value={mutations}>
      {children}
    </MutationsContext.Provider>
  );
}

export { MutationsContext };
