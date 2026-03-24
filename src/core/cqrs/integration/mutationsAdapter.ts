/**
 * CQRS Mutations Adapter — Strangler Fig Integration
 *
 * Implements the existing `Mutations` interface by dispatching commands
 * through the command bus instead of calling the store directly.
 * This is the key integration point for migrating to CQRS.
 */

import type { Mutations } from '@/shared/contexts/MutationsContext';
import type {
  Bin,
  BinId,
  LayerId,
  CategoryId,
  Category,
  Layer,
  Drawer,
  BaseplateParams,
} from '@/core/types';
import type { Result, ValidationError, LayoutError } from '@/core/result';
import { ok, err, isOk } from '@/core/result';
import { createCommand } from '../commands';
import type { CommandBus } from '../bus/commandBus';
import type { DomainEvent } from '../events';
import type { CommandResult } from '../types';

/**
 * Extract the value from a CommandResult, converting it to the expected
 * Result type that the Mutations interface requires.
 */
function extractResult<T, E = ValidationError | LayoutError>(
  cmdResult: CommandResult<unknown, DomainEvent>
): Result<T, E> {
  if (isOk(cmdResult)) {
    return ok(cmdResult.value.value as T);
  }
  return err(cmdResult.error as E);
}

/**
 * Create a Mutations implementation that routes through the CQRS command bus.
 */
export function createCqrsMutations(bus: CommandBus): Mutations {
  return {
    addBin(bin: Omit<Bin, 'id'>): Result<BinId, ValidationError> {
      const result = bus.dispatch(createCommand('bin.add', bin));
      return extractResult(result);
    },

    updateBin(id: BinId, updates: Partial<Bin>): Result<void, LayoutError> {
      const result = bus.dispatch(createCommand('bin.update', { id, updates }));
      return extractResult(result);
    },

    deleteBin(id: BinId): Result<void, LayoutError> {
      const result = bus.dispatch(createCommand('bin.delete', { id }));
      return extractResult(result);
    },

    deleteBins(ids: BinId[]): Result<void, LayoutError> {
      const result = bus.dispatch(createCommand('bin.deleteBatch', { ids }));
      return extractResult(result);
    },

    duplicateBin(id: BinId): Result<BinId, ValidationError | LayoutError> {
      const result = bus.dispatch(createCommand('bin.duplicate', { id }));
      return extractResult(result);
    },

    moveBinToStaging(id: BinId): Result<void, LayoutError> {
      const result = bus.dispatch(createCommand('bin.moveToStaging', { id }));
      return extractResult(result);
    },

    moveBinFromStaging(
      id: BinId,
      layerId: LayerId,
      x: number,
      y: number
    ): Result<void, ValidationError | LayoutError> {
      const result = bus.dispatch(createCommand('bin.moveFromStaging', { id, layerId, x, y }));
      return extractResult(result);
    },

    addLayer(): Result<LayerId, LayoutError> {
      const result = bus.dispatch(createCommand('layer.add', {}));
      return extractResult(result);
    },

    updateLayer(id: LayerId, updates: Partial<Layer>): Result<void, LayoutError> {
      const result = bus.dispatch(createCommand('layer.update', { id, updates }));
      return extractResult(result);
    },

    deleteLayer(id: LayerId): Result<void, LayoutError> {
      const result = bus.dispatch(createCommand('layer.delete', { id }));
      return extractResult(result);
    },

    reorderLayers(fromIndex: number, toIndex: number): Result<void, LayoutError> {
      const result = bus.dispatch(createCommand('layer.reorder', { fromIndex, toIndex }));
      return extractResult(result);
    },

    updateDrawer(updates: Partial<Drawer>): void {
      bus.dispatch(createCommand('drawer.update', updates));
    },

    addCategory(category: Omit<Category, 'id'>): Result<CategoryId, LayoutError> {
      const result = bus.dispatch(createCommand('category.add', category));
      return extractResult(result);
    },

    updateCategory(id: CategoryId, updates: Partial<Category>): Result<void, LayoutError> {
      const result = bus.dispatch(createCommand('category.update', { id, updates }));
      return extractResult(result);
    },

    deleteCategory(id: CategoryId): Result<void, LayoutError> {
      const result = bus.dispatch(createCommand('category.delete', { id }));
      return extractResult(result);
    },

    fillLayer(
      layerId: LayerId,
      width: number,
      depth: number,
      categoryId: CategoryId,
      halfBinMode?: boolean
    ): number {
      const result = bus.dispatch(
        createCommand('bin.fillLayer', { layerId, width, depth, categoryId, halfBinMode })
      );
      if (isOk(result)) return result.value.value as number;
      return 0;
    },

    fillLayerGaps(layerId: LayerId, categoryId: CategoryId, halfBinMode?: boolean): number {
      const result = bus.dispatch(
        createCommand('bin.fillGaps', { layerId, categoryId, halfBinMode })
      );
      if (isOk(result)) return result.value.value as number;
      return 0;
    },

    clearLayer(layerId: LayerId): number {
      const result = bus.dispatch(createCommand('bin.clearLayer', { layerId }));
      if (isOk(result)) return result.value.value as number;
      return 0;
    },

    setName(name: string): void {
      bus.dispatch(createCommand('layout.setName', { name }));
    },

    setPrintBedSize(size: number): void {
      bus.dispatch(createCommand('layout.setPrintBedSize', { size }));
    },

    setGridUnitMm(mm: number): void {
      bus.dispatch(createCommand('layout.setGridUnitMm', { mm }));
    },

    setHeightUnitMm(mm: number): void {
      bus.dispatch(createCommand('layout.setHeightUnitMm', { mm }));
    },

    setBaseplateParams(params: BaseplateParams): void {
      bus.dispatch(createCommand('layout.setBaseplateParams', { params }));
    },
  };
}
