/**
 * Grid axis labels for the bin designer 3D preview.
 *
 * Renders numbered column (X) and row (Y) labels along the bin's footprint edges,
 * with tick marks at cell boundaries. Adapted from the layout planner's AxisLabels
 * but operating in mm-space with the bin centered at origin.
 *
 * X-axis labels: along the front edge (negative Y), numbered left to right
 * Y-axis labels: along the left edge (negative X), numbered front to back
 *
 * Supports half-bin fractional dimensions (shows "+.5" for fractional cells).
 */

import { useMemo, useEffect } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { GRIDFINITY } from '@/shared/constants/bin';
import { useThreeColors } from '@/hooks/useThemeEffect';

interface BinAxisLabelsProps {
  /** Bin width in grid units (can be fractional for half-bin mode) */
  width: number;
  /** Bin depth in grid units (can be fractional for half-bin mode) */
  depth: number;
  /** Grid unit size in mm (defaults to standard 42mm) */
  gridUnitMm?: number;
}

// Styling constants matched to planner's AxisLabels proportions
// (planner values × GRID_SIZE, scaled for typical 2–4 unit bins)
const LABEL_OPACITY = 0.45;
const FRACTIONAL_LABEL_OPACITY = 0.35;
const FONT_SIZE = 4; // mm (planner: 0.28 units)
const FRACTIONAL_FONT_SIZE = 3.2; // mm (planner: 0.22 units)
const TICK_SIZE = 3; // mm — outward from edge (planner: 0.08 units)
const TICK_OPACITY = 0.3;
const LABEL_OFFSET = 5; // mm from bin edge to label anchor (planner: 0.28 units)
const TICK_OFFSET = 0.5; // mm above Z=0 to avoid z-fighting with floor
const FRACTIONAL_LABEL = '+.5'; // Display label for half-unit cells

/**
 * Grid axis labels showing column/row numbers along bin edges.
 * Matches the architectural drawing style of the layout planner.
 */
export function BinAxisLabels({ width, depth, gridUnitMm }: BinAxisLabelsProps) {
  const colors = useThreeColors();
  const GS = gridUnitMm ?? GRIDFINITY.GRID_SIZE;

  const halfW = (width * GS) / 2;
  const halfD = (depth * GS) / 2;

  const integerWidth = Math.floor(width);
  const integerDepth = Math.floor(depth);
  const hasFractionalWidth = width % 1 !== 0;
  const hasFractionalDepth = depth % 1 !== 0;

  // Build X-axis labels (columns)
  const xLabels: { value: number; isFractional: boolean }[] = [];
  for (let i = 1; i <= integerWidth; i++) {
    xLabels.push({ value: i, isFractional: false });
  }
  if (hasFractionalWidth) {
    xLabels.push({ value: width, isFractional: true });
  }

  // Build Y-axis labels (rows)
  const yLabels: { value: number; isFractional: boolean }[] = [];
  for (let i = 1; i <= integerDepth; i++) {
    yLabels.push({ value: i, isFractional: false });
  }
  if (hasFractionalDepth) {
    yLabels.push({ value: depth, isFractional: true });
  }

  // Create tick mark geometry at cell boundaries
  const tickGeometry = useMemo(() => {
    const positions: number[] = [];

    // X-axis ticks along the front edge — outward only (matching planner)
    for (let i = 0; i <= integerWidth; i++) {
      const x = -halfW + i * GS;
      positions.push(x, -halfD, TICK_OFFSET);
      positions.push(x, -halfD - TICK_SIZE, TICK_OFFSET);
    }
    if (hasFractionalWidth) {
      positions.push(halfW, -halfD, TICK_OFFSET);
      positions.push(halfW, -halfD - TICK_SIZE, TICK_OFFSET);
    }

    // Y-axis ticks along the left edge — outward only (matching planner)
    for (let i = 0; i <= integerDepth; i++) {
      const y = -halfD + i * GS;
      positions.push(-halfW, y, TICK_OFFSET);
      positions.push(-halfW - TICK_SIZE, y, TICK_OFFSET);
    }
    if (hasFractionalDepth) {
      positions.push(-halfW, halfD, TICK_OFFSET);
      positions.push(-halfW - TICK_SIZE, halfD, TICK_OFFSET);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [halfW, halfD, integerWidth, integerDepth, hasFractionalWidth, hasFractionalDepth, GS]);

  // Cleanup geometry on unmount or change
  useEffect(() => {
    return () => {
      tickGeometry.dispose();
    };
  }, [tickGeometry]);

  return (
    <group>
      {/* Tick marks */}
      <lineSegments geometry={tickGeometry}>
        <lineBasicMaterial color={colors.labelColor} transparent opacity={TICK_OPACITY} />
      </lineSegments>

      {/* X-axis labels (columns) — along front edge */}
      {xLabels.map(({ value, isFractional }, idx) => {
        // Center label in its grid cell
        const xPos = isFractional
          ? -halfW + (integerWidth + (width - integerWidth) / 2) * GS
          : -halfW + (value - 0.5) * GS;
        const yPos = -halfD - LABEL_OFFSET;
        const label = isFractional ? FRACTIONAL_LABEL : value.toString();

        return (
          <Text
            key={`x-${idx}`}
            position={[xPos, yPos, TICK_OFFSET]}
            fontSize={isFractional ? FRACTIONAL_FONT_SIZE : FONT_SIZE}
            color={colors.labelColor}
            fillOpacity={isFractional ? FRACTIONAL_LABEL_OPACITY : LABEL_OPACITY}
            anchorX="center"
            anchorY="top"
          >
            {label}
          </Text>
        );
      })}

      {/* Y-axis labels (rows) — along left edge */}
      {yLabels.map(({ value, isFractional }, idx) => {
        // Center label in its grid cell
        const yPos = isFractional
          ? -halfD + (integerDepth + (depth - integerDepth) / 2) * GS
          : -halfD + (value - 0.5) * GS;
        const xPos = -halfW - LABEL_OFFSET;
        const label = isFractional ? FRACTIONAL_LABEL : value.toString();

        return (
          <Text
            key={`y-${idx}`}
            position={[xPos, yPos, TICK_OFFSET]}
            fontSize={isFractional ? FRACTIONAL_FONT_SIZE : FONT_SIZE}
            color={colors.labelColor}
            fillOpacity={isFractional ? FRACTIONAL_LABEL_OPACITY : LABEL_OPACITY}
            anchorX="right"
            anchorY="middle"
          >
            {label}
          </Text>
        );
      })}
    </group>
  );
}
