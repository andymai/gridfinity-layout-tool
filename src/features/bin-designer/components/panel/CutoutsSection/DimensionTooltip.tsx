/**
 * Displays live dimension information during drag and resize operations.
 *
 * Shows W×D during resize and X,Y during drag, positioned near the cursor.
 */

interface DimensionTooltipProps {
  /** What to display: 'resize' shows WxD, 'drag' shows X,Y position */
  readonly type: 'resize' | 'drag';
  /** Current width in mm (for resize) */
  readonly width?: number;
  /** Current depth in mm (for resize) */
  readonly depth?: number;
  /** Current X in mm (for drag) */
  readonly x?: number;
  /** Current Y in mm (for drag) */
  readonly y?: number;
  /** SVG X position for tooltip anchor */
  readonly svgX: number;
  /** SVG Y position for tooltip anchor */
  readonly svgY: number;
}

export function DimensionTooltip({ type, width, depth, x, y, svgX, svgY }: DimensionTooltipProps) {
  const text =
    type === 'resize'
      ? `${width?.toFixed(1)}×${depth?.toFixed(1)}`
      : `${x?.toFixed(1)}, ${y?.toFixed(1)}`;

  // Measure text to size background
  const charWidth = 6;
  const textWidth = text.length * charWidth;
  const rectWidth = textWidth + 8;
  const rectHeight = 18;

  // Position tooltip above and to the right of the anchor
  const tooltipX = svgX + 5;
  const tooltipY = svgY - 10 - rectHeight;

  return (
    <g>
      <rect
        x={tooltipX}
        y={tooltipY}
        width={rectWidth}
        height={rectHeight}
        fill="var(--color-surface-elevated)"
        stroke="var(--color-stroke-subtle)"
        strokeWidth={1}
        rx={3}
      />
      <text
        x={tooltipX + 4}
        y={tooltipY + 12}
        fontSize={10}
        fill="var(--color-content)"
        fontFamily="system-ui"
      >
        {text}
      </text>
    </g>
  );
}
