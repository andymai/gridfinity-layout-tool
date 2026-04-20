import { memo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { getSplitPositions } from '@/shared/utils/splitPositions';

// Hoisted constant to avoid allocation on every render
const AMBER_COLOR = new THREE.Color(0xfbbf24); // rgb(251, 191, 36)

interface SplitLineOverlayProps {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  maxGridUnits: { width: number; depth: number };
  opacity: number;
}

/**
 * Renders dashed amber split lines on the top face of oversized bins,
 * matching the pieces `getSplitPositions` will produce at export time.
 */
export const SplitLineOverlay = memo(function SplitLineOverlay({
  x,
  y,
  z,
  width,
  depth,
  height,
  maxGridUnits,
  opacity,
}: SplitLineOverlayProps) {
  // Only render if bin is oversized
  if (width <= maxGridUnits.width && depth <= maxGridUnits.depth) {
    return null;
  }

  const topZ = z + height;

  // Get split positions for width (X axis) and depth (Y axis)
  const xSplits = getSplitPositions(width, maxGridUnits.width);
  const ySplits = getSplitPositions(depth, maxGridUnits.depth);

  // Amber color matching UI warning, with opacity for dimmed bins
  const lineOpacity = opacity < 1 ? 0.4 : 0.9;

  return (
    <group>
      {/* Vertical split lines (parallel to Y axis) at X positions */}
      {xSplits.map((splitX, i) => (
        <Line
          key={`x-${i}`}
          points={[
            [x + splitX, y, topZ],
            [x + splitX, y + depth, topZ],
          ]}
          color={AMBER_COLOR}
          lineWidth={1.5}
          dashed
          dashScale={10}
          dashSize={0.4}
          gapSize={0.3}
          transparent
          opacity={lineOpacity}
        />
      ))}

      {/* Horizontal split lines (parallel to X axis) at Y positions */}
      {ySplits.map((splitY, i) => (
        <Line
          key={`y-${i}`}
          points={[
            [x, y + splitY, topZ],
            [x + width, y + splitY, topZ],
          ]}
          color={AMBER_COLOR}
          lineWidth={1.5}
          dashed
          dashScale={10}
          dashSize={0.4}
          gapSize={0.3}
          transparent
          opacity={lineOpacity}
        />
      ))}
    </group>
  );
});
