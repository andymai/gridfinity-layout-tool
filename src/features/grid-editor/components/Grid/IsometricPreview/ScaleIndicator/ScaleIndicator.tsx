import { Line, Text } from '@react-three/drei';
import { useThreeColors } from '@/hooks/useThemeEffect';

interface ScaleIndicatorProps {
  gridUnitMm: number;
  drawerDepth: number;
}

const LINE_OPACITY = 0.5;
const TEXT_OPACITY = 0.6;
const FONT_SIZE = 0.25;
const TICK_HEIGHT = 0.12;

/**
 * Scale reference indicator showing what 1 grid unit represents in mm.
 * Positioned at the back-right corner of the drawer floor.
 */
export function ScaleIndicator({ gridUnitMm, drawerDepth }: ScaleIndicatorProps) {
  const colors = useThreeColors();
  // Position at back-right, offset from edge
  const y = drawerDepth + 0.5;
  const x = 0;
  const z = 0.01; // Just above floor

  return (
    <group position={[x, y, z]}>
      {/* Main scale line (1 unit long) */}
      <Line
        points={[
          [0, 0, 0],
          [1, 0, 0],
        ]}
        color={colors.lineColor}
        lineWidth={1.5}
        transparent
        opacity={LINE_OPACITY}
      />

      {/* Left tick mark */}
      <Line
        points={[
          [0, -TICK_HEIGHT, 0],
          [0, TICK_HEIGHT, 0],
        ]}
        color={colors.lineColor}
        lineWidth={1.5}
        transparent
        opacity={LINE_OPACITY}
      />

      {/* Right tick mark */}
      <Line
        points={[
          [1, -TICK_HEIGHT, 0],
          [1, TICK_HEIGHT, 0],
        ]}
        color={colors.lineColor}
        lineWidth={1.5}
        transparent
        opacity={LINE_OPACITY}
      />

      {/* Scale label */}
      <Text
        position={[0.5, 0.3, 0]}
        fontSize={FONT_SIZE}
        color={colors.lineColor}
        fillOpacity={TEXT_OPACITY}
        anchorX="center"
        anchorY="bottom"
      >
        {`1 unit = ${gridUnitMm}mm`}
      </Text>
    </group>
  );
}
