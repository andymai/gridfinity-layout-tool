import { useMemo } from 'react';
import * as THREE from 'three';

interface FloorGridProps {
  width: number;
  depth: number;
}

/**
 * Drawer floor plane with flat gridlines at 1-unit intervals.
 * Constrained to drawer bounds with subtle edge highlights.
 */
export function FloorGrid({ width, depth }: FloorGridProps) {
  // Create gridline geometry
  const gridGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];

    // Lines parallel to X-axis (along depth)
    for (let x = 0; x <= width; x++) {
      positions.push(x, 0, 0);
      positions.push(x, depth, 0);
    }

    // Lines parallel to Y-axis (along width)
    for (let y = 0; y <= depth; y++) {
      positions.push(0, y, 0);
      positions.push(width, y, 0);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [width, depth]);

  // Create floor edge geometry (baseplate rim)
  const edgeGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = [
      // Floor perimeter
      0, 0, 0,
      width, 0, 0,
      width, 0, 0,
      width, depth, 0,
      width, depth, 0,
      0, depth, 0,
      0, depth, 0,
      0, 0, 0,
    ];

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [width, depth]);

  return (
    <group>
      {/* Floor plane - no rotation needed since Z is up */}
      <mesh position={[width / 2, depth / 2, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color="#2a2a3e" side={THREE.DoubleSide} />
      </mesh>

      {/* Drop shadow beneath floor */}
      <mesh position={[width / 2, depth / 2, -0.15]}>
        <planeGeometry args={[width + 0.8, depth + 0.8]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Gridlines - raised slightly to prevent z-fighting with floor */}
      <lineSegments geometry={gridGeometry} position={[0, 0, 0.01]}>
        <lineBasicMaterial color="#ffffff" opacity={0.12} transparent />
      </lineSegments>

      {/* Floor edge highlight (baseplate rim) - raised slightly */}
      <lineSegments geometry={edgeGeometry} position={[0, 0, 0.01]}>
        <lineBasicMaterial color="#ffffff" opacity={0.18} transparent linewidth={1.2} />
      </lineSegments>
    </group>
  );
}
