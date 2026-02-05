/**
 * SVG rotation handle for cutout editor.
 *
 * Renders a small circle handle above the cutout center, connected by a line.
 * Dragging the handle rotates the cutout around its center.
 */

import type { Cutout } from '@/features/bin-designer/types';

interface RotationHandleProps {
  readonly cutout: Cutout;
  readonly scale: number;
  readonly binDepth: number;
  readonly onRotateStart: (id: string, startAngle: number) => void;
}

/** Handle positioned 15px above cutout top edge */
const HANDLE_OFFSET_PX = 15;

export function RotationHandle({ cutout, scale, binDepth, onRotateStart }: RotationHandleProps) {
  // Cutout center in mm (model coordinates)
  const centerMmX = cutout.x + cutout.width / 2;
  const centerMmY = cutout.y + cutout.depth / 2;

  // Convert to SVG pixels (Y is inverted)
  const centerSvgX = centerMmX * scale;
  const centerSvgY = (binDepth - centerMmY) * scale;

  // Handle positioned above the cutout (lower Y in SVG = higher on screen)
  const handleX = centerSvgX;
  const handleY = centerSvgY - (cutout.depth * scale) / 2 - HANDLE_OFFSET_PX;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();

    // Compute starting angle from center to handle
    const svg = (e.target as SVGElement).closest('svg');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const pointerSvgX = e.clientX - rect.left;
    const pointerSvgY = e.clientY - rect.top;

    // Convert to model coordinates
    const pointerMmX = pointerSvgX / scale;
    const pointerMmY = binDepth - pointerSvgY / scale;

    // Compute angle from center to pointer
    const dx = pointerMmX - centerMmX;
    const dy = pointerMmY - centerMmY;
    const startAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    onRotateStart(cutout.id, startAngle);
  };

  return (
    <g>
      {/* Connector line from center to handle */}
      <line
        x1={centerSvgX}
        y1={centerSvgY}
        x2={handleX}
        y2={handleY}
        stroke="var(--color-accent)"
        strokeWidth={1}
        opacity={0.5}
      />

      {/* Handle circle */}
      <circle
        cx={handleX}
        cy={handleY}
        r={4}
        fill="var(--color-accent)"
        stroke="white"
        strokeWidth={1.5}
        style={{ cursor: 'grab' }}
        onPointerDown={handlePointerDown}
      />
    </g>
  );
}
