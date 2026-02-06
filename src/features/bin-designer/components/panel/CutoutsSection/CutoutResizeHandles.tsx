/**
 * SVG resize handles rendered on a selected cutout.
 *
 * All shapes get 8 handles (4 corners + 4 edge midpoints).
 * Handles rotate with the cutout via a `<g transform>` wrapper.
 * Styling matches the grid planner ResizeHandle: amber fill, rounded
 * corners, drop-shadows, and scale transitions on hover/active.
 */

import { useState } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import type { ResizeHandle } from './useCutoutInteraction';
import { getResizeCursor } from './geometry';

interface CutoutResizeHandlesProps {
  readonly cutout: Cutout;
  readonly scale: number;
  readonly binDepth: number;
  readonly onResizeStart: (id: string, handle: ResizeHandle, mmX: number, mmY: number) => void;
}

/** Amber color matching grid planner selection ring */
const HANDLE_COLOR = '#fbbf24';
const CORNER_SIZE = 8;
const EDGE_SIZE = 6;
const CORNER_RADIUS = 2;

function isCorner(handle: ResizeHandle): boolean {
  return handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw';
}

interface HandleDef {
  readonly handle: ResizeHandle;
  readonly svgX: number;
  readonly svgY: number;
}

function getHandles(cutout: Cutout, scale: number, binDepth: number): HandleDef[] {
  const left = cutout.x * scale;
  const top = (binDepth - cutout.y - cutout.depth) * scale;
  const right = (cutout.x + cutout.width) * scale;
  const bottom = (binDepth - cutout.y) * scale;
  const midX = (left + right) / 2;
  const midY = (top + bottom) / 2;

  if (cutout.shape === 'circle') {
    return [
      { handle: 'n', svgX: midX, svgY: top },
      { handle: 'ne', svgX: right, svgY: top },
      { handle: 'e', svgX: right, svgY: midY },
      { handle: 'se', svgX: right, svgY: bottom },
      { handle: 's', svgX: midX, svgY: bottom },
      { handle: 'sw', svgX: left, svgY: bottom },
      { handle: 'w', svgX: left, svgY: midY },
      { handle: 'nw', svgX: left, svgY: top },
    ];
  }

  return [
    { handle: 'nw', svgX: left, svgY: top },
    { handle: 'n', svgX: midX, svgY: top },
    { handle: 'ne', svgX: right, svgY: top },
    { handle: 'e', svgX: right, svgY: midY },
    { handle: 'se', svgX: right, svgY: bottom },
    { handle: 's', svgX: midX, svgY: bottom },
    { handle: 'sw', svgX: left, svgY: bottom },
    { handle: 'w', svgX: left, svgY: midY },
  ];
}

function HandleRect({
  handle,
  svgX,
  svgY,
  cutoutId,
  scale,
  binDepth,
  onResizeStart,
}: {
  handle: ResizeHandle;
  svgX: number;
  svgY: number;
  cutoutId: string;
  scale: number;
  binDepth: number;
  onResizeStart: CutoutResizeHandlesProps['onResizeStart'];
}) {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const corner = isCorner(handle);
  const baseSize = corner ? CORNER_SIZE : EDGE_SIZE;

  // Compute effective size (scaled by hover/active state) keeping the handle centered
  const scaleFactor = active ? 1.3 : hovered ? 1.4 : 1;
  const size = baseSize * scaleFactor;
  const half = size / 2;

  const shadow = corner
    ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))'
    : 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))';

  return (
    <rect
      data-testid={`resize-handle-${handle}`}
      x={svgX - half}
      y={svgY - half}
      width={size}
      height={size}
      rx={CORNER_RADIUS}
      ry={CORNER_RADIUS}
      fill={HANDLE_COLOR}
      stroke="white"
      strokeWidth={1}
      style={{
        cursor: getResizeCursor(handle),
        filter: shadow,
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setActive(false);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        setActive(true);
        const mmX = svgX / scale;
        const mmY = binDepth - svgY / scale;
        onResizeStart(cutoutId, handle, mmX, mmY);
      }}
      onPointerUp={() => setActive(false)}
    />
  );
}

export function CutoutResizeHandles({
  cutout,
  scale,
  binDepth,
  onResizeStart,
}: CutoutResizeHandlesProps) {
  const handles = getHandles(cutout, scale, binDepth);
  const rotation = cutout.rotation;
  const cx = (cutout.x + cutout.width / 2) * scale;
  const cy = (binDepth - cutout.y - cutout.depth / 2) * scale;

  return (
    <g
      data-testid="resize-handles"
      transform={rotation !== 0 ? `rotate(${rotation} ${cx} ${cy})` : undefined}
    >
      {handles.map(({ handle, svgX, svgY }) => (
        <HandleRect
          key={handle}
          handle={handle}
          svgX={svgX}
          svgY={svgY}
          cutoutId={cutout.id}
          scale={scale}
          binDepth={binDepth}
          onResizeStart={onResizeStart}
        />
      ))}
    </g>
  );
}
