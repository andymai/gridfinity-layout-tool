import { useMemo, useEffect } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { FractionalEdge } from '@/core/types';
import { useThreeColors } from '@/hooks/useThemeEffect';

interface AxisLabelsProps {
  width: number;
  depth: number;
  fractionalEdgeX?: FractionalEdge;
  fractionalEdgeY?: FractionalEdge;
}

const LABEL_OPACITY = 0.45;
const FRACTIONAL_LABEL_OPACITY = 0.35;
const FONT_SIZE = 0.28;
const FRACTIONAL_FONT_SIZE = 0.22;
const TICK_SIZE = 0.08;
const TICK_OPACITY = 0.3;
const FRACTIONAL_LABEL = '+.5';

/**
 * Renders X and Y axis labels along the edges of the floor grid.
 * X-axis (columns) along the front edge, Y-axis (rows) along the left edge.
 * Technical drawing style with small tick marks.
 * Includes fractional edge labels when drawer has fractional dimensions.
 * Respects fractionalEdgeX/Y settings for label positioning.
 */
export function AxisLabels({
  width,
  depth,
  fractionalEdgeX = 'end',
  fractionalEdgeY = 'end',
}: AxisLabelsProps) {
  const colors = useThreeColors();
  const integerWidth = Math.floor(width);
  const integerDepth = Math.floor(depth);
  const hasFractionalWidth = width % 1 !== 0;
  const hasFractionalDepth = depth % 1 !== 0;
  const fractionalWidthPart = width - integerWidth; // e.g., 0.5
  const fractionalDepthPart = depth - integerDepth; // e.g., 0.5

  // X-axis labels - integer labels plus fractional edge
  // When fractionalEdgeX='start', fractional is first; when 'end', it's last
  const xLabels: { value: number; isFractional: boolean }[] = [];
  if (hasFractionalWidth && fractionalEdgeX === 'start') {
    xLabels.push({ value: fractionalWidthPart, isFractional: true });
  }
  for (let i = 1; i <= integerWidth; i++) {
    xLabels.push({ value: i, isFractional: false });
  }
  if (hasFractionalWidth && fractionalEdgeX === 'end') {
    xLabels.push({ value: width, isFractional: true });
  }

  // Y-axis labels - integer labels plus fractional edge
  const yLabels: { value: number; isFractional: boolean }[] = [];
  if (hasFractionalDepth && fractionalEdgeY === 'start') {
    yLabels.push({ value: fractionalDepthPart, isFractional: true });
  }
  for (let i = 1; i <= integerDepth; i++) {
    yLabels.push({ value: i, isFractional: false });
  }
  if (hasFractionalDepth && fractionalEdgeY === 'end') {
    yLabels.push({ value: depth, isFractional: true });
  }

  // Calculate X offset for integer labels when fractional is at start
  const xOffset = hasFractionalWidth && fractionalEdgeX === 'start' ? fractionalWidthPart : 0;
  // Calculate Y offset for integer labels when fractional is at start
  const yOffset = hasFractionalDepth && fractionalEdgeY === 'start' ? fractionalDepthPart : 0;

  // Create tick mark geometry
  const tickGeometry = useMemo(() => {
    const positions: number[] = [];

    // X-axis ticks (along front edge)
    // Integer ticks
    for (let i = 0; i <= integerWidth; i++) {
      const x = xOffset + i;
      positions.push(x, 0, 0.01);
      positions.push(x, -TICK_SIZE, 0.01);
    }
    // Fractional tick
    if (hasFractionalWidth) {
      const x = fractionalEdgeX === 'start' ? fractionalWidthPart : width;
      positions.push(x, 0, 0.01);
      positions.push(x, -TICK_SIZE, 0.01);
    }

    // Y-axis ticks (along left edge)
    // Integer ticks
    for (let i = 0; i <= integerDepth; i++) {
      const y = yOffset + i;
      positions.push(0, y, 0.01);
      positions.push(-TICK_SIZE, y, 0.01);
    }
    // Fractional tick
    if (hasFractionalDepth) {
      const y = fractionalEdgeY === 'start' ? fractionalDepthPart : depth;
      positions.push(0, y, 0.01);
      positions.push(-TICK_SIZE, y, 0.01);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [
    width,
    depth,
    integerWidth,
    integerDepth,
    hasFractionalWidth,
    hasFractionalDepth,
    fractionalWidthPart,
    fractionalDepthPart,
    xOffset,
    yOffset,
    fractionalEdgeX,
    fractionalEdgeY,
  ]);

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
        <lineBasicMaterial color={colors.labelColor} transparent opacity={TICK_OPACITY} />
      </lineSegments>

      {/* X-axis labels along front edge */}
      {xLabels.map(({ value, isFractional }, idx) => {
        // Calculate X position: center label in its cell
        let xPos: number;
        if (isFractional) {
          // Fractional label centered in fractional cell
          xPos = fractionalEdgeX === 'start' ? fractionalWidthPart / 2 : (integerWidth + width) / 2;
        } else {
          // Integer label centered in its cell (offset by xOffset when fractional is at start)
          xPos = xOffset + value - 0.5;
        }
        const label = isFractional ? FRACTIONAL_LABEL : value.toString();

        return (
          <Text
            key={`x-${idx}`}
            position={[xPos, -0.28, 0.01]}
            fontSize={isFractional ? FRACTIONAL_FONT_SIZE : FONT_SIZE}
            color={colors.labelColor}
            fillOpacity={isFractional ? FRACTIONAL_LABEL_OPACITY : LABEL_OPACITY}
            anchorX="center"
            anchorY="top"
          >
            {label}
          </Text>
        );
      })}

      {/* Y-axis labels along left edge */}
      {yLabels.map(({ value, isFractional }, idx) => {
        // Calculate Y position: center label in its cell
        let yPos: number;
        if (isFractional) {
          // Fractional label centered in fractional cell
          yPos = fractionalEdgeY === 'start' ? fractionalDepthPart / 2 : (integerDepth + depth) / 2;
        } else {
          // Integer label centered in its cell (offset by yOffset when fractional is at start)
          yPos = yOffset + value - 0.5;
        }
        const label = isFractional ? FRACTIONAL_LABEL : value.toString();

        return (
          <Text
            key={`y-${idx}`}
            position={[-0.28, yPos, 0.01]}
            fontSize={isFractional ? FRACTIONAL_FONT_SIZE : FONT_SIZE}
            color={colors.labelColor}
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
