/**
 * SVG shape renderer for a single cutout.
 *
 * Renders rectangle (with optional cornerRadius) or circle shapes
 * with selection highlight and click handling.
 */

import type { Cutout } from '@/features/bin-designer/types';

interface CutoutShapeProps {
  readonly cutout: Cutout;
  readonly scale: number;
  readonly binDepth: number;
  readonly isSelected: boolean;
  readonly isGrouped: boolean;
  readonly onSelect: (id: string, additive: boolean) => void;
}

export function CutoutShape({
  cutout,
  scale,
  binDepth,
  isSelected,
  isGrouped,
  onSelect,
}: CutoutShapeProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(cutout.id, e.shiftKey);
  };

  if (cutout.shape === 'circle') {
    const diameter = cutout.width * scale;
    const cx = (cutout.x + cutout.width / 2) * scale;
    // SVG Y is inverted (top-down) vs bin coords (bottom-up)
    const cy = (binDepth - cutout.y - cutout.width / 2) * scale;

    return (
      <circle
        cx={cx}
        cy={cy}
        r={diameter / 2}
        fill="var(--color-accent)"
        fillOpacity={0.3}
        stroke={isSelected ? 'var(--color-accent)' : 'var(--color-stroke-subtle)'}
        strokeWidth={isSelected ? 2 : 1}
        strokeDasharray={isGrouped ? '4 2' : undefined}
        className="cursor-pointer"
        onPointerDown={handlePointerDown}
      />
    );
  }

  // Rectangle
  const px = cutout.x * scale;
  const py = (binDepth - cutout.y - cutout.depth) * scale;
  const pw = cutout.width * scale;
  const ph = cutout.depth * scale;
  const cr = cutout.cornerRadius * scale;

  return (
    <rect
      x={px}
      y={py}
      width={pw}
      height={ph}
      rx={cr}
      ry={cr}
      fill="var(--color-accent)"
      fillOpacity={0.3}
      stroke={isSelected ? 'var(--color-accent)' : 'var(--color-stroke-subtle)'}
      strokeWidth={isSelected ? 2 : 1}
      strokeDasharray={isGrouped ? '4 2' : undefined}
      className="cursor-pointer"
      onPointerDown={handlePointerDown}
    />
  );
}
