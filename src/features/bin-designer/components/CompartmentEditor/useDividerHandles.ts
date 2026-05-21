/**
 * Drag-handle state machine for tilting compartment dividers in the
 * compartment-editor canvas. Pairs with `DividerHandlesOverlay` (visual).
 *
 * Scope (v1): only renders for **linear grids** (cols === 1 OR rows === 1)
 * where every interior divider spans wall-to-wall. Multi-divider grids
 * (e.g. 2×2 with partial-width dividers) keep panel-only editing for now;
 * the divider-segment endpoint math is more involved and ships in a
 * follow-up.
 *
 * Drag UX:
 *  - Default snap: 5 mm increments (intuitive for users thinking in mm).
 *  - Alt or Shift held: free 1 mm increments.
 *  - Live validation: handle/line render red when the would-be commit is
 *    invalid; pointer-up on an invalid position snaps back (no commit).
 *  - Pointer-up commits once via `setDividerOverride` — one undo step
 *    per drag, not one per pointer move.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLabsStore } from '@/core/store/labs';
import {
  getEligibleDividers,
  validateDividerOverride,
  type EligibleDivider,
} from '@/features/bin-designer/utils/compartments';
import type { CompartmentConfig } from '@/features/bin-designer/types';

export const DRAG_SNAP_DEFAULT_MM = 5;
export const DRAG_SNAP_FREE_MM = 1;

/** One draggable endpoint on the canvas. */
export interface DividerHandle {
  readonly divider: EligibleDivider;
  readonly which: 'start' | 'end';
  /** Resting position in the canvas's 0..1 coordinate space, expressed in
   *  visual-frame coordinates (flex-col-reverse already applied — Y=1 is
   *  the BOTTOM of the canvas, which corresponds to data row 0 / front). */
  readonly visualX: number;
  readonly visualY: number;
  /** Current applied offset in mm (zero when no override exists). */
  readonly currentOffsetMm: number;
}

/** Active drag, while the user is moving a handle. */
export interface DividerDragState {
  readonly divider: EligibleDivider;
  readonly which: 'start' | 'end';
  /** mm offset the handle is currently being dragged to (pre-commit). */
  readonly previewOffsetMm: number;
  /** Snapping mode active for this drag. */
  readonly snapMm: number;
  /** Validation status of the would-be commit. False = render red, snap
   *  back on pointer-up. */
  readonly isValid: boolean;
  /** Cursor position in the page (for the mm chip overlay). */
  readonly cursorX: number;
  readonly cursorY: number;
}

interface UseDividerHandlesOptions {
  readonly compartments: CompartmentConfig;
  readonly innerW: number;
  readonly innerD: number;
  readonly canvasRef: React.RefObject<HTMLElement | null>;
}

interface UseDividerHandlesResult {
  /** All eligible handles. Empty when feature is unavailable (labs flag off,
   *  non-linear grid, or no interior dividers). */
  readonly handles: readonly DividerHandle[];
  /** Active drag state; null when idle. Drives the live-preview overlay
   *  and the mm chip. */
  readonly drag: DividerDragState | null;
  readonly onHandlePointerDown: (handle: DividerHandle) => (e: React.PointerEvent) => void;
}

