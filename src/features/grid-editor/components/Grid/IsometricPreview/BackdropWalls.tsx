import { useMemo } from 'react';
import * as THREE from 'three';
import { useUIStore } from '@/core/store';

// Height units (7mm) to grid units (42mm) conversion
const HEIGHT_TO_GRID_SCALE = 7 / 42;

interface BackdropWallsProps {
  width: number;
  depth: number;
  maxHeight: number;
}

/**
 * Determine which two walls should be visible based on rotation.
 * Like The Sims "hide walls" - only show walls behind the scene.
 */
function getVisibleWalls(rotation: number): { showFront: boolean; showRight: boolean; showBack: boolean; showLeft: boolean } {
  const r = ((rotation % 360) + 360) % 360;

  if (r >= 315 || r < 45) {
    // 0°: Camera at front-right, show back and left walls
    return { showFront: false, showRight: false, showBack: true, showLeft: true };
  } else if (r >= 45 && r < 135) {
    // 90°: Camera at back-right, show front and left walls
    return { showFront: true, showRight: false, showBack: false, showLeft: true };
  } else if (r >= 135 && r < 225) {
    // 180°: Camera at back-left, show front and right walls
    return { showFront: true, showRight: true, showBack: false, showLeft: false };
  } else {
    // 270°: Camera at front-left, show back and right walls
    return { showFront: false, showRight: true, showBack: true, showLeft: false };
  }
}

/**
 * Backdrop walls showing the full drawer volume with height tick lines.
 * Uses "hide walls" logic - only shows walls behind the scene based on camera rotation.
 */
export function BackdropWalls({ width, depth, maxHeight }: BackdropWallsProps) {
  const wallMaxZ = maxHeight * HEIGHT_TO_GRID_SCALE;
  const tickInterval = 3; // Every 3 height units

  const isometricRotation = useUIStore((state) => state.isometricRotation);
  const visibleWalls = getVisibleWalls(isometricRotation);

  // Create all 4 wall geometries with vertical gradients
  const frontWallGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();

    // Front wall vertices (Y=0)
    const positions = [
      // Triangle 1
      0, 0, 0,
      width, 0, 0,
      width, 0, wallMaxZ,
      // Triangle 2
      0, 0, 0,
      width, 0, wallMaxZ,
      0, 0, wallMaxZ,
    ];

    // Vertex colors with gradient (lighter at top)
    const baseColor = new THREE.Color('#2a2a3e');
    const topColor = new THREE.Color('#32324a');
    const colors: number[] = [];

    // Bottom vertices (dark)
    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(topColor.r, topColor.g, topColor.b); // Top

    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(topColor.r, topColor.g, topColor.b); // Top
    colors.push(topColor.r, topColor.g, topColor.b); // Top

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    return geometry;
  }, [width, wallMaxZ]);

  const rightWallGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();

    // Right wall vertices (X=width)
    const positions = [
      // Triangle 1
      width, 0, 0,
      width, depth, 0,
      width, depth, wallMaxZ,
      // Triangle 2
      width, 0, 0,
      width, depth, wallMaxZ,
      width, 0, wallMaxZ,
    ];

    // Vertex colors with gradient
    const baseColor = new THREE.Color('#252535');
    const topColor = new THREE.Color('#2d2d40');
    const colors: number[] = [];

    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(topColor.r, topColor.g, topColor.b);

    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(topColor.r, topColor.g, topColor.b);
    colors.push(topColor.r, topColor.g, topColor.b);

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    return geometry;
  }, [width, depth, wallMaxZ]);

  const backWallGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();

    // Back wall vertices (Y=depth)
    const positions = [
      // Triangle 1
      0, depth, 0,
      width, depth, 0,
      width, depth, wallMaxZ,
      // Triangle 2
      0, depth, 0,
      width, depth, wallMaxZ,
      0, depth, wallMaxZ,
    ];

    // Vertex colors with gradient
    const baseColor = new THREE.Color('#2a2a3e');
    const topColor = new THREE.Color('#32324a');
    const colors: number[] = [];

    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(topColor.r, topColor.g, topColor.b);

    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(topColor.r, topColor.g, topColor.b);
    colors.push(topColor.r, topColor.g, topColor.b);

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    return geometry;
  }, [width, depth, wallMaxZ]);

  const leftWallGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();

    // Left wall vertices (X=0)
    const positions = [
      // Triangle 1
      0, 0, 0,
      0, depth, 0,
      0, depth, wallMaxZ,
      // Triangle 2
      0, 0, 0,
      0, depth, wallMaxZ,
      0, 0, wallMaxZ,
    ];

    // Vertex colors with gradient
    const baseColor = new THREE.Color('#252535');
    const topColor = new THREE.Color('#2d2d40');
    const colors: number[] = [];

    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(topColor.r, topColor.g, topColor.b);

    colors.push(baseColor.r, baseColor.g, baseColor.b);
    colors.push(topColor.r, topColor.g, topColor.b);
    colors.push(topColor.r, topColor.g, topColor.b);

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    return geometry;
  }, [depth, wallMaxZ]);

  // Create height tick lines geometry for all walls
  const tickLinesGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];

    // Draw horizontal lines at each tick height on visible walls
    for (let h = tickInterval; h <= maxHeight; h += tickInterval) {
      const z = h * HEIGHT_TO_GRID_SCALE;

      // Front wall ticks (Y=0) - horizontal line along X
      if (visibleWalls.showFront) {
        positions.push(0, 0, z);
        positions.push(width, 0, z);
      }

      // Right wall ticks (X=width) - horizontal line along Y
      if (visibleWalls.showRight) {
        positions.push(width, 0, z);
        positions.push(width, depth, z);
      }

      // Back wall ticks (Y=depth) - horizontal line along X
      if (visibleWalls.showBack) {
        positions.push(0, depth, z);
        positions.push(width, depth, z);
      }

      // Left wall ticks (X=0) - horizontal line along Y
      if (visibleWalls.showLeft) {
        positions.push(0, 0, z);
        positions.push(0, depth, z);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [width, depth, maxHeight, visibleWalls]);

  return (
    <group>
      {/* Only render walls that are behind the scene (hide walls in front) */}

      {/* Front wall (Y=0) */}
      {visibleWalls.showFront && (
        <mesh geometry={frontWallGeometry}>
          <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Right wall (X=width) */}
      {visibleWalls.showRight && (
        <mesh geometry={rightWallGeometry}>
          <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Back wall (Y=depth) */}
      {visibleWalls.showBack && (
        <mesh geometry={backWallGeometry}>
          <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Left wall (X=0) */}
      {visibleWalls.showLeft && (
        <mesh geometry={leftWallGeometry}>
          <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Height tick lines (dashed) - only on visible walls */}
      <lineSegments geometry={tickLinesGeometry}>
        <lineDashedMaterial
          color="#ffffff"
          opacity={0.08}
          transparent
          dashSize={0.4}
          gapSize={0.4}
        />
      </lineSegments>
    </group>
  );
}
