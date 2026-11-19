import { err, isErr, ok, storageCorrupted } from '@/core/result';
import type { Result, StorageError } from '@/core/result';
import type { DesignId } from '@/core/types';
import {
  DESIGNER_CONSTRAINTS,
  loadDesign,
  saveDesign,
  upsertRegistryEntry,
  registryEdgeFields,
  useDesignerStore,
} from '@/features/bin-designer';
import { MAX_IMPORTED_MESH_HEIGHT_UNITS } from '@/shared/items/importedMesh/descriptor';

interface Footprint {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

const EPSILON = 1e-6;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Whether the placement is turned a quarter: given as `previous`, the bin
 * before the resize, which is compared with the stored design; or as the
 * `turned` answer of an earlier save in the same run of resizes, whose
 * `previous` sizes were never stored.
 */
export type Orientation = { readonly previous: Footprint } | { readonly turned: boolean };

/**
 * Keep a layout resize of a linked imported model as the design's footprint,
 * the same field the designer's footprint steppers edit; the mesh keeps its
 * size. Without it, the next mount reconciliation sizes the bin back.
 *
 * Returns the footprint as stored, in the design's own axes, and the turn it
 * used. The caller announces it with `design-saved`, which moves the siblings.
 */
export async function saveImportedFootprint(
  id: DesignId,
  size: Footprint,
  orientation: Orientation
): Promise<Result<{ footprint: Footprint; turned: boolean }, StorageError>> {
  const loaded = await loadDesign(id);
  if (isErr(loaded)) return loaded;
  const design = loaded.value;
  if (!design.envelope || design.structure?.kind !== 'importedMesh') {
    return err(storageCorrupted(id, ['not an imported model']));
  }

  // The layout shows a mesh turned a quarter when the bin's footprint is the
  // design's transposed, so a turned bin's size goes back across the axes;
  // saved as placed, the model would stop turning.
  const { width: designW, depth: designD } = design.envelope;
  const turned =
    'turned' in orientation
      ? orientation.turned
      : Math.abs(designW - designD) > EPSILON &&
        Math.abs(orientation.previous.width - designD) < EPSILON &&
        Math.abs(orientation.previous.depth - designW) < EPSILON;
  const { MIN_DIMENSION, MAX_DIMENSION } = DESIGNER_CONSTRAINTS;
  // Sync refuses an imported footprint outside these (api/lib/importedMeshValidation.ts).
  const width = clamp(turned ? size.depth : size.width, MIN_DIMENSION, MAX_DIMENSION);
  const depth = clamp(turned ? size.width : size.depth, MIN_DIMENSION, MAX_DIMENSION);
  const heightUnits = clamp(Math.round(size.height), 1, MAX_IMPORTED_MESH_HEIGHT_UNITS);

  const saved = await saveDesign({
    ...design,
    envelope: { ...design.envelope, width, depth },
    structure: { ...design.structure, heightUnits },
  });
  if (isErr(saved)) return saved;

  upsertRegistryEntry({
    id: saved.value.id,
    name: saved.value.name,
    width,
    depth,
    height: heightUnits,
    kind: 'importedMesh',
    ...registryEdgeFields({}),
    updatedAt: saved.value.updatedAt,
  });

  // The designer keeps the last design in memory; its next footprint edit
  // would otherwise save the old size back.
  const designer = useDesignerStore.getState();
  if (designer.currentDesignId === id && designer.itemKind === 'importedMesh') {
    designer.updateEnvelope({ width, depth });
    designer.updateStructure({ heightUnits });
  }

  return ok({ footprint: { width, depth, height: heightUnits }, turned });
}
