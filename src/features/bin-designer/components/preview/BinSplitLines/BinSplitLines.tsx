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
import {
  getSplitPlanePositionsMm,
  computePinPositions,
} from '@/features/bin-designer/utils/splitPositions';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

const AMBER_COLOR = new THREE.Color(0xfbbf24);
const PIN_COLOR = new THREE.Color(0x60a5fa);
const PIN_SPHERE_GEOM = new THREE.SphereGeometry(1.25, 8, 6);
const EXPLODE_GAP_MM = 10;

const DASHED_LINE_SHARED = {
  color: AMBER_COLOR,
  dashed: true,
  dashScale: 8,
  dashSize: 0.5,
  gapSize: 0.3,
  transparent: true,
} as const;

interface PinIndicatorsProps {
  readonly xSplits: readonly number[];
  readonly ySplits: readonly number[];
  readonly outerW: number;
  readonly outerD: number;
  readonly pinSpacing: number;
  readonly pinZ: number;
  readonly xExplodeOffset?: (i: number) => number;
  readonly yExplodeOffset?: (i: number) => number;
}

function PinIndicators({
  xSplits,
  ySplits,
  outerW,
  outerD,
  pinSpacing,
  pinZ,
  xExplodeOffset,
  yExplodeOffset,
}: PinIndicatorsProps) {
  const pins = useMemo(() => {
    const result: Array<{ x: number; y: number; z: number }> = [];

    // X-axis cuts: pins distributed along Y (depth) axis
    for (let i = 0; i < xSplits.length; i++) {
      const ex = xExplodeOffset?.(i) ?? 0;
      const positions = computePinPositions(outerD, pinSpacing);
      for (const offset of positions) {
        result.push({ x: xSplits[i] + ex, y: offset, z: pinZ });
      }
    }

    // Y-axis cuts: pins distributed along X (width) axis
    for (let i = 0; i < ySplits.length; i++) {
      const ey = yExplodeOffset?.(i) ?? 0;
      const positions = computePinPositions(outerW, pinSpacing);
      for (const offset of positions) {
        result.push({ x: offset, y: ySplits[i] + ey, z: pinZ });
      }
    }

    return result;
  }, [xSplits, ySplits, outerW, outerD, pinSpacing, pinZ, xExplodeOffset, yExplodeOffset]);

  return (
    <>
      {pins.map((pin, i) => (
        <mesh key={i} geometry={PIN_SPHERE_GEOM} position={[pin.x, pin.y, pin.z]} renderOrder={2}>
          <meshStandardMaterial
            color={PIN_COLOR}
            emissive={PIN_COLOR}
            emissiveIntensity={0.3}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
    </>
  );
}

export const BinSplitLines = memo(function BinSplitLines() {
  const { width, depth, height, gridUnitMm, splitConnectors, splitViewMode, baseStyle } =
    useDesignerStore(
      useShallow((s) => ({
        width: s.params.width,
        depth: s.params.depth,
        height: s.params.height,
        gridUnitMm: s.params.gridUnitMm,
        splitConnectors: s.params.splitConnectors,
        splitViewMode: s.ui.splitViewMode,
        baseStyle: s.params.base.style,
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

  const connectorConfig = splitConnectors ?? DEFAULT_SPLIT_CONNECTOR_CONFIG;

  if (!needsSplit) return null;

  const outerW = width * GRIDFINITY.GRID_SIZE;
  const outerD = depth * GRIDFINITY.GRID_SIZE;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const halfW = outerW / 2;
  const halfD = outerD / 2;
  const isExploded = splitViewMode === 'exploded';
  const explodeOffset = (i: number) => (isExploded ? (i + 1) * EXPLODE_GAP_MM : 0);

  return (
    <group>
      {xSplits.map((splitX, i) => {
        const x = splitX + explodeOffset(i);
        return (
          <group key={`x-${i}`}>
            <Line
              points={[
                [x, -halfD, totalH],
                [x, halfD, totalH],
              ]}
              {...DASHED_LINE_SHARED}
              lineWidth={2}
              opacity={0.9}
            />
            <Line
              points={[
                [x, -halfD, 0],
                [x, -halfD, totalH],
              ]}
              {...DASHED_LINE_SHARED}
              lineWidth={1.5}
              opacity={0.5}
            />
            <Line
              points={[
                [x, halfD, 0],
                [x, halfD, totalH],
              ]}
              {...DASHED_LINE_SHARED}
              lineWidth={1.5}
              opacity={0.5}
            />
          </group>
        );
      })}

      {ySplits.map((splitY, i) => {
        const y = splitY + explodeOffset(i);
        return (
          <group key={`y-${i}`}>
            <Line
              points={[
                [-halfW, y, totalH],
                [halfW, y, totalH],
              ]}
              {...DASHED_LINE_SHARED}
              lineWidth={2}
              opacity={0.9}
            />
            <Line
              points={[
                [-halfW, y, 0],
                [-halfW, y, totalH],
              ]}
              {...DASHED_LINE_SHARED}
              lineWidth={1.5}
              opacity={0.5}
            />
            <Line
              points={[
                [halfW, y, 0],
                [halfW, y, totalH],
              ]}
              {...DASHED_LINE_SHARED}
              lineWidth={1.5}
              opacity={0.5}
            />
          </group>
        );
      })}

      {connectorConfig.enabled && (
        <PinIndicators
          xSplits={xSplits}
          ySplits={ySplits}
          outerW={outerW}
          outerD={outerD}
          pinSpacing={connectorConfig.pinSpacing}
          pinZ={
            baseStyle === 'flat'
              ? connectorConfig.pinDiameter / 2 + 0.5
              : GRIDFINITY.SOCKET_HEIGHT / 2
          }
          xExplodeOffset={isExploded ? explodeOffset : undefined}
          yExplodeOffset={isExploded ? explodeOffset : undefined}
        />
      )}
    </group>
  );
});
