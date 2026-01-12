import { useMemo, useEffect } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface AxisLabelsProps {
  width: number;
  depth: number;
}

const LABEL_COLOR = '#ffffff';
const LABEL_OPACITY = 0.45;
const FRACTIONAL_LABEL_OPACITY = 0.35;
const FONT_SIZE = 0.28;
const FRACTIONAL_FONT_SIZE = 0.22;
const TICK_SIZE = 0.08;
const TICK_OPACITY = 0.3;

/**
 * Renders X and Y axis labels along the edges of the floor grid.
 * X-axis (columns) along the front edge, Y-axis (rows) along the left edge.
 * Technical drawing style with small tick marks.
 * Includes fractional edge labels when drawer has fractional dimensions.
 */
export function AxisLabels({ width, depth }: AxisLabelsProps) {
  const integerWidth = Math.floor(width);
  const integerDepth = Math.floor(depth);
  const hasFractionalWidth = width % 1 !== 0;
  const hasFractionalDepth = depth % 1 !== 0;

  // X-axis labels (1 to width) along the front edge, plus fractional edge if present
  const xLabels: number[] = Array.from({ length: integerWidth }, (_, i) => i + 1);
  if (hasFractionalWidth) {
    xLabels.push(width); // e.g., 5.5
  }

  // Y-axis labels (1 to depth) along the left edge, plus fractional edge if present
  const yLabels: number[] = Array.from({ length: integerDepth }, (_, i) => i + 1);
  if (hasFractionalDepth) {
    yLabels.push(depth); // e.g., 8.5
  }

  // Create tick mark geometry
  const tickGeometry = useMemo(() => {
    const positions: number[] = [];

    // X-axis ticks (along front edge) - at integer positions
    for (let i = 0; i <= integerWidth; i++) {
      positions.push(i, 0, 0.01);
      positions.push(i, -TICK_SIZE, 0.01);
    }
    // Add tick at fractional width edge
    if (hasFractionalWidth) {
      positions.push(width, 0, 0.01);
      positions.push(width, -TICK_SIZE, 0.01);
    }

    // Y-axis ticks (along left edge) - at integer positions
    for (let i = 0; i <= integerDepth; i++) {
      positions.push(0, i, 0.01);
      positions.push(-TICK_SIZE, i, 0.01);
    }
    // Add tick at fractional depth edge
    if (hasFractionalDepth) {
      positions.push(0, depth, 0.01);
      positions.push(-TICK_SIZE, depth, 0.01);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [width, depth, integerWidth, integerDepth, hasFractionalWidth, hasFractionalDepth]);

  // Cleanup geometry on unmount or when dependencies change
  useEffect(() => {
    return () => {
      tickGeometry.dispose();
    };
  }, [tickGeometry]);

  return (
    <group>
      {/* Tick marks */}
      <lineSegments geometry={tickGeometry}>
        <lineBasicMaterial color={LABEL_COLOR} transparent opacity={TICK_OPACITY} />
      </lineSegments>

      {/* X-axis labels along front edge */}
      {xLabels.map((num) => {
        const isFractional = num % 1 !== 0;
        // Center label between grid lines: integer labels at num-0.5, fractional at (integerWidth + width) / 2
        const xPos = isFractional ? (integerWidth + width) / 2 : num - 0.5;
        const label = isFractional ? '+.5' : num.toString();

        return (
          <Text
            key={`x-${num}`}
            position={[xPos, -0.28, 0.01]}
            fontSize={isFractional ? FRACTIONAL_FONT_SIZE : FONT_SIZE}
            color={LABEL_COLOR}
            fillOpacity={isFractional ? FRACTIONAL_LABEL_OPACITY : LABEL_OPACITY}
            anchorX="center"
            anchorY="top"
          >
            {label}
          </Text>
        );
      })}

      {/* Y-axis labels along left edge */}
      {yLabels.map((num) => {
        const isFractional = num % 1 !== 0;
        // Center label between grid lines: integer labels at num-0.5, fractional at (integerDepth + depth) / 2
        const yPos = isFractional ? (integerDepth + depth) / 2 : num - 0.5;
        const label = isFractional ? '+.5' : num.toString();

        return (
          <Text
            key={`y-${num}`}
            position={[-0.28, yPos, 0.01]}
            fontSize={isFractional ? FRACTIONAL_FONT_SIZE : FONT_SIZE}
            color={LABEL_COLOR}
            fillOpacity={isFractional ? FRACTIONAL_LABEL_OPACITY : LABEL_OPACITY}
            anchorX="right"
            anchorY="middle"
          >
            {label}
          </Text>
        );
      })}
    </group>
  );
}
