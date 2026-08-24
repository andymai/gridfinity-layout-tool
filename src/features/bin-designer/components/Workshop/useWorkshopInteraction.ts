/**
 * Workshop gesture state machine: click-to-place from the armed palette
 * type, drag-to-move with live surface hopping (dropping a part over
 * another re-seats it mid-drag inside one transaction), and selection.
 * All positions flow in the STORE frame; the scene converts at its edge.
 *
 * Selection is a set with an anchor. A plain press on a part collapses the
 * selection to it; shift toggles membership; a press on a part already in a
 * multi-selection grabs the whole group. Group gestures translate/rotate the
 * selection's top-level parts rigidly in world frame — surface hopping and
 * re-seating stay single-part behaviors, where "which surface" is
 * unambiguous.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { AssemblyStructure } from '@/shared/types/assembly';
import {
  collectAssemblyIds,
  filterTopLevelAssemblyIds,
  findAssemblyPart,
} from '@/features/bin-designer/utils/assemblyTree';
import { defaultCutterProfile } from '@/shared/items/assembly/descriptor';
import { partFootprint } from '@/shared/types/assemblyPlacement';
import {
  alignSnap,
  FINE_SNAP_MM,
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

export interface PartPointerModifiers {
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/** Where the rotation ring renders: one part's own ring, or the group's. */
export interface RotationHub {
  readonly x: number;
  readonly y: number;
  readonly topZ: number;
  readonly radius: number;
  /** Heading knob angle — the anchor part's world rotation. */
  readonly headingDeg: number;
}

