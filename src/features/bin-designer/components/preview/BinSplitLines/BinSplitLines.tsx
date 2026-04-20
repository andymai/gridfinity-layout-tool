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
import { Color } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { useDesignerStore } from '@/features/bin-designer/store';
import { calcMaxGridUnits } from '@/core/constants';
import { getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

const AMBER_COLOR = new Color(0xfbbf24);

const DASHED_LINE_SHARED = {
  color: AMBER_COLOR,
  dashed: true,
  dashScale: 8,
  dashSize: 0.5,
  gapSize: 0.3,
  transparent: true,
} as const;

export const BinSplitLines = memo(function BinSplitLines() {
  const { width, depth, height, gridUnitMm } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      gridUnitMm: s.params.gridUnitMm,
    }))
  );

  const { defaultPrintBedSize, defaultPrintBedDepth } = useSettingsStore(
    useShallow((s) => ({
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultPrintBedDepth: s.settings.defaultPrintBedDepth,
    }))
  );

  const maxGrid = useMemo(
    () => calcMaxGridUnits(defaultPrintBedSize, gridUnitMm, defaultPrintBedDepth),
    [defaultPrintBedSize, defaultPrintBedDepth, gridUnitMm]
  );

  const needsSplit = width > maxGrid.width || depth > maxGrid.depth;

  const xSplits = useMemo(
    () => (needsSplit ? getSplitPlanePositionsMm(width, maxGrid.width, gridUnitMm) : []),
    [width, maxGrid.width, gridUnitMm, needsSplit]
  );

  const ySplits = useMemo(
    () => (needsSplit ? getSplitPlanePositionsMm(depth, maxGrid.depth, gridUnitMm) : []),
    [depth, maxGrid.depth, gridUnitMm, needsSplit]
  );

  if (!needsSplit) return null;

  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const halfW = (width * gridUnitMm - GRIDFINITY.TOLERANCE) / 2;
  const halfD = (depth * gridUnitMm - GRIDFINITY.TOLERANCE) / 2;

  return (
    <group>
      {/* Split lines — always shown */}
      {xSplits.map((splitX, i) => (
        <group key={`x-${i}`}>
          <Line
            points={[
              [splitX, -halfD, totalH],
              [splitX, halfD, totalH],
            ]}
            {...DASHED_LINE_SHARED}
            lineWidth={2}
            opacity={0.9}
          />
          <Line
            points={[
              [splitX, -halfD, 0],
              [splitX, -halfD, totalH],
            ]}
            {...DASHED_LINE_SHARED}
            lineWidth={1.5}
            opacity={0.5}
          />
          <Line
            points={[
              [splitX, halfD, 0],
              [splitX, halfD, totalH],
            ]}
            {...DASHED_LINE_SHARED}
            lineWidth={1.5}
            opacity={0.5}
          />
        </group>
      ))}

      {ySplits.map((splitY, i) => (
        <group key={`y-${i}`}>
          <Line
            points={[
              [-halfW, splitY, totalH],
              [halfW, splitY, totalH],
            ]}
            {...DASHED_LINE_SHARED}
            lineWidth={2}
            opacity={0.9}
          />
          <Line
            points={[
              [-halfW, splitY, 0],
              [-halfW, splitY, totalH],
            ]}
            {...DASHED_LINE_SHARED}
            lineWidth={1.5}
            opacity={0.5}
          />
          <Line
            points={[
              [halfW, splitY, 0],
              [halfW, splitY, totalH],
            ]}
            {...DASHED_LINE_SHARED}
            lineWidth={1.5}
            opacity={0.5}
          />
        </group>
      ))}
    </group>
  );
});
