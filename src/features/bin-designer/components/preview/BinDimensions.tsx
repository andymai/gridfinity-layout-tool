/**
 * Architectural dimension lines for the bin designer 3D preview.
 *
 * Shows width, depth, and height annotations with end caps and centered labels.
 * Positioned just outside the bin's bounding box, matching the visual style
 * of DrawerDimensions in the layout planner's IsometricPreview.
 *
 * The bin mesh is centered at origin (0,0) in XY with base at Z≈0.
 * All coordinates are in millimeters (scene unit = mm).
 */

import { Line, Text } from '@react-three/drei';
import { useMemo } from 'react';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

interface BinDimensionsProps {
  /** Bin width in grid units */
  width: number;
  /** Bin depth in grid units */
  depth: number;
  /** Bin height in height units */
  height: number;
  /** Grid unit size in mm (for label text) */
  gridUnitMm: number;
  /** Height unit size in mm (for label text) */
  heightUnitMm: number;
  /** Whether stacking lip is enabled (adds LIP_HEIGHT to total height) */
  stackingLip: boolean;
}

// Layout constants matched to planner's DrawerDimensions proportions
// (planner: OFFSET=0.8, END_CAP=0.15, FONT_SIZE=0.32, label_gap=0.3)
const OFFSET = 14; // Distance from bin edge to dimension line
const END_CAP = 1; // Length of end cap markers (half-length, extends both directions)
const LABEL_GAP = 4; // Additional offset from line to label text
const LINE_COLOR = '#ffffff';
const LINE_OPACITY = 0.5;
const TEXT_OPACITY = 0.7;
const FONT_SIZE = 4.5;

/**
 * Dimension lines showing bin width, depth, and height in mm.
 * Matches the architectural drawing style from the layout planner.
 */
export function BinDimensions({
  width,
  depth,
  height,
  gridUnitMm,
  heightUnitMm,
  stackingLip,
}: BinDimensionsProps) {
  // Bin extents in mm (mesh is centered at origin)
  const outerW = width * GRIDFINITY.GRID_SIZE;
  const outerD = depth * GRIDFINITY.GRID_SIZE;
  const lipHeight = stackingLip ? GRIDFINITY.LIP_HEIGHT : 0;
  // Total height per Gridfinity spec: height units + lip
  // e.g., 3u + lip = 21 + 4.4 = 25.4mm
  const totalH = height * GRIDFINITY.HEIGHT_UNIT + lipHeight;

  // Display labels use the user's configured unit sizes
  const widthMm = Math.round(width * gridUnitMm);
  const depthMm = Math.round(depth * gridUnitMm);
  // Height uses user's heightUnitMm setting + lip
  const heightMmRaw = height * heightUnitMm + lipHeight;
  const heightMm = Number.isInteger(heightMmRaw) ? heightMmRaw : heightMmRaw.toFixed(1);

  const dimensions = useMemo(() => {
    const halfW = outerW / 2;
    const halfD = outerD / 2;

    return {
      // Width: along front edge, offset in -Y direction
      width: {
        start: [-halfW, -halfD - OFFSET, 0] as [number, number, number],
        end: [halfW, -halfD - OFFSET, 0] as [number, number, number],
        labelPos: [0, -halfD - OFFSET - LABEL_GAP, 0] as [number, number, number],
        label: `${widthMm}mm`,
        endCaps: {
          left: [
            [-halfW, -halfD - OFFSET - END_CAP, 0],
            [-halfW, -halfD - OFFSET + END_CAP, 0],
          ] as [[number, number, number], [number, number, number]],
          right: [
            [halfW, -halfD - OFFSET - END_CAP, 0],
            [halfW, -halfD - OFFSET + END_CAP, 0],
          ] as [[number, number, number], [number, number, number]],
        },
      },
      // Depth: along left edge, offset in -X direction
      depth: {
        start: [-halfW - OFFSET, -halfD, 0] as [number, number, number],
        end: [-halfW - OFFSET, halfD, 0] as [number, number, number],
        labelPos: [-halfW - OFFSET - LABEL_GAP, 0, 0] as [number, number, number],
        label: `${depthMm}mm`,
        endCaps: {
          left: [
            [-halfW - OFFSET - END_CAP, -halfD, 0],
            [-halfW - OFFSET + END_CAP, -halfD, 0],
          ] as [[number, number, number], [number, number, number]],
          right: [
            [-halfW - OFFSET - END_CAP, halfD, 0],
            [-halfW - OFFSET + END_CAP, halfD, 0],
          ] as [[number, number, number], [number, number, number]],
        },
      },
      // Height: vertical at back-left corner, offset from both edges
      height: {
        start: [-halfW - OFFSET, halfD + OFFSET, 0] as [number, number, number],
        end: [-halfW - OFFSET, halfD + OFFSET, totalH] as [number, number, number],
        labelPos: [-halfW - OFFSET - LABEL_GAP, halfD + OFFSET, totalH / 2] as [
          number,
          number,
          number,
        ],
        label: `${heightMm}mm`,
        endCaps: {
          bottom: [
            [-halfW - OFFSET - END_CAP, halfD + OFFSET, 0],
            [-halfW - OFFSET + END_CAP, halfD + OFFSET, 0],
          ] as [[number, number, number], [number, number, number]],
          top: [
            [-halfW - OFFSET - END_CAP, halfD + OFFSET, totalH],
            [-halfW - OFFSET + END_CAP, halfD + OFFSET, totalH],
          ] as [[number, number, number], [number, number, number]],
        },
      },
    };
  }, [outerW, outerD, totalH, widthMm, depthMm, heightMm]);

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
        points={dimensions.height.endCaps.bottom}
        color={LINE_COLOR}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.height.endCaps.top}
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
