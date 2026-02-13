/**
 * State machine hook for cutout editor interactions.
 *
 * Manages placement, selection, dragging, resizing, and marquee states.
 * Keyboard shortcuts: Delete, Ctrl+A, arrows (nudge), Escape.
 *
 * Pointer-move logic for each interaction mode is delegated to focused
 * handler functions in ./handlers/ — this hook orchestrates transitions
 * and wires shared state.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Cutout, CutoutShape, PathPoint } from '@/features/bin-designer/types';
import { useCutoutSelection } from '@/features/bin-designer/store';
import {
  snapToGrid,
  MIN_CUTOUT_SIZE,
  computeBounds,
  getRotatedBounds,
  type AlignmentGuide,
} from './geometry';
import {
  getPathBounds,
  CLOSE_SNAP_THRESHOLD,
  clampPathToBounds,
  isSelfIntersecting,
} from './pathGeometry';
import {
  handlePendingPlaceMove,
  handleDragMove,
  handleResizeMove,
  handleRotateMove,
  handleGroupRotateMove,
  handleGroupScaleMove,
  handleDrawMove,
  handleCutoutKeyDown,
  handlePathDrawingPointerDown,
  handlePathDrawingPointerMove,
  handlePathDrawingPointerUp,
  handlePathDrawingVertexDown,
  handleVertexEditPointerDown,
  handleVertexEditPointerMove,
  handleVertexEditPointerUp,
} from './handlers';
import type { RulerMeasurement } from './handlers/rulerHandler';
import {
  collectSnapTargets,
  snapToNearestTarget,
  computeMeasurement,
} from './handlers/rulerHandler';
import type { PathDrawingMode, PathDrawingPreviewState, SegmentHoverInfo } from './handlers';
import type { VertexEditMode } from './handlers';
import type { StartRect } from './geometry';

/** Direction for resize handles */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Default sizes for click-to-place (mm) */
const DEFAULT_RECT_SIZE = 20;
const DEFAULT_CIRCLE_SIZE = 15;

export type InteractionMode =
  | { readonly type: 'idle' }
  | { readonly type: 'placing'; readonly shape: CutoutShape }
  | {
      readonly type: 'pending-place';
      readonly shape: CutoutShape;
      readonly startMmX: number;
      readonly startMmY: number;
    }
  | {
      readonly type: 'drawing';
      readonly shape: CutoutShape;
      readonly startMmX: number;
      readonly startMmY: number;
    }
  | {
      readonly type: 'dragging';
      readonly startX: number;
      readonly startY: number;
      readonly offsets: ReadonlyMap<string, { readonly dx: number; readonly dy: number }>;
    }
  | {
      readonly type: 'resizing';
      readonly cutoutId: string;
      readonly handle: ResizeHandle;
      readonly startRect: StartRect;
    }
  | {
      readonly type: 'rotating';
      readonly cutoutId: string;
      readonly startAngle: number;
      readonly initialRotation: number;
    }
  | {
      readonly type: 'group-rotating';
      readonly startAngle: number;
      readonly center: { readonly x: number; readonly y: number };
      readonly initialStates: ReadonlyMap<
        string,
        { readonly x: number; readonly y: number; readonly rotation: number }
      >;
    }
  | {
      readonly type: 'group-scaling';
      readonly startDist: number;
      readonly center: { readonly x: number; readonly y: number };
      readonly initialStates: ReadonlyMap<
        string,
        {
          readonly x: number;
          readonly y: number;
          readonly width: number;
          readonly depth: number;
        }
      >;
    }
  | { readonly type: 'marquee'; readonly startX: number; readonly startY: number }
  | PathDrawingMode
  | VertexEditMode
  | { readonly type: 'ruler-ready' }
  | {
      readonly type: 'measuring';
      readonly startX: number;
      readonly startY: number;
      /** When true, return to ruler-ready on pointer up; otherwise return to idle (Shift+drag) */
      readonly sticky: boolean;
    };

/** Preview overrides applied during drag/resize for visual feedback */
export type PreviewMap = ReadonlyMap<string, Partial<Cutout>>;

