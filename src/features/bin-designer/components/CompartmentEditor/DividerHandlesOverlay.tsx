/**
 * Visual layer for the divider drag handles. Renders on top of the cell
 * grid AND on top of `GhostPreview` (CompartmentEditor renders this
 * sibling last) so the handles + ghost line + mm chip are never occluded
 * by the cell-selection overlay.
 *
 * Positioned with `inset-0` (not `inset-2`) so the handle coordinate
 * space matches the GridCell flex container's coordinate space — Greptile
 * flagged the prior `inset-2` mismatch on #1835. Pair with `canvasRef`
 * pointing at that same flex container in `useDividerHandles`.
 *
 * Renders:
 *  - One subtle dot per handle position (4 px resting, 8 px on hover).
 *  - A ghost line for the actively-dragged divider, recolored red when the
 *    drag is over an invalid commit position.
 *  - A small floating mm chip near the cursor during drag.
 *
 * Logic / pointer events live in `useDividerHandles`; this is render-only.
 */

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import type { DividerHandle, DividerDragState } from './useDividerHandles';

// Tailwind class fragments referenced from JSX. Hoisting them out of the
// conditional in JSX silences the i18next/no-literal-string lint rule
// (which flags every inline string literal) while keeping the runtime
// styling identical.
const TONE_INVALID = 'bg-state-danger';
const TONE_VALID = 'bg-accent';
const CHIP_INVALID = 'bg-state-danger text-on-accent';
const CHIP_VALID = 'bg-accent text-on-accent';

interface Props {
  readonly handles: readonly DividerHandle[];
  readonly drag: DividerDragState | null;
  readonly innerW: number;
  readonly innerD: number;
  readonly onHandlePointerDown: (handle: DividerHandle) => (e: React.PointerEvent) => void;
}

export function DividerHandlesOverlay({
  handles,
  drag,
  innerW,
  innerD,
  onHandlePointerDown,
}: Props) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const t = useTranslation();
  if (handles.length === 0) return null;
  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        {/* Ghost line for active drag — drawn before handles so the dots
            sit on top of the line. */}
        {drag && <DragGhostLine handles={handles} drag={drag} innerW={innerW} innerD={innerD} />}
        {handles.map((h) => {
          const key = handleKey(h);
          const isHovered = hoveredKey === key;
          const isDragged = matchesDrag(h, drag);
          const { visualX, visualY } =
            isDragged && drag ? previewPosition(h, drag, innerW, innerD) : h;
          const size = isHovered || isDragged ? 8 : 4;
          const tone = isDragged && drag && !drag.isValid ? TONE_INVALID : TONE_VALID;
          return (
            <button
              key={key}
              type="button"
              onPointerDown={onHandlePointerDown(h)}
              onPointerEnter={() => setHoveredKey(key)}
              onPointerLeave={() => setHoveredKey((k) => (k === key ? null : k))}
              aria-label={t(`binDesigner.angledDividers.handleAriaLabel.${h.which}`, {
                a: String(h.divider.compartmentA + 1),
                b: String(h.divider.compartmentB + 1),
              })}
              className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface transition-all ${tone}`}
              style={{
                left: `${clamp01(visualX) * 100}%`,
                top: `${clamp01(visualY) * 100}%`,
                width: `${size}px`,
                height: `${size}px`,
                // Tap target is always 16 px on touch; visual dot stays small.
                // `touch-action: none` blocks the OS from interpreting drag
                // gestures as page scroll/zoom — required since the React
                // pointer-down handler can't reliably preventDefault on
                // passive touch events.
                boxSizing: 'content-box',
                padding: '4px',
                margin: '-4px',
                touchAction: 'none',
              }}
            />
          );
        })}
      </div>
      {drag && <DragMmChip drag={drag} />}
    </>
  );
}

function DragGhostLine({
  handles,
  drag,
  innerW,
  innerD,
}: {
  handles: readonly DividerHandle[];
  drag: DividerDragState;
  innerW: number;
  innerD: number;
}) {
  const startHandle = handles.find(
    (h) =>
      h.divider.compartmentA === drag.divider.compartmentA &&
      h.divider.compartmentB === drag.divider.compartmentB &&
      h.which === 'start'
  );
  const endHandle = handles.find(
    (h) =>
      h.divider.compartmentA === drag.divider.compartmentA &&
      h.divider.compartmentB === drag.divider.compartmentB &&
      h.which === 'end'
  );
  if (!startHandle || !endHandle) return null;
  const startPos =
    drag.which === 'start' ? previewPosition(startHandle, drag, innerW, innerD) : startHandle;
  const endPos =
    drag.which === 'end' ? previewPosition(endHandle, drag, innerW, innerD) : endHandle;
  const stroke = drag.isValid ? 'rgb(var(--color-accent))' : 'rgb(var(--color-state-danger))';
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <line
        x1={clamp01(startPos.visualX) * 100}
        y1={clamp01(startPos.visualY) * 100}
        x2={clamp01(endPos.visualX) * 100}
        y2={clamp01(endPos.visualY) * 100}
        stroke={stroke}
        strokeWidth={1}
        strokeDasharray="2 1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function DragMmChip({ drag }: { drag: DividerDragState }) {
  const sign = drag.previewOffsetMm > 0 ? '+' : '';
  const decimals = drag.snapMm < 1 ? 1 : 0;
  return (
    <div
      // Fixed positioning so the chip follows the cursor across the
      // viewport, not bounded by the canvas container.
      className={`pointer-events-none fixed z-50 rounded px-1.5 py-0.5 font-mono text-xs ${
        drag.isValid ? CHIP_VALID : CHIP_INVALID
      }`}
      style={{
        left: `${drag.cursorX + 12}px`,
        top: `${drag.cursorY + 12}px`,
      }}
    >
      {`${sign}${drag.previewOffsetMm.toFixed(decimals)} mm`}
    </div>
  );
}

/**
 * Compute where a handle should appear during a drag — accounts for the
 * delta between the stored `currentOffsetMm` and the in-flight
 * `previewOffsetMm`. Vertical dividers shift along X (canvas X axis maps
 * to innerW); horizontal dividers shift along Y (with the flex-col-reverse
 * flip — a positive data offset means LOWER visual Y).
 */
function previewPosition(
  handle: DividerHandle,
  drag: DividerDragState,
  innerW: number,
  innerD: number
): { visualX: number; visualY: number } {
  if (!matchesDrag(handle, drag)) {
    return { visualX: handle.visualX, visualY: handle.visualY };
  }
  const deltaMm = drag.previewOffsetMm - handle.currentOffsetMm;
  if (handle.divider.axis === 'vertical') {
    return {
      visualX: handle.visualX + deltaMm / innerW,
      visualY: handle.visualY,
    };
  }
  // Horizontal divider: data +Y → visual -Y (flex-col-reverse).
  return {
    visualX: handle.visualX,
    visualY: handle.visualY - deltaMm / innerD,
  };
}

function matchesDrag(handle: DividerHandle, drag: DividerDragState | null): boolean {
  if (!drag) return false;
  return (
    drag.divider.compartmentA === handle.divider.compartmentA &&
    drag.divider.compartmentB === handle.divider.compartmentB &&
    drag.which === handle.which
  );
}

function handleKey(h: DividerHandle): string {
  return `${h.divider.compartmentA}-${h.divider.compartmentB}-${h.which}`;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
