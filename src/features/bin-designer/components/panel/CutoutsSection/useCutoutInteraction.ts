/**
 * State machine hook for cutout editor interactions.
 *
 * Manages placement, selection, dragging, resizing, and marquee states.
 * Keyboard shortcuts: Delete, Ctrl+A, arrows (nudge), Escape.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Cutout, CutoutShape } from '@/features/bin-designer/types';
import { useCutoutSelection } from '@/features/bin-designer/store';
import { generateUUID } from '@/shared/utils/uuid';
import {
  calculateCutoutResize,
  constrainGroupDrag,
  snapToGrid,
  MIN_CUTOUT_SIZE,
  computeBounds,
  findAlignmentGuides,
  rotatePoint,
  clampRotationToBounds,
  getRotatedBounds,
  type StartRect,
  type AlignmentGuide,
} from './geometry';

/** Direction for resize handles */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Default sizes for click-to-place (mm) */
const DEFAULT_RECT_SIZE = 20;
const DEFAULT_CIRCLE_SIZE = 15;
/** Minimum drag distance to enter drawing mode vs click-to-place (mm) */
const PLACE_DRAG_THRESHOLD = 2;

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
  | { readonly type: 'marquee'; readonly startX: number; readonly startY: number };

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
  readonly binWidth: number;
  readonly binDepth: number;
  readonly gridSize?: number;
}

const NUDGE_AMOUNT = 0.5;
/** Dead zone in mm — cursor must move beyond this before drag/resize starts updating preview */
const DEAD_ZONE_MM = 0.5;
/** Paste offset in mm — each successive paste shifts by this amount */
const PASTE_OFFSET = 2;

