/**
 * Renders dashed amber split lines on the 3D preview of oversized bins.
 *
 * Uses the same greedy halving algorithm as the Grid Planner's SplitLineOverlay
 * to show where the bin will be cut for printing. Lines are drawn on the top face
 * and down the vertical edges at cut positions.
 *
 * Coordinate system: mesh is centered at (0, 0) in XY, Z=0 at bottom.
 */

import { memo, useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { useDesignerStore } from '@/features/bin-designer/store';
import { calcMaxGridUnits } from '@/core/constants';
import { getSplitPlanePositionsMm } from '@/features/bin-designer/utils/splitPositions';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

const AMBER_COLOR = new THREE.Color(0xfbbf24);

/**
 * Renders split lines on the bin designer 3D preview when the bin exceeds
 * the user's print bed size. Shows amber dashed lines at the cut positions.
 */
export const BinSplitLines = memo(function BinSplitLines() {
  const { width, depth, height, gridUnitMm } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      gridUnitMm: s.params.gridUnitMm,
    }))
  );

  const { defaultPrintBedSize, defaultGridUnitMm } = useSettingsStore(
    useShallow((s) => ({
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultGridUnitMm: s.settings.defaultGridUnitMm,
    }))
  );

  const maxGridUnits = useMemo(
    () => calcMaxGridUnits(defaultPrintBedSize, defaultGridUnitMm),
    [defaultPrintBedSize, defaultGridUnitMm]
  );

  const needsSplit = width > maxGridUnits || depth > maxGridUnits;

  const xSplits = useMemo(
    () => (needsSplit ? getSplitPlanePositionsMm(width, maxGridUnits, gridUnitMm) : []),
    [width, maxGridUnits, gridUnitMm, needsSplit]
  );

  const ySplits = useMemo(
    () => (needsSplit ? getSplitPlanePositionsMm(depth, maxGridUnits, gridUnitMm) : []),
    [depth, maxGridUnits, gridUnitMm, needsSplit]
  );

  if (!needsSplit) return null;

  const outerW = width * GRIDFINITY.GRID_SIZE;
  const outerD = depth * GRIDFINITY.GRID_SIZE;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const halfW = outerW / 2;
  const halfD = outerD / 2;

  return (
    <group>
      {/* X-axis split lines (parallel to Y/depth axis) */}
      {xSplits.map((splitX, i) => (
        <group key={`x-${i}`}>
          {/* Top face line */}
          <Line
            points={[
              [splitX, -halfD, totalH],
              [splitX, halfD, totalH],
            ]}
            color={AMBER_COLOR}
            lineWidth={2}
            dashed
            dashScale={8}
            dashSize={0.5}
            gapSize={0.3}
            transparent
            opacity={0.9}
          />
          {/* Vertical edge (front) */}
          <Line
            points={[
              [splitX, -halfD, 0],
              [splitX, -halfD, totalH],
            ]}
            color={AMBER_COLOR}
            lineWidth={1.5}
            dashed
            dashScale={8}
            dashSize={0.5}
            gapSize={0.3}
            transparent
            opacity={0.5}
          />
          {/* Vertical edge (back) */}
          <Line
            points={[
              [splitX, halfD, 0],
              [splitX, halfD, totalH],
            ]}
            color={AMBER_COLOR}
            lineWidth={1.5}
            dashed
            dashScale={8}
            dashSize={0.5}
            gapSize={0.3}
            transparent
            opacity={0.5}
          />
        </group>
      ))}

      {/* Y-axis split lines (parallel to X/width axis) */}
      {ySplits.map((splitY, i) => (
        <group key={`y-${i}`}>
          {/* Top face line */}
          <Line
            points={[
              [-halfW, splitY, totalH],
              [halfW, splitY, totalH],
            ]}
            color={AMBER_COLOR}
            lineWidth={2}
            dashed
            dashScale={8}
            dashSize={0.5}
            gapSize={0.3}
            transparent
            opacity={0.9}
          />
          {/* Vertical edge (left) */}
          <Line
            points={[
              [-halfW, splitY, 0],
              [-halfW, splitY, totalH],
            ]}
            color={AMBER_COLOR}
            lineWidth={1.5}
            dashed
            dashScale={8}
            dashSize={0.5}
            gapSize={0.3}
            transparent
            opacity={0.5}
          />
          {/* Vertical edge (right) */}
          <Line
            points={[
              [halfW, splitY, 0],
              [halfW, splitY, totalH],
            ]}
            color={AMBER_COLOR}
            lineWidth={1.5}
            dashed
            dashScale={8}
            dashSize={0.5}
            gapSize={0.3}
            transparent
            opacity={0.5}
          />
        </group>
      ))}
    </group>
  );
});
