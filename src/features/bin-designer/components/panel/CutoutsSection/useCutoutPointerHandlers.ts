/**
 * Pointer move/up dispatcher for the cutout interaction state machine.
 *
 * `handlePointerMove` is a single switch over `mode.type` that routes the
 * event to the appropriate domain handler (drag, resize, rotate, draw, path,
 * vertex, ruler). `handlePointerUp` commits whatever transient state the
 * current mode produced — pending place / drag preview / drawing preview /
 * path / vertex edit / measurement.
 */

import { useCallback } from 'react';
import type { Cutout, CutoutShape, PathPoint } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import {
  handlePendingPlaceMove,
  handleDragMove,
  handleResizeMove,
  handleRotateMove,
  handleGroupRotateMove,
  handleGroupScaleMove,
  handleDrawMove,
  handlePathDrawingPointerMove,
  handlePathDrawingPointerUp,
  handleVertexEditPointerMove,
  handleVertexEditPointerUp,
} from './handlers';
import type { PathDrawingPreviewState, SegmentHoverInfo } from './handlers';
import { snapToNearestTarget, computeMeasurement } from './handlers/rulerHandler';
import type { RulerMeasurement, SnapTarget } from './handlers/rulerHandler';
import { MIN_CUTOUT_SIZE, type AlignmentGuide } from './geometry';
import { rectFitsInMask, type MaskCellSize } from './maskFit';
import { createDefaultCutout } from './cutoutHelpers';
import {
  type InteractionMode,
  type PreviewMap,
  DEFAULT_RECT_SIZE,
  DEFAULT_CIRCLE_SIZE,
} from './cutoutInteractionTypes';

interface DrawingPreviewState {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly shape: CutoutShape;
}

interface UseCutoutPointerHandlersOptions {
  readonly mode: InteractionMode;
  readonly setMode: (next: InteractionMode) => void;
  readonly cutouts: readonly Cutout[];
  readonly preview: PreviewMap;
  readonly setPreview: (next: PreviewMap | ((prev: PreviewMap) => PreviewMap)) => void;
  readonly setActiveGuides: React.Dispatch<React.SetStateAction<AlignmentGuide[]>>;
  readonly drawingPreview: DrawingPreviewState | null;
  readonly setDrawingPreview: (next: DrawingPreviewState | null) => void;
  readonly setPathDrawingPreview: (next: PathDrawingPreviewState | null) => void;
  readonly setSegmentHover: (next: SegmentHoverInfo | null) => void;
  readonly setSelection: (next: ReadonlySet<string>) => void;
  readonly setRulerMeasurement: (next: RulerMeasurement | null) => void;
  readonly snap: (v: number) => number;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly cellMask?: CellMask;
  readonly maskCellSize?: MaskCellSize;
  readonly rulerSnapTargets: readonly SnapTarget[];
  readonly rulerZoomRef: React.RefObject<number>;
  readonly pastDeadZoneRef: React.RefObject<boolean>;
  readonly commitPath: (points: readonly PathPoint[]) => void;
  readonly onAdd: (cutout: Cutout) => void;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onUpdateBatch?: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly commitTransaction?: () => void;
}

export interface CutoutPointerHandlers {
  readonly handlePointerMove: (
    mmX: number,
    mmY: number,
    shiftKey?: boolean,
    altKey?: boolean
  ) => void;
  readonly handlePointerUp: () => void;
}

