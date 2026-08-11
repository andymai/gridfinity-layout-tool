/**
 * Drag a compartment wall directly on the workspace canvas.
 *
 * Builds on the divider machinery the panel inspector already uses rather than
 * a second implementation: `getDividerGeometry` supplies the offset envelope
 * (already clamped so no compartment falls under MIN_COMPARTMENT_SIZE),
 * `previewTilt` paints the in-flight position through `ui.dividerTiltPreview`
 * (transient, never in undo), and `commitTilt` writes the real
 * `DividerOverride` once on pointer release — so a drag costs one history entry,
 * not one per pointermove.
 *
 * A drag only ever changes `shiftMm`. Any tilt the divider already carries is
 * passed through untouched, so dragging a tilted wall slides it without
 * straightening it.
 *
 * Two sign conventions have to hold together, and both are easy to get
 * backwards in a way that only shows on one axis:
 *  - a positive offset moves a VERTICAL divider toward +X and a HORIZONTAL one
 *    toward +Y (see `getDividerGeometry`);
 *  - the grid draws bottom-up (`flex-col-reverse`, row 0 = front), so pointer
 *    Y runs opposite to bin Y and the vertical delta must be negated.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SHIFT_UI_STEP_MM } from '@/features/bin-designer/utils/dividerAngle';
import type { TiltRow } from '../CompartmentEditor/useDividerTiltSubsection';

/**
 * Free dragging snaps to this many mm. Matches the inspector's stepper, so a
 * wall dragged to 4.5mm reads as 4.5 in the panel rather than 4.4713.
 */
const DRAG_SNAP_MM = SHIFT_UI_STEP_MM;

/**
 * Within this distance of the cell boundary the wall returns to it exactly.
 * Without a magnet, "put it back where it was" is unreachable by hand and the
 * design keeps a 0.5mm override that reads as a mistake.
 */
const BOUNDARY_MAGNET_MM = 1.5;

export interface DividerDragHandlers {
  /** Key of the divider currently being dragged, or null. */
  readonly draggingKey: string | null;
  readonly onDragStart: (row: TiltRow, event: React.PointerEvent) => void;
}

interface DragState {
  readonly row: TiltRow;
  readonly originX: number;
  readonly originY: number;
  readonly startShiftMm: number;
}

export function snapShift(rawMm: number, freeDrag: boolean): number {
  if (Math.abs(rawMm) <= BOUNDARY_MAGNET_MM) return 0;
  if (freeDrag) return Math.round(rawMm * 100) / 100;
  return Math.round(rawMm / DRAG_SNAP_MM) * DRAG_SNAP_MM;
}

export function useDividerDrag(
  scaleX: number,
  scaleY: number,
  previewTilt: (row: TiltRow, next: { angleDeg: number; shiftMm: number }) => void,
  commitTilt: (
    row: TiltRow,
    next: { angleDeg: number; shiftMm: number },
    source?: 'panel_input' | 'canvas_drag'
  ) => void
): DividerDragHandlers {
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Latest callbacks without re-subscribing the window listeners mid-drag:
  // re-running the effect would tear down the listeners between pointermoves.
  const previewRef = useRef(previewTilt);
  const commitRef = useRef(commitTilt);
  useEffect(() => {
    previewRef.current = previewTilt;
    commitRef.current = commitTilt;
  }, [previewTilt, commitTilt]);

  const shiftFor = useCallback(
    (e: PointerEvent, drag: DragState): number => {
      const isVertical = drag.row.axis === 'vertical';
      const scale = isVertical ? scaleX : scaleY;
      if (scale <= 0) return drag.startShiftMm;

      // Pointer Y is inverted relative to bin Y (grid renders bottom-up).
      const deltaPx = isVertical ? e.clientX - drag.originX : -(e.clientY - drag.originY);
      const raw = drag.startShiftMm + deltaPx / scale;
      return snapShift(raw, e.altKey);
    },
    [scaleX, scaleY]
  );

  useEffect(() => {
    if (!draggingKey) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      previewRef.current(drag.row, {
        angleDeg: drag.row.angleDeg,
        shiftMm: shiftFor(e, drag),
      });
    };

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDraggingKey(null);
      if (!drag) return;
      commitRef.current(
        drag.row,
        { angleDeg: drag.row.angleDeg, shiftMm: shiftFor(e, drag) },
        'canvas_drag'
      );
    };

    // Listen on window, not the handle: a fast drag outruns the pointer and
    // would otherwise strand the wall mid-move with the preview still painted.
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [draggingKey, shiftFor]);

  const onDragStart = useCallback((row: TiltRow, event: React.PointerEvent) => {
    if (!row.geometry) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      row,
      originX: event.clientX,
      originY: event.clientY,
      startShiftMm: row.shiftMm,
    };
    setDraggingKey(row.key);
  }, []);

  return { draggingKey, onDragStart };
}
