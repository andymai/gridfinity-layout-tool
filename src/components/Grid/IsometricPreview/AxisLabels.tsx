import { Text } from '@react-three/drei';

interface AxisLabelsProps {
  width: number;
  depth: number;
}

/**
 * Renders X and Y axis labels along the edges of the floor grid.
 * X-axis (columns) along the front edge, Y-axis (rows) along the left edge.
 */
export function AxisLabels({ width, depth }: AxisLabelsProps) {
  const fontSize = 0.35;
  const labelColor = '#ffffff';
  const labelOpacity = 0.5;

  // X-axis labels (1 to width) along the front edge
  const xLabels = Array.from({ length: width }, (_, i) => i + 1);

  // Y-axis labels (1 to depth) along the left edge
  const yLabels = Array.from({ length: depth }, (_, i) => i + 1);

  return (
    <group>
      {/* X-axis labels along front edge (Y = -0.5) */}
      {xLabels.map((num) => (
        <Text
          key={`x-${num}`}
          position={[num - 0.5, -0.5, 0.01]}
          fontSize={fontSize}
          color={labelColor}
          fillOpacity={labelOpacity}
          anchorX="center"
          anchorY="middle"
        >
          {num}
        </Text>
      ))}

      {/* Y-axis labels along left edge (X = -0.5) */}
      {yLabels.map((num) => (
        <Text
          key={`y-${num}`}
          position={[-0.5, num - 0.5, 0.01]}
          fontSize={fontSize}
          color={labelColor}
          fillOpacity={labelOpacity}
          anchorX="center"
          anchorY="middle"
        >
          {num}
        </Text>
      ))}
    </group>
  );
}
