/**
 * Renders alignment guide lines for the cutout editor.
 *
 * Displays dashed lines when dragging cutouts to show alignment
 * with stationary cutouts (edges and centers).
 */

import type { AlignmentGuide } from './geometry';

interface SmartGuidesProps {
  readonly guides: readonly AlignmentGuide[];
  readonly scale: number;
  readonly binWidth: number;
  readonly binDepth: number;
}

export function SmartGuides({ guides, scale, binWidth, binDepth }: SmartGuidesProps) {
  if (guides.length === 0) return null;

  const binPxW = binWidth * scale;
  const binPxH = binDepth * scale;

  return (
    <g>
      {guides.map((guide, index) => {
        if (guide.axis === 'x') {
          // Vertical line
          const x = guide.position * scale;
          return (
            <line
              key={`${guide.axis}-${guide.position}-${index}`}
              x1={x}
              y1={0}
              x2={x}
              y2={binPxH}
              stroke="var(--color-accent)"
              strokeWidth={0.5}
              strokeDasharray="3 3"
              opacity={0.5}
            />
          );
        }

        // Horizontal line (Y-axis inverted for SVG)
        const y = (binDepth - guide.position) * scale;
        return (
          <line
            key={`${guide.axis}-${guide.position}-${index}`}
            x1={0}
            y1={y}
            x2={binPxW}
            y2={y}
            stroke="var(--color-accent)"
            strokeWidth={0.5}
            strokeDasharray="3 3"
            opacity={0.5}
          />
        );
      })}
    </g>
  );
}
