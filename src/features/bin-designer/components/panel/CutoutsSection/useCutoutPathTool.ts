/**
 * Path-drawing and vertex-editing handlers for the cutout workspace.
 *
 * The pen tool emits a sequence of clicks that build a path; this hook owns
 * the transitions for "background click", "vertex click during draw", and the
 * vertex-edit follow-up flow (point/handle/background down).
 *
 * Mask + bounds enforcement happens before commit so an invalid path silently
 * resets to idle rather than producing geometry that overhangs the bin.
 */

import { useCallback } from 'react';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import {
  handlePathDrawingPointerDown,
  handlePathDrawingVertexDown,
  handleVertexEditPointerDown,
} from './handlers';
import type { PathDrawingPreviewState, SegmentHoverInfo } from './handlers';
import {
  CLOSE_SNAP_THRESHOLD,
  clampPathToBounds,
  getPathBounds,
  isSelfIntersecting,
} from './pathGeometry';
import { rectFitsInMask, type MaskCellSize } from './maskFit';
import { createDefaultCutout } from './cutoutHelpers';
import type { InteractionMode, PreviewMap } from './cutoutInteractionTypes';

interface UseCutoutPathToolOptions {
  readonly mode: InteractionMode;
  readonly setMode: (mode: InteractionMode) => void;
  readonly cutouts: readonly Cutout[];
  readonly onAdd: (cutout: Cutout) => void;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly setSelection: (sel: ReadonlySet<string>) => void;
  readonly setPathDrawingPreview: (next: PathDrawingPreviewState | null) => void;
  readonly setPreview: (next: PreviewMap | ((prev: PreviewMap) => PreviewMap)) => void;
  readonly setSegmentHover: (next: SegmentHoverInfo | null) => void;
  readonly snap: (v: number) => number;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly cellMask?: CellMask;
  readonly maskCellSize?: MaskCellSize;
  readonly startTransaction?: () => void;
}

export interface CutoutPathTool {
  readonly commitPath: (points: readonly PathPoint[]) => void;
  readonly handlePathBackgroundDown: (mmX: number, mmY: number, shiftKey: boolean) => void;
  readonly onPathDrawingVertexDown: (index: number, mmX: number, mmY: number) => void;
  readonly enterVertexEditing: (cutoutId: string) => void;
  readonly handleVertexPointDown: (index: number, mmX: number, mmY: number) => void;
  readonly handleVertexHandleDown: (
    index: number,
    handleType: 'in' | 'out',
    mmX: number,
    mmY: number
  ) => void;
  readonly handleVertexBackgroundDown: (mmX: number, mmY: number) => void;
}

export function useCutoutPathTool({
  mode,
  setMode,
  cutouts,
  onAdd,
  onUpdate,
  setSelection,
  setPathDrawingPreview,
  setPreview,
  setSegmentHover,
  snap,
  binWidth,
  binDepth,
  cellMask,
  maskCellSize,
  startTransaction,
}: UseCutoutPathToolOptions): CutoutPathTool {
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

      // Polygon bins: reject paths whose bounds overhang the mask.
      if (
        cellMask &&
        maskCellSize &&
        !rectFitsInMask(cellMask, minX, minY, maxX - minX, maxY - minY, maskCellSize)
      ) {
        setPathDrawingPreview(null);
        setMode({ type: 'idle' });
        return;
      }

      const newId = crypto.randomUUID();
      onAdd({
        ...createDefaultCutout(newId, 'path', minX, minY, maxX - minX, maxY - minY),
        path: clamped,
      });
      setSelection(new Set([newId]));
      setMode({ type: 'idle' });
      setPathDrawingPreview(null);
    },
    [
      onAdd,
      setSelection,
      setMode,
      setPathDrawingPreview,
      binWidth,
      binDepth,
      cellMask,
      maskCellSize,
    ]
  );

  /** Handle path background click (first click or subsequent). */
  const handlePathBackgroundDown = useCallback(
    (mmX: number, mmY: number, shiftKey: boolean) => {
      const bounds = { binWidth, binDepth, cellMask, maskCellSize };
      const pathMode = mode.type === 'path-drawing' ? mode : null;
      handlePathDrawingPointerDown(pathMode, mmX, mmY, shiftKey, bounds, snap, {
        setMode,
        setPathDrawingPreview,
        commitPath,
      });
    },
    [
      mode,
      binWidth,
      binDepth,
      cellMask,
      maskCellSize,
      snap,
      commitPath,
      setMode,
      setPathDrawingPreview,
    ]
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
    [mode, commitPath, setMode, setPathDrawingPreview]
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
    [cutouts, setSelection, setMode]
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
    [mode, startTransaction, setMode]
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
    [mode, startTransaction, setMode]
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
    [mode, cutouts, onUpdate, startTransaction, setMode, setPreview, setSegmentHover]
  );

  return {
    commitPath,
    handlePathBackgroundDown,
    onPathDrawingVertexDown,
    enterVertexEditing,
    handleVertexPointDown,
    handleVertexHandleDown,
    handleVertexBackgroundDown,
  };
}
