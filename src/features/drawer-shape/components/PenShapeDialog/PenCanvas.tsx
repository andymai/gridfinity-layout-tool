/**
 * The drawing surface of the pen editor: the drawer, the shape, its handles,
 * the alignment guides and the marquee.
 *
 * Pure presentation — every gesture is handled by the parent, which owns the
 * sketch and the view. Split out so the dialog stays inside the file line cap
 * now that it carries history, keyboard editing, a view and a selection model.
 */

import type {
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  FocusEvent as ReactFocusEvent,
} from 'react';
import type { RefObject } from 'react';
import type { OutlineVertex } from '@/core/types';
import { segmentHandle } from '../../utils/penShape';

export interface PenCanvasProps {
  readonly svgRef: RefObject<SVGSVGElement | null>;
  readonly verts: readonly OutlineVertex[];
  readonly selected: ReadonlySet<number>;
  readonly pathD: string;
  readonly widthMm: number;
  readonly depthMm: number;
  readonly viewBox: string;
  readonly padMm: number;
  readonly handleR: number;
  readonly valid: boolean;
  readonly guides: { readonly x: number | null; readonly y: number | null };
  readonly marquee: { x0: number; y0: number; x1: number; y1: number } | null;
  readonly ariaLabel: string;
  readonly onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onPointerEnd: () => void;
  readonly onDoubleClick: (e: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onKeyDown: (e: ReactKeyboardEvent<SVGSVGElement>) => void;
  readonly onKeyUp: (e: ReactKeyboardEvent<SVGSVGElement>) => void;
  readonly onBlur: (e: ReactFocusEvent<SVGSVGElement>) => void;
  readonly onWheel: (e: React.WheelEvent<SVGSVGElement>) => void;
}

export function PenCanvas({
  svgRef,
  verts,
  selected,
  pathD,
  widthMm,
  depthMm,
  viewBox,
  padMm,
  handleR,
  valid,
  guides,
  marquee,
  ariaLabel,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onDoubleClick,
  onKeyDown,
  onKeyUp,
  onBlur,
  onWheel,
}: PenCanvasProps) {
  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className="h-auto w-full cursor-crosshair touch-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
      // Role before tabIndex: it declares what the element is before how it is
      // reached, which is also the order the a11y check reads the pair in.
      role="application"
      tabIndex={0}
      aria-label={ariaLabel}
    >
      {/* Y-up data in a Y-down viewport: flip once here so the canvas reads
          like the layout grid without touching stored coordinates. */}
      <g transform={`translate(${padMm} ${depthMm + padMm}) scale(1 -1)`}>
        <rect
          x={0}
          y={0}
          width={widthMm}
          height={depthMm}
          className="fill-surface stroke-stroke-subtle"
          strokeWidth={handleR / 3}
        />
        <path
          d={pathD}
          className={valid ? 'fill-accent/15 stroke-accent' : 'fill-error/10 stroke-error'}
          strokeWidth={handleR / 2}
          strokeLinejoin="round"
        />
        {guides.x !== null && (
          <line
            x1={guides.x}
            y1={0}
            x2={guides.x}
            y2={depthMm}
            className="stroke-accent/70"
            strokeWidth={handleR / 4}
            strokeDasharray={`${handleR} ${handleR}`}
          />
        )}
        {guides.y !== null && (
          <line
            x1={0}
            y1={guides.y}
            x2={widthMm}
            y2={guides.y}
            className="stroke-accent/70"
            strokeWidth={handleR / 4}
            strokeDasharray={`${handleR} ${handleR}`}
          />
        )}
        {marquee !== null && (
          <rect
            x={Math.min(marquee.x0, marquee.x1)}
            y={Math.min(marquee.y0, marquee.y1)}
            width={Math.abs(marquee.x1 - marquee.x0)}
            height={Math.abs(marquee.y1 - marquee.y0)}
            className="fill-accent/10 stroke-accent/60"
            strokeWidth={handleR / 4}
          />
        )}
        {verts.map((_, i) => {
          const h = segmentHandle(verts, i);
          return (
            <circle
              key={`seg-${i}`}
              cx={h.x}
              cy={h.y}
              r={handleR * 0.6}
              className="cursor-grab fill-surface-elevated stroke-content-tertiary"
              strokeWidth={handleR / 4}
            />
          );
        })}
        {verts.map((v, i) => (
          <circle
            key={`vert-${i}`}
            cx={v.x}
            cy={v.y}
            r={handleR}
            className={
              selected.has(i)
                ? 'cursor-move fill-accent stroke-accent'
                : 'cursor-move fill-surface stroke-accent'
            }
            strokeWidth={handleR / 3}
          />
        ))}
      </g>
    </svg>
  );
}
