/**
 * Auto-save for Workshop assemblies.
 *
 * `useAutoSave` is bin-params-only, and unlike imported meshes (saved
 * eagerly at import) a fresh assembly has no record at all — so this hook
 * owns the whole lifecycle: it CREATES the design on the first part placed,
 * then persists structure/envelope edits debounced, refreshing the
 * thumbnail from the live scene whenever a save lands while the sharp
 * mesh is up. Saves merge over the loaded record (load → spread → save) so
 * createdAt, tags, and sync lineage survive.
 */
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isOk } from '@/core/result';
import { designId as toDesignId } from '@/core/types';
import type { ItemEnvelope, ItemStructure } from '@/shared/types/item';
import { assemblyHeightUnits } from '@/shared/types/assemblyPlacement';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { loadDesign, saveDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '../store';
import { registryEdgeFields, upsertRegistryEntry } from '../store/customBinRegistry';
import { captureThumbnailAtPreset } from '../utils/thumbnail';

const AUTO_SAVE_DELAY_MS = 1000;

function assemblyThumbnail(envelope: ItemEnvelope, structure: ItemStructure): string | null {
  if (structure.kind !== 'assembly') return null;
  return captureThumbnailAtPreset({
    width: envelope.width,
    depth: envelope.depth,
    height: assemblyHeightUnits(
      structure,
      envelope.heightUnitMm,
      GRIDFINITY_SPEC.SOCKET_HEIGHT + structure.base.floorThickness
    ),
    gridUnitMm: envelope.gridUnitMm,
    heightUnitMm: envelope.heightUnitMm,
  });
}

async function persistExisting(
  id: string,
  name: string | null,
  envelope: ItemEnvelope,
  structure: ItemStructure,
  thumbnail: string | null
): Promise<void> {
  const existing = await loadDesign(toDesignId(id));
  if (!isOk(existing)) return;
  const result = await saveDesign({
    ...existing.value,
    ...(name ? { name } : {}),
    kind: 'assembly',
    envelope,
    structure,
    ...(thumbnail ? { thumbnail } : {}),
  });
  if (!isOk(result) || structure.kind !== 'assembly') return;
  upsertRegistryEntry({
    id: result.value.id,
    name: result.value.name,
    width: envelope.width,
    depth: envelope.depth,
    height: assemblyHeightUnits(
      structure,
      envelope.heightUnitMm,
      GRIDFINITY_SPEC.SOCKET_HEIGHT + structure.base.floorThickness
    ),
    kind: 'assembly',
    ...registryEdgeFields({}),
    updatedAt: result.value.updatedAt,
  });
}

export function useWorkshopAutoSave(): void {
  const { itemKind, envelope, structure, currentDesignId, designName, generationStatus } =
    useDesignerStore(
      useShallow((s) => ({
        itemKind: s.itemKind,
        envelope: s.envelope,
        structure: s.structure,
        currentDesignId: s.currentDesignId,
        designName: s.designName,
        generationStatus: s.generation.status,
      }))
    );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{ envelope: ItemEnvelope | null; structure: ItemStructure | null }>({
    envelope: null,
    structure: null,
  });
  const lastDesignIdRef = useRef<string | null>(null);
  const creatingRef = useRef(false);

  useEffect(() => {
    if (itemKind !== 'assembly' || !envelope || structure?.kind !== 'assembly') return;

    // First save: a build exists but no record does. Create it once.
    if (!currentDesignId) {
      if (structure.parts.length === 0 || creatingRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        creatingRef.current = true;
        const thumbnail =
          generationStatus === 'complete' ? assemblyThumbnail(envelope, structure) : null;
        void saveDesign({
          name: designName,
          kind: 'assembly',
          envelope,
          structure,
          thumbnail: thumbnail ?? null,
          exportFileNameConfig: null,
        }).then((result) => {
          creatingRef.current = false;
          if (!isOk(result)) return;
          lastDesignIdRef.current = result.value.id;
          lastSavedRef.current = { envelope, structure };
          const store = useDesignerStore.getState();
          // Only adopt the id if the user is still on this same build.
          if (store.itemKind === 'assembly' && store.currentDesignId === null) {
            store.setCurrentDesignId(result.value.id);
          }
        });
      }, AUTO_SAVE_DELAY_MS);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    // Design switch: reset tracking without saving.
    if (currentDesignId !== lastDesignIdRef.current) {
      lastDesignIdRef.current = currentDesignId;
      lastSavedRef.current = { envelope, structure };
      return;
    }

    if (
      lastSavedRef.current.envelope === envelope &&
      lastSavedRef.current.structure === structure
    ) {
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    const id = currentDesignId;
    const name = designName;
    timerRef.current = setTimeout(() => {
      lastSavedRef.current = { envelope, structure };
      const thumbnail =
        useDesignerStore.getState().generation.status === 'complete'
          ? assemblyThumbnail(envelope, structure)
          : null;
      void persistExisting(id, name, envelope, structure, thumbnail);
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [itemKind, envelope, structure, currentDesignId, designName, generationStatus]);
}
