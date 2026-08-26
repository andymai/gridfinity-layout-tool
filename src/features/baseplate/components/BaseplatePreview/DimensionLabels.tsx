import { useEffect, useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { DrawerOutline } from '@/core/types';
import { outlineBounds } from '@/shared/utils/drawerOutlineGeometry';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { formatMm } from '@/shared/utils/format';

const DIM_FONT_SIZE = 4;
const DIM_OPACITY = 0.5;
const DIM_OFFSET = 8; // mm from slab edge to label
const DIM_LINE_OPACITY = 0.25;
const DIM_TICK_SIZE = 3;

/**
 * Width and depth dimension annotations along the baseplate edges.
 * Measures the material, so leader lines land on the plate's real edges and the
 * figures match the panel's readout.
 *
 * With a perimeter the generator intersects its slab with the shape, so the
 * shape's own bounds are the plate — wider than the padded grid extent when the
 * drawer was measured larger than the cells it was given, narrower when the
 * shape falls short of them.
 */
export function DimensionLabels({
  width,
  depth,
  gridUnitMm,
  gridUnitMmY,
  paddingLeft,
  paddingRight,
  paddingFront,
  paddingBack,
  outline,
}: {
  width: number;
  depth: number;
  gridUnitMm: number;
  gridUnitMmY: number;
  paddingLeft: number;
  paddingRight: number;
  paddingFront: number;
  paddingBack: number;
  /** Resolved plate-local perimeter, when the plate has one. */
  outline?: DrawerOutline;
}) {
  const colors = useThreeColors();

  const gridW = width * gridUnitMm;
  const gridD = depth * gridUnitMmY;

  // Slab edges (pockets centered at origin, slab offset by padding asymmetry).
  // Plate-local mm run from 0 at the padded extent's left/front edge, so the
  // perimeter's bounds map into this frame by the same offset.
  const edges = useMemo(() => {
    const originX = -gridW / 2 - paddingLeft;
    const originY = -gridD / 2 - paddingFront;
    if (outline === undefined) {
      return {
        left: originX,
        right: gridW / 2 + paddingRight,
        front: originY,
        back: gridD / 2 + paddingBack,
      };
    }
    const b = outlineBounds(outline);
    return {
      left: originX + b.minX,
      right: originX + b.maxX,
      front: originY + b.minY,
      back: originY + b.maxY,
    };
  }, [outline, gridW, gridD, paddingLeft, paddingRight, paddingFront, paddingBack]);

  const { left: slabLeft, right: slabRight, front: slabFront, back: slabBack } = edges;
  const totalW = slabRight - slabLeft;
  const totalD = slabBack - slabFront;

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
