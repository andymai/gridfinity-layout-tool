import { Line, Text } from '@react-three/drei';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';

interface FrontLabelProps {
  drawerWidth: number;
  label: string;
}

const TEXT_OPACITY = 0.6;
const LINE_OPACITY = 0.25;

/**
 * Renders the layout name along the front edge of the floor
 * with a subtle underline for technical drawing aesthetic.
 */
export function FrontLabel({ drawerWidth, label }: FrontLabelProps) {
  const colors = useThreeColors();
  // Position the text centered along the front edge, below dimension lines
  const textX = drawerWidth / 2;
  const textY = -2.2; // Well below the width dimension line (at Y = -0.8 to -1.1)
  const textZ = 0.01; // Just above the floor to prevent z-fighting

  // Calculate underline width based on approximate text width
  const underlineHalfWidth = Math.min(label.length * 0.22, drawerWidth * 0.8) / 2;

  return (
    <group>
      <Text
        position={[textX, textY, textZ]}
        rotation={[0, 0, 0]}
        fontSize={0.5}
        color={colors.labelColor}
        fillOpacity={TEXT_OPACITY}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        maxWidth={drawerWidth * 1.5}
      >
        {label.toUpperCase()}
      </Text>

      {/* Subtle underline */}
      <Line
        points={[
          [textX - underlineHalfWidth, textY - 0.45, textZ],
          [textX + underlineHalfWidth, textY - 0.45, textZ],
        ]}
        color={colors.labelColor}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
    </group>
  );
}
