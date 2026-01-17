import { useMemo } from 'react';
import * as THREE from 'three';
import type { FractionalEdge } from '../../../../../core/types';

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
export function FloorGrid({ width, depth, fractionalEdgeX = 'end', fractionalEdgeY = 'end' }: FloorGridProps) {
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
  }, [width, depth, integerWidth, integerDepth, hasFractionalWidth, hasFractionalDepth, fractionalWidthPart, fractionalDepthPart, fractionalEdgeX, fractionalEdgeY]);

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
  }, [width, depth, hasFractionalWidth, hasFractionalDepth, fractionalWidthPart, fractionalDepthPart, fractionalEdgeX, fractionalEdgeY]);

  return (
    <group>
      {/* Floor plane - no rotation needed since Z is up */}
      <mesh position={[width / 2, depth / 2, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color="#2a2a3e" side={THREE.DoubleSide} />
      </mesh>

      {/* Main gridlines at integer positions - raised slightly to prevent z-fighting */}
      <lineSegments geometry={gridGeometry} position={[0, 0, 0.01]}>
        <lineBasicMaterial color="#ffffff" opacity={0.12} transparent />
      </lineSegments>

      {/* Fractional edge lines - slightly less visible for subtle appearance */}
      {fractionalEdgeGeometry && (
        <lineSegments geometry={fractionalEdgeGeometry} position={[0, 0, 0.01]}>
          <lineBasicMaterial color="#ffffff" opacity={0.08} transparent />
        </lineSegments>
      )}
    </group>
  );
}
