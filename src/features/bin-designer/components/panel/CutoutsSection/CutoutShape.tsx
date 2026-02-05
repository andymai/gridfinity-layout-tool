/**
 * SVG shape renderer for a single cutout.
 *
 * Renders rectangle (with optional cornerRadius) or circle shapes
 * with selection highlight, click handling, and drag support.
 */

import { useMemo } from 'react';
import type { Cutout } from '@/features/bin-designer/types';

interface CutoutShapeProps {
  readonly cutout: Cutout;
  readonly scale: number;
  readonly binDepth: number;
  readonly isSelected: boolean;
  readonly isGrouped: boolean;
  readonly isDragging: boolean;
  readonly previewOverrides?: Partial<Cutout>;
  readonly onSelect: (id: string, additive: boolean) => void;
  readonly onDoubleClick?: (id: string) => void;
  readonly onDragStart?: (id: string, mmX: number, mmY: number) => void;
}

export function CutoutShape({
  cutout,
  scale,
  binDepth,
  isSelected,
  isGrouped,
  isDragging,
  previewOverrides,
  onSelect,
  onDoubleClick,
  onDragStart,
}: CutoutShapeProps) {
  // Merge preview overrides for live visual feedback during drag/resize
  const effective = useMemo(
    () => (previewOverrides ? { ...cutout, ...previewOverrides } : cutout),
    [cutout, previewOverrides]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const additive = e.shiftKey;
    onSelect(cutout.id, additive);

    if (onDragStart && !additive) {
      // Convert pointer to mm coordinates for drag start
      const svg = (e.target as SVGElement).closest('svg');
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const svgX = e.clientX - rect.left;
        const svgY = e.clientY - rect.top;
        const mmX = svgX / scale;
        const mmY = binDepth - svgY / scale;
        onDragStart(cutout.id, mmX, mmY);
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(cutout.id);
  };

  const cursor = isSelected ? 'grab' : 'pointer';
  const opacity = isDragging ? 0.5 : isSelected ? 0.3 : 0.15;

  if (effective.shape === 'circle') {
    const rx = (effective.width / 2) * scale;
    const ry = (effective.depth / 2) * scale;
    const cx = (effective.x + effective.width / 2) * scale;
    // SVG Y is inverted (top-down) vs bin coords (bottom-up)
    const cy = (binDepth - effective.y - effective.depth / 2) * scale;
    const rotation = effective.rotation;

    return (
      <g transform={rotation !== 0 ? `rotate(${-rotation} ${cx} ${cy})` : undefined}>
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="var(--color-accent)"
          fillOpacity={opacity}
          stroke={isSelected ? 'var(--color-accent)' : 'var(--color-stroke-subtle)'}
          strokeWidth={1.5}
          strokeDasharray={isGrouped ? '4 2' : undefined}
          style={{ cursor }}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
        />
      </g>
    );
  }

  // Rectangle
  const px = effective.x * scale;
  const py = (binDepth - effective.y - effective.depth) * scale;
  const pw = effective.width * scale;
  const ph = effective.depth * scale;
  const cr = effective.cornerRadius * scale;

  // Apply rotation around center (SVG Y is inverted from model Y)
  const rotation = effective.rotation;
  const cx = (effective.x + effective.width / 2) * scale;
  const cy = (binDepth - effective.y - effective.depth / 2) * scale;

  return (
    <g transform={rotation !== 0 ? `rotate(${-rotation} ${cx} ${cy})` : undefined}>
      <rect
        x={px}
        y={py}
        width={pw}
        height={ph}
        rx={cr}
        ry={cr}
        fill="var(--color-accent)"
        fillOpacity={opacity}
        stroke={isSelected ? 'var(--color-accent)' : 'var(--color-stroke-subtle)'}
        strokeWidth={1.5}
        strokeDasharray={isGrouped ? '4 2' : undefined}
        style={{ cursor }}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      />
    </g>
  );
}
