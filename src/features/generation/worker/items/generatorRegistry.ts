/**
 * Generator half of the item-type system (OCCT, worker-only). Holds each
 * kind's geometry `generate` (preview/export mesh) and `export` (STL/STEP).
 * Kept out of `@/shared` so OCCT never reaches the UI bundle.
 */
import type { GridfinityItem, ItemKind } from '@/shared/types/item';
import type { ExportFormat, MeshData } from '../../bridge/types';
import type { ProgressFn } from '../generators/generatorTypes';

export interface ItemExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
}

export interface ItemGeneratorModule {
  readonly kind: ItemKind;
  readonly generate: (
    item: GridfinityItem,
    onProgress: ProgressFn,
    isExport: boolean,
    signal?: AbortSignal
  ) => MeshData;
  readonly export: (
    item: GridfinityItem,
    format: ExportFormat,
    tolerance?: number,
    angularTolerance?: number
  ) => Promise<ItemExportResult>;
}

const registry = new Map<ItemKind, ItemGeneratorModule>();

export function registerItemGenerator(module: ItemGeneratorModule): void {
  registry.set(module.kind, module);
}

export function getItemGenerator(kind: ItemKind): ItemGeneratorModule {
  const module = registry.get(kind);
  if (!module) {
    throw new Error(`No item generator registered for kind '${kind}'`);
  }
  return module;
}
