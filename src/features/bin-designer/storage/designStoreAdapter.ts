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
 *
 * Every design core loads leaves the device (layout file export, cloud share,
 * bulk archive), so `loadDesign` hands back its meshes inline, and a design
 * whose mesh file is missing fails with `STORAGE_MESH_MISSING`.
 */

import type {
  DesignRegistryEdgeFields,
  DesignRegistryEntry,
  DesignRegistryPlacementFields,
  DesignStorePort,
  DesignSummary,
  LoadedDesignData,
  PreparedBinParams,
  SaveDesignInput,
  SavedDesignData,
} from '@/core/storage/designStorePort';
import { isOk, ok } from '@/core/result';
import type { Result, StorageError } from '@/core/result';
import type { DesignId } from '@/core/types';
import type { BinParams } from '@/features/bin-designer/types';
import type { ItemEnvelope } from '@/shared/types/item';

export const designStoreAdapter: DesignStorePort = {
  async loadDesign(
    id: DesignId,
    options: { readonly meshRefs?: boolean } = {}
  ): Promise<Result<LoadedDesignData, StorageError>> {
    const [{ loadDesign }, { inlineHolderMeshes }] = await Promise.all([
      import('@/features/bin-designer/storage/DesignerStorage'),
      import('@/shared/generation/meshRefs'),
    ]);
    const loaded = await loadDesign(id);
    if (!isOk(loaded) || options.meshRefs === true) return loaded;
    return inlineHolderMeshes(loaded.value);
  },

  async saveDesign(input: SaveDesignInput): Promise<Result<SavedDesignData, StorageError>> {
    const { saveDesign } = await import('@/features/bin-designer/storage/DesignerStorage');
    if (input.kind === 'assembly' && input.envelope) {
      const { assemblyDescriptor } = await import('@/shared/items/assembly/descriptor');
      const envelope = input.envelope as ItemEnvelope;
      return saveDesign({
        id: input.id,
        name: input.name,
        kind: 'assembly',
        envelope,
        // Migration is the trust boundary: an embedded or shared structure
        // gets schema-salvaged node-by-node, exactly like a sync payload.
        structure: assemblyDescriptor.migrate(input.structure, envelope),
        thumbnail: input.thumbnail,
        exportFileNameConfig: input.exportFileNameConfig,
      });
    }
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

  async registryPlacementFields(params: unknown): Promise<DesignRegistryPlacementFields> {
    const [{ registryHeightFields, registrySlantFields, registrySplitFields }, { migrateParams }] =
      await Promise.all([
        import('@/features/bin-designer/store/customBinRegistry'),
        import('@/features/bin-designer/constants/paramMigration'),
      ]);
    const migrated = migrateParams(params as BinParams);
    return {
      ...registryHeightFields(migrated),
      ...registrySlantFields(migrated),
      ...registrySplitFields(migrated),
    };
  },

  async prepareBinParams(params: unknown): Promise<PreparedBinParams | null> {
    if (typeof params !== 'object' || params === null || Array.isArray(params)) return null;
    const { migrateParams } = await import('@/features/bin-designer/constants/paramMigration');
    let migrated: BinParams;
    try {
      migrated = migrateParams(params);
    } catch {
      return null;
    }
    const { width, depth, height } = migrated;
    const size = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
    if (!size(width) || !size(depth) || !size(height)) return null;
    return { params: migrated, width, depth, height };
  },

  async listDesignSummaries(
    options: { readonly thumbnails?: boolean } = {}
  ): Promise<Result<DesignSummary[], StorageError>> {
    const [{ listDesigns }, { listAllDesignVersions }, { isUntouchedDefault }] = await Promise.all([
      import('@/features/bin-designer/storage/DesignerStorage'),
      import('@/features/bin-designer/storage/DesignVersionService'),
      import('@/features/bin-designer/utils/untouchedDesign'),
    ]);
    const designs = await listDesigns();
    if (!isOk(designs)) return designs;
    // Version dates only sharpen the summary, so a failed read leaves them empty.
    const versions = await listAllDesignVersions();
    const versionDates = new Map<string, string[]>();
    if (isOk(versions)) {
      for (const version of versions.value) {
        const dates = versionDates.get(version.designId) ?? [];
        dates.push(version.createdAt);
        versionDates.set(version.designId, dates);
      }
    }
    return ok(
      designs.value.map((design) => ({
        id: design.id,
        name: design.name,
        createdAt: design.createdAt,
        updatedAt: design.updatedAt,
        ...(design.params ? { params: design.params } : {}),
        thumbnail: options.thumbnails === false ? null : design.thumbnail,
        remixed: (design.lineage ?? null) !== null,
        untouched: design.params ? isUntouchedDefault(design.params) : false,
        versionDates: versionDates.get(design.id) ?? [],
      }))
    );
  },
};
