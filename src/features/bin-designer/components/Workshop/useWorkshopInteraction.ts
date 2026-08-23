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
import { defaultCutterProfile } from '@/shared/items/assembly/descriptor';
import {
  parentLocalToWorld,
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
  /** The current selection was made by touch — show the move handle. */
  readonly selectedViaTouch: boolean;
  readonly placements: PlacedPart[];
  readonly placedById: Map<string, PlacedPart>;
  readonly hover: HoverSurface | null;
  readonly ghostPosition: { x: number; y: number; z: number } | null;
  readonly draggingId: string | null;
  readonly selectedId: string | null;
  readonly pendingType: ReturnType<typeof usePendingType>;
  readonly pendingCutterShape: 'circle' | 'slot' | null;
  onSurfaceMove: (surface: HoverSurface) => void;
  onSurfaceLeave: () => void;
  onSurfaceClick: (surface: HoverSurface) => void;
  onPartPointerDown: (id: string, pointerType: string) => void;
  beginPartDrag: (id: string) => void;
  isInDraggedSubtree: (id: string) => boolean;
}

function usePendingType() {
  return useDesignerStore((s) => s.ui.workshopPendingPartType);
}

function usePendingCutterShape() {
  return useDesignerStore((s) => s.ui.workshopPendingCutterShape);
}

export function useWorkshopInteraction(
  structure: AssemblyStructure,
  baseExtent: { w: number; d: number }
): WorkshopInteraction {
  const pendingType = usePendingType();
  const pendingCutterShape = usePendingCutterShape();
  const { selectedId } = useDesignerStore(
    useShallow((s) => ({ selectedId: s.ui.selectedAssemblyPartId }))
  );
  const invalidate = useThree((s) => s.invalidate);
  const getThree = useThree((s) => s.get);

  const [hover, setHover] = useState<HoverSurface | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedViaTouch, setSelectedViaTouch] = useState(false);
  const draggedSubtreeRef = useRef<Set<string>>(new Set());
  // Transaction opens lazily on the first real mutation of a drag, so a
  // click that never moves the part leaves no undo step behind.
  const dragTransactionRef = useRef(false);
  // A pointerdown on a part disables that subtree's raycast for the drag, so
  // the browser's synthesized click can fall through to the base and would
  // deselect what was just selected — swallow exactly that one click.
  const skipNextBaseClickRef = useRef(false);
  const [fineSnap, setFineSnap] = useState(false);

  const placements = useMemo(
    () => resolvePlacedParts(structure, baseExtent),
    [structure, baseExtent]
  );
  const placedById = useMemo(() => {
    const map = new Map<string, PlacedPart>();
    for (const p of placements) {
      if (!map.has(p.selectId)) map.set(p.selectId, p);
    }
    return map;
  }, [placements]);

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') setFineSnap(true);
      if (e.key === 'Escape') {
        useDesignerStore.getState().setWorkshopPendingPartType(null);
        invalidate();
      }
    };
    const up = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') setFineSnap(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [invalidate]);

  const endDrag = useCallback((): void => {
    if (dragTransactionRef.current) {
      useDesignerStore.getState().commitTransaction();
      dragTransactionRef.current = false;
    }
    const controls = getThree().controls as { enabled: boolean } | null;
    if (controls) controls.enabled = true;
    setDraggingId(null);
    draggedSubtreeRef.current = new Set();
    invalidate();
  }, [getThree, invalidate]);

  useEffect(() => {
    if (draggingId === null) return;
    window.addEventListener('pointerup', endDrag);
    // A cancelled touch (edge swipe, notification shade, palm rejection)
    // fires pointercancel, never pointerup — without this the drag wedges
    // orbit, the open undo transaction, and the drag state.
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [draggingId, endDrag]);

  const snapPoint = useCallback(
    (surface: HoverSurface): { x: number; y: number } => {
      const fine = fineSnap;
      const parent = surface.parentId === null ? null : (placedById.get(surface.parentId) ?? null);
      const local = worldToParentLocal({ x: surface.x, y: surface.y }, parent);
      return { x: snapCoord(local.x, fine), y: snapCoord(local.y, fine) };
    },
    [fineSnap, placedById]
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
        if (!dragTransactionRef.current) {
          store.startTransaction();
          dragTransactionRef.current = true;
        }
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
        skipNextBaseClickRef.current = false;
        const local = snapPoint(surface);
        const cutterShape = store.ui.workshopPendingCutterShape;
        store.addAssemblyPart(
          type,
          surface.parentId,
          { x: local.x, y: local.y },
          type === 'cutter' && cutterShape
            ? { profile: defaultCutterProfile(cutterShape) }
            : undefined
        );
        invalidate();
        return;
      }
      if (surface.parentId !== null) {
        skipNextBaseClickRef.current = false;
      }
      if (surface.parentId === null) {
        if (skipNextBaseClickRef.current) {
          skipNextBaseClickRef.current = false;
          return;
        }
        store.setSelectedAssemblyPartId(null);
        invalidate();
      }
    },
    [invalidate, snapPoint]
  );

  const beginPartDrag = useCallback(
    (id: string): void => {
      const store = useDesignerStore.getState();
      const currentStructure = store.structure;
      if (currentStructure?.kind !== 'assembly') return;
      const node = findAssemblyPart(currentStructure.parts, id);
      if (!node) return;
      draggedSubtreeRef.current = new Set(collectAssemblyIds([node]));
      skipNextBaseClickRef.current = true;
      const controls = getThree().controls as { enabled: boolean } | null;
      if (controls) controls.enabled = false;
      setDraggingId(id);
      invalidate();
    },
    [getThree, invalidate]
  );

  const onPartPointerDown = useCallback(
    (id: string, pointerType: string): void => {
      const store = useDesignerStore.getState();
      if (store.ui.workshopPendingPartType) return;
      store.setSelectedAssemblyPartId(id);
      // Touch: tap selects; moving happens through the dedicated handle so a
      // one-finger drag from a part still orbits instead of dragging it. The
      // pointer that made the selection is the ONE modality signal — a
      // mouse on a touchscreen laptop drags, a finger gets the handle.
      const viaTouch = pointerType === 'touch';
      setSelectedViaTouch(viaTouch);
      if (viaTouch) {
        skipNextBaseClickRef.current = true;
        invalidate();
        return;
      }
      beginPartDrag(id);
    },
    [beginPartDrag, invalidate]
  );

  const isInDraggedSubtree = useCallback(
    (id: string): boolean => draggedSubtreeRef.current.has(id),
    []
  );

  // Snap in the hovered parent's local frame — the same math placement uses —
  // then convert back to the store frame so the ghost lands where the part will.
  const ghostPosition = useMemo((): { x: number; y: number; z: number } | null => {
    if (!hover) return null;
    const parent = hover.parentId === null ? null : (placedById.get(hover.parentId) ?? null);
    const local = worldToParentLocal({ x: hover.x, y: hover.y }, parent);
    const snapped = { x: snapCoord(local.x, fineSnap), y: snapCoord(local.y, fineSnap) };
    const world = parentLocalToWorld(snapped, parent);
    return { x: world.x, y: world.y, z: hover.topZ };
  }, [fineSnap, hover, placedById]);

  return {
    selectedViaTouch,
    placements,
    placedById,
    hover,
    ghostPosition,
    draggingId,
    selectedId,
    pendingType,
    pendingCutterShape,
    onSurfaceMove,
    onSurfaceLeave,
    onSurfaceClick,
    onPartPointerDown,
    beginPartDrag,
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
