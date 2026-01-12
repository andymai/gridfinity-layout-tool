import { useMemo } from 'react';
import * as THREE from 'three';

interface FloorGridProps {
  width: number;
  depth: number;
}

/**
 * Drawer floor plane with flat gridlines at 1-unit intervals.
 * Constrained to drawer bounds with subtle edge highlights.
 * Includes fractional edge lines when drawer has fractional dimensions.
 */
export function FloorGrid({ width, depth }: FloorGridProps) {
  // Check for fractional dimensions
  const hasFractionalWidth = width % 1 !== 0;
  const hasFractionalDepth = depth % 1 !== 0;

  // Create gridline geometry for integer positions
  const gridGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];

    // Lines parallel to X-axis (along depth) - at integer positions only
    for (let x = 0; x <= Math.floor(width); x++) {
      positions.push(x, 0, 0);
      positions.push(x, depth, 0);
    }

    // Lines parallel to Y-axis (along width) - at integer positions only
    for (let y = 0; y <= Math.floor(depth); y++) {
      positions.push(0, y, 0);
      positions.push(width, y, 0);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [width, depth]);

  // Create separate geometry for fractional edge lines (drawer boundaries)
  const fractionalEdgeGeometry = useMemo(() => {
    if (!hasFractionalWidth && !hasFractionalDepth) return null;

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];

    if (hasFractionalWidth) {
      // Vertical line at fractional width edge
      positions.push(width, 0, 0);
      positions.push(width, depth, 0);
    }

    if (hasFractionalDepth) {
      // Horizontal line at fractional depth edge
      positions.push(0, depth, 0);
      positions.push(width, depth, 0);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [width, depth, hasFractionalWidth, hasFractionalDepth]);

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