interface UseCutoutInteractionOptions {
  readonly cutouts: readonly Cutout[];
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onRemove: (id: string) => void;
  readonly onAdd: (cutout: Cutout) => void;
  readonly onGroup?: (cutoutIds: readonly string[]) => void;
  readonly onUngroup?: (cutoutIds: readonly string[]) => void;
  readonly onUpdateBatch?: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly onRemoveBatch?: (ids: readonly string[]) => void;
  readonly onUndo?: () => void;
  readonly onRedo?: () => void;
  readonly canUndo?: boolean;
  readonly canRedo?: boolean;
  readonly onLock?: (ids: readonly string[]) => void;
  readonly onUnlock?: (ids: readonly string[]) => void;
  readonly startTransaction?: () => void;
  readonly commitTransaction?: () => void;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly gridSize?: number;
}

/** Paste offset in mm — each successive paste shifts by this amount */
const PASTE_OFFSET = 2;

interface ClonedCutout extends Cutout {
  readonly originalId: string;
}

function cloneCutoutsWithGroups(
  originals: readonly Cutout[],
  offsetFn?: (original: Cutout) => { x: number; y: number }
): readonly ClonedCutout[] {
  const groupMap = new Map<string, string>();
  return originals.map((original) => {
    const newId = crypto.randomUUID();
    let newGroupId: string | null = null;
    if (original.groupId) {
      if (!groupMap.has(original.groupId)) {
        groupMap.set(original.groupId, crypto.randomUUID());
      }
      newGroupId = groupMap.get(original.groupId) ?? null;
    }
    const pos = offsetFn ? offsetFn(original) : { x: original.x, y: original.y };
    return {
      ...original,
      id: newId,
      x: pos.x,
      y: pos.y,
      groupId: newGroupId,
      originalId: original.id,
    };
  });
}

