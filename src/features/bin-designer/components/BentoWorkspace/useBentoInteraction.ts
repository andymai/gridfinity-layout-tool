/**
 * Pointer state machine for the Bento canvas, mirroring the layout planner's
 * interaction architecture: one discriminated-union gesture, validity computed
 * during move and carried on the state (the render layer never re-validates),
 * commit exactly once on pointerup through a store action, cancel by clearing
 * the gesture (Escape works because commit only happens in the up handler).
 *
 * Gestures: drag on background draws, drag on a drawn compartment moves it
 * (Alt = duplicate), resize-handle drag reshapes, drag from the stash shelf
 * places. A move that ends over the shelf stashes. All coordinates quantize
 * to whole cells — the layout's smart-snap machinery has nothing to do here.
 *
 * Move / resize / stash-drag are RAF-throttled and draw deliberately is not,
 * matching `useInteraction`: the first three run overlap validation against
 * every compartment on each update, while draw is cheap and wants the ghost to
 * track the cursor with no frame of lag.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { throttleRAF, cancelThrottledRAF } from '@/shared/utils';
import type { CompartmentConfig, StashedCompartment } from '@/features/bin-designer/types';
import {
  canPlaceRect,
  getCompartmentRect,
  getDrawnCompartmentIds,
  rectIndices,
  type CellRect,
} from '@/features/bin-designer/utils/bentoDraw';
import { previewMergeCells } from '@/features/bin-designer/utils/compartments';

export type ResizeHandleId = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface Cell {
  readonly col: number;
  readonly row: number;
}

export type BentoGesture =
  | { readonly type: 'draw'; readonly anchor: Cell; readonly cursor: Cell }
  | {
      readonly type: 'move';
      readonly id: number;
      readonly startRect: CellRect;
      readonly grab: Cell;
      readonly currentRect: CellRect;
      readonly duplicate: boolean;
      readonly overStash: boolean;
      readonly moved: boolean;
    }
  | {
      readonly type: 'resize';
      readonly id: number;
      readonly handle: ResizeHandleId;
      readonly startRect: CellRect;
      readonly currentRect: CellRect;
    }
  | {
      readonly type: 'stashDrag';
      readonly index: number;
      readonly entry: StashedCompartment;
      /**
       * Which cell of the entry's own footprint the pointer grabbed, read off
       * the shelf tile's proportions. Re-centring the rect on the cursor
       * instead made a wide entry jump sideways the instant it was picked up.
       */
      readonly grab: Cell;
      /** Client px at pointerdown — the threshold below is measured from it. */
      readonly origin: { readonly x: number; readonly y: number };
      /**
       * False until the pointer has travelled `DRAG_THRESHOLD_PX`. A stash tile
       * carries its own controls (remove) and a bare click should reach them,
       * so the gesture stays inert — and the shelf keeps rendering the tile —
       * until the pointer says a drag was meant.
       */
      readonly armed: boolean;
      readonly currentRect: CellRect | null;
    };

export interface BentoGhost {
  readonly rect: CellRect;
  readonly valid: boolean;
  readonly kind: 'draw' | 'move' | 'resize' | 'stashDrag';
  readonly overStash: boolean;
}

export interface BentoInteractionContext {
  readonly config: CompartmentConfig;
  /** Interior mm per cell on each axis. */
  readonly cellW: number;
  readonly cellH: number;
  /** The canvas container; its rect anchors client px → world mm. */
  readonly canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Camera values (plain, no refs) matching the container's projection. */
  readonly zoom: number;
  readonly cameraCenter: { readonly x: number; readonly y: number };
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  /** The stash shelf element, hit-tested during move gestures. */
  readonly stashShelfRef: React.RefObject<HTMLDivElement | null>;
  readonly selectedId: number | null;
  readonly onSelect: (id: number | null) => void;
  readonly onRequestLabelEdit: (id: number) => void;
  /**
   * A release landed somewhere invalid (overlap / out of bounds) and the
   * gesture was discarded. The layout planner toasts the reason on invalid
   * drops; without this the ghost just vanishes silently. Draw is exempt —
   * its red ghost was continuous feedback and a toast per experiment spams.
   */
  readonly onInvalidDrop?: (kind: 'move' | 'resize' | 'duplicate' | 'place') => void;
  /**
   * A gesture committed and produced this compartment id. Drives the drop
   * settle on the canvas — the layout planner animates a dropped bin, and
   * without it a placed compartment simply blinks into existence.
   */
  readonly onCommitted?: (id: number) => void;
  /** A shift-click asked to merge compartments that don't touch. */
  readonly onInvalidMerge?: () => void;
  readonly actions: {
    readonly draw: (rect: CellRect) => number | null;
    readonly move: (id: number, dCol: number, dRow: number) => number | null;
    readonly resize: (id: number, rect: CellRect) => number | null;
    readonly duplicate: (id: number, rect: CellRect) => number | null;
    readonly stash: (id: number) => boolean;
    readonly placeFromStash: (index: number, rect: CellRect) => number | null;
    /**
     * Fuse two drawn compartments into one shape. Null when they don't touch —
     * the caller says so; a merged pocket has to be one piece.
     */
    readonly merge: (ids: readonly number[]) => number | null;
  };
  readonly setPreviewCompartments: (preview: CompartmentConfig | null) => void;
  readonly setPreviewSelection: (
    selection: {
      action: 'merge' | 'split';
      minCol: number;
      maxCol: number;
      minRow: number;
      maxRow: number;
    } | null
  ) => void;
}

