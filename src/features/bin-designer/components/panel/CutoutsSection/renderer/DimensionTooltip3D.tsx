/**
 * WebGL dimension tooltip using drei <Html>.
 *
 * Positioned at a world-space point, renders existing Tailwind styling.
 * Shows W×D during resize and X,Y during drag.
 */

import { Html } from '@react-three/drei';

interface DimensionTooltip3DProps {
  /** What to display */
  readonly type: 'resize' | 'drag';
  /** Current width in mm (for resize) */
  readonly width?: number;
  /** Current depth in mm (for resize) */
  readonly depth?: number;
  /** Current X in mm (for drag) */
  readonly x?: number;
  /** Current Y in mm (for drag) */
  readonly y?: number;
  /** World-space position to anchor the tooltip */
  readonly worldX: number;
  readonly worldY: number;
}

export function DimensionTooltip3D({
  type,
  width,
  depth,
  x,
  y,
  worldX,
  worldY,
}: DimensionTooltip3DProps) {
  const text =
    type === 'resize'
      ? `${width?.toFixed(1)} \u00D7 ${depth?.toFixed(1)}`
      : `${x?.toFixed(1)}, ${y?.toFixed(1)}`;

  return (
    <Html position={[worldX, worldY, 0.1]} style={{ pointerEvents: 'none' }} center={false}>
      <div
        className="rounded border border-stroke-subtle bg-surface-elevated px-2 py-0.5 text-[10px] font-mono text-content whitespace-nowrap shadow-sm"
        style={{ transform: 'translate(5px, -28px)' }}
      >
        {text}
      </div>
    </Html>
  );
}