const RING_MARGIN_MM = 8;
const RING_MIN_RADIUS_MM = 14;

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
  readonly selectedIds: ReadonlySet<string>;
  readonly rotationHub: RotationHub | null;
  readonly pendingType: ReturnType<typeof usePendingType>;
  readonly pendingCutterShape: 'circle' | 'slot' | null;
  onSurfaceMove: (surface: HoverSurface) => void;
  onSurfaceLeave: () => void;
  onSurfaceClick: (surface: HoverSurface) => void;
  onPartPointerDown: (id: string, pointerType: string, modifiers?: PartPointerModifiers) => void;
  beginPartDrag: (id: string) => void;
  beginRotate: (world: { x: number; y: number }) => void;
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
  baseExtent: { w: number; d: number },
  options?: {
    /** Consulted (and consumed) when a base click would clear the selection —
     *  the marquee overlay answers true right after a release. */
    shouldSwallowBaseClick?: () => boolean;
    /** Called on every scene-claimed pointerdown (part grab, gizmo, handle)
     *  so the DOM marquee overlay leaves those presses alone. */
    onGestureStart?: () => void;
  }
): WorkshopInteraction {
  const pendingType = usePendingType();
  const pendingCutterShape = usePendingCutterShape();
  const { selectedId, selectedIdList } = useDesignerStore(
    useShallow((s) => ({
      selectedId: s.ui.selectedAssemblyPartId,
      selectedIdList: s.ui.selectedAssemblyPartIds,
    }))
  );
  const invalidate = useThree((s) => s.invalidate);
  const getThree = useThree((s) => s.get);
  const shouldSwallowBaseClick = options?.shouldSwallowBaseClick;
  const onGestureStart = options?.onGestureStart;

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
  /** Group-drag frame captured at drag start: who moves, and where they sit
   *  relative to the grabbed part. Never changes mid-drag. */
  const dragGroupRef = useRef<{
    grabId: string;
    grabParentId: string | null;
    targets: { id: string; dx: number; dy: number }[];
  } | null>(null);
  const rotateStateRef = useRef<{
    pivotX: number;
    pivotY: number;
    startPointerDeg: number;
    starts: { id: string; x: number; y: number; rotZDeg: number }[];
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

  const selectedIds = useMemo(() => new Set(selectedIdList), [selectedIdList]);

  /** Selection's top-level placements — what group gestures actually move. */
  const topLevelSelected = useMemo(() => {
    if (selectedIdList.length === 0) return [];
    return filterTopLevelAssemblyIds(structure.parts, new Set(selectedIdList)).flatMap(
      (id) => placedById.get(id) ?? []
    );
  }, [placedById, selectedIdList, structure.parts]);

  const rotationHub = useMemo((): RotationHub | null => {
    if (topLevelSelected.length === 0) return null;
    if (topLevelSelected.length === 1) {
      const placed = topLevelSelected[0];
      if (!placed) return null;
      const footprint = partFootprint(placed.node);
      return {
        x: placed.x,
        y: placed.y,
        topZ: placed.topZ,
        radius: Math.max(
          RING_MIN_RADIUS_MM,
          Math.max(footprint.w, footprint.d) / 2 + RING_MARGIN_MM
        ),
        headingDeg: placed.rotZDeg,
      };
    }
    const cx = topLevelSelected.reduce((sum, p) => sum + p.x, 0) / topLevelSelected.length;
    const cy = topLevelSelected.reduce((sum, p) => sum + p.y, 0) / topLevelSelected.length;
    let radius = RING_MIN_RADIUS_MM;
    let topZ = 0;
    for (const placed of topLevelSelected) {
      const footprint = partFootprint(placed.node);
      const reach =
        Math.hypot(placed.x - cx, placed.y - cy) + Math.max(footprint.w, footprint.d) / 2;
      radius = Math.max(radius, reach + RING_MARGIN_MM);
      topZ = Math.max(topZ, placed.topZ);
    }
    const anchor = selectedId !== null ? placedById.get(selectedId) : undefined;
    return { x: cx, y: cy, topZ, radius, headingDeg: anchor?.rotZDeg ?? 0 };
  }, [placedById, selectedId, topLevelSelected]);

  /** Arrow-key direction in the ground plane, snapped to the world axis the
   *  camera is most nearly facing, so "up" always moves away from the viewer. */
  const cameraForward = useCallback((): { x: number; y: number } => {
    const three = getThree();
    const camera = three.camera;
    const controls = three.controls as { target?: { x: number; y: number } } | null;
    const tx = controls?.target?.x ?? 0;
    const ty = controls?.target?.y ?? 0;
    const fx = tx - camera.position.x;
    const fy = ty - camera.position.y;
    if (Math.abs(fx) >= Math.abs(fy)) return { x: Math.sign(fx) || 1, y: 0 };
    return { x: 0, y: Math.sign(fy) || 1 };
  }, [getThree]);

  // Ctrl+V reads the hover through a ref so the keydown listener doesn't
  // re-subscribe on every pointer move.
  const hoverRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') setFineSnap(true);
      if (e.key === 'Escape') {
        const store = useDesignerStore.getState();
        if (store.ui.workshopPendingPartType) {
          store.setWorkshopPendingPartType(null);
          invalidate();
          return;
        }
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const store = useDesignerStore.getState();
      const selection = store.ui.selectedAssemblyPartIds;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const currentStructure = store.structure;
        if (currentStructure?.kind !== 'assembly') return;
        e.preventDefault();
        // Whole tree, not just roots — children tint too; group operations
        // reduce to top-level members themselves.
        store.setSelectedAssemblyPartIds(collectAssemblyIds(currentStructure.parts));
        invalidate();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selection.length === 0) return;
        e.preventDefault();
        store.copyAssemblyParts(selection);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (store.ui.workshopClipboardCount === 0) return;
        e.preventDefault();
        // Paste under the pointer when it rests on a surface; beside the
        // source otherwise.
        store.pasteAssemblyParts(hoverRef.current ?? undefined);
        invalidate();
        return;
      }
      if (e.key === 'Escape' && selection.length > 0) {
        store.setSelectedAssemblyPartId(null);
        invalidate();
        return;
      }
      if (selection.length === 0) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        store.removeAssemblyParts(selection);
        invalidate();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        store.duplicateAssemblyParts(selection);
        invalidate();
        return;
      }
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        store.rotateAssemblyPartsWorld(selection, 90);
        invalidate();
        return;
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.altKey ? FINE_SNAP_MM : store.ui.workshopSnapMm;
        const forward = cameraForward();
        // Screen-right is the ground forward rotated -90° (Z-up, CCW+).
        const right = { x: forward.y, y: -forward.x };
        const dir =
          e.key === 'ArrowUp'
            ? forward
            : e.key === 'ArrowDown'
              ? { x: -forward.x, y: -forward.y }
              : e.key === 'ArrowRight'
                ? right
                : { x: -right.x, y: -right.y };
        store.nudgeAssemblyPartsWorld(selection, dir.x * step, dir.y * step);
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
  }, [cameraForward, invalidate]);

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
    dragGroupRef.current = null;
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

  const openTransaction = useCallback((): void => {
    if (!dragTransactionRef.current) {
      useDesignerStore.getState().startTransaction();
      dragTransactionRef.current = true;
    }
  }, []);

  const onSurfaceMove = useCallback(
    (surface: HoverSurface): void => {
      if (draggingId !== null) {
        if (draggedSubtreeRef.current.has(surface.parentId ?? '')) return;
        const store = useDesignerStore.getState();
        const currentStructure = store.structure;
        if (currentStructure?.kind !== 'assembly') return;
        const group = dragGroupRef.current;

        if (group && group.targets.length > 1) {
          // Group drag: rigid translation in the grabbed part's start parent
          // frame. No surface hopping — "which parent" is ambiguous for a
          // group, and rigid motion is what a multi-drag promises.
          const parent =
            group.grabParentId === null ? null : (placedById.get(group.grabParentId) ?? null);
          const rawLocal = worldToParentLocal({ x: surface.x, y: surface.y }, parent);
          const siblings =
            group.grabParentId === null
              ? currentStructure.parts
              : (findAssemblyPart(currentStructure.parts, group.grabParentId)?.children ?? []);
          const xs: number[] = [];
          const ys: number[] = [];
          for (const sibling of siblings) {
            if (draggedSubtreeRef.current.has(sibling.id)) continue;
            xs.push(sibling.transform.x);
            ys.push(sibling.transform.y);
          }
          if (group.grabParentId === null) {
            xs.push(baseExtent.w / 2);
            ys.push(baseExtent.d / 2);
          }
          const snapped = alignSnap(rawLocal, { xs, ys }, fineSnap, snapMm);
          setAlignGuides(
            snapped.guideX !== null || snapped.guideY !== null
              ? { x: snapped.guideX, y: snapped.guideY, parentId: group.grabParentId }
              : null
          );
          const grabWorld = parentLocalToWorld({ x: snapped.x, y: snapped.y }, parent);
          openTransaction();
          store.moveAssemblyPartsWorldTo(
            group.targets.map((target) => ({
              id: target.id,
              x: grabWorld.x + target.dx,
              y: grabWorld.y + target.dy,
            }))
          );
          invalidate();
          return;
        }

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
        openTransaction();
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
      hoverRef.current = { x: surface.x, y: surface.y };
      setHover(surface);
      invalidate();
    },
    [
      baseExtent.d,
      baseExtent.w,
      draggingId,
      fineSnap,
      invalidate,
      openTransaction,
      placedById,
      snapMm,
    ]
  );

  const onSurfaceLeave = useCallback((): void => {
    hoverRef.current = null;
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
        if (shouldSwallowBaseClick?.()) {
          return;
        }
        store.setSelectedAssemblyPartId(null);
        invalidate();
      }
    },
    [invalidate, shouldSwallowBaseClick, snapPoint]
  );

  const beginPartDrag = useCallback(
    (id: string): void => {
      const store = useDesignerStore.getState();
      const currentStructure = store.structure;
      if (currentStructure?.kind !== 'assembly') return;
      const node = findAssemblyPart(currentStructure.parts, id);
      if (!node) return;
      const selection = store.ui.selectedAssemblyPartIds;
      const groupIds = selection.includes(id) ? selection : [id];
      const topIds = filterTopLevelAssemblyIds(currentStructure.parts, new Set(groupIds));
      const dragged = new Set<string>();
      for (const topId of topIds) {
        const topNode = findAssemblyPart(currentStructure.parts, topId);
        if (topNode) for (const sub of collectAssemblyIds([topNode])) dragged.add(sub);
      }
      const grab = placedById.get(id);
      if (!grab) return;
      dragGroupRef.current = {
        grabId: id,
        grabParentId: grab.parentId,
        targets: topIds.flatMap((topId) => {
          const placed = placedById.get(topId);
          return placed ? [{ id: topId, dx: placed.x - grab.x, dy: placed.y - grab.y }] : [];
        }),
      };
      draggedSubtreeRef.current = dragged;
      skipNextBaseClickRef.current = true;
      onGestureStart?.();
      const controls = getThree().controls as { enabled: boolean } | null;
      if (controls) controls.enabled = false;
      setDraggingId(id);
      invalidate();
    },
    [getThree, invalidate, onGestureStart, placedById]
  );

  // Alt+drag hand-off: the clone exists in the store but not yet in this
  // render's placements; begin its drag as soon as it resolves.
  const pendingDragRef = useRef<string | null>(null);

  const onPartPointerDown = useCallback(
    (id: string, pointerType: string, modifiers?: PartPointerModifiers): void => {
      const store = useDesignerStore.getState();
      onGestureStart?.();
      if (store.ui.workshopPendingPartType) return;
      const viaTouch = pointerType === 'touch';
      if (modifiers?.shiftKey && !viaTouch) {
        store.toggleAssemblyPartSelected(id);
        skipNextBaseClickRef.current = true;
        invalidate();
        return;
      }
      const selection = store.ui.selectedAssemblyPartIds;
      if (selection.includes(id)) {
        // Grabbing a selected part keeps the group and re-anchors to it.
        store.setSelectedAssemblyPartIds(selection, id);
      } else {
        store.setSelectedAssemblyPartId(id);
      }
      // Touch: tap selects; moving happens through the dedicated handle so a
      // one-finger drag from a part still orbits instead of dragging it. The
      // pointer that made the selection is the ONE modality signal — a
      // mouse on a touchscreen laptop drags, a finger gets the handle.
      setTouchSelectedId(viaTouch ? id : null);
      if (viaTouch) {
        skipNextBaseClickRef.current = true;
        invalidate();
        return;
      }
      if (modifiers?.altKey) {
        // Alt+drag clones the selection in place and drags the copies.
        const sourceIds = useDesignerStore.getState().ui.selectedAssemblyPartIds;
        const clones = useDesignerStore.getState().duplicateAssemblyParts(sourceIds, 0);
        const grabClone = clones.find((clone) => clone.sourceId === id)?.id ?? clones[0]?.id;
        if (grabClone) {
          // Clone placements aren't in this render's `placedById` yet — defer
          // the grab one frame so beginPartDrag sees them.
          pendingDragRef.current = grabClone;
          invalidate();
          return;
        }
      }
      beginPartDrag(id);
    },
    [beginPartDrag, invalidate, onGestureStart]
  );

  useEffect(() => {
    const pending = pendingDragRef.current;
    if (pending === null) return;
    if (placedById.has(pending)) {
      pendingDragRef.current = null;
      beginPartDrag(pending);
    }
  }, [beginPartDrag, placedById]);

  const beginRotate = useCallback(
    (world: { x: number; y: number }): void => {
      const store = useDesignerStore.getState();
      const currentStructure = store.structure;
      if (currentStructure?.kind !== 'assembly') return;
      if (topLevelSelected.length === 0 || rotationHub === null) return;
      const pivotX = rotationHub.x;
      const pivotY = rotationHub.y;
      onGestureStart?.();
      rotateStateRef.current = {
        pivotX,
        pivotY,
        // Grab where the pointer lands, so the group never jumps to meet it.
        startPointerDeg: (Math.atan2(world.y - pivotY, world.x - pivotX) * 180) / Math.PI,
        starts: topLevelSelected.map((placed) => ({
          id: placed.selectId,
          x: placed.x,
          y: placed.y,
          rotZDeg: placed.rotZDeg,
        })),
      };
      skipNextBaseClickRef.current = true;
      const controls = getThree().controls as { enabled: boolean } | null;
      if (controls) controls.enabled = false;
      setRotatingId(store.ui.selectedAssemblyPartId);
      invalidate();
    },
    [getThree, invalidate, onGestureStart, rotationHub, topLevelSelected]
  );

  const onRotateMove = useCallback(
    (world: { x: number; y: number }): void => {
      const state = rotateStateRef.current;
      if (state === null) return;
      const store = useDesignerStore.getState();
      const pointerDeg =
        (Math.atan2(world.y - state.pivotY, world.x - state.pivotX) * 180) / Math.PI;
      const rawDelta = pointerDeg - state.startPointerDeg;
      const single = state.starts.length === 1 ? state.starts[0] : undefined;
      openTransaction();
      if (single) {
        // One part snaps its absolute heading to the angle grid, matching
        // the inspector's stepper stops.
        const heading = snapAngleDeg(single.rotZDeg + rawDelta, fineSnap);
        store.moveAssemblyPartsWorldTo([
          { id: single.id, x: single.x, y: single.y, rotZDeg: heading },
        ]);
      } else {
        // A group snaps the shared delta instead — snapping each absolute
        // heading would tear the arrangement apart.
        const delta = snapAngleDeg(rawDelta, fineSnap);
        const rad = (delta * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        store.moveAssemblyPartsWorldTo(
          state.starts.map((start) => {
            const dx = start.x - state.pivotX;
            const dy = start.y - state.pivotY;
            return {
              id: start.id,
              x: state.pivotX + dx * cos - dy * sin,
              y: state.pivotY + dx * sin + dy * cos,
              rotZDeg: start.rotZDeg + delta,
            };
          })
        );
      }
      invalidate();
    },
    [fineSnap, invalidate, openTransaction]
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
    selectedIds,
    rotationHub,
    pendingType,
    pendingCutterShape,
    onSurfaceMove,
    onSurfaceLeave,
    onSurfaceClick,
    onPartPointerDown,
    beginPartDrag,
    beginRotate,
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
