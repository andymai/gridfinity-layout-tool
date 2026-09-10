import { useMemo } from 'react';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { DimensionLine } from '@/shared/components/preview/DimensionLine';

interface DrawerDimensionsProps {
  width: number;
  depth: number;
  height: number;
  gridUnitMm: number;
  /** Depth-axis pitch (mm) — the true drawer depth for a non-square grid. */
  gridUnitMmY: number;
  /** Depth-axis world scale for a non-square grid (1 = square). */
  depthScale?: number;
  heightUnitMm: number;
}

// Dimension line offset from drawer edges
const OFFSET = 0.8;
const END_CAP_SIZE = 0.15;
const LINE_OPACITY = 0.5;
const TEXT_OPACITY = 0.7;
const FONT_SIZE = 0.32;

/**
 * Architectural dimension lines showing drawer width, depth, and height.
 * Positioned just outside the drawer bounds with end caps and centered labels.
 */
export function DrawerDimensions({
  width,
  depth,
  height,
  gridUnitMm,
  gridUnitMmY,
  depthScale = 1,
  heightUnitMm,
}: DrawerDimensionsProps) {
  const colors = useThreeColors();
  // Convert height from height-units to grid-units for 3D space
  const heightInGridUnits = height * (heightUnitMm / gridUnitMm);
  // Depth axis is compressed in world space for a non-square grid; the mm label
  // uses the true Y pitch.
  const scaledDepth = depth * depthScale;

  // Calculate real-world dimensions in mm
  const widthMm = width * gridUnitMm;
  const depthMm = depth * gridUnitMmY;
  const heightMm = height * heightUnitMm;

  const dimensions = useMemo(
    () => ({
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
      // Depth dimension - along left edge (X = -OFFSET). Y positions compress by
      // depthScale to track the scaled floor; the mm label is the true depth.
      depth: {
        start: [-OFFSET, 0, 0] as [number, number, number],
        end: [-OFFSET, scaledDepth, 0] as [number, number, number],
        labelPos: [-OFFSET - 0.3, scaledDepth / 2, 0] as [number, number, number],
        label: `${depthMm}mm`,
        endCaps: {
          left: [
            [-OFFSET - END_CAP_SIZE, 0, 0],
            [-OFFSET + END_CAP_SIZE, 0, 0],
          ] as [[number, number, number], [number, number, number]],
          right: [
            [-OFFSET - END_CAP_SIZE, scaledDepth, 0],
            [-OFFSET + END_CAP_SIZE, scaledDepth, 0],
          ] as [[number, number, number], [number, number, number]],
        },
      },
      // Height dimension - vertical along back-left corner
      height: {
        start: [-OFFSET, scaledDepth + OFFSET, 0] as [number, number, number],
        end: [-OFFSET, scaledDepth + OFFSET, heightInGridUnits] as [number, number, number],
        labelPos: [-OFFSET - 0.3, scaledDepth + OFFSET, heightInGridUnits / 2] as [
          number,
          number,
          number,
        ],
        label: `${heightMm}mm`,
        endCaps: {
          left: [
            [-OFFSET - END_CAP_SIZE, scaledDepth + OFFSET, 0],
            [-OFFSET + END_CAP_SIZE, scaledDepth + OFFSET, 0],
          ] as [[number, number, number], [number, number, number]],
          right: [
            [-OFFSET - END_CAP_SIZE, scaledDepth + OFFSET, heightInGridUnits],
            [-OFFSET + END_CAP_SIZE, scaledDepth + OFFSET, heightInGridUnits],
          ] as [[number, number, number], [number, number, number]],
        },
      },
    }),
    [width, scaledDepth, heightInGridUnits, widthMm, depthMm, heightMm]
  );

  const dimensionStyle = {
    color: colors.lineColor,
    fontSize: FONT_SIZE,
    lineOpacity: LINE_OPACITY,
    textOpacity: TEXT_OPACITY,
  };

  return (
    <group>
      <DimensionLine
        start={dimensions.width.start}
        end={dimensions.width.end}
        endCaps={[dimensions.width.endCaps.left, dimensions.width.endCaps.right]}
        labelPos={dimensions.width.labelPos}
        label={dimensions.width.label}
        anchorX="center"
        anchorY="top"
        {...dimensionStyle}
      />
      <DimensionLine
        start={dimensions.depth.start}
        end={dimensions.depth.end}
        endCaps={[dimensions.depth.endCaps.left, dimensions.depth.endCaps.right]}
        labelPos={dimensions.depth.labelPos}
        label={dimensions.depth.label}
        anchorX="right"
        anchorY="middle"
        rotation={[0, 0, Math.PI / 2]}
        {...dimensionStyle}
      />
      <DimensionLine
        start={dimensions.height.start}
        end={dimensions.height.end}
        endCaps={[dimensions.height.endCaps.left, dimensions.height.endCaps.right]}
        labelPos={dimensions.height.labelPos}
        label={dimensions.height.label}
        anchorX="right"
        anchorY="middle"
        {...dimensionStyle}
      />
    </group>
  );
}
