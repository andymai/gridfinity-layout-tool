import { Text } from '@react-three/drei';

interface FrontLabelProps {
  drawerWidth: number;
}

/**
 * Renders the word "FRONT" along the front edge of the floor
 * to help orient users viewing the 3D model.
 */
export function FrontLabel({ drawerWidth }: FrontLabelProps) {
  // Position the text centered along the front edge (Y=0)
  const textX = drawerWidth / 2;
  const textY = -1.0; // Slightly in front of the floor
  const textZ = 0.01; // Just above the floor to prevent z-fighting

  return (
    <Text
      position={[textX, textY, textZ]}
      rotation={[0, 0, 0]} // No rotation - text faces camera in Z-up system
      fontSize={1.0}
      color="#ffffff"
      fillOpacity={0.7}
      anchorX="center"
      anchorY="middle"
      letterSpacing={0.15}
    >
      FRONT
    </Text>
  );
}
