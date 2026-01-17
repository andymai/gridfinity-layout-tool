/* eslint-disable react-refresh/only-export-components */
/**
 * Mutations Context - Provides a unified interface for layout mutations.
 *
 * This module provides direct access to layout store mutations.
 * All validation and error handling is done in the store itself.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { addBin, deleteBin } = useMutations();
 *   // Mutations go directly to the store
 * }
 * ```
 */

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLayoutStore } from '../core/store/layout';
import type { Bin, Layer, Category, Drawer } from '../core/types';
import type { Result, ValidationError, LayoutError } from '../core/result';

/**
 * Mutation functions interface.
 * All mutations are passed through directly to the layout store.
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
 * Hook to access mutations.
 * Returns store mutations directly, or context mutations if in a provider.
 */
export function useMutations(): Mutations {
  const context = useContext(MutationsContext);
  const storeMutations = useStoreMutations();

  // If in a provider, use context mutations
  // Otherwise, use store mutations directly
  return context ?? storeMutations;
}

/**
 * Hook that provides mutations directly from the store.
 * This is the primary implementation - all validation is in the store.
 */
function useStoreMutations(): Mutations {
  // Use getState() instead of the hook since we only need stable method references
  // This avoids re-renders when layout state changes
  const store = useLayoutStore.getState();

  return useMemo<Mutations>(
    () => ({
      // Bin operations
      addBin: store.addBin,
      updateBin: store.updateBin,
      deleteBin: store.deleteBin,
      deleteBins: store.deleteBins,
      duplicateBin: store.duplicateBin,
      moveBinToStaging: store.moveBinToStaging,
      moveBinFromStaging: store.moveBinFromStaging,

      // Layer operations
      addLayer: store.addLayer,
      updateLayer: store.updateLayer,
      deleteLayer: store.deleteLayer,
      reorderLayers: store.reorderLayers,

      // Drawer operations
      updateDrawer: store.updateDrawer,

      // Category operations
      addCategory: store.addCategory,
      updateCategory: store.updateCategory,
      deleteCategory: store.deleteCategory,

      // Bulk operations
      fillLayer: store.fillLayer,
      clearLayer: store.clearLayer,

      // Layout metadata
      setName: store.setName,
      setPrintBedSize: store.setPrintBedSize,
      setGridUnitMm: store.setGridUnitMm,
      setHeightUnitMm: store.setHeightUnitMm,
    }),
    // Store methods from getState() are stable references - no deps needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
}

/**
 * Provider for mutations context.
 * Used to provide mutations through React context for collab mode compatibility.
 */
export function LocalMutationsProvider({ children }: { children: ReactNode }) {
  const mutations = useStoreMutations();

  return (
    <MutationsContext.Provider value={mutations}>
      {children}
    </MutationsContext.Provider>
  );
}

export { MutationsContext };
