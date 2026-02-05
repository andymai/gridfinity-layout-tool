/**
 * Background grid and crosshair for the cutout editor.
 *
 * Renders a dot grid at 1mm intervals (or 2mm for large bins)
 * and a center crosshair to help with shape placement.
 */

interface EditorBackgroundProps {
  readonly binWidth: number; // mm
  readonly binDepth: number; // mm
  readonly scale: number; // px per mm
  readonly canvasWidth: number; // total SVG width in px
  readonly canvasHeight: number; // total SVG height in px
}

const LARGE_BIN_THRESHOLD = 10000;

export function EditorBackground({
  binWidth,
  binDepth,
  scale,
  canvasWidth,
  canvasHeight,
}: EditorBackgroundProps) {
  // Use 2mm interval for large bins to avoid rendering too many dots
  const dotInterval = binWidth * binDepth > LARGE_BIN_THRESHOLD ? 2 : 1;

  // Generate dot grid points
  const dots: Array<{ x: number; y: number }> = [];
  for (let x = 0; x <= binWidth; x += dotInterval) {
    for (let y = 0; y <= binDepth; y += dotInterval) {
      dots.push({
        x: x * scale,
        y: canvasHeight - y * scale, // SVG Y is inverted
      });
    }
  }

  // Center crosshair positions
  const centerX = (binWidth / 2) * scale;
  const centerY = canvasHeight - (binDepth / 2) * scale;

  return (
    <g>
      {/* Dot grid */}
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={0.5}
          fill="var(--color-stroke-subtle)"
          opacity={0.3}
        />
      ))}

      {/* Horizontal center line */}
      <line
        x1={0}
        y1={centerY}
        x2={canvasWidth}
        y2={centerY}
        stroke="var(--color-stroke-subtle)"
        strokeWidth={0.5}
        strokeDasharray="4 2"
        opacity={0.4}
      />

      {/* Vertical center line */}
      <line
        x1={centerX}
        y1={0}
        x2={centerX}
        y2={canvasHeight}
        stroke="var(--color-stroke-subtle)"
        strokeWidth={0.5}
        strokeDasharray="4 2"
        opacity={0.4}
      />
    </g>
  );
}
