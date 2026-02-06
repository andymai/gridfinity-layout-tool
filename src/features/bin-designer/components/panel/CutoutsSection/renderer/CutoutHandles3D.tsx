/**
 * WebGL resize handles for a selected cutout.
 *
 * 8 small quads (4 corners + 4 edge midpoints) scaled inversely with
 * camera zoom for constant screen-space size. Rotated with the cutout.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import type { ResizeHandle } from '../useCutoutInteraction';
import { RENDER_ORDER, CORNER_HANDLE_SIZE, EDGE_HANDLE_SIZE, HANDLE_COLOR } from './constants';

interface CutoutHandles3DProps {
  readonly cutout: Cutout;
  readonly onResizeStart: (id: string, handle: ResizeHandle, mmX: number, mmY: number) => void;
}

interface HandleDef {
  readonly handle: ResizeHandle;
  /** Position relative to cutout center (unrotated local coords) */
  readonly localX: number;
  readonly localY: number;
}

function isCorner(handle: ResizeHandle): boolean {
  return handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw';
}

function getHandleDefs(width: number, depth: number): HandleDef[] {
  const hw = width / 2;
  const hd = depth / 2;
  return [
    { handle: 'nw', localX: -hw, localY: hd },
    { handle: 'n', localX: 0, localY: hd },
    { handle: 'ne', localX: hw, localY: hd },
    { handle: 'e', localX: hw, localY: 0 },
    { handle: 'se', localX: hw, localY: -hd },
    { handle: 's', localX: 0, localY: -hd },
    { handle: 'sw', localX: -hw, localY: -hd },
    { handle: 'w', localX: -hw, localY: 0 },
  ];
}

const handleColor = new THREE.Color(HANDLE_COLOR);

export function CutoutHandles3D({ cutout, onResizeStart }: CutoutHandles3DProps) {
  const { camera } = useThree();
  const zoom = camera.zoom;

  const handles = useMemo(
    () => getHandleDefs(cutout.width, cutout.depth),
    [cutout.width, cutout.depth]
  );

  // Cutout center in world coords
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const rotationZ = -(cutout.rotation * Math.PI) / 180;

  return (
    <group
      position={[cx, cy, 0.05]}
      rotation={[0, 0, rotationZ]}
      renderOrder={RENDER_ORDER.HANDLES}
    >
      {handles.map(({ handle, localX, localY }) => {
        const corner = isCorner(handle);
        const screenSize = corner ? CORNER_HANDLE_SIZE : EDGE_HANDLE_SIZE;
        // Convert screen pixels to world units
        const worldSize = screenSize / zoom;

        return (
          <mesh
            key={handle}
            position={[localX, localY, 0]}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onResizeStart(cutout.id, handle, e.point.x, e.point.y);
            }}
          >
            <planeGeometry args={[worldSize, worldSize]} />
            <meshBasicMaterial color={handleColor} depthTest={false} transparent />
          </mesh>
        );
      })}
    </group>
  );
}
