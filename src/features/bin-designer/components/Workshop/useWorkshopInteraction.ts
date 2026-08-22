/**
 * Workshop gesture state machine: click-to-place from the armed palette
 * type, drag-to-move with live surface hopping (dropping a part over
 * another re-seats it mid-drag inside one transaction), and selection.
 * All positions flow in the STORE frame; the scene converts at its edge.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { AssemblyStructure } from '@/shared/types/assembly';
import { collectAssemblyIds, findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';
import {
  resolvePlacedParts,
  snapCoord,
  worldToParentLocal,
  type PlacedPart,
} from './workshopPlacement';

export interface HoverSurface {
  readonly parentId: string | null;
  readonly topZ: number;
  /** Pointer position in the store frame (mm). */
  readonly x: number;
  readonly y: number;
}

export interface WorkshopInteraction {
  readonly placements: PlacedPart[];
  readonly placedById: Map<string, PlacedPart>;
  readonly hover: HoverSurface | null;
  readonly draggingId: string | null;
  readonly selectedId: string | null;
  readonly pendingType: ReturnType<typeof usePendingType>;
  onSurfaceMove: (surface: HoverSurface) => void;
  onSurfaceLeave: () => void;
  onSurfaceClick: (surface: HoverSurface) => void;
  onPartPointerDown: (id: string, pointerId: number) => void;
  isInDraggedSubtree: (id: string) => boolean;
}

function usePendingType() {
  return useDesignerStore((s) => s.ui.workshopPendingPartType);
}

export function useWorkshopInteraction(structure: AssemblyStructure): WorkshopInteraction {
  const pendingType = usePendingType();
  const { selectedId } = useDesignerStore(
    useShallow((s) => ({ selectedId: s.ui.selectedAssemblyPartId }))
  );
  const invalidate = useThree((s) => s.invalidate);
  const getThree = useThree((s) => s.get);

  const [hover, setHover] = useState<HoverSurface | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggedSubtreeRef = useRef<Set<string>>(new Set());
  const altRef = useRef(false);

  const placements = useMemo(() => resolvePlacedParts(structure), [structure]);
  const placedById = useMemo(() => {
    const map = new Map<string, PlacedPart>();
    for (const p of placements) {
      if (!map.has(p.selectId)) map.set(p.selectId, p);
    }
    return map;
  }, [placements]);

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') altRef.current = true;
      if (e.key === 'Escape') {
        useDesignerStore.getState().setWorkshopPendingPartType(null);
        invalidate();
      }
    };
    const up = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') altRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [invalidate]);

  const endDrag = useCallback((): void => {
    useDesignerStore.getState().commitTransaction();
    const controls = getThree().controls as { enabled: boolean } | null;
    if (controls) controls.enabled = true;
    setDraggingId(null);
    draggedSubtreeRef.current = new Set();
    invalidate();
  }, [getThree, invalidate]);

  useEffect(() => {
    if (draggingId === null) return;
    window.addEventListener('pointerup', endDrag);
    return () => window.removeEventListener('pointerup', endDrag);
  }, [draggingId, endDrag]);

  const snapPoint = useCallback(
    (surface: HoverSurface): { x: number; y: number } => {
      const fine = altRef.current;
      const parent = surface.parentId === null ? null : (placedById.get(surface.parentId) ?? null);
      const local = worldToParentLocal({ x: surface.x, y: surface.y }, parent);
      return { x: snapCoord(local.x, fine), y: snapCoord(local.y, fine) };
    },
    [placedById]
  );

  const onSurfaceMove = useCallback(
    (surface: HoverSurface): void => {
      if (draggingId !== null) {
        if (draggedSubtreeRef.current.has(surface.parentId ?? '')) return;
        const store = useDesignerStore.getState();
        const currentStructure = store.structure;
        if (currentStructure?.kind !== 'assembly') return;
        const node = findAssemblyPart(currentStructure.parts, draggingId);
        if (!node) return;
        const currentParent = resolveParentId(currentStructure, draggingId);
        const local = snapPoint(surface);
        if (surface.parentId === currentParent) {
          store.moveAssemblyPart(draggingId, { x: local.x, y: local.y, seatZ: 0 });
        } else {
          store.reparentAssemblyPart(draggingId, surface.parentId, {
            x: local.x,
            y: local.y,
            seatZ: 0,
          });
        }
        invalidate();
        return;
      }
      setHover(surface);
      invalidate();
    },
    [draggingId, invalidate, snapPoint]
  );

  const onSurfaceLeave = useCallback((): void => {
    setHover(null);
    invalidate();
  }, [invalidate]);

  const onSurfaceClick = useCallback(
    (surface: HoverSurface): void => {
      const store = useDesignerStore.getState();
      const type = store.ui.workshopPendingPartType;
      if (type) {
        const local = snapPoint(surface);
        store.addAssemblyPart(type, surface.parentId, { x: local.x, y: local.y });
        invalidate();
        return;
      }
      if (surface.parentId === null) {
        store.setSelectedAssemblyPartId(null);
        invalidate();
      }
    },
    [invalidate, snapPoint]
  );

  const onPartPointerDown = useCallback(
    (id: string, _pointerId: number): void => {
      const store = useDesignerStore.getState();
      if (store.ui.workshopPendingPartType) return;
      store.setSelectedAssemblyPartId(id);
      const currentStructure = store.structure;
      if (currentStructure?.kind !== 'assembly') return;
      const node = findAssemblyPart(currentStructure.parts, id);
      if (!node) return;
      draggedSubtreeRef.current = new Set(collectAssemblyIds([node]));
      store.startTransaction();
      const controls = getThree().controls as { enabled: boolean } | null;
      if (controls) controls.enabled = false;
      setDraggingId(id);
      invalidate();
    },
    [getThree, invalidate]
  );

  const isInDraggedSubtree = useCallback(
    (id: string): boolean => draggedSubtreeRef.current.has(id),
    []
  );

  return {
    placements,
    placedById,
    hover,
    draggingId,
    selectedId,
    pendingType,
    onSurfaceMove,
    onSurfaceLeave,
    onSurfaceClick,
    onPartPointerDown,
    isInDraggedSubtree,
  };
}

function resolveParentId(structure: AssemblyStructure, id: string): string | null {
  const walk = (
    nodes: readonly AssemblyStructure['parts'][number][],
    parent: string | null
  ): string | null | undefined => {
    for (const node of nodes) {
      if (node.id === id) return parent;
      const found = walk(node.children, node.id);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return walk(structure.parts, null) ?? null;
}