const SHIFT_NUDGE_AMOUNT = 5;

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

  const snap = useCallback(
    (v: number) => (snapEnabled ? snapToGrid(v, gridSize) : v),
    [snapEnabled, gridSize]
  );

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

    // Map old groupId → new groupId so groups are preserved
    const groupMap = new Map<string, string>();
    const newIds: string[] = [];
    for (const original of clipboard) {
      const newId = generateUUID();
      newIds.push(newId);
      let newGroupId: string | null = null;
      if (original.groupId) {
        if (!groupMap.has(original.groupId)) {
          groupMap.set(original.groupId, generateUUID());
        }
        newGroupId = groupMap.get(original.groupId) ?? null;
      }
      onAdd({
        ...original,
        id: newId,
        x: Math.min(original.x + offset, binWidth - original.width),
        y: Math.min(original.y + offset, binDepth - original.depth),
        groupId: newGroupId,
      });
    }
    // Select the newly pasted cutouts
    setSelection(new Set(newIds));
  }, [clipboard, onAdd, binWidth, binDepth]);

  const duplicateSelected = useCallback(() => {
    const selected = cutouts.filter((c) => selection.has(c.id));
    if (selected.length === 0) return;
    // Map old groupId → new groupId so groups are preserved
    const groupMap = new Map<string, string>();
    const newIds: string[] = [];
    for (const original of selected) {
      const newId = generateUUID();
      newIds.push(newId);
      let newGroupId: string | null = null;
      if (original.groupId) {
        if (!groupMap.has(original.groupId)) {
          groupMap.set(original.groupId, generateUUID());
        }
        newGroupId = groupMap.get(original.groupId) ?? null;
      }
      onAdd({
        ...original,
        id: newId,
        x: Math.min(original.x + PASTE_OFFSET, binWidth - original.width),
        y: Math.min(original.y + PASTE_OFFSET, binDepth - original.depth),
        groupId: newGroupId,
      });
    }
    setSelection(new Set(newIds));
  }, [cutouts, selection, onAdd, binWidth, binDepth]);

  const openContextMenu = useCallback((x: number, y: number) => {
    setContextMenu({ x, y });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ── Drag lifecycle ──────────────────────────────────────────────────

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
      if (altKey) {
        const groupMap = new Map<string, string>();
        const newIds: string[] = [];
        for (const selectedId of effectiveSelection) {
          const original = cutouts.find((c) => c.id === selectedId);
          if (!original) continue;
          const newId = generateUUID();
          newIds.push(newId);
          let newGroupId: string | null = null;
          if (original.groupId) {
            if (!groupMap.has(original.groupId)) {
              groupMap.set(original.groupId, generateUUID());
            }
            newGroupId = groupMap.get(original.groupId) ?? null;
          }
          onAdd({ ...original, id: newId, groupId: newGroupId });
        }
        dragSelection = new Set(newIds);
        setSelection(dragSelection);
      }

      // Store offset from cursor to each selected cutout's origin
      const offsets = new Map<string, { dx: number; dy: number }>();
      for (const selectedId of dragSelection) {
        // For alt-clones, look up by original position (clones start at same pos)
        const cutout = altKey
          ? cutouts.find((c) => effectiveSelection.has(c.id))
          : cutouts.find((c) => c.id === selectedId);
        if (cutout) {
          offsets.set(selectedId, { dx: cutout.x - mmX, dy: cutout.y - mmY });
        }
      }

      pastDeadZoneRef.current = false;
      setMode({ type: 'dragging', startX: mmX, startY: mmY, offsets });
    },
    [selection, cutouts, onAdd]
  );

  // ── Resize lifecycle ────────────────────────────────────────────────

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

  // ── Rotate lifecycle ────────────────────────────────────────────────

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

  // ── Group rotate lifecycle ──────────────────────────────────────────

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

  // ── Group scale lifecycle ───────────────────────────────────────────

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

  // ── Pointer move (drag, resize, or rotate) ─────────────────────────

  const handlePointerMove = useCallback(
    (mmX: number, mmY: number, shiftKey?: boolean, altKey?: boolean) => {
      if (mode.type === 'pending-place') {
        // Check if cursor has moved far enough to enter drawing mode
        const dist = Math.sqrt((mmX - mode.startMmX) ** 2 + (mmY - mode.startMmY) ** 2);
        if (dist >= PLACE_DRAG_THRESHOLD) {
          setMode({
            type: 'drawing',
            shape: mode.shape,
            startMmX: mode.startMmX,
            startMmY: mode.startMmY,
          });
        }
        return;
      }

      if (mode.type === 'dragging') {
        // Dead zone check
        if (!pastDeadZoneRef.current) {
          const dist = Math.sqrt((mmX - mode.startX) ** 2 + (mmY - mode.startY) ** 2);
          if (dist < DEAD_ZONE_MM) return;
          pastDeadZoneRef.current = true;
        }

        // Compute raw deltas
        const rawDx = mmX - mode.startX;
        const rawDy = mmY - mode.startY;

        // Shift: axis-lock — constrain to dominant axis (Figma-style)
        let constrainedDx = rawDx;
        let constrainedDy = rawDy;
        if (shiftKey) {
          if (Math.abs(rawDx) >= Math.abs(rawDy)) {
            constrainedDy = 0;
          } else {
            constrainedDx = 0;
          }
        }

        // Get selected cutouts for clamping
        const selectedCutouts = cutouts.filter((c) => mode.offsets.has(c.id));
        const { dx, dy } = constrainGroupDrag(
          selectedCutouts,
          constrainedDx,
          constrainedDy,
          binWidth,
          binDepth
        );

        const nextPreview = new Map<string, Partial<Cutout>>();
        for (const [id, offset] of mode.offsets) {
          const cutout = cutouts.find((c) => c.id === id);
          if (!cutout) continue;
          // Snap, then clamp to bin bounds (snap can round past non-integer edges)
          nextPreview.set(id, {
            x: Math.max(0, Math.min(snap(mode.startX + dx + offset.dx), binWidth - cutout.width)),
            y: Math.max(0, Math.min(snap(mode.startY + dy + offset.dy), binDepth - cutout.depth)),
          });
        }
        setPreview(nextPreview);

        // Compute alignment guides
        const stationaryIds = new Set(cutouts.map((c) => c.id));
        for (const id of mode.offsets.keys()) stationaryIds.delete(id);
        const stationary = cutouts.filter((c) => stationaryIds.has(c.id));

        // Compute bounds of moving cutouts using preview positions
        const movingCutouts = [...nextPreview.entries()]
          .map(([id, updates]) => {
            const orig = cutouts.find((c) => c.id === id);
            return orig ? ({ ...orig, ...updates } as Cutout) : null;
          })
          .filter((c): c is Cutout => c !== null);

        const movingBounds = computeBounds(movingCutouts);
        const guides = findAlignmentGuides(movingBounds, stationary);
        setActiveGuides(guides);
      } else if (mode.type === 'resizing') {
        // Dead zone check
        if (!pastDeadZoneRef.current) {
          const cutout = cutouts.find((c) => c.id === mode.cutoutId);
          if (!cutout) return;
          // Use start center as reference
          const cx = mode.startRect.x + mode.startRect.width / 2;
          const cy = mode.startRect.y + mode.startRect.depth / 2;
          const startDist = Math.sqrt(
            (mode.startRect.x + mode.startRect.width - cx) ** 2 +
              (mode.startRect.y + mode.startRect.depth - cy) ** 2
          );
          const curDist = Math.sqrt((mmX - cx) ** 2 + (mmY - cy) ** 2);
          if (Math.abs(curDist - startDist) < DEAD_ZONE_MM) return;
          pastDeadZoneRef.current = true;
        }

        const cutout = cutouts.find((c) => c.id === mode.cutoutId);
        if (!cutout) return;

        const resized = calculateCutoutResize(
          mode.startRect,
          mode.handle,
          mmX,
          mmY,
          binWidth,
          binDepth,
          cutout.shape,
          cutout.rotation,
          shiftKey,
          altKey
        );

        // Snap, then clamp to bin bounds (snap can round past non-integer edges)
        const snappedW = Math.max(MIN_CUTOUT_SIZE, snap(resized.width));
        const snappedD = Math.max(MIN_CUTOUT_SIZE, snap(resized.depth));
        setPreview(
          new Map([
            [
              mode.cutoutId,
              {
                x: Math.max(0, Math.min(snap(resized.x), binWidth - snappedW)),
                y: Math.max(0, Math.min(snap(resized.y), binDepth - snappedD)),
                width: snappedW,
                depth: snappedD,
              },
            ],
          ])
        );
      } else if (mode.type === 'rotating') {
        // Dead zone check
        if (!pastDeadZoneRef.current) {
          const cutout = cutouts.find((c) => c.id === mode.cutoutId);
          if (!cutout) return;
          const cx = cutout.x + cutout.width / 2;
          const cy = cutout.y + cutout.depth / 2;
          // Check if we've rotated far enough from start
          const currentAngle = Math.atan2(mmY - cy, mmX - cx) * (180 / Math.PI);
          if (Math.abs(currentAngle - mode.startAngle) < 1) return;
          pastDeadZoneRef.current = true;
        }

        const cutout = cutouts.find((c) => c.id === mode.cutoutId);
        if (!cutout) return;

        const cx = cutout.x + cutout.width / 2;
        const cy = cutout.y + cutout.depth / 2;
        const currentAngle = Math.atan2(mmY - cy, mmX - cx) * (180 / Math.PI);
        const delta = currentAngle - mode.startAngle;
        let newRotation = (((mode.initialRotation - delta) % 360) + 360) % 360;

        // Snap to 15° increments when Shift is held
        if (shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }

        // Clamp rotation to keep within bin bounds
        newRotation = clampRotationToBounds(cutout, newRotation, binWidth, binDepth);

        setPreview(new Map([[mode.cutoutId, { rotation: newRotation }]]));
      } else if (mode.type === 'group-rotating') {
        if (!pastDeadZoneRef.current) {
          const currentAngle =
            Math.atan2(mmY - mode.center.y, mmX - mode.center.x) * (180 / Math.PI);
          if (Math.abs(currentAngle - mode.startAngle) < 1) return;
          pastDeadZoneRef.current = true;
        }

        const currentAngle = Math.atan2(mmY - mode.center.y, mmX - mode.center.x) * (180 / Math.PI);
        let delta = currentAngle - mode.startAngle;
        if (shiftKey) {
          delta = Math.round(delta / 15) * 15;
        }

        const nextPreview = new Map<string, Partial<Cutout>>();
        for (const [id, initial] of mode.initialStates) {
          const cutout = cutouts.find((c) => c.id === id);
          if (!cutout) continue;
          // Rotate position around group center
          const cxI = initial.x + cutout.width / 2;
          const cyI = initial.y + cutout.depth / 2;
          const rotated = rotatePoint(cxI, cyI, mode.center.x, mode.center.y, delta);
          nextPreview.set(id, {
            x: rotated.x - cutout.width / 2,
            y: rotated.y - cutout.depth / 2,
            rotation: (((initial.rotation + delta) % 360) + 360) % 360,
          });
        }
        setPreview(nextPreview);
      } else if (mode.type === 'group-scaling') {
        if (!pastDeadZoneRef.current) {
          const curDist = Math.sqrt((mmX - mode.center.x) ** 2 + (mmY - mode.center.y) ** 2);
          if (Math.abs(curDist - mode.startDist) < DEAD_ZONE_MM) return;
          pastDeadZoneRef.current = true;
        }

        const curDist = Math.sqrt((mmX - mode.center.x) ** 2 + (mmY - mode.center.y) ** 2);
        const scaleFactor = mode.startDist > 0 ? curDist / mode.startDist : 1;

        const nextPreview = new Map<string, Partial<Cutout>>();
        for (const [id, initial] of mode.initialStates) {
          // Scale size
          const newW = Math.max(MIN_CUTOUT_SIZE, initial.width * scaleFactor);
          const newD = Math.max(MIN_CUTOUT_SIZE, initial.depth * scaleFactor);
          // Scale position offset from center
          const cxI = initial.x + initial.width / 2;
          const cyI = initial.y + initial.depth / 2;
          const dx = (cxI - mode.center.x) * scaleFactor;
          const dy = (cyI - mode.center.y) * scaleFactor;
          nextPreview.set(id, {
            x: mode.center.x + dx - newW / 2,
            y: mode.center.y + dy - newD / 2,
            width: newW,
            depth: newD,
          });
        }
        setPreview(nextPreview);
      } else if (mode.type === 'drawing') {
        // Corner-to-corner drawing with modifiers
        let w = Math.abs(mmX - mode.startMmX);
        let d = Math.abs(mmY - mode.startMmY);

        // Shift: constrain to square
        if (shiftKey) {
          const maxDim = Math.max(w, d);
          w = maxDim;
          d = maxDim;
        }

        let x: number;
        let y: number;
        if (altKey) {
          // Alt: draw from center
          x = Math.max(0, mode.startMmX - w);
          y = Math.max(0, mode.startMmY - d);
          w = Math.min(w * 2, binWidth - x);
          d = Math.min(d * 2, binDepth - y);
        } else {
          x = Math.max(0, Math.min(mode.startMmX, mmX));
          y = Math.max(0, Math.min(mode.startMmY, mmY));
          w = Math.min(w, binWidth - x);
          d = Math.min(d, binDepth - y);
        }

        setDrawingPreview({
          x: snap(x),
          y: snap(y),
          width: Math.max(MIN_CUTOUT_SIZE, snap(w)),
          depth: Math.max(MIN_CUTOUT_SIZE, snap(d)),
          shape: mode.shape,
        });
      }
    },
    [mode, cutouts, binWidth, binDepth, snap]
  );

  // ── Pointer up (commit) ─────────────────────────────────────────────

  const handlePointerUp = useCallback(() => {
    if (mode.type === 'pending-place') {
      // Click-to-place: create default-sized shape centered at click position
      const defaultW = mode.shape === 'circle' ? DEFAULT_CIRCLE_SIZE : DEFAULT_RECT_SIZE;
      const defaultD = mode.shape === 'circle' ? DEFAULT_CIRCLE_SIZE : DEFAULT_RECT_SIZE;
      const x = Math.max(0, Math.min(snap(mode.startMmX - defaultW / 2), binWidth - defaultW));
      const y = Math.max(0, Math.min(snap(mode.startMmY - defaultD / 2), binDepth - defaultD));
      const newId = generateUUID();
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
        if (onUpdateBatch && preview.size > 1) {
          onUpdateBatch(preview);
        } else {
          for (const [id, updates] of preview) {
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
        const newId = generateUUID();
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
    }
  }, [mode, preview, drawingPreview, onUpdate, onUpdateBatch, onAdd, snap, binWidth, binDepth]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const mod = e.metaKey || e.ctrlKey;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (selection.size > 0) {
            e.preventDefault();
            deleteSelected();
          }
          break;
        case 'Escape':
          e.preventDefault();
          // Cancel in-progress drag/resize/rotate/drawing without committing
          setPreview(new Map());
          setActiveGuides([]);
          setDrawingPreview(null);
          if (mode.type === 'idle') {
            // Two-stage: if inside a group (single member selected), first re-select whole group
            if (selection.size === 1) {
              const selectedId = [...selection][0];
              const cutout = cutouts.find((c) => c.id === selectedId);
              if (cutout?.groupId) {
                const groupIds = cutouts
                  .filter((c) => c.groupId === cutout.groupId)
                  .map((c) => c.id);
                if (groupIds.length > 1) {
                  setSelection(new Set(groupIds));
                  break;
                }
              }
            }
            deselectAll();
          }
          setMode({ type: 'idle' });
          break;

        // Undo/redo
        case 'z':
          if (mod) {
            e.preventDefault();
            if (e.shiftKey) {
              onRedo?.();
            } else {
              onUndo?.();
            }
          }
          break;
        case 'Z':
          if (mod && e.shiftKey) {
            e.preventDefault();
            onRedo?.();
          }
          break;
        case 'y':
          if (mod) {
            e.preventDefault();
            onRedo?.();
          }
          break;

        case 'a':
          if (mod) {
            e.preventDefault();
            selectAll();
          }
          break;
        case 'c':
          if (mod) {
            e.preventDefault();
            copySelected();
          }
          break;
        case 'v':
          if (mod) {
            e.preventDefault();
            pasteFromClipboard();
          }
          break;
        case 'd':
          if (mod) {
            e.preventDefault();
            duplicateSelected();
          }
          break;

        // Ctrl+G group / Ctrl+Shift+G ungroup
        case 'g':
          if (mod) {
            e.preventDefault();
            if (e.shiftKey) {
              onUngroup?.([...selection]);
            } else if (selection.size >= 2) {
              onGroup?.([...selection]);
            }
          }
          break;
        case 'G':
          if (mod && e.shiftKey) {
            e.preventDefault();
            onUngroup?.([...selection]);
          }
          break;

        // R to rotate 90°
        case 'r':
          if (!mod && selection.size > 0) {
            e.preventDefault();
            // Block rotation if any selected cutout is locked
            if (cutouts.some((c) => selection.has(c.id) && c.locked)) break;
            if (onUpdateBatch && selection.size > 1) {
              // Group rotation: rotate each cutout's position around the group center
              const selectedCutouts = cutouts.filter((c) => selection.has(c.id));
              const bounds = computeBounds(selectedCutouts);
              const cx = (bounds.minX + bounds.maxX) / 2;
              const cy = (bounds.minY + bounds.maxY) / 2;
              const updates = new Map<string, Partial<Cutout>>();
              for (const cutout of selectedCutouts) {
                const cutCx = cutout.x + cutout.width / 2;
                const cutCy = cutout.y + cutout.depth / 2;
                const rotated = rotatePoint(cutCx, cutCy, cx, cy, 90);
                updates.set(cutout.id, {
                  x: rotated.x - cutout.width / 2,
                  y: rotated.y - cutout.depth / 2,
                  rotation: (cutout.rotation + 90) % 360,
                });
              }
              onUpdateBatch(updates);
            } else {
              for (const id of selection) {
                const cutout = cutouts.find((c) => c.id === id);
                if (!cutout) continue;
                onUpdate(id, { rotation: (cutout.rotation + 90) % 360 });
              }
            }
          }
          break;

        // Tab / Shift+Tab to cycle selection
        case 'Tab':
          if (cutouts.length > 0) {
            e.preventDefault();
            const ids = cutouts.map((c) => c.id);
            const currentIdx = selection.size === 1 ? ids.indexOf([...selection][0]) : -1;
            const nextIdx = e.shiftKey
              ? currentIdx <= 0
                ? ids.length - 1
                : currentIdx - 1
              : (currentIdx + 1) % ids.length;
            setSelection(new Set([ids[nextIdx]]));
          }
          break;

        case 'ArrowLeft':
          if (selection.size > 0) {
            e.preventDefault();
            const amount = e.shiftKey ? SHIFT_NUDGE_AMOUNT : NUDGE_AMOUNT;
            nudgeSelected(-amount, 0);
          }
          break;
        case 'ArrowRight':
          if (selection.size > 0) {
            e.preventDefault();
            const amount = e.shiftKey ? SHIFT_NUDGE_AMOUNT : NUDGE_AMOUNT;
            nudgeSelected(amount, 0);
          }
          break;
        case 'ArrowUp':
          if (selection.size > 0) {
            e.preventDefault();
            const amount = e.shiftKey ? SHIFT_NUDGE_AMOUNT : NUDGE_AMOUNT;
            nudgeSelected(0, amount);
          }
          break;
        case 'ArrowDown':
          if (selection.size > 0) {
            e.preventDefault();
            const amount = e.shiftKey ? SHIFT_NUDGE_AMOUNT : NUDGE_AMOUNT;
            nudgeSelected(0, -amount);
          }
          break;

        // Ctrl+L to toggle lock
        case 'l':
          if (mod && selection.size > 0) {
            e.preventDefault();
            const selectedCutouts = cutouts.filter((c) => selection.has(c.id));
            const allLocked = selectedCutouts.every((c) => c.locked);
            if (allLocked) {
              onUnlock?.([...selection]);
            } else {
              onLock?.([...selection]);
            }
          }
          break;
      }
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
    mode.type,
  ]);

  // ── Recovery: reset on lost pointer / visibility change ─────────────
  useEffect(() => {
    const reset = () => {
      if (mode.type !== 'idle' && mode.type !== 'placing' && mode.type !== 'marquee') {
        setPreview(new Map());
        setActiveGuides([]);
        setDrawingPreview(null);
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
  }, [mode.type]);

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
    startDrag,
    startResize,
    startRotation,
    startGroupRotation,
    startGroupScale,
    handlePointerMove,
    handlePointerUp,
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
  };
}
