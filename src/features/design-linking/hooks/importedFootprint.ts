import { err, isErr, ok, storageCorrupted } from '@/core/result';
import type { Result, StorageError } from '@/core/result';
import type { DesignId } from '@/core/types';
import type { SavedDesign } from '@/features/bin-designer';
import {
  loadDesign,
  saveDesign,
  upsertRegistryEntry,
  registryEdgeFields,
  useDesignerStore,
} from '@/features/bin-designer';
import { MAX_IMPORTED_MESH_HEIGHT_UNITS } from '@/shared/items/importedMesh/descriptor';
import { emitSyncEvent } from '../events';

interface Footprint {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

/**
 * Keep a layout resize of a linked imported model as the design's footprint,
 * the same field the designer's footprint steppers edit; the mesh keeps its
 * size. Without it, the next mount reconciliation sizes the bin back.
 *
 * The `design-saved` event lets `useDesignSavedListener` move the siblings,
 * so this path needs no cascade of its own.
 */
export async function saveImportedFootprint(
  id: DesignId,
  size: Footprint
): Promise<Result<SavedDesign, StorageError>> {
  const loaded = await loadDesign(id);
  if (isErr(loaded)) return loaded;
  const design = loaded.value;
  if (!design.envelope || design.structure?.kind !== 'importedMesh') {
    return err(storageCorrupted(id, ['not an imported model']));
  }

  const heightUnits = Math.min(
    MAX_IMPORTED_MESH_HEIGHT_UNITS,
    Math.max(1, Math.round(size.height))
  );
  const envelope = { ...design.envelope, width: size.width, depth: size.depth };
  const structure = { ...design.structure, heightUnits };
  const saved = await saveDesign({ ...design, envelope, structure });
  if (isErr(saved)) return saved;

  upsertRegistryEntry({
    id: saved.value.id,
    name: saved.value.name,
    width: size.width,
    depth: size.depth,
    height: heightUnits,
    kind: 'importedMesh',
    ...registryEdgeFields({}),
    updatedAt: saved.value.updatedAt,
  });

  // The designer keeps the last design in memory; its next footprint edit
  // would otherwise save the old size back.
  const designer = useDesignerStore.getState();
  if (designer.currentDesignId === id && designer.itemKind === 'importedMesh') {
    designer.updateEnvelope({ width: size.width, depth: size.depth });
    designer.updateStructure({ heightUnits });
  }

  emitSyncEvent({
    type: 'design-saved',
    designId: id,
    dimensions: { width: size.width, depth: size.depth, height: heightUnits },
  });
  return ok(saved.value);
}
