import { useMemo } from 'react';
import * as THREE from 'three';
import type { FractionalEdge } from '@/core/types';
import { useThreeColors } from '@/hooks/useThemeEffect';
import { useSettingsStore } from '@/core/store';

interface FloorGridProps {
  width: number;
  depth: number;
  fractionalEdgeX?: FractionalEdge;
  fractionalEdgeY?: FractionalEdge;
}

/**
 * Drawer floor plane with flat gridlines at 1-unit intervals.
 * Constrained to drawer bounds with subtle edge highlights.
 * Includes fractional edge lines when drawer has fractional dimensions.
 * Respects fractionalEdgeX/Y settings for line positioning.
 */
export function FloorGrid({
  width,
  depth,
  fractionalEdgeX = 'end',
  fractionalEdgeY = 'end',
}: FloorGridProps) {
  const colors = useThreeColors();
  const gridShowLines = useSettingsStore((s) => s.settings.gridShowLines);
  const gridShowHalfLines = useSettingsStore((s) => s.settings.gridShowHalfLines);
  const gridLineOpacity = useSettingsStore((s) => s.settings.gridLineOpacity);
  // Check for fractional dimensions
  const hasFractionalWidth = width % 1 !== 0;
  const hasFractionalDepth = depth % 1 !== 0;
  const integerWidth = Math.floor(width);
  const integerDepth = Math.floor(depth);
  const fractionalWidthPart = width - integerWidth; // e.g., 0.5
  const fractionalDepthPart = depth - integerDepth; // e.g., 0.5

  // Create gridline geometry for integer positions
  const gridGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];

    // Lines parallel to Y-axis (vertical in 3D view)
    // When fractionalEdgeX='start', integer lines start at fractionalWidthPart
    const xOffset = hasFractionalWidth && fractionalEdgeX === 'start' ? fractionalWidthPart : 0;
    for (let i = 0; i <= integerWidth; i++) {
      const x = xOffset + i;
      positions.push(x, 0, 0);
      positions.push(x, depth, 0);
    }

    // Lines parallel to X-axis (horizontal in 3D view)
    // When fractionalEdgeY='start', integer lines start at fractionalDepthPart
    const yOffset = hasFractionalDepth && fractionalEdgeY === 'start' ? fractionalDepthPart : 0;
    for (let i = 0; i <= integerDepth; i++) {
      const y = yOffset + i;
      positions.push(0, y, 0);
      positions.push(width, y, 0);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [
    width,
    depth,
    integerWidth,
    integerDepth,
    hasFractionalWidth,
    hasFractionalDepth,
    fractionalWidthPart,
    fractionalDepthPart,
    fractionalEdgeX,
    fractionalEdgeY,
  ]);

  // Create separate geometry for fractional edge lines (drawer boundaries)
  const fractionalEdgeGeometry = useMemo(() => {
    if (!hasFractionalWidth && !hasFractionalDepth) return null;

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];

    if (hasFractionalWidth) {
      // Vertical line at fractional edge position
      const x = fractionalEdgeX === 'start' ? fractionalWidthPart : width;
      positions.push(x, 0, 0);
      positions.push(x, depth, 0);
    }

    if (hasFractionalDepth) {
      // Horizontal line at fractional edge position
      const y = fractionalEdgeY === 'start' ? fractionalDepthPart : depth;
      positions.push(0, y, 0);
      positions.push(width, y, 0);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [
    width,
    depth,
    hasFractionalWidth,
    hasFractionalDepth,
    fractionalWidthPart,
    fractionalDepthPart,
    fractionalEdgeX,
    fractionalEdgeY,
  ]);

  // Half-bin subdivision lines at 0.5 intervals between integer lines
  const halfBinGeometry = useMemo(() => {
    if (!gridShowHalfLines) return null;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const xOffset = hasFractionalWidth && fractionalEdgeX === 'start' ? fractionalWidthPart : 0;
    for (let i = 0; i < integerWidth; i++) {
      const x = xOffset + i + 0.5;
      positions.push(x, 0, 0);
      positions.push(x, depth, 0);
    }
    const yOffset = hasFractionalDepth && fractionalEdgeY === 'start' ? fractionalDepthPart : 0;
    for (let i = 0; i < integerDepth; i++) {
      const y = yOffset + i + 0.5;
      positions.push(0, y, 0);
      positions.push(width, y, 0);
    }
    if (positions.length === 0) return null;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [
    width,
    depth,
    integerWidth,
    integerDepth,
    hasFractionalWidth,
    hasFractionalDepth,
    fractionalWidthPart,
    fractionalDepthPart,
    fractionalEdgeX,
    fractionalEdgeY,
    gridShowHalfLines,
  ]);

  return (
    <group>
      {/* Floor plane - no rotation needed since Z is up */}
      <mesh position={[width / 2, depth / 2, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={colors.floorPlane} side={THREE.DoubleSide} />
      </mesh>

      {/* Main gridlines at integer positions - raised slightly to prevent z-fighting */}
      {gridShowLines && (
        <lineSegments geometry={gridGeometry} position={[0, 0, 0.01]}>
          <lineBasicMaterial
            color={colors.gridLine}
            opacity={colors.gridLineOpacity * (gridLineOpacity / 100)}
            transparent
          />
        </lineSegments>
      )}

      {/* Half-bin subdivision lines at 0.5 intervals */}
      {gridShowLines && halfBinGeometry && (
        <lineSegments geometry={halfBinGeometry} position={[0, 0, 0.01]}>
          <lineBasicMaterial
            color={colors.gridLine}
            opacity={colors.gridLineOpacity * 0.5 * (gridLineOpacity / 100)}
            transparent
          />
        </lineSegments>
      )}

      {/* Fractional edge lines - slightly less visible for subtle appearance */}
      {gridShowLines && fractionalEdgeGeometry && (
        <lineSegments geometry={fractionalEdgeGeometry} position={[0, 0, 0.01]}>
          <lineBasicMaterial
            color={colors.gridLine}
            opacity={colors.gridEdgeOpacity * (gridLineOpacity / 100)}
            transparent
          />
        </lineSegments>
      )}
    </group>
  );
}
