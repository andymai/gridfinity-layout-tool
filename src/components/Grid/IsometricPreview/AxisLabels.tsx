import { useMemo, useEffect } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface AxisLabelsProps {
  width: number;
  depth: number;
}

const LABEL_COLOR = '#ffffff';
const LABEL_OPACITY = 0.45;
const FONT_SIZE = 0.28;
const TICK_SIZE = 0.08;
const TICK_OPACITY = 0.3;

/**
 * Renders X and Y axis labels along the edges of the floor grid.
 * X-axis (columns) along the front edge, Y-axis (rows) along the left edge.
 * Technical drawing style with small tick marks.
 */
export function AxisLabels({ width, depth }: AxisLabelsProps) {
  // X-axis labels (1 to width) along the front edge
  const xLabels = Array.from({ length: width }, (_, i) => i + 1);

  // Y-axis labels (1 to depth) along the left edge
  const yLabels = Array.from({ length: depth }, (_, i) => i + 1);

  // Create tick mark geometry
  const tickGeometry = useMemo(() => {
    const positions: number[] = [];

    // X-axis ticks (along front edge)
    for (let i = 0; i <= width; i++) {
      positions.push(i, 0, 0.01);
      positions.push(i, -TICK_SIZE, 0.01);
    }

    // Y-axis ticks (along left edge)
    for (let i = 0; i <= depth; i++) {
      positions.push(0, i, 0.01);
      positions.push(-TICK_SIZE, i, 0.01);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [width, depth]);

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
      {xLabels.map((num) => (
        <Text
          key={`x-${num}`}
          position={[num - 0.5, -0.28, 0.01]}
          fontSize={FONT_SIZE}
          color={LABEL_COLOR}
          fillOpacity={LABEL_OPACITY}
          anchorX="center"
          anchorY="top"
        >
          {num}
        </Text>
      ))}

      {/* Y-axis labels along left edge */}
      {yLabels.map((num) => (
        <Text
          key={`y-${num}`}
          position={[-0.28, num - 0.5, 0.01]}
          fontSize={FONT_SIZE}
          color={LABEL_COLOR}
          fillOpacity={LABEL_OPACITY}
          anchorX="right"
          anchorY="middle"
        >
          {num}
        </Text>
      ))}
    </group>
  );
}
