/**
 * Dashed rectangle overlay for drag-to-select (marquee selection).
 */

interface MarqueeBoxProps {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function MarqueeBox({ x, y, width, height }: MarqueeBoxProps) {
  return (
    <rect
      x={Math.min(x, x + width)}
      y={Math.min(y, y + height)}
      width={Math.abs(width)}
      height={Math.abs(height)}
      fill="var(--color-accent)"
      fillOpacity={0.1}
      stroke="var(--color-accent)"
      strokeWidth={1}
      strokeDasharray="4 2"
      pointerEvents="none"
    />
  );
}