export function useCutoutInteraction({
  cutouts,
  onUpdate,
  onRemove,
  onAdd,
  onGroup,
  onUngroup,
  onUpdateBatch,
  onRemoveBatch,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onLock,
  onUnlock,
  startTransaction,
  commitTransaction,
  binWidth,
  binDepth,
  gridSize = 0.5,
}: UseCutoutInteractionOptions) {
  const [mode, setMode] = useState<InteractionMode>({ type: 'idle' });
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [preview, setPreview] = useState<PreviewMap>(new Map());
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);
  /** Container ref — kept for potential external use but no longer needed for coordinate conversion */
  const containerRef = useRef<HTMLElement | null>(null);
  /** Track whether the dead zone has been exceeded during this drag/resize */
  const pastDeadZoneRef = useRef(false);
  /** Clipboard for copy/paste operations */
  const [clipboard, setClipboard] = useState<readonly Cutout[]>([]);
  /** Track number of pastes since last copy to increment offset */
  const pasteCountRef = useRef(0);
  /** Context menu state */
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  /** Drawing preview (corner-to-corner shape being drawn) */
  const [drawingPreview, setDrawingPreview] = useState<{
    x: number;
    y: number;
    width: number;
    depth: number;
    shape: CutoutShape;
  } | null>(null);
  /** Path drawing preview (pen tool multi-click) */
  const [pathDrawingPreview, setPathDrawingPreview] = useState<PathDrawingPreviewState | null>(
    null
  );
  const [segmentHover, setSegmentHover] = useState<SegmentHoverInfo | null>(null);
  const [rulerMeasurement, setRulerMeasurement] = useState<RulerMeasurement | null>(null);
  /** Current zoom level — updated externally so ruler snap threshold adapts */
  const rulerZoomRef = useRef(1);

  /** Memoized snap targets for ruler — only recompute when cutouts array changes */
  const rulerSnapTargets = useMemo(() => collectSnapTargets(cutouts), [cutouts]);

  const snap = useCallback(
    (v: number) => (snapEnabled ? snapToGrid(v, gridSize) : v),
    [snapEnabled, gridSize]
  );

  // ── Selection ──────────────────────────────────────────────────────

  /** Select cutout; expands to full group unless additive. Skips hidden cutouts. */
  const selectCutout = useCallback(
    (id: string, additive: boolean) => {
      const cutout = cutouts.find((c) => c.id === id);
      if (!cutout) return;
      // Hidden cutouts cannot be selected
      if (cutout.hidden) return;

      setSelection((prev) => {
        if (additive) {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          // Auto-join: if the clicked cutout is ungrouped and the selection
          // contains a group, auto-add the clicked cutout to that group
          if (onGroup && next.has(id) && !cutout.groupId) {
            const selectedWithGroup = cutouts.find((c) => next.has(c.id) && c.groupId !== null);
            if (selectedWithGroup) {
              onGroup([...next]);
            }
          }
          return next;
        }

        // Group-aware: select all cutouts with same groupId
        if (cutout.groupId) {
          const groupIds = cutouts.filter((c) => c.groupId === cutout.groupId).map((c) => c.id);
          return new Set(groupIds);
        }

        return new Set([id]);
      });
    },
    [cutouts, onGroup]
  );

  /** Double-click: select only the individual cutout (bypasses group) */
  const selectIndividual = useCallback((id: string) => {
    setSelection(new Set([id]));
  }, []);

  const deselectAll = useCallback(() => {
    setSelection(new Set());
    setActiveGuides([]);
  }, []);

  const selectAll = useCallback(() => {
    setSelection(new Set(cutouts.map((c) => c.id)));
  }, [cutouts]);

  // ── Bulk operations ────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    if (selection.size === 0) return;
    // Filter out locked cutouts — only delete unlocked ones
    const deletable = [...selection].filter((id) => {
      const c = cutouts.find((cut) => cut.id === id);
      return c && !c.locked;
    });
    if (deletable.length === 0) return;
    if (onRemoveBatch) {
      onRemoveBatch(deletable);
    } else {
      for (const id of deletable) {
        onRemove(id);
      }
    }
    setSelection(new Set());
  }, [selection, cutouts, onRemove, onRemoveBatch]);

  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (selection.size === 0) return;
      // Block nudge if any selected cutout is locked
      const anyLocked = cutouts.some((c) => selection.has(c.id) && c.locked);
      if (anyLocked) return;
      const updates = new Map<string, Partial<Cutout>>();
      for (const id of selection) {
        const cutout = cutouts.find((c) => c.id === id);
        if (!cutout) continue;
        // Use rotation-aware AABB for clamping — rotated shapes extend
        // beyond their unrotated box, so x must stay further from edges
        const rb = getRotatedBounds(cutout);
        const overhangX = (rb.maxX - rb.minX - cutout.width) / 2;
        const overhangY = (rb.maxY - rb.minY - cutout.depth) / 2;
        const minX = overhangX;
        const minY = overhangY;
        const maxX = binWidth - cutout.width - overhangX;
        const maxY = binDepth - cutout.depth - overhangY;
        updates.set(id, {
          x: Math.max(minX, Math.min(cutout.x + dx, maxX)),
          y: Math.max(minY, Math.min(cutout.y + dy, maxY)),
        });
      }
      if (onUpdateBatch) {
        onUpdateBatch(updates);
      } else {
        for (const [id, partial] of updates) {
          onUpdate(id, partial);
        }
      }
    },
    [selection, cutouts, onUpdate, onUpdateBatch, binWidth, binDepth]
  );

  // ── Clipboard ──────────────────────────────────────────────────────

  const copySelected = useCallback(() => {
    const selected = cutouts.filter((c) => selection.has(c.id));
    if (selected.length > 0) {
      setClipboard(selected);
      pasteCountRef.current = 0;
    }
  }, [cutouts, selection]);

  const pasteFromClipboard = useCallback(() => {
    if (clipboard.length === 0) return;
    pasteCountRef.current += 1;
    const offset = PASTE_OFFSET * pasteCountRef.current;

    const clones = cloneCutoutsWithGroups(clipboard, (original) => ({
      x: Math.min(original.x + offset, binWidth - original.width),
      y: Math.min(original.y + offset, binDepth - original.depth),
    }));
    for (const { originalId: _, ...cutout } of clones) {
      onAdd(cutout);
    }
    setSelection(new Set(clones.map((c) => c.id)));
  }, [clipboard, onAdd, binWidth, binDepth]);

  const duplicateSelected = useCallback(() => {
    const selected = cutouts.filter((c) => selection.has(c.id));
    if (selected.length === 0) return;

    const clones = cloneCutoutsWithGroups(selected, (original) => ({
      x: Math.min(original.x + PASTE_OFFSET, binWidth - original.width),
      y: Math.min(original.y + PASTE_OFFSET, binDepth - original.depth),
    }));
    for (const { originalId: _, ...cutout } of clones) {
      onAdd(cutout);
    }
    setSelection(new Set(clones.map((c) => c.id)));
  }, [cutouts, selection, onAdd, binWidth, binDepth]);

  // ── Path tool ────────────────────────────────────────────────────

  /** Commit a closed path as a new cutout. */
  const commitPath = useCallback(
    (points: readonly PathPoint[]) => {
      // Clamp to bin bounds so cutout never extends outside the bin surface
      const clamped = clampPathToBounds(points, binWidth, binDepth);

      // Reject self-intersecting paths that would produce invalid 3D geometry
      if (isSelfIntersecting(clamped)) {
        setPathDrawingPreview(null);
        setMode({ type: 'idle' });
        return;
      }

      const { minX, minY, maxX, maxY } = getPathBounds(clamped);
      const newId = crypto.randomUUID();
      onAdd({
        id: newId,
        shape: 'path',
        x: minX,
        y: minY,
        width: maxX - minX,
        depth: maxY - minY,
        cutDepth: 5,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
        path: clamped,
      });
      setSelection(new Set([newId]));
      setMode({ type: 'idle' });
      setPathDrawingPreview(null);
    },
    [onAdd, binWidth, binDepth]
  );

  /** Handle path background click (first click or subsequent). */
  const handlePathBackgroundDown = useCallback(
    (mmX: number, mmY: number, shiftKey: boolean) => {
      const bounds = { binWidth, binDepth };
      const pathMode = mode.type === 'path-drawing' ? mode : null;
      handlePathDrawingPointerDown(pathMode, mmX, mmY, shiftKey, bounds, snap, {
        setMode,
        setPathDrawingPreview,
        commitPath,
      });
    },
    [mode, binWidth, binDepth, snap, commitPath]
  );

  /** Handle clicking an existing vertex while drawing (to reposition or close). */
  const onPathDrawingVertexDown = useCallback(
    (index: number, _mmX: number, _mmY: number) => {
      if (mode.type !== 'path-drawing') return;
      handlePathDrawingVertexDown(mode, index, {
        setMode,
        setPathDrawingPreview,
        commitPath,
      });
    },
    [mode, commitPath]
  );

  /** Enter vertex editing mode for a path cutout (on double-click). */
  const enterVertexEditing = useCallback(
    (cutoutId: string) => {
      const cutout = cutouts.find((c) => c.id === cutoutId);
      if (!cutout || cutout.shape !== 'path') return;
      setSelection(new Set([cutoutId]));
      setMode({
        type: 'vertex-editing',
        cutoutId,
        selectedPointIndex: null,
        dragTarget: null,
      });
    },
    [cutouts]
  );

  /** Handle vertex point down from PathEditOverlay3D. */
  const handleVertexPointDown = useCallback(
    (index: number, _mmX: number, _mmY: number) => {
      if (mode.type !== 'vertex-editing') return;
      startTransaction?.();
      setMode({
        ...mode,
        selectedPointIndex: index,
        dragTarget: { type: 'vertex', index },
      });
    },
    [mode, startTransaction]
  );

  /** Handle vertex handle down from PathEditOverlay3D. */
  const handleVertexHandleDown = useCallback(
    (index: number, handleType: 'in' | 'out', _mmX: number, _mmY: number) => {
      if (mode.type !== 'vertex-editing') return;
      startTransaction?.();
      setMode({
        ...mode,
        dragTarget: { type: 'handle', index, handleType },
      });
    },
    [mode, startTransaction]
  );

  /** Handle background click during vertex editing (segment insertion or exit). */
  const handleVertexBackgroundDown = useCallback(
    (mmX: number, mmY: number) => {
      if (mode.type !== 'vertex-editing') return;
      const cutout = cutouts.find((c) => c.id === mode.cutoutId);
      if (!cutout) {
        setMode({ type: 'idle' });
        return;
      }
      // Start a transaction so the split + any subsequent drag = one undo step
      startTransaction?.();
      handleVertexEditPointerDown(mode, { mmX, mmY, altKey: false }, cutout, CLOSE_SNAP_THRESHOLD, {
        setMode,
        setPreview,
        onUpdate,
        setSegmentHover,
      });
    },
    [mode, cutouts, onUpdate, startTransaction]
  );

  // ── Context menu ───────────────────────────────────────────────────

  const openContextMenu = useCallback((x: number, y: number) => {
    setContextMenu({ x, y });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ── Drag lifecycle ─────────────────────────────────────────────────

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
        const clones = cloneCutoutsWithGroups(selected);
        for (const { originalId: _, ...cutout } of clones) {
          onAdd(cutout);
        }
        cloneOriginMap = new Map(clones.map((c) => [c.id, c.originalId]));
        dragSelection = new Set(clones.map((c) => c.id));
        setSelection(dragSelection);
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
    [selection, cutouts, onAdd]
  );

  // ── Resize lifecycle ───────────────────────────────────────────────

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
    [cutouts]
  );

  // ── Rotate lifecycle ───────────────────────────────────────────────

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
    [cutouts]
  );

  // ── Group rotate lifecycle ─────────────────────────────────────────

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
    [cutouts, selection]
  );

  // ── Group scale lifecycle ──────────────────────────────────────────

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
    [cutouts, selection]
  );

  // ── Pointer move — delegates to mode-specific handlers ─────────────

  const handlePointerMove = useCallback(
    (mmX: number, mmY: number, shiftKey?: boolean, altKey?: boolean) => {
      const event = { mmX, mmY, shiftKey, altKey };
      const bounds = { binWidth, binDepth };

      switch (mode.type) {
        case 'pending-place':
          handlePendingPlaceMove(mode, event, setMode);
          break;

        case 'dragging':
          handleDragMove(mode, event, cutouts, bounds, snap, pastDeadZoneRef, {
            setPreview,
            setActiveGuides,
          });
          break;

        case 'resizing':
          handleResizeMove(mode, event, cutouts, bounds, snap, pastDeadZoneRef, {
            setPreview,
          });
          break;

        case 'rotating':
          handleRotateMove(mode, event, cutouts, bounds, pastDeadZoneRef, {
            setPreview,
          });
          break;

        case 'group-rotating':
          handleGroupRotateMove(mode, event, cutouts, pastDeadZoneRef, {
            setPreview,
          });
          break;

        case 'group-scaling':
          handleGroupScaleMove(mode, event, pastDeadZoneRef, {
            setPreview,
          });
          break;

        case 'drawing':
          handleDrawMove(mode, event, bounds, snap, {
            setDrawingPreview,
          });
          break;

        case 'path-drawing':
          handlePathDrawingPointerMove(mode, event, bounds, snap, {
            setMode,
            setPathDrawingPreview,
            commitPath,
          });
          break;

        case 'vertex-editing': {
          const editCutout = cutouts.find((c) => c.id === mode.cutoutId);
          if (editCutout) {
            handleVertexEditPointerMove(mode, event, editCutout, bounds, snap, {
              setPreview,
              setSegmentHover,
            });
          }
          break;
        }

        case 'measuring': {
          const snapped = snapToNearestTarget(mmX, mmY, rulerSnapTargets, rulerZoomRef.current);
          setRulerMeasurement(computeMeasurement(mode.startX, mode.startY, snapped.x, snapped.y));
          break;
        }
      }
    },
    [mode, cutouts, binWidth, binDepth, snap, commitPath, rulerSnapTargets]
  );

  // ── Pointer up (commit) ────────────────────────────────────────────

  const handlePointerUp = useCallback(() => {
    if (mode.type === 'pending-place') {
      // Click-to-place: create default-sized shape centered at click position
      const defaultW = mode.shape === 'circle' ? DEFAULT_CIRCLE_SIZE : DEFAULT_RECT_SIZE;
      const defaultD = mode.shape === 'circle' ? DEFAULT_CIRCLE_SIZE : DEFAULT_RECT_SIZE;
      const x = Math.max(0, Math.min(snap(mode.startMmX - defaultW / 2), binWidth - defaultW));
      const y = Math.max(0, Math.min(snap(mode.startMmY - defaultD / 2), binDepth - defaultD));
      const newId = crypto.randomUUID();
      onAdd({
        id: newId,
        shape: mode.shape,
        x,
        y,
        width: defaultW,
        depth: defaultD,
        cutDepth: 5,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
      });
      setSelection(new Set([newId]));
      setMode({ type: 'idle' });
      return;
    }

    if (
      mode.type === 'dragging' ||
      mode.type === 'resizing' ||
      mode.type === 'rotating' ||
      mode.type === 'group-rotating' ||
      mode.type === 'group-scaling'
    ) {
      // Only commit if we actually moved past the dead zone
      if (pastDeadZoneRef.current && preview.size > 0) {
        // For path cutouts during drag, translate absolute path point coordinates
        // to match the new x/y bounding box position.
        const augmented = new Map(preview);
        if (mode.type === 'dragging') {
          for (const [id, updates] of augmented) {
            const cutout = cutouts.find((c) => c.id === id);
            if (
              cutout?.shape === 'path' &&
              cutout.path &&
              updates.x !== undefined &&
              updates.y !== undefined
            ) {
              const dx = updates.x - cutout.x;
              const dy = updates.y - cutout.y;
              if (dx !== 0 || dy !== 0) {
                augmented.set(id, {
                  ...updates,
                  path: cutout.path.map((pt) => ({
                    ...pt,
                    x: pt.x + dx,
                    y: pt.y + dy,
                  })),
                });
              }
            }
          }
        }
        if (onUpdateBatch && augmented.size > 1) {
          onUpdateBatch(augmented);
        } else {
          for (const [id, updates] of augmented) {
            onUpdate(id, updates);
          }
        }
      }
      setPreview(new Map());
      setActiveGuides([]);
      setMode({ type: 'idle' });
    } else if (mode.type === 'drawing') {
      // Commit the drawn shape
      if (
        drawingPreview &&
        drawingPreview.width >= MIN_CUTOUT_SIZE &&
        drawingPreview.depth >= MIN_CUTOUT_SIZE
      ) {
        const newId = crypto.randomUUID();
        onAdd({
          id: newId,
          shape: drawingPreview.shape,
          x: drawingPreview.x,
          y: drawingPreview.y,
          width: drawingPreview.width,
          depth: drawingPreview.depth,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
        });
        setSelection(new Set([newId]));
      }
      setDrawingPreview(null);
      setMode({ type: 'idle' });
    } else if (mode.type === 'path-drawing') {
      handlePathDrawingPointerUp(mode, { setMode });
    } else if (mode.type === 'vertex-editing') {
      const editCutout = cutouts.find((c) => c.id === mode.cutoutId);
      if (editCutout) {
        handleVertexEditPointerUp(mode, editCutout, preview, {
          setMode,
          setPreview,
          onUpdate,
          setSegmentHover,
        });
      }
      commitTransaction?.();
    } else if (mode.type === 'measuring') {
      // Sticky mode (toolbar): stay in ruler-ready for repeated measurements
      // One-off (Shift+drag): return to idle
      setMode({ type: mode.sticky ? 'ruler-ready' : 'idle' });
    }
  }, [
    mode,
    preview,
    drawingPreview,
    cutouts,
    onUpdate,
    onUpdateBatch,
    onAdd,
    snap,
    binWidth,
    binDepth,
    commitTransaction,
  ]);

  // ── Keyboard shortcuts — delegates to handler ──────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleCutoutKeyDown(e, {
        selection,
        cutouts,
        mode,
        deleteSelected,
        deselectAll,
        selectAll,
        nudgeSelected,
        copySelected,
        pasteFromClipboard,
        duplicateSelected,
        onUndo,
        onRedo,
        onGroup,
        onUngroup,
        onUpdate,
        onUpdateBatch,
        onLock,
        onUnlock,
        setPreview,
        clearActiveGuides: () => setActiveGuides([]),
        clearDrawingPreview: () => setDrawingPreview(null),
        clearPathDrawingPreview: () => setPathDrawingPreview(null),
        setPathDrawingPreview,
        setMode,
        setSegmentHover,
        setSelection,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selection,
    cutouts,
    deleteSelected,
    deselectAll,
    selectAll,
    nudgeSelected,
    copySelected,
    pasteFromClipboard,
    duplicateSelected,
    onUndo,
    onRedo,
    onGroup,
    onUngroup,
    onUpdate,
    onUpdateBatch,
    onLock,
    onUnlock,
    mode,
  ]);

  // ── Recovery: reset on lost pointer / visibility change ────────────

  useEffect(() => {
    const reset = () => {
      if (mode.type === 'path-drawing' && mode.activePointDrag) {
        // Cancel in-progress handle drag but preserve the placed path points
        setMode({ ...mode, activePointDrag: false, repositionIndex: null });
        return;
      }
      if (
        mode.type !== 'idle' &&
        mode.type !== 'placing' &&
        mode.type !== 'marquee' &&
        mode.type !== 'vertex-editing' &&
        mode.type !== 'path-drawing' &&
        mode.type !== 'ruler-ready'
      ) {
        setPreview(new Map());
        setActiveGuides([]);
        setDrawingPreview(null);
        setPathDrawingPreview(null);
        setRulerMeasurement(null);
        setMode({ type: 'idle' });
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') reset();
    };
    window.addEventListener('pointercancel', reset);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pointercancel', reset);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mode]);

  // Clear ruler measurement when leaving ruler modes (e.g. pressing Escape)
  /* eslint-disable react-hooks/set-state-in-effect -- clearing transient visual state when mode changes */
  useEffect(() => {
    if (mode.type !== 'measuring' && mode.type !== 'ruler-ready') {
      setRulerMeasurement(null);
    }
  }, [mode.type]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Derived state ──────────────────────────────────────────────────

  // Derive effective selection by pruning stale IDs (avoids setState in effect)
  const effectiveSelection = useMemo(() => {
    const cutoutIds = new Set(cutouts.map((c) => c.id));
    let hasStale = false;
    for (const id of selection) {
      if (!cutoutIds.has(id)) {
        hasStale = true;
        break;
      }
    }
    if (!hasStale) return selection;
    const cleaned = new Set<string>();
    for (const id of selection) {
      if (cutoutIds.has(id)) cleaned.add(id);
    }
    return cleaned as ReadonlySet<string>;
  }, [cutouts, selection]);

  // ── Store sync ─────────────────────────────────────────────────────

  // Sync selection to shared store so the 3D preview can highlight selected cutouts
  useEffect(() => {
    useCutoutSelection.getState().setSelectedIds(effectiveSelection);
  }, [effectiveSelection]);

  // Sync preview overrides to shared store so 3D preview updates during interactions
  useEffect(() => {
    useCutoutSelection.getState().setPreviewOverrides(preview);
  }, [preview]);

  // Clear shared selection on unmount (e.g. switching away from solid mode)
  useEffect(() => {
    return () => {
      useCutoutSelection.getState().setSelectedIds(new Set());
      useCutoutSelection.getState().setPreviewOverrides(new Map());
    };
  }, []);

  return {
    mode,
    setMode,
    selection: effectiveSelection,
    selectCutout,
    selectIndividual,
    deselectAll,
    selectAll,
    deleteSelected,
    containerRef,
    preview,
    drawingPreview,
    pathDrawingPreview,
    segmentHover,
    startDrag,
    startResize,
    startRotation,
    startGroupRotation,
    startGroupScale,
    handlePointerMove,
    handlePointerUp,
    handlePathBackgroundDown,
    onPathDrawingVertexDown,
    enterVertexEditing,
    handleVertexPointDown,
    handleVertexHandleDown,
    handleVertexBackgroundDown,
    snapEnabled,
    setSnapEnabled,
    activeGuides,
    copySelected,
    pasteFromClipboard,
    duplicateSelected,
    clipboard,
    contextMenu,
    openContextMenu,
    closeContextMenu,
    canUndo: canUndo ?? false,
    canRedo: canRedo ?? false,
    rulerMeasurement,
    rulerZoomRef,
  };
}
