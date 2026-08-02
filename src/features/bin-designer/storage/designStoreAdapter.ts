/**
 * Concrete `DesignStorePort` for the bin-designer feature.
 *
 * Lives here (not in `core/`) because it touches `DesignerStorage` and
 * `customBinRegistry`, which own `BinParams`/`SavedDesign`/`CustomBinRef` —
 * types core cannot import. Registered with the port at the `shared/`
 * composition root at app boot.
 *
 * Each method `import()`s the underlying module on first use so the
 * IndexedDB/registry code stays out of any eager chunk that only needs the
 * adapter reference — the same code-splitting the old dynamic imports in
 * `core/storage` provided, now on an allowed feature-internal edge.
 */

import type {
  DesignRegistryEdgeFields,
  DesignRegistryEntry,
  DesignStorePort,
  LoadedDesignData,
  SaveDesignInput,
  SavedDesignData,
} from '@/core/storage/designStorePort';
import type { Result, StorageError } from '@/core/result';
import type { DesignId } from '@/core/types';
import type { BinParams } from '@/features/bin-designer/types';

export const designStoreAdapter: DesignStorePort = {
  async loadDesign(id: DesignId): Promise<Result<LoadedDesignData, StorageError>> {
    const { loadDesign } = await import('@/features/bin-designer/storage/DesignerStorage');
    return loadDesign(id);
  },

  async saveDesign(input: SaveDesignInput): Promise<Result<SavedDesignData, StorageError>> {
    const { saveDesign } = await import('@/features/bin-designer/storage/DesignerStorage');
    return saveDesign({
      id: input.id,
      name: input.name,
      params: input.params as BinParams,
      thumbnail: input.thumbnail,
      exportFileNameConfig: input.exportFileNameConfig,
    });
  },

  async upsertRegistryEntry(entry: DesignRegistryEntry): Promise<Result<void, StorageError>> {
    const { upsertRegistryEntry } = await import('@/features/bin-designer/store/customBinRegistry');
    return upsertRegistryEntry(entry);
  },

  async registryEdgeFields(params: unknown): Promise<DesignRegistryEdgeFields> {
    const { registryEdgeFields } = await import('@/features/bin-designer/store/customBinRegistry');
    return registryEdgeFields(params as BinParams);
  },
};
