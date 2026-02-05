/**
 * SVG resize handles rendered on a selected cutout.
 *
 * All shapes get 8 handles (4 corners + 4 edge midpoints).
 * Handles rotate with the cutout via a `<g transform>` wrapper.
 */

import type { Cutout } from '@/features/bin-designer/types';
import type { ResizeHandle } from './useCutoutInteraction';
import { getResizeCursor } from './geometry';

interface CutoutResizeHandlesProps {
  readonly cutout: Cutout;
  readonly scale: number;
  readonly binDepth: number;
  readonly onResizeStart: (id: string, handle: ResizeHandle, mmX: number, mmY: number) => void;
}

const HANDLE_SIZE = 6;
const HALF = HANDLE_SIZE / 2;

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
    // Ellipse: handles at cardinal + intercardinal positions on bounding box
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

  // Rectangle: 4 corners + 4 edge midpoints
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
      transform={rotation !== 0 ? `rotate(${-rotation} ${cx} ${cy})` : undefined}
    >
      {handles.map(({ handle, svgX, svgY }) => (
        <rect
          key={handle}
          data-testid={`resize-handle-${handle}`}
          x={svgX - HALF}
          y={svgY - HALF}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="var(--color-accent)"
          stroke="white"
          strokeWidth={1}
          style={{ cursor: getResizeCursor(handle) }}
          onPointerDown={(e) => {
            e.stopPropagation();
            // Convert SVG px back to mm for the interaction hook
            const mmX = svgX / scale;
            const mmY = binDepth - svgY / scale;
            onResizeStart(cutout.id, handle, mmX, mmY);
          }}
        />
      ))}
    </g>
  );
}
