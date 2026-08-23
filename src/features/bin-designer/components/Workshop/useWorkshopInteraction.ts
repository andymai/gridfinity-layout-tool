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
  alignSnap,
  parentLocalToWorld,
  resolvePlacedParts,
  snapAngleDeg,
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

export interface AlignGuides {
  /** Aligned local coordinates in the target parent's frame; null axis = no guide. */
  readonly x: number | null;
  readonly y: number | null;
  readonly parentId: string | null;
}

export interface WorkshopInteraction {
  /**
   * The selection was made by a touch pointerdown on this exact part — the
   * move handle shows only then, so selection changes from any other path
   * (placement auto-select, the tree, removal) can never leave it stale.
   */
  readonly selectedViaTouch: boolean;
  readonly placements: PlacedPart[];
  readonly placedById: Map<string, PlacedPart>;
  readonly hover: HoverSurface | null;
  readonly ghostPosition: { x: number; y: number; z: number; rotZDeg: number } | null;
  readonly draggingId: string | null;
  readonly rotatingId: string | null;
  readonly alignGuides: AlignGuides | null;
  readonly selectedId: string | null;
  readonly pendingType: ReturnType<typeof usePendingType>;
  readonly pendingCutterShape: 'circle' | 'slot' | null;
  onSurfaceMove: (surface: HoverSurface) => void;
  onSurfaceLeave: () => void;
  onSurfaceClick: (surface: HoverSurface) => void;
  onPartPointerDown: (id: string, pointerType: string) => void;
  beginPartDrag: (id: string) => void;
  beginPartRotate: (id: string, world: { x: number; y: number }) => void;
  onRotateMove: (world: { x: number; y: number }) => void;
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
  const [touchSelectedId, setTouchSelectedId] = useState<string | null>(null);
  const draggedSubtreeRef = useRef<Set<string>>(new Set());
  // Transaction opens lazily on the first real mutation of a drag, so a
  // click that never moves the part leaves no undo step behind.
  const dragTransactionRef = useRef(false);
  // A pointerdown on a part disables that subtree's raycast for the drag, so
  // the browser's synthesized click can fall through to the base and would
  // deselect what was just selected — swallow exactly that one click.
  const skipNextBaseClickRef = useRef(false);
  const [fineSnap, setFineSnap] = useState(false);
  const snapMm = useDesignerStore((s) => s.ui.workshopSnapMm);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [alignGuides, setAlignGuides] = useState<AlignGuides | null>(null);
  const rotateStateRef = useRef<{
    id: string;
    centerX: number;
    centerY: number;
    parentWorldDeg: number;
    grabOffsetDeg: number;
  } | null>(null);

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
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const store = useDesignerStore.getState();
      const selected = store.ui.selectedAssemblyPartId;
      if (selected === null) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        store.removeAssemblyPart(selected);
        invalidate();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        store.duplicateAssemblyPart(selected);
        invalidate();
        return;
      }
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const currentStructure = store.structure;
        if (currentStructure?.kind !== 'assembly') return;
        const node = findAssemblyPart(currentStructure.parts, selected);
        if (!node) return;
        store.moveAssemblyPart(selected, {
          rotZDeg: ((node.transform.rotZDeg + 90 + 540) % 360) - 180,
        });
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
    setRotatingId(null);
    setAlignGuides(null);
    rotateStateRef.current = null;
    draggedSubtreeRef.current = new Set();
    invalidate();
  }, [getThree, invalidate]);

  useEffect(() => {
    if (draggingId === null && rotatingId === null) return;
    window.addEventListener('pointerup', endDrag);
    // A cancelled touch (edge swipe, notification shade, palm rejection)
    // fires pointercancel, never pointerup — without this the drag wedges
    // orbit, the open undo transaction, and the drag state.
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [draggingId, rotatingId, endDrag]);

  const snapPoint = useCallback(
    (surface: HoverSurface): { x: number; y: number } => {
      const fine = fineSnap;
      const parent = surface.parentId === null ? null : (placedById.get(surface.parentId) ?? null);
      const local = worldToParentLocal({ x: surface.x, y: surface.y }, parent);
      return { x: snapCoord(local.x, fine, snapMm), y: snapCoord(local.y, fine, snapMm) };
    },
    [fineSnap, placedById, snapMm]
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
        const parent =
          surface.parentId === null ? null : (placedById.get(surface.parentId) ?? null);
        const rawLocal = worldToParentLocal({ x: surface.x, y: surface.y }, parent);
        // Alignment candidates are the target frame's other children (the
        // parts a guide can meaningfully relate to), plus the plate center
        // when seating on the base.
        const siblings =
          surface.parentId === null
            ? currentStructure.parts
            : (findAssemblyPart(currentStructure.parts, surface.parentId)?.children ?? []);
        const xs: number[] = [];
        const ys: number[] = [];
        for (const sibling of siblings) {
          if (draggedSubtreeRef.current.has(sibling.id)) continue;
          xs.push(sibling.transform.x);
          ys.push(sibling.transform.y);
        }
        if (surface.parentId === null) {
          xs.push(baseExtent.w / 2);
          ys.push(baseExtent.d / 2);
        }
        const snapped = alignSnap(rawLocal, { xs, ys }, fineSnap, snapMm);
        setAlignGuides(
          snapped.guideX !== null || snapped.guideY !== null
            ? { x: snapped.guideX, y: snapped.guideY, parentId: surface.parentId }
            : null
        );
        if (!dragTransactionRef.current) {
          store.startTransaction();
          dragTransactionRef.current = true;
        }
        if (surface.parentId === currentParent) {
          store.moveAssemblyPart(draggingId, { x: snapped.x, y: snapped.y, seatZ: 0 });
        } else {
          store.reparentAssemblyPart(draggingId, surface.parentId, {
            x: snapped.x,
            y: snapped.y,
            seatZ: 0,
          });
        }
        invalidate();
        return;
      }
      setHover(surface);
      invalidate();
    },
    [baseExtent.d, baseExtent.w, draggingId, fineSnap, invalidate, placedById, snapMm]
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
      setTouchSelectedId(viaTouch ? id : null);
      if (viaTouch) {
        skipNextBaseClickRef.current = true;
        invalidate();
        return;
      }
      beginPartDrag(id);
    },
    [beginPartDrag, invalidate]
  );

  const beginPartRotate = useCallback(
    (id: string, world: { x: number; y: number }): void => {
      const store = useDesignerStore.getState();
      const currentStructure = store.structure;
      if (currentStructure?.kind !== 'assembly') return;
      const node = findAssemblyPart(currentStructure.parts, id);
      const placed = placedById.get(id);
      if (!node || !placed) return;
      const pointerDeg = (Math.atan2(world.y - placed.y, world.x - placed.x) * 180) / Math.PI;
      rotateStateRef.current = {
        id,
        centerX: placed.x,
        centerY: placed.y,
        parentWorldDeg: placed.rotZDeg - node.transform.rotZDeg,
        // Grab where the pointer lands, so the part never jumps to meet it.
        grabOffsetDeg: pointerDeg - placed.rotZDeg,
      };
      skipNextBaseClickRef.current = true;
      const controls = getThree().controls as { enabled: boolean } | null;
      if (controls) controls.enabled = false;
      setRotatingId(id);
      invalidate();
    },
    [getThree, invalidate, placedById]
  );

  const onRotateMove = useCallback(
    (world: { x: number; y: number }): void => {
      const state = rotateStateRef.current;
      if (state === null) return;
      const store = useDesignerStore.getState();
      const pointerDeg =
        (Math.atan2(world.y - state.centerY, world.x - state.centerX) * 180) / Math.PI;
      const localDeg = snapAngleDeg(
        pointerDeg - state.grabOffsetDeg - state.parentWorldDeg,
        fineSnap
      );
      if (!dragTransactionRef.current) {
        store.startTransaction();
        dragTransactionRef.current = true;
      }
      store.moveAssemblyPart(state.id, { rotZDeg: localDeg });
      invalidate();
    },
    [fineSnap, invalidate]
  );

  const isInDraggedSubtree = useCallback(
    (id: string): boolean => draggedSubtreeRef.current.has(id),
    []
  );

  // Snap in the hovered parent's local frame — the same math placement uses —
  // then convert back to the store frame so the ghost lands where the part will.
  const ghostPosition = useMemo((): {
    x: number;
    y: number;
    z: number;
    rotZDeg: number;
  } | null => {
    if (!hover) return null;
    const parent = hover.parentId === null ? null : (placedById.get(hover.parentId) ?? null);
    const local = worldToParentLocal({ x: hover.x, y: hover.y }, parent);
    const snapped = {
      x: snapCoord(local.x, fineSnap, snapMm),
      y: snapCoord(local.y, fineSnap, snapMm),
    };
    const world = parentLocalToWorld(snapped, parent);
    // A placed part starts at local rotation 0, so its world orientation is
    // the parent frame's — the ghost previews exactly that.
    return { x: world.x, y: world.y, z: hover.topZ, rotZDeg: parent?.rotZDeg ?? 0 };
  }, [fineSnap, hover, placedById, snapMm]);

  return {
    selectedViaTouch: selectedId !== null && selectedId === touchSelectedId,
    placements,
    placedById,
    hover,
    ghostPosition,
    draggingId,
    rotatingId,
    alignGuides,
    selectedId,
    pendingType,
    pendingCutterShape,
    onSurfaceMove,
    onSurfaceLeave,
    onSurfaceClick,
    onPartPointerDown,
    beginPartDrag,
    beginPartRotate,
    onRotateMove,
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
