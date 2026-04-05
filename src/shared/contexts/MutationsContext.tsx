/* eslint-disable react-refresh/only-export-components -- Context exports multiple hooks by design */
/**
 * Mutations Context - Provides a unified interface for layout mutations.
 *
 * All mutations route through the CQRS command bus, which validates commands,
 * captures undo snapshots, produces domain events, and delegates to the
 * layout store. The command bus is transparent — components use the same
 * `useMutations()` hook as before.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { addBin, deleteBin } = useMutations();
 *   // Mutations flow through the command bus automatically
 * }
 * ```
 */

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createCqrsMutations, commandBus } from '@/core/cqrs';
import type {
  Bin,
  Layer,
  Category,
  Drawer,
  BinId,
  LayerId,
  CategoryId,
  BaseplateParams,
} from '@/core/types';
import type { Result, ValidationError, LayoutError } from '@/core/result';

/**
 * Mutation functions interface.
 * All mutations are routed through the CQRS command bus.
 */
export interface Mutations {
  // Bin operations
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

  // Layout metadata
  setName: (name: string) => void;
  setPrintBedSize: (size: number, depth?: number) => void;
  setGridUnitMm: (mm: number) => void;
  setHeightUnitMm: (mm: number) => void;
  setBaseplateParams: (params: BaseplateParams) => void;
}

const MutationsContext = createContext<Mutations | null>(null);

/** CQRS-backed mutations singleton (stable across renders) */
const cqrsMutations: Mutations = createCqrsMutations(commandBus);

/**
 * Hook to access mutations.
 * Returns context mutations if in a provider, otherwise CQRS mutations directly.
 */
export function useMutations(): Mutations {
  const context = useContext(MutationsContext);
  return context ?? cqrsMutations;
}

/**
 * Provider for mutations context.
 * Used to provide mutations through React context for collab mode compatibility.
 */
export function LocalMutationsProvider({ children }: { children: ReactNode }) {
  const mutations = useMemo<Mutations>(() => cqrsMutations, []);

  return <MutationsContext.Provider value={mutations}>{children}</MutationsContext.Provider>;
}

export { MutationsContext };
