import { useEffect, useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';

const DIM_FONT_SIZE = 4;
const DIM_OPACITY = 0.5;
const DIM_OFFSET = 8; // mm from slab edge to label
const DIM_LINE_OPACITY = 0.25;
const DIM_TICK_SIZE = 3;

/** Format mm for display: minimum needed decimals, no trailing zeros. */
function formatMm(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  return String(rounded);
}

/**
 * Width and depth dimension annotations along the baseplate edges.
 * Shows total mm including padding with leader lines and tick marks.
 */
export function DimensionLabels({
  width,
  depth,
  gridUnitMm,
  paddingLeft,
  paddingRight,
  paddingFront,
  paddingBack,
}: {
  width: number;
  depth: number;
  gridUnitMm: number;
  paddingLeft: number;
  paddingRight: number;
  paddingFront: number;
  paddingBack: number;
}) {
  const colors = useThreeColors();
  const GS = gridUnitMm;

  const gridW = width * GS;
  const gridD = depth * GS;
  const totalW = gridW + paddingLeft + paddingRight;
  const totalD = gridD + paddingFront + paddingBack;

  // Slab edges (pockets centered at origin, slab offset by padding asymmetry)
  const slabLeft = -gridW / 2 - paddingLeft;
  const slabRight = gridW / 2 + paddingRight;
  const slabFront = -gridD / 2 - paddingFront;
  const slabBack = gridD / 2 + paddingBack;

  const widthY = slabFront - DIM_OFFSET;
  const depthX = slabLeft - DIM_OFFSET;

  // Build leader line geometry: horizontal line + end ticks for width,
  // vertical line + end ticks for depth
  const lineGeometry = useMemo(() => {
    const positions: number[] = [];
    const z = 0.5;

    // Width leader line (along front edge)
    positions.push(slabLeft, widthY, z, slabRight, widthY, z);
    // Width end ticks
    positions.push(slabLeft, widthY - DIM_TICK_SIZE, z, slabLeft, widthY + DIM_TICK_SIZE, z);
    positions.push(slabRight, widthY - DIM_TICK_SIZE, z, slabRight, widthY + DIM_TICK_SIZE, z);

    // Depth leader line (along left edge)
    positions.push(depthX, slabFront, z, depthX, slabBack, z);
    // Depth end ticks
    positions.push(depthX - DIM_TICK_SIZE, slabFront, z, depthX + DIM_TICK_SIZE, slabFront, z);
    positions.push(depthX - DIM_TICK_SIZE, slabBack, z, depthX + DIM_TICK_SIZE, slabBack, z);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [slabLeft, slabRight, slabFront, slabBack, widthY, depthX]);

  useEffect(() => {
    return () => {
      lineGeometry.dispose();
    };
  }, [lineGeometry]);

  return (
    <group>
      {/* Leader lines */}
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color={colors.labelColor} transparent opacity={DIM_LINE_OPACITY} />
      </lineSegments>

      {/* Width label */}
      <Text
        position={[(slabLeft + slabRight) / 2, widthY - DIM_FONT_SIZE, 0.5]}
        fontSize={DIM_FONT_SIZE}
        color={colors.labelColor}
        fillOpacity={DIM_OPACITY}
        anchorX="center"
        anchorY="top"
      >
        {`${formatMm(totalW)}mm`}
      </Text>

      {/* Depth label */}
      <Text
        position={[depthX - DIM_FONT_SIZE, (slabFront + slabBack) / 2, 0.5]}
        fontSize={DIM_FONT_SIZE}
        color={colors.labelColor}
        fillOpacity={DIM_OPACITY}
        anchorX="right"
        anchorY="middle"
      >
        {`${formatMm(totalD)}mm`}
      </Text>
    </group>
  );
}
