/**
 * Background for the cutout editor canvas.
 *
 * Renders the bin area with an elevated surface fill, a visible border,
 * dot grid at 1mm intervals (2mm for large bins), and center crosshair.
 * Styled to match the compartment editor's visual language.
 */

interface EditorBackgroundProps {
  readonly binWidth: number; // mm
  readonly binDepth: number; // mm
  readonly scale: number; // px per mm
}

const LARGE_BIN_THRESHOLD = 10000;

export function EditorBackground({ binWidth, binDepth, scale }: EditorBackgroundProps) {
  const binPxW = binWidth * scale;
  const binPxH = binDepth * scale;

  // Use 2mm interval for large bins to avoid rendering too many dots
  const dotInterval = binWidth * binDepth > LARGE_BIN_THRESHOLD ? 2 : 1;

  // Generate dot grid points
  const dots: Array<{ x: number; y: number }> = [];
  for (let x = 0; x <= binWidth; x += dotInterval) {
    for (let y = 0; y <= binDepth; y += dotInterval) {
      dots.push({
        x: x * scale,
        y: (binDepth - y) * scale, // SVG Y is inverted
      });
    }
  }

  // Center crosshair positions
  const centerX = (binWidth / 2) * scale;
  const centerY = (binDepth / 2) * scale;

  return (
    <g>
      {/* Bin area fill — elevated surface like compartment editor */}
      <rect
        x={0}
        y={0}
        width={binPxW}
        height={binPxH}
        fill="var(--color-surface-elevated)"
        rx={4}
        ry={4}
      />

      {/* Bin boundary — 2px border matching compartment editor */}
      <rect
        x={0}
        y={0}
        width={binPxW}
        height={binPxH}
        fill="none"
        stroke="var(--color-stroke-subtle)"
        strokeWidth={2}
        rx={4}
        ry={4}
      />

      {/* Dot grid */}
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={1}
          fill="var(--color-content-tertiary)"
          opacity={0.35}
        />
      ))}

      {/* Horizontal center line */}
      <line
        x1={0}
        y1={centerY}
        x2={binPxW}
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
        y2={binPxH}
        stroke="var(--color-stroke-subtle)"
        strokeWidth={0.5}
        strokeDasharray="4 2"
        opacity={0.4}
      />
    </g>
  );
}
