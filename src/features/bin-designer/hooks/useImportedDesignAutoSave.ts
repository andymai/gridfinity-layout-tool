/**
 * Auto-save for imported-mesh designs.
 *
 * `useAutoSave` is bin-params-only (it persists via `updateDesignParams`),
 * so non-bin kinds have no auto-save path through it. Imported designs are
 * saved eagerly at import; this hook covers the two things that can change
 * afterwards: the claimed footprint (envelope width/depth + heightUnits) and
 * the one-time thumbnail captured after the first successful generation.
 *
 * Saves merge over the loaded record (load → spread → save) so the captured
 * thumbnail and createdAt are never clobbered by a footprint edit.
 */
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isOk } from '@/core/result';
import { designId as toDesignId } from '@/core/types';
import type { ItemEnvelope, ItemStructure } from '@/shared/types/item';
import {
  loadDesign,
  saveDesign,
  updateDesignThumbnail,
} from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '../store';
import { registryEdgeFields, upsertRegistryEntry } from '../store/customBinRegistry';
import { captureThumbnailAtPreset } from '../utils/thumbnail';

const AUTO_SAVE_DELAY_MS = 1000;

async function persistFootprint(
  id: string,
  envelope: ItemEnvelope,
  structure: ItemStructure
): Promise<void> {
  const existing = await loadDesign(toDesignId(id));
  if (!isOk(existing)) return;
  const result = await saveDesign({
    ...existing.value,
    kind: 'importedMesh',
    envelope,
    structure,
  });
  if (!isOk(result) || structure.kind !== 'importedMesh') return;
  upsertRegistryEntry({
    id: result.value.id,
    name: result.value.name,
    width: envelope.width,
    depth: envelope.depth,
    height: structure.heightUnits,
    kind: 'importedMesh',
    ...registryEdgeFields({}),
    updatedAt: result.value.updatedAt,
  });
}

export function useImportedDesignAutoSave(): void {
  const { itemKind, envelope, structure, currentDesignId, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      itemKind: s.itemKind,
      envelope: s.envelope,
      structure: s.structure,
      currentDesignId: s.currentDesignId,
      generationStatus: s.generation.status,
    }))
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{ envelope: ItemEnvelope | null; structure: ItemStructure | null }>({
    envelope: null,
    structure: null,
  });
  const lastDesignIdRef = useRef<string | null>(null);
  const thumbnailCapturedRef = useRef<string | null>(null);

  // Debounced footprint persistence.
  useEffect(() => {
    if (itemKind !== 'importedMesh' || !currentDesignId || !envelope || !structure) return;

    // Design switch: reset tracking without saving (the loaded record is
    // already persisted).
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
    timerRef.current = setTimeout(() => {
      lastSavedRef.current = { envelope, structure };
      void persistFootprint(id, envelope, structure);
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [itemKind, envelope, structure, currentDesignId]);

  // One-time thumbnail capture after the first completed generation.
  useEffect(() => {
    if (
      itemKind !== 'importedMesh' ||
      !currentDesignId ||
      !envelope ||
      structure?.kind !== 'importedMesh' ||
      generationStatus !== 'complete' ||
      thumbnailCapturedRef.current === currentDesignId
    ) {
      return;
    }
    thumbnailCapturedRef.current = currentDesignId;
    const id = currentDesignId;
    // Small delay for React Three Fiber to flush the final render.
    const timer = setTimeout(() => {
      const thumbnail = captureThumbnailAtPreset({
        width: envelope.width,
        depth: envelope.depth,
        height: structure.heightUnits,
        gridUnitMm: envelope.gridUnitMm,
        heightUnitMm: envelope.heightUnitMm,
      });
      if (thumbnail) void updateDesignThumbnail(toDesignId(id), thumbnail);
    }, 150);
    return () => clearTimeout(timer);
  }, [itemKind, currentDesignId, envelope, structure, generationStatus]);
}