/** Just the pointer position a gesture update needs — the throttled path
 *  crosses a frame boundary, and holding the live event across it is a trap. */
interface PointerSample {
  readonly clientX: number;
  readonly clientY: number;
}

/** Pointer travel before a stash-tile press becomes a drag. */
const DRAG_THRESHOLD_PX = 4;

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

function rectFromCells(a: Cell, b: Cell): CellRect {
  const col = Math.min(a.col, b.col);
  const row = Math.min(a.row, b.row);
  return {
    col,
    row,
    w: Math.abs(a.col - b.col) + 1,
    h: Math.abs(a.row - b.row) + 1,
  };
}

/**
 * Which cell of a stashed entry the pointer grabbed, read off the shelf tile —
 * it draws the entry to scale, so the fraction of the tile under the cursor is
 * the fraction of the footprint. Screen Y runs down while row 0 is the FRONT of
 * the bin (bottom of the canvas), hence the flip. A tile with no measurable
 * size names no cell, so fall back to the middle one.
 */
function grabCellOnTile(e: React.PointerEvent, entry: StashedCompartment): Cell {
  const tile = e.currentTarget.getBoundingClientRect();
  if (tile.width <= 0 || tile.height <= 0) {
    return { col: Math.floor((entry.w - 1) / 2), row: Math.floor((entry.h - 1) / 2) };
  }
  const fracX = (e.clientX - tile.left) / tile.width;
  const fracY = (e.clientY - tile.top) / tile.height;
  return {
    col: clamp(Math.floor(fracX * entry.w), 0, entry.w - 1),
    row: clamp(Math.floor((1 - fracY) * entry.h), 0, entry.h - 1),
  };
}

function applyHandle(start: CellRect, handle: ResizeHandleId, cell: Cell): CellRect {
  let left = start.col;
  let right = start.col + start.w - 1;
  let bottom = start.row;
  let top = start.row + start.h - 1;
  // Row 0 is the FRONT of the bin (bottom of the screen): the 'n' handle is
  // the visually-top edge, which is the HIGH row. Each edge clamps against
  // its opposite so the rect can't invert.
  if (handle.includes('e')) right = Math.max(left, cell.col);
  if (handle.includes('w')) left = Math.min(right, cell.col);
  if (handle.includes('n')) top = Math.max(bottom, cell.row);
  if (handle.includes('s')) bottom = Math.min(top, cell.row);
  return { col: left, row: bottom, w: right - left + 1, h: top - bottom + 1 };
}

