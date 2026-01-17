import { Line, Text } from '@react-three/drei';
import { useMemo } from 'react';

interface DrawerDimensionsProps {
  width: number;
  depth: number;
  height: number;
  gridUnitMm: number;
  heightUnitMm: number;
}

// Dimension line offset from drawer edges
const OFFSET = 0.8;
const END_CAP_SIZE = 0.15;
const LINE_COLOR = '#ffffff';
const LINE_OPACITY = 0.5;
const TEXT_OPACITY = 0.7;
const FONT_SIZE = 0.32;

/**
 * Architectural dimension lines showing drawer width, depth, and height.
 * Positioned just outside the drawer bounds with end caps and centered labels.
 */
export function DrawerDimensions({ width, depth, height, gridUnitMm, heightUnitMm }: DrawerDimensionsProps) {
  // Convert height from height-units to grid-units for 3D space
  const heightInGridUnits = height * (heightUnitMm / gridUnitMm);

  // Calculate real-world dimensions in mm
  const widthMm = width * gridUnitMm;
  const depthMm = depth * gridUnitMm;
  const heightMm = height * heightUnitMm;

  const dimensions = useMemo(() => ({
    // Width dimension - along front edge (Y = -OFFSET)
    width: {
      start: [0, -OFFSET, 0] as [number, number, number],
      end: [width, -OFFSET, 0] as [number, number, number],
      labelPos: [width / 2, -OFFSET - 0.3, 0] as [number, number, number],
      label: `${widthMm}mm`,
      endCaps: {
        left: [
          [0, -OFFSET - END_CAP_SIZE, 0],
          [0, -OFFSET + END_CAP_SIZE, 0],
        ] as [[number, number, number], [number, number, number]],
        right: [
          [width, -OFFSET - END_CAP_SIZE, 0],
          [width, -OFFSET + END_CAP_SIZE, 0],
        ] as [[number, number, number], [number, number, number]],
      },
    },
    // Depth dimension - along left edge (X = -OFFSET)
    depth: {
      start: [-OFFSET, 0, 0] as [number, number, number],
      end: [-OFFSET, depth, 0] as [number, number, number],
      labelPos: [-OFFSET - 0.3, depth / 2, 0] as [number, number, number],
      label: `${depthMm}mm`,
      endCaps: {
        left: [
          [-OFFSET - END_CAP_SIZE, 0, 0],
          [-OFFSET + END_CAP_SIZE, 0, 0],
        ] as [[number, number, number], [number, number, number]],
        right: [
          [-OFFSET - END_CAP_SIZE, depth, 0],
          [-OFFSET + END_CAP_SIZE, depth, 0],
        ] as [[number, number, number], [number, number, number]],
      },
    },
    // Height dimension - vertical along back-left corner
    height: {
      start: [-OFFSET, depth + OFFSET, 0] as [number, number, number],
      end: [-OFFSET, depth + OFFSET, heightInGridUnits] as [number, number, number],
      labelPos: [-OFFSET - 0.3, depth + OFFSET, heightInGridUnits / 2] as [number, number, number],
      label: `${heightMm}mm`,
      endCaps: {
        left: [
          [-OFFSET - END_CAP_SIZE, depth + OFFSET, 0],
          [-OFFSET + END_CAP_SIZE, depth + OFFSET, 0],
        ] as [[number, number, number], [number, number, number]],
        right: [
          [-OFFSET - END_CAP_SIZE, depth + OFFSET, heightInGridUnits],
          [-OFFSET + END_CAP_SIZE, depth + OFFSET, heightInGridUnits],
        ] as [[number, number, number], [number, number, number]],
      },
    },
  }), [width, depth, heightInGridUnits, widthMm, depthMm, heightMm]);

  return (
    <group>
      {/* Width dimension line */}
      <Line
        points={[dimensions.width.start, dimensions.width.end]}
        color={LINE_COLOR}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.width.endCaps.left}
        color={LINE_COLOR}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.width.endCaps.right}
        color={LINE_COLOR}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Text
        position={dimensions.width.labelPos}
        fontSize={FONT_SIZE}
        color={LINE_COLOR}
        fillOpacity={TEXT_OPACITY}
        anchorX="center"
        anchorY="top"
      >
        {dimensions.width.label}
      </Text>

      {/* Depth dimension line */}
      <Line
        points={[dimensions.depth.start, dimensions.depth.end]}
        color={LINE_COLOR}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.depth.endCaps.left}
        color={LINE_COLOR}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.depth.endCaps.right}
        color={LINE_COLOR}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Text
        position={dimensions.depth.labelPos}
        fontSize={FONT_SIZE}
        color={LINE_COLOR}
        fillOpacity={TEXT_OPACITY}
        anchorX="right"
        anchorY="middle"
        rotation={[0, 0, Math.PI / 2]}
      >
        {dimensions.depth.label}
      </Text>

      {/* Height dimension line */}
      <Line
        points={[dimensions.height.start, dimensions.height.end]}
        color={LINE_COLOR}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.height.endCaps.left}
        color={LINE_COLOR}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.height.endCaps.right}
        color={LINE_COLOR}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Text
        position={dimensions.height.labelPos}
        fontSize={FONT_SIZE}
        color={LINE_COLOR}
        fillOpacity={TEXT_OPACITY}
        anchorX="right"
        anchorY="middle"
      >
        {dimensions.height.label}
      </Text>
    </group>
  );
}
