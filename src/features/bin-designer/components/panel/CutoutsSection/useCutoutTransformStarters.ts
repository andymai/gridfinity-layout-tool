/**
 * Transform-lifecycle starters for the cutout workspace.
 *
 * Each `start*` callback transitions `mode` from idle/selected into a
 * dragging/resizing/rotating state, capturing the initial geometry needed
 * to compute deltas during pointer-move.
 *
 * Locked-cutout guards live here so a stray click on a locked shape can't
 * begin a transform; group-aware drag selection handles the React-batching
 * staleness that would otherwise leave a single-id selection at drag start.
 */

import { useCallback } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import { computeBounds } from './geometry';
import { addClonedCutouts } from './cutoutHelpers';
import type { InteractionMode, ResizeHandle } from './cutoutInteractionTypes';

interface UseCutoutTransformStartersOptions {
  readonly cutouts: readonly Cutout[];
  readonly selection: ReadonlySet<string>;
  readonly setSelection: (sel: ReadonlySet<string>) => void;
  readonly onAdd: (cutout: Cutout) => void;
  readonly setMode: (mode: InteractionMode) => void;
  readonly pastDeadZoneRef: React.RefObject<boolean>;
}

export interface CutoutTransformStarters {
  readonly startDrag: (id: string, mmX: number, mmY: number, altKey?: boolean) => void;
  readonly startResize: (id: string, handle: ResizeHandle, mmX: number, mmY: number) => void;
  readonly startRotation: (id: string, startAngle: number) => void;
  readonly startGroupRotation: (startAngle: number) => void;
  readonly startGroupScale: (mmX: number, mmY: number) => void;
}

export function useCutoutTransformStarters({
  cutouts,
  selection,
  setSelection,
  onAdd,
  setMode,
  pastDeadZoneRef,
}: UseCutoutTransformStartersOptions): CutoutTransformStarters {
  const startDrag = useCallback(
    (id: string, mmX: number, mmY: number, altKey?: boolean) => {
      // Locked cutouts cannot be dragged
      const target = cutouts.find((c) => c.id === id);
      if (target?.locked) return;

      // Determine effective selection, handling stale closure for grouped cutouts.
      // When clicking a grouped cutout, selectCutout runs first and sets selection
      // to the whole group, but React batches updates so `selection` here may still
      // be the old value. Compute the correct set eagerly.
      let effectiveSelection: ReadonlySet<string>;
      if (selection.has(id)) {
        effectiveSelection = selection;
      } else {
        const cutout = cutouts.find((c) => c.id === id);
        if (cutout?.groupId) {
          const groupIds = cutouts.filter((c) => c.groupId === cutout.groupId).map((c) => c.id);
          effectiveSelection = new Set(groupIds);
        } else {
          effectiveSelection = new Set([id]);
        }
        setSelection(effectiveSelection);
      }

      // Block drag if any member of the effective selection is locked
      const anyLocked = cutouts.some((c) => effectiveSelection.has(c.id) && c.locked);
      if (anyLocked) return;

      // Alt+drag: duplicate selected cutouts in-place, then drag the clones
      let dragSelection = effectiveSelection;
      let cloneOriginMap: ReadonlyMap<string, string> | null = null;
      if (altKey) {
        const selected = cutouts.filter((c) => effectiveSelection.has(c.id));
        const clones = addClonedCutouts(selected, onAdd, setSelection);
        cloneOriginMap = new Map(clones.map((c) => [c.id, c.originalId]));
        dragSelection = new Set(clones.map((c) => c.id));
      }

      // Store offset from cursor to each selected cutout's origin
      const offsets = new Map<string, { dx: number; dy: number }>();
      for (const selectedId of dragSelection) {
        const lookupId = cloneOriginMap?.get(selectedId) ?? selectedId;
        const cutout = cutouts.find((c) => c.id === lookupId);
        if (cutout) {
          offsets.set(selectedId, { dx: cutout.x - mmX, dy: cutout.y - mmY });
        }
      }

      pastDeadZoneRef.current = false;
      setMode({ type: 'dragging', startX: mmX, startY: mmY, offsets });
    },
    [selection, cutouts, onAdd, setSelection, setMode, pastDeadZoneRef]
  );

  const startResize = useCallback(
    (id: string, handle: ResizeHandle, _mmX: number, _mmY: number) => {
      const cutout = cutouts.find((c) => c.id === id);
      if (!cutout) return;
      if (cutout.locked) return;

      pastDeadZoneRef.current = false;
      setMode({
        type: 'resizing',
        cutoutId: id,
        handle,
        startRect: { x: cutout.x, y: cutout.y, width: cutout.width, depth: cutout.depth },
      });
    },
    [cutouts, setMode, pastDeadZoneRef]
  );

  const startRotation = useCallback(
    (id: string, startAngle: number) => {
      const cutout = cutouts.find((c) => c.id === id);
      if (!cutout) return;
      if (cutout.locked) return;

      pastDeadZoneRef.current = false;
      setMode({
        type: 'rotating',
        cutoutId: id,
        startAngle,
        initialRotation: cutout.rotation,
      });
    },
    [cutouts, setMode, pastDeadZoneRef]
  );

  const startGroupRotation = useCallback(
    (startAngle: number) => {
      const selectedCutouts = cutouts.filter((c) => selection.has(c.id));
      if (selectedCutouts.length < 2) return;
      const bounds = computeBounds(selectedCutouts);
      const center = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
      const initialStates = new Map<string, { x: number; y: number; rotation: number }>();
      for (const c of selectedCutouts) {
        initialStates.set(c.id, { x: c.x, y: c.y, rotation: c.rotation });
      }
      pastDeadZoneRef.current = false;
      setMode({ type: 'group-rotating', startAngle, center, initialStates });
    },
    [cutouts, selection, setMode, pastDeadZoneRef]
  );

  const startGroupScale = useCallback(
    (mmX: number, mmY: number) => {
      const selectedCutouts = cutouts.filter((c) => selection.has(c.id));
      if (selectedCutouts.length < 2) return;
      const bounds = computeBounds(selectedCutouts);
      const center = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
      const startDist = Math.sqrt((mmX - center.x) ** 2 + (mmY - center.y) ** 2);
      const initialStates = new Map<
        string,
        { x: number; y: number; width: number; depth: number }
      >();
      for (const c of selectedCutouts) {
        initialStates.set(c.id, { x: c.x, y: c.y, width: c.width, depth: c.depth });
      }
      pastDeadZoneRef.current = false;
      setMode({ type: 'group-scaling', startDist, center, initialStates });
    },
    [cutouts, selection, setMode, pastDeadZoneRef]
  );

  return { startDrag, startResize, startRotation, startGroupRotation, startGroupScale };
}
