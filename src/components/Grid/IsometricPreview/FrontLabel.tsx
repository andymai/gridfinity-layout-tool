import { Text } from '@react-three/drei';

interface FrontLabelProps {
  drawerWidth: number;
  label: string;
}

/**
 * Renders the layout name along the front edge of the floor
 * to help orient users viewing the 3D model.
 */
export function FrontLabel({ drawerWidth, label }: FrontLabelProps) {
  // Position the text centered along the front edge (Y=0)
  const textX = drawerWidth / 2;
  const textY = -1.0; // Slightly in front of the floor
  const textZ = 0.01; // Just above the floor to prevent z-fighting

  return (
    <Text
      position={[textX, textY, textZ]}
      rotation={[0, 0, 0]} // No rotation - text faces camera in Z-up system
      fontSize={0.8}
      color="#ffffff"
      fillOpacity={0.7}
      anchorX="center"
      anchorY="middle"
      letterSpacing={0.05}
      maxWidth={drawerWidth * 1.5}
    >
      {label}
    </Text>
  );
}