export function useBentoInteraction(ctx: BentoInteractionContext) {
  // The ref is the source of truth for event handlers (setState updaters must
  // stay pure — commit is a store write, and StrictMode double-invokes
  // updaters); the state exists only to re-render the ghost. Always write
  // both through updateGesture.
  const [gesture, setGesture] = useState<BentoGesture | null>(null);
  const gestureRef = useRef<BentoGesture | null>(null);
  const updateGesture = useCallback((next: BentoGesture | null): void => {
    gestureRef.current = next;
    setGesture(next);
  }, []);
  const ctxRef = useRef(ctx);
  useEffect(() => {
    ctxRef.current = ctx;
  }, [ctx]);

  const drawnIds = useMemo(() => getDrawnCompartmentIds(ctx.config), [ctx.config]);

  /** Client px → interior world mm (Y up, origin bottom-left). Unclamped. */
  const worldAt = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const { canvasRef, zoom, cameraCenter, canvasWidth, canvasHeight } = ctxRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    const px = clientX - (rect?.left ?? 0);
    const py = clientY - (rect?.top ?? 0);
    return {
      x: cameraCenter.x + (px - canvasWidth / 2) / zoom,
      y: cameraCenter.y - (py - canvasHeight / 2) / zoom,
    };
  }, []);

  const cellAt = useCallback(
    (clientX: number, clientY: number): Cell => {
      const { config, cellW, cellH } = ctxRef.current;
      const world = worldAt(clientX, clientY);
      return {
        col: clamp(Math.floor(world.x / cellW), 0, config.cols - 1),
        row: clamp(Math.floor(world.y / cellH), 0, config.rows - 1),
      };
    },
    [worldAt]
  );

  const isOverStash = useCallback((clientX: number, clientY: number): boolean => {
    const el = ctxRef.current.stashShelfRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    );
  }, []);

  const isInsideCanvas = useCallback(
    (clientX: number, clientY: number): boolean => {
      const { config, cellW, cellH } = ctxRef.current;
      const world = worldAt(clientX, clientY);
      return (
        world.x >= 0 &&
        world.y >= 0 &&
        world.x <= config.cols * cellW &&
        world.y <= config.rows * cellH
      );
    },
    [worldAt]
  );

  /** Ghost rect + validity for the render layer. */
  const ghost = useMemo((): BentoGhost | null => {
    if (!gesture) return null;
    const { config } = ctx;
    switch (gesture.type) {
      case 'draw': {
        const rect = rectFromCells(gesture.anchor, gesture.cursor);
        return { rect, valid: canPlaceRect(config, rect), kind: 'draw', overStash: false };
      }
      case 'move': {
        if (!gesture.moved) return null;
        const valid = gesture.duplicate
          ? canPlaceRect(config, gesture.currentRect)
          : canPlaceRect(config, gesture.currentRect, { ignoreId: gesture.id });
        return { rect: gesture.currentRect, valid, kind: 'move', overStash: gesture.overStash };
      }
      case 'resize':
        return {
          rect: gesture.currentRect,
          valid: canPlaceRect(config, gesture.currentRect, { ignoreId: gesture.id }),
          kind: 'resize',
          overStash: false,
        };
      case 'stashDrag':
        if (!gesture.currentRect) return null;
        return {
          rect: gesture.currentRect,
          valid: canPlaceRect(config, gesture.currentRect),
          kind: 'stashDrag',
          overStash: false,
        };
    }
  }, [gesture, ctx]);

  // Mirror a valid draw ghost to the 3D preview, same as the old drag-merge.
  useEffect(() => {
    const { config, setPreviewCompartments, setPreviewSelection } = ctxRef.current;
    if (
      !ghost ||
      ghost.kind !== 'draw' ||
      !ghost.valid ||
      (ghost.rect.w === 1 && ghost.rect.h === 1)
    ) {
      setPreviewCompartments(null);
      setPreviewSelection(null);
      return;
    }
    const indices = rectIndices(config.cols, ghost.rect);
    setPreviewCompartments({
      cols: config.cols,
      rows: config.rows,
      thickness: config.thickness,
      cells: previewMergeCells(config.cells, indices),
    });
    setPreviewSelection({
      action: 'merge',
      minCol: ghost.rect.col,
      maxCol: ghost.rect.col + ghost.rect.w - 1,
      minRow: ghost.rect.row,
      maxRow: ghost.rect.row + ghost.rect.h - 1,
    });
    return () => {
      setPreviewCompartments(null);
      setPreviewSelection(null);
    };
  }, [ghost]);

  const commit = useCallback(
    (g: BentoGesture, e: PointerEvent): void => {
      const { config, actions, onSelect, onInvalidDrop, onCommitted } = ctxRef.current;
      const landed = (id: number | null): void => {
        if (id === null) return;
        onSelect(id);
        onCommitted?.(id);
      };
      switch (g.type) {
        case 'draw': {
          const rect = rectFromCells(g.anchor, g.cursor);
          if (!canPlaceRect(config, rect)) return;
          landed(actions.draw(rect));
          return;
        }
        case 'move': {
          if (!g.moved) return;
          if (g.overStash && !g.duplicate) {
            if (actions.stash(g.id)) onSelect(null);
            return;
          }
          const dCol = g.currentRect.col - g.startRect.col;
          const dRow = g.currentRect.row - g.startRect.row;
          if (g.duplicate) {
            if (!canPlaceRect(config, g.currentRect)) {
              onInvalidDrop?.('duplicate');
              return;
            }
            landed(actions.duplicate(g.id, g.currentRect));
            return;
          }
          if (dCol === 0 && dRow === 0) return;
          if (!canPlaceRect(config, g.currentRect, { ignoreId: g.id })) {
            onInvalidDrop?.('move');
            return;
          }
          landed(actions.move(g.id, dCol, dRow));
          return;
        }
        case 'resize': {
          if (
            g.currentRect.col === g.startRect.col &&
            g.currentRect.row === g.startRect.row &&
            g.currentRect.w === g.startRect.w &&
            g.currentRect.h === g.startRect.h
          ) {
            return;
          }
          if (!canPlaceRect(config, g.currentRect, { ignoreId: g.id })) {
            onInvalidDrop?.('resize');
            return;
          }
          landed(actions.resize(g.id, g.currentRect));
          return;
        }
        case 'stashDrag': {
          // Released outside the canvas = deliberate cancel, stays silent
          // (matching the layout's off-grid drops). An unarmed press never
          // moved anything, so it is a click on the tile, not a failed drop.
          if (!g.armed || !g.currentRect || !isInsideCanvas(e.clientX, e.clientY)) return;
          if (!canPlaceRect(config, g.currentRect)) {
            onInvalidDrop?.('place');
            return;
          }
          landed(actions.placeFromStash(g.index, g.currentRect));
          return;
        }
      }
    },
    [isInsideCanvas]
  );

  // Window-level listeners while a gesture is live — a fast drag outruns the
  // canvas element, and commit must fire even when the pointer ends elsewhere.
  // Handlers read/write gestureRef, never the state updater: commit is a
  // store write and must run exactly once, synchronously, on pointerup.
  const hasGesture = gesture !== null;
  useEffect(() => {
    if (!hasGesture) return;

    const nextGestureFor = (g: BentoGesture, e: PointerSample): BentoGesture => {
      const cell = cellAt(e.clientX, e.clientY);
      switch (g.type) {
        case 'draw':
          if (cell.col === g.cursor.col && cell.row === g.cursor.row) return g;
          return { ...g, cursor: cell };
        case 'move': {
          const { config } = ctxRef.current;
          const col = clamp(cell.col - g.grab.col, 0, config.cols - g.startRect.w);
          const row = clamp(cell.row - g.grab.row, 0, config.rows - g.startRect.h);
          const overStash = isOverStash(e.clientX, e.clientY);
          const moved = g.moved || col !== g.startRect.col || row !== g.startRect.row || overStash;
          if (
            col === g.currentRect.col &&
            row === g.currentRect.row &&
            overStash === g.overStash &&
            moved === g.moved
          ) {
            return g;
          }
          return { ...g, currentRect: { ...g.currentRect, col, row }, overStash, moved };
        }
        case 'resize': {
          const next = applyHandle(g.startRect, g.handle, cell);
          if (
            next.col === g.currentRect.col &&
            next.row === g.currentRect.row &&
            next.w === g.currentRect.w &&
            next.h === g.currentRect.h
          ) {
            return g;
          }
          return { ...g, currentRect: next };
        }
        case 'stashDrag': {
          const armed =
            g.armed ||
            Math.hypot(e.clientX - g.origin.x, e.clientY - g.origin.y) >= DRAG_THRESHOLD_PX;
          if (!armed) return g;
          if (!isInsideCanvas(e.clientX, e.clientY)) {
            return g.currentRect === null && g.armed ? g : { ...g, armed, currentRect: null };
          }
          const { config } = ctxRef.current;
          const col = clamp(cell.col - g.grab.col, 0, config.cols - g.entry.w);
          const row = clamp(cell.row - g.grab.row, 0, config.rows - g.entry.h);
          if (g.armed && g.currentRect && col === g.currentRect.col && row === g.currentRect.row) {
            return g;
          }
          return { ...g, armed, currentRect: { col, row, w: g.entry.w, h: g.entry.h } };
        }
      }
    };

    const applyMove = (clientX: number, clientY: number): void => {
      const g = gestureRef.current;
      if (!g) return;
      const next = nextGestureFor(g, { clientX, clientY });
      if (next !== g) updateGesture(next);
    };

    // Only the heavy gestures are deferred to a frame: each recomputes overlap
    // against every compartment. Draw calls applyMove straight through.
    const throttledMove = throttleRAF(applyMove);

    const onMove = (e: PointerEvent): void => {
      const g = gestureRef.current;
      if (!g) return;
      if (g.type === 'draw') applyMove(e.clientX, e.clientY);
      else throttledMove(e.clientX, e.clientY);
    };

    const onUp = (e: PointerEvent): void => {
      // A frame queued behind the release would write a gesture back onto a
      // state machine that has already committed and cleared.
      cancelThrottledRAF(throttledMove);
      const g = gestureRef.current;
      updateGesture(null);
      if (g) commit(g, e);
    };

    const onCancel = (): void => {
      cancelThrottledRAF(throttledMove);
      updateGesture(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      cancelThrottledRAF(throttledMove);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [hasGesture, cellAt, commit, isOverStash, isInsideCanvas, updateGesture]);

  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent): void => {
      if (e.button !== 0) return;
      const { config, onSelect } = ctxRef.current;
      const cell = cellAt(e.clientX, e.clientY);
      const id = config.cells[cell.row * config.cols + cell.col];
      e.preventDefault();
      if (drawnIds.has(id)) {
        // Shift-click grows the selection into the compartment under the
        // cursor instead of moving it: the gesture for an L, S, T or U.
        const { selectedId, actions, onInvalidMerge } = ctxRef.current;
        if (e.shiftKey && selectedId !== null && selectedId !== id) {
          const merged = actions.merge([selectedId, id]);
          if (merged === null) onInvalidMerge?.();
          else onSelect(merged);
          return;
        }
        onSelect(id);
        const rect = getCompartmentRect(config, id);
        if (!rect) return;
        updateGesture({
          type: 'move',
          id,
          startRect: rect,
          grab: { col: cell.col - rect.col, row: cell.row - rect.row },
          currentRect: rect,
          duplicate: e.altKey,
          overStash: false,
          moved: false,
        });
        return;
      }
      onSelect(null);
      updateGesture({ type: 'draw', anchor: cell, cursor: cell });
    },
    [cellAt, drawnIds, updateGesture]
  );

  const onCanvasDoubleClick = useCallback(
    (e: React.MouseEvent): void => {
      const { config, onRequestLabelEdit } = ctxRef.current;
      const cell = cellAt(e.clientX, e.clientY);
      const id = config.cells[cell.row * config.cols + cell.col];
      if (drawnIds.has(id)) onRequestLabelEdit(id);
    },
    [cellAt, drawnIds]
  );

  const onResizeHandlePointerDown = useCallback(
    (id: number, handle: ResizeHandleId, e: React.PointerEvent): void => {
      if (e.button !== 0) return;
      const rect = getCompartmentRect(ctxRef.current.config, id);
      if (!rect) return;
      e.preventDefault();
      e.stopPropagation();
      updateGesture({ type: 'resize', id, handle, startRect: rect, currentRect: rect });
    },
    [updateGesture]
  );

  const onStashEntryPointerDown = useCallback(
    (index: number, e: React.PointerEvent): void => {
      if (e.button !== 0) return;
      const entry = ctxRef.current.config.stash?.[index];
      if (!entry) return;
      e.preventDefault();
      updateGesture({
        type: 'stashDrag',
        index,
        entry,
        grab: grabCellOnTile(e, entry),
        origin: { x: e.clientX, y: e.clientY },
        armed: false,
        currentRect: null,
      });
    },
    [updateGesture]
  );

  /** Abandon the in-flight gesture. Returns whether there was one — the
   *  workspace's Escape handler unwinds gesture → selection → close on that. */
  const cancel = useCallback((): boolean => {
    const hadGesture = gestureRef.current !== null;
    updateGesture(null);
    return hadGesture;
  }, [updateGesture]);

  return {
    gesture,
    ghost,
    drawnIds,
    worldAt,
    onCanvasPointerDown,
    onCanvasDoubleClick,
    onResizeHandlePointerDown,
    onStashEntryPointerDown,
    cancel,
  };
}

export type BentoInteractionApi = ReturnType<typeof useBentoInteraction>;
