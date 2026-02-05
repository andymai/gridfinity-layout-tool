/**
 * State machine hook for cutout editor interactions.
 *
 * Manages placement, selection, dragging, resizing, and marquee states.
 * Keyboard shortcuts: Delete, Ctrl+A, arrows (nudge), Escape.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Cutout, CutoutShape } from '@/features/bin-designer/types';
import { useCutoutSelection } from '@/features/bin-designer/store';
import {
  calculateCutoutResize,
  constrainGroupDrag,
  snapToGrid,
  MIN_CUTOUT_SIZE,
  computeBounds,
  findAlignmentGuides,
  rotatePoint,
  clampRotationToBounds,
  type StartRect,
  type AlignmentGuide,
} from './geometry';

/** Direction for resize handles */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type InteractionMode =
  | { readonly type: 'idle' }
  | { readonly type: 'placing'; readonly shape: CutoutShape }
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
  readonly binWidth: number;
  readonly binDepth: number;
}

const NUDGE_AMOUNT = 0.5;
/** Dead zone in mm — cursor must move beyond this before drag/resize starts updating preview */
const DEAD_ZONE_MM = 0.5;
/** Paste offset in mm — each successive paste shifts by this amount */
const PASTE_OFFSET = 2;

export function useCutoutInteraction({
  cutouts,
  onUpdate,
  onRemove,
  onAdd,
  binWidth,
  binDepth,
}: UseCutoutInteractionOptions) {
  const [mode, setMode] = useState<InteractionMode>({ type: 'idle' });
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [preview, setPreview] = useState<PreviewMap>(new Map());
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);
  const containerRef = useRef<SVGSVGElement | null>(null);
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

  const snap = useCallback((v: number) => (snapEnabled ? snapToGrid(v) : v), [snapEnabled]);

  /** Select cutout; expands to full group unless additive */
  const selectCutout = useCallback(
    (id: string, additive: boolean) => {
      const cutout = cutouts.find((c) => c.id === id);
      if (!cutout) return;

      setSelection((prev) => {
        if (additive) {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
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
    [cutouts]
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
    for (const id of selection) {
      onRemove(id);
    }
    setSelection(new Set());
  }, [selection, onRemove]);

  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      for (const id of selection) {
        const cutout = cutouts.find((c) => c.id === id);
        if (!cutout) continue;
        onUpdate(id, {
          x: Math.max(0, Math.min(cutout.x + dx, binWidth - cutout.width)),
          y: Math.max(0, Math.min(cutout.y + dy, binDepth - cutout.depth)),
        });
      }
    },
    [selection, cutouts, onUpdate, binWidth, binDepth]
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

    const newIds: string[] = [];
    for (const original of clipboard) {
      const newId = crypto.randomUUID();
      newIds.push(newId);
      onAdd({
        ...original,
        id: newId,
        x: Math.min(original.x + offset, binWidth - original.width),
        y: Math.min(original.y + offset, binDepth - original.depth),
        groupId: null, // Don't copy group membership
      });
    }
    // Select the newly pasted cutouts
    setSelection(new Set(newIds));
  }, [clipboard, onAdd, binWidth, binDepth]);

  const duplicateSelected = useCallback(() => {
    const selected = cutouts.filter((c) => selection.has(c.id));
    if (selected.length === 0) return;
    const newIds: string[] = [];
    for (const original of selected) {
      const newId = crypto.randomUUID();
      newIds.push(newId);
      onAdd({
        ...original,
        id: newId,
        x: Math.min(original.x + PASTE_OFFSET, binWidth - original.width),
        y: Math.min(original.y + PASTE_OFFSET, binDepth - original.depth),
        groupId: null,
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
    (id: string, mmX: number, mmY: number) => {
      // Ensure the clicked cutout is selected
      const currentSelection = selection.has(id) ? selection : new Set([id]);
      if (!selection.has(id)) {
        setSelection(new Set([id]));
      }

      // Store offset from cursor to each selected cutout's origin
      const offsets = new Map<string, { dx: number; dy: number }>();
      for (const selectedId of currentSelection) {
        const cutout = cutouts.find((c) => c.id === selectedId);
        if (cutout) {
          offsets.set(selectedId, { dx: cutout.x - mmX, dy: cutout.y - mmY });
        }
      }

      pastDeadZoneRef.current = false;
      setMode({ type: 'dragging', startX: mmX, startY: mmY, offsets });
    },
    [selection, cutouts]
  );

  // ── Resize lifecycle ────────────────────────────────────────────────

  const startResize = useCallback(
    (id: string, handle: ResizeHandle, _mmX: number, _mmY: number) => {
      const cutout = cutouts.find((c) => c.id === id);
      if (!cutout) return;

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
    (mmX: number, mmY: number, shiftKey?: boolean) => {
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

        // Get selected cutouts for clamping
        const selectedCutouts = cutouts.filter((c) => mode.offsets.has(c.id));
        const { dx, dy } = constrainGroupDrag(selectedCutouts, rawDx, rawDy, binWidth, binDepth);

        const nextPreview = new Map<string, Partial<Cutout>>();
        for (const [id, offset] of mode.offsets) {
          nextPreview.set(id, {
            x: snap(mode.startX + dx + offset.dx),
            y: snap(mode.startY + dy + offset.dy),
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
          shiftKey
        );

        setPreview(
          new Map([
            [
              mode.cutoutId,
              {
                x: snap(resized.x),
                y: snap(resized.y),
                width: Math.max(MIN_CUTOUT_SIZE, snap(resized.width)),
                depth: Math.max(MIN_CUTOUT_SIZE, snap(resized.depth)),
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
        let newRotation = (((mode.initialRotation + delta) % 360) + 360) % 360;

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
        // Corner-to-corner drawing
        const x = Math.max(0, Math.min(mode.startMmX, mmX));
        const y = Math.max(0, Math.min(mode.startMmY, mmY));
        const w = Math.min(Math.abs(mmX - mode.startMmX), binWidth - x);
        const d = Math.min(Math.abs(mmY - mode.startMmY), binDepth - y);
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
    if (
      mode.type === 'dragging' ||
      mode.type === 'resizing' ||
      mode.type === 'rotating' ||
      mode.type === 'group-rotating' ||
      mode.type === 'group-scaling'
    ) {
      // Only commit if we actually moved past the dead zone
      if (pastDeadZoneRef.current && preview.size > 0) {
        for (const [id, updates] of preview) {
          onUpdate(id, updates);
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
    }
  }, [mode, preview, drawingPreview, onUpdate, onAdd]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

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
            deselectAll();
          }
          setMode({ type: 'idle' });
          break;
        case 'a':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            selectAll();
          }
          break;
        case 'c':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            copySelected();
          }
          break;
        case 'v':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            pasteFromClipboard();
          }
          break;
        case 'd':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            duplicateSelected();
          }
          break;
        case 'ArrowLeft':
          if (selection.size > 0) {
            e.preventDefault();
            nudgeSelected(-NUDGE_AMOUNT, 0);
          }
          break;
        case 'ArrowRight':
          if (selection.size > 0) {
            e.preventDefault();
            nudgeSelected(NUDGE_AMOUNT, 0);
          }
          break;
        case 'ArrowUp':
          if (selection.size > 0) {
            e.preventDefault();
            // Increase model Y → shape moves up visually (SVG Y is inverted)
            nudgeSelected(0, NUDGE_AMOUNT);
          }
          break;
        case 'ArrowDown':
          if (selection.size > 0) {
            e.preventDefault();
            // Decrease model Y → shape moves down visually (SVG Y is inverted)
            nudgeSelected(0, -NUDGE_AMOUNT);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selection,
    deleteSelected,
    deselectAll,
    selectAll,
    nudgeSelected,
    copySelected,
    pasteFromClipboard,
    duplicateSelected,
    mode.type,
  ]);

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

  // Clear shared selection on unmount (e.g. switching away from solid mode)
  useEffect(() => {
    return () => {
      useCutoutSelection.getState().setSelectedIds(new Set());
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
  };
}