export function useCutoutPointerHandlers(
  opts: UseCutoutPointerHandlersOptions
): CutoutPointerHandlers {
  const {
    mode,
    setMode,
    cutouts,
    preview,
    setPreview,
    setActiveGuides,
    drawingPreview,
    setDrawingPreview,
    setPathDrawingPreview,
    setSegmentHover,
    setSelection,
    setRulerMeasurement,
    snap,
    binWidth,
    binDepth,
    cellMask,
    maskCellSize,
    rulerSnapTargets,
    rulerZoomRef,
    pastDeadZoneRef,
    commitPath,
    onAdd,
    onUpdate,
    onUpdateBatch,
    commitTransaction,
  } = opts;

  const handlePointerMove = useCallback(
    (mmX: number, mmY: number, shiftKey?: boolean, altKey?: boolean) => {
      const event = { mmX, mmY, shiftKey, altKey };
      const bounds = { binWidth, binDepth, cellMask, maskCellSize };

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
          handleGroupRotateMove(mode, event, cutouts, bounds, pastDeadZoneRef, {
            setPreview,
          });
          break;

        case 'group-scaling':
          handleGroupScaleMove(mode, event, cutouts, bounds, pastDeadZoneRef, {
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
    [
      mode,
      cutouts,
      binWidth,
      binDepth,
      cellMask,
      maskCellSize,
      snap,
      commitPath,
      rulerSnapTargets,
      rulerZoomRef,
      pastDeadZoneRef,
      setMode,
      setPreview,
      setActiveGuides,
      setDrawingPreview,
      setPathDrawingPreview,
      setSegmentHover,
      setRulerMeasurement,
    ]
  );

  /** Click-to-place: create a default-sized shape centered at the click position. */
  const commitPendingPlace = useCallback(
    (placeMode: Extract<InteractionMode, { type: 'pending-place' }>) => {
      const defaultSize = placeMode.shape === 'circle' ? DEFAULT_CIRCLE_SIZE : DEFAULT_RECT_SIZE;
      const x = Math.max(
        0,
        Math.min(snap(placeMode.startMmX - defaultSize / 2), binWidth - defaultSize)
      );
      const y = Math.max(
        0,
        Math.min(snap(placeMode.startMmY - defaultSize / 2), binDepth - defaultSize)
      );

      // Polygon mask: reject click-to-place inside an unfilled notch.
      if (
        cellMask &&
        maskCellSize &&
        !rectFitsInMask(cellMask, x, y, defaultSize, defaultSize, maskCellSize)
      ) {
        setMode({ type: 'idle' });
        return;
      }

      const newId = crypto.randomUUID();
      onAdd(createDefaultCutout(newId, placeMode.shape, x, y, defaultSize, defaultSize));
      setSelection(new Set([newId]));
      setMode({ type: 'idle' });
    },
    [snap, binWidth, binDepth, cellMask, maskCellSize, onAdd, setSelection, setMode]
  );

  /**
   * Augment drag preview with translated path coordinates, then commit all
   * preview updates to the store.
   */
  const commitTransformPreview = useCallback(
    (isDrag: boolean) => {
      if (!pastDeadZoneRef.current || preview.size === 0) return;

      // For path cutouts during drag, translate absolute path point coordinates
      // to match the new x/y bounding box position.
      const augmented = new Map(preview);
      if (isDrag) {
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
    },
    [preview, cutouts, onUpdate, onUpdateBatch, pastDeadZoneRef]
  );

  /** Commit the draw-to-place preview as a new cutout. */
  const commitDrawing = useCallback(() => {
    if (
      drawingPreview &&
      drawingPreview.width >= MIN_CUTOUT_SIZE &&
      drawingPreview.depth >= MIN_CUTOUT_SIZE
    ) {
      const newId = crypto.randomUUID();
      onAdd(
        createDefaultCutout(
          newId,
          drawingPreview.shape,
          drawingPreview.x,
          drawingPreview.y,
          drawingPreview.width,
          drawingPreview.depth
        )
      );
      setSelection(new Set([newId]));
    }
    setDrawingPreview(null);
    setMode({ type: 'idle' });
  }, [drawingPreview, onAdd, setSelection, setDrawingPreview, setMode]);

  const handlePointerUp = useCallback(() => {
    switch (mode.type) {
      case 'pending-place':
        commitPendingPlace(mode);
        return;

      case 'dragging':
      case 'resizing':
      case 'rotating':
      case 'group-rotating':
      case 'group-scaling':
        commitTransformPreview(mode.type === 'dragging');
        setPreview(new Map());
        setActiveGuides([]);
        setMode({ type: 'idle' });
        return;

      case 'drawing':
        commitDrawing();
        return;

      case 'path-drawing':
        handlePathDrawingPointerUp(mode, { setMode });
        return;

      case 'vertex-editing': {
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
        return;
      }

      case 'measuring':
        // Sticky mode (toolbar): stay in ruler-ready for repeated measurements
        // One-off (Shift+drag): return to idle
        setMode({ type: mode.sticky ? 'ruler-ready' : 'idle' });
        return;
    }
  }, [
    mode,
    preview,
    cutouts,
    onUpdate,
    commitPendingPlace,
    commitTransformPreview,
    commitDrawing,
    commitTransaction,
    setMode,
    setPreview,
    setActiveGuides,
    setSegmentHover,
  ]);

  return { handlePointerMove, handlePointerUp };
}
