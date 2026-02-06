/**
 * WebGL rotation handle for cutout editor.
 *
 * Circle handle positioned above the cutout, connected by a line.
 * Scales inversely with camera zoom for constant screen-space size.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import {
  RENDER_ORDER,
  ROTATION_HANDLE_OFFSET_PX,
  ROTATION_HANDLE_RADIUS_PX,
  HANDLE_COLOR,
} from './constants';

interface RotationHandle3DProps {
  readonly cutout: Cutout;
  readonly onRotateStart: (id: string, startAngle: number) => void;
}

const handleColor = new THREE.Color(HANDLE_COLOR);
const CIRCLE_SEGMENTS = 16;

export function RotationHandle3D({ cutout, onRotateStart }: RotationHandle3DProps) {
  const { camera } = useThree();
  const zoom = camera.zoom;

  // Cutout center in world coords
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;

  // Handle offset in world units (screen pixels / zoom)
  const offsetWorld = cutout.depth / 2 + ROTATION_HANDLE_OFFSET_PX / zoom;
  const radiusWorld = ROTATION_HANDLE_RADIUS_PX / zoom;

  // Handle position: above the cutout center (higher Y = up)
  const handleX = cx;
  const handleY = cy + offsetWorld;

  // Connector line geometry
  const lineGeometry = useMemo(() => {
    const positions = new Float32Array([cx, cy, 0.05, handleX, handleY, 0.05]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [cx, cy, handleX, handleY]);

  // Circle geometry for handle
  const circleGeometry = useMemo(
    () => new THREE.CircleGeometry(radiusWorld, CIRCLE_SEGMENTS),
    [radiusWorld]
  );

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.button !== 0) return; // Only left-click
    e.stopPropagation();

    // Compute starting angle from cutout center to pointer in world coords
    const dx = e.point.x - cx;
    const dy = e.point.y - cy;
    const startAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    onRotateStart(cutout.id, startAngle);
  };

  return (
    <group renderOrder={RENDER_ORDER.ROTATION_HANDLE}>
      {/* Connector line — thin and subtle */}
      <lineSegments geometry={lineGeometry} renderOrder={RENDER_ORDER.ROTATION_HANDLE}>
        <lineBasicMaterial color={handleColor} transparent opacity={0.3} depthTest={false} />
      </lineSegments>

      {/* Handle circle */}
      <mesh
        position={[handleX, handleY, 0.05]}
        renderOrder={RENDER_ORDER.ROTATION_HANDLE}
        onPointerDown={handlePointerDown}
      >
        <primitive object={circleGeometry} attach="geometry" />
        <meshBasicMaterial color={handleColor} depthTest={false} />
      </mesh>
    </group>
  );
}
