import { memo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

// Hoisted constant to avoid allocation on every render
const AMBER_COLOR = new THREE.Color(0xfbbf24); // rgb(251, 191, 36)

/**
 * Calculate split line positions along an axis using greedy halving.
 * Returns positions relative to 0 (start of bin).
 */
function getSplitPositions(size: number, maxSize: number, offset: number = 0): number[] {
  if (size <= maxSize) return [];

  const splitAt = Math.ceil(size / 2);
  const positions: number[] = [offset + splitAt];

  // Recursively get splits for left and right halves
  positions.push(...getSplitPositions(splitAt, maxSize, offset));
  positions.push(...getSplitPositions(size - splitAt, maxSize, offset + splitAt));

  return positions;
}

interface SplitLineOverlayProps {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  maxGridUnits: number;
  opacity: number;
}

/**
 * Renders dashed amber split lines on the top face of oversized bins.
 * Uses the same greedy halving algorithm as the original Canvas implementation.
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
  if (width <= maxGridUnits && depth <= maxGridUnits) {
    return null;
  }

  const topZ = z + height;

  // Get split positions for width (X axis) and depth (Y axis)
  const xSplits = getSplitPositions(width, maxGridUnits);
  const ySplits = getSplitPositions(depth, maxGridUnits);

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