export function useDividerHandles(opts: UseDividerHandlesOptions): UseDividerHandlesResult {
  const { compartments, innerW, innerD, canvasRef } = opts;
  const flagEnabled = useLabsStore((s) => s.isFeatureEnabled('angled_dividers'));
  const { setDividerOverride } = useDesignerStore(
    useShallow((s) => ({ setDividerOverride: s.setDividerOverride }))
  );
  const [drag, setDrag] = useState<DividerDragState | null>(null);
  // Pointer-down captured the initial offset and pointer position so move
  // events can compute a delta without re-reading the (possibly mutated)
  // override value.
  const dragOriginRef = useRef<{
    startClientX: number;
    startClientY: number;
    originalOffsetMm: number;
  } | null>(null);

  // v1 restriction: only render handles when the bin is a 1×N or N×1 grid,
  // so every interior divider spans wall-to-wall. Multi-divider grids
  // (2×2 etc.) keep panel-only editing for now.
  const isLinearGrid = compartments.cols === 1 || compartments.rows === 1;
  const handlesEnabled = flagEnabled && isLinearGrid;

  const handles = useMemo<readonly DividerHandle[]>(() => {
    if (!handlesEnabled) return [];
    return computeHandlesForLinearGrid(compartments, innerW, innerD);
  }, [handlesEnabled, compartments, innerW, innerD]);

  const onHandlePointerDown = useCallback(
    (handle: DividerHandle) =>
      (e: React.PointerEvent): void => {
        // Don't let the underlying GridCell selection capture the same press.
        e.stopPropagation();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        dragOriginRef.current = {
          startClientX: e.clientX,
          startClientY: e.clientY,
          originalOffsetMm: handle.currentOffsetMm,
        };
        setDrag({
          divider: handle.divider,
          which: handle.which,
          previewOffsetMm: handle.currentOffsetMm,
          snapMm: e.altKey || e.shiftKey ? DRAG_SNAP_FREE_MM : DRAG_SNAP_DEFAULT_MM,
          isValid: true,
          cursorX: e.clientX,
          cursorY: e.clientY,
        });

        const handleMove = (move: PointerEvent): void => {
          const origin = dragOriginRef.current;
          const canvas = canvasRef.current;
          if (!origin || !canvas) return;
          const rect = canvas.getBoundingClientRect();
          // Drag axis: vertical dividers offset along ±X; horizontal along ±Y.
          // The visual Y axis is flipped by flex-col-reverse — a *visual*
          // upward drag (negative client delta) corresponds to a +Y data
          // shift. We undo the flip here so positive offsets mean +data-Y.
          const deltaPxX = move.clientX - origin.startClientX;
          const deltaPxY = -(move.clientY - origin.startClientY);
          const deltaMm =
            handle.divider.axis === 'vertical'
              ? (deltaPxX / Math.max(1, rect.width)) * innerW
              : (deltaPxY / Math.max(1, rect.height)) * innerD;
          const snapMm = move.altKey || move.shiftKey ? DRAG_SNAP_FREE_MM : DRAG_SNAP_DEFAULT_MM;
          const rawMm = origin.originalOffsetMm + deltaMm;
          const previewOffsetMm = Math.round(rawMm / snapMm) * snapMm;
          const candidate = buildCandidateOverride(handle, previewOffsetMm);
          const isValid = candidate
            ? validateDividerOverride(compartments, candidate) === null
            : false;
          setDrag({
            divider: handle.divider,
            which: handle.which,
            previewOffsetMm,
            snapMm,
            isValid,
            cursorX: move.clientX,
            cursorY: move.clientY,
          });
        };

        const handleUp = (up: PointerEvent): void => {
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', handleUp);
          window.removeEventListener('pointercancel', handleUp);
          const origin = dragOriginRef.current;
          dragOriginRef.current = null;
          if (!origin) {
            setDrag(null);
            return;
          }
          // Re-derive the final offset from the up-event so a pointer
          // released between move ticks still commits the right value.
          const canvas = canvasRef.current;
          if (!canvas) {
            setDrag(null);
            return;
          }
          const rect = canvas.getBoundingClientRect();
          const deltaPxX = up.clientX - origin.startClientX;
          const deltaPxY = -(up.clientY - origin.startClientY);
          const deltaMm =
            handle.divider.axis === 'vertical'
              ? (deltaPxX / Math.max(1, rect.width)) * innerW
              : (deltaPxY / Math.max(1, rect.height)) * innerD;
          const snapMm = up.altKey || up.shiftKey ? DRAG_SNAP_FREE_MM : DRAG_SNAP_DEFAULT_MM;
          const rawMm = origin.originalOffsetMm + deltaMm;
          const finalOffsetMm = Math.round(rawMm / snapMm) * snapMm;
          const candidate = buildCandidateOverride(handle, finalOffsetMm);
          if (candidate && validateDividerOverride(compartments, candidate) === null) {
            setDividerOverride(
              candidate.compartmentA,
              candidate.compartmentB,
              candidate.offsetStart,
              candidate.offsetEnd
            );
          }
          // Either way the drag is over; the snap-back to the previous
          // valid state is implicit because we never committed an invalid
          // value to the store.
          setDrag(null);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('pointercancel', handleUp);
      },
    [canvasRef, compartments, innerW, innerD, setDividerOverride]
  );

  return { handles, drag, onHandlePointerDown };
}

/**
 * Compute handle positions for the linear-grid case (cols === 1 OR
 * rows === 1). Each interior divider has two handles, one at each bin wall.
 * Returns in visual-frame coordinates (flex-col-reverse applied).
 */
function computeHandlesForLinearGrid(
  config: CompartmentConfig,
  innerW: number,
  innerD: number
): DividerHandle[] {
  const out: DividerHandle[] = [];
  const eligible = getEligibleDividers(config);
  for (const divider of eligible) {
    if (divider.axis === 'horizontal') {
      // Horizontal divider in a 1×N grid: spans full width at some Y.
      // Find Y from the row boundary between compartmentA and compartmentB.
      const yMm = horizontalDividerYMm(config, divider, innerD);
      if (yMm === null) continue;
      const startYVisual = 1 - (yMm + divider.offsetStart) / innerD;
      const endYVisual = 1 - (yMm + divider.offsetEnd) / innerD;
      out.push(
        {
          divider,
          which: 'start',
          visualX: 0,
          visualY: startYVisual,
          currentOffsetMm: divider.offsetStart,
        },
        {
          divider,
          which: 'end',
          visualX: 1,
          visualY: endYVisual,
          currentOffsetMm: divider.offsetEnd,
        }
      );
    } else {
      // Vertical divider in an N×1 grid: spans full depth at some X.
      const xMm = verticalDividerXMm(config, divider, innerW);
      if (xMm === null) continue;
      const startXVisual = (xMm + divider.offsetStart) / innerW;
      const endXVisual = (xMm + divider.offsetEnd) / innerW;
      out.push(
        {
          divider,
          which: 'start',
          visualX: startXVisual,
          // Start = front = data Y=0 = visual Y=1 (bottom of canvas).
          visualY: 1,
          currentOffsetMm: divider.offsetStart,
        },
        {
          divider,
          which: 'end',
          visualX: endXVisual,
          // End = back = data Y=innerD = visual Y=0 (top of canvas).
          visualY: 0,
          currentOffsetMm: divider.offsetEnd,
        }
      );
    }
  }
  return out;
}

function horizontalDividerYMm(
  config: CompartmentConfig,
  divider: EligibleDivider,
  innerD: number
): number | null {
  // For a 1-col linear grid, compartments are stacked along Y. The Y of
  // the boundary between compartmentA and compartmentB sits at the row
  // boundary just above the lower compartment.
  const { cells, cols, rows } = config;
  for (let row = 0; row < rows - 1; row++) {
    const a = cells[row * cols];
    const b = cells[(row + 1) * cols];
    if (
      (a === divider.compartmentA && b === divider.compartmentB) ||
      (a === divider.compartmentB && b === divider.compartmentA)
    ) {
      return ((row + 1) / rows) * innerD;
    }
  }
  return null;
}

function verticalDividerXMm(
  config: CompartmentConfig,
  divider: EligibleDivider,
  innerW: number
): number | null {
  const { cells, cols } = config;
  for (let col = 0; col < cols - 1; col++) {
    const a = cells[col];
    const b = cells[col + 1];
    if (
      (a === divider.compartmentA && b === divider.compartmentB) ||
      (a === divider.compartmentB && b === divider.compartmentA)
    ) {
      return ((col + 1) / cols) * innerW;
    }
  }
  return null;
}

function buildCandidateOverride(
  handle: DividerHandle,
  newOffsetMm: number
): {
  compartmentA: number;
  compartmentB: number;
  offsetStart: number;
  offsetEnd: number;
} | null {
  const { divider, which } = handle;
  const offsetStart = which === 'start' ? newOffsetMm : divider.offsetStart;
  const offsetEnd = which === 'end' ? newOffsetMm : divider.offsetEnd;
  return {
    compartmentA: divider.compartmentA,
    compartmentB: divider.compartmentB,
    offsetStart,
    offsetEnd,
  };
}
