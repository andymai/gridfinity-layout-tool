import { Line, Text } from '@react-three/drei';

type Vec3 = [number, number, number];
type Segment = [Vec3, Vec3];

interface DimensionLineProps {
  start: Vec3;
  end: Vec3;
  /** The two perpendicular caps, one at each end of the line. */
  endCaps: [Segment, Segment];
  labelPos: Vec3;
  label: string;
  anchorX: 'center' | 'right';
  anchorY: 'top' | 'middle';
  rotation?: Vec3;
  color: string;
  fontSize: number;
  lineOpacity: number;
  textOpacity: number;
}

/** One architectural dimension: a line, an end cap at each end, and a measurement label. */
export function DimensionLine({
  start,
  end,
  endCaps,
  labelPos,
  label,
  anchorX,
  anchorY,
  rotation,
  color,
  fontSize,
  lineOpacity,
  textOpacity,
}: DimensionLineProps) {
  const lineProps = { color, lineWidth: 1, transparent: true, opacity: lineOpacity };
  return (
    <group>
      <Line points={[start, end]} {...lineProps} />
      <Line points={endCaps[0]} {...lineProps} />
      <Line points={endCaps[1]} {...lineProps} />
      <Text
        position={labelPos}
        fontSize={fontSize}
        color={color}
        fillOpacity={textOpacity}
        anchorX={anchorX}
        anchorY={anchorY}
        {...(rotation ? { rotation } : {})}
      >
        {label}
      </Text>
    </group>
  );
}
