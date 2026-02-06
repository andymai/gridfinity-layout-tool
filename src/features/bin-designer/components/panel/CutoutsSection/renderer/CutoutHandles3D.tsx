/**
 * WebGL resize handles for a selected cutout.
 *
 * 8 small quads (4 corners + 4 edge midpoints) scaled inversely with
 * camera zoom for constant screen-space size. Rotated with the cutout.
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import type { ResizeHandle } from '../useCutoutInteraction';
import {
  RENDER_ORDER,
  CORNER_HANDLE_SIZE,
  EDGE_HANDLE_WIDTH,
  EDGE_HANDLE_HEIGHT,
  ACCENT_COLOR_HEX,
  HANDLE_HOVER_SCALE,
} from './constants';

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

const handleFillColor = new THREE.Color(ACCENT_COLOR_HEX); // Amber fill
const handleBorderColor = new THREE.Color('#b45309'); // Darker amber border

export function CutoutHandles3D({ cutout, onResizeStart }: CutoutHandles3DProps) {
  const { camera } = useThree();
  const zoom = camera.zoom;
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle | null>(null);

  // Offset handles outward when cutout is too small
  const smallThresholdW = (CORNER_HANDLE_SIZE * 3) / zoom;
  const smallThresholdD = (CORNER_HANDLE_SIZE * 3) / zoom;
  const isSmall = cutout.width < smallThresholdW || cutout.depth < smallThresholdD;
  const handleOffset = isSmall ? CORNER_HANDLE_SIZE / zoom : 0;

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
        // Convert screen pixels to world units
        const worldWidth = corner ? CORNER_HANDLE_SIZE / zoom : EDGE_HANDLE_WIDTH / zoom;
        const worldHeight = corner ? CORNER_HANDLE_SIZE / zoom : EDGE_HANDLE_HEIGHT / zoom;
        const strokeWidth = 1.5 / zoom; // Dark outline in world units
        const isHovered = hoveredHandle === handle;
        const hoverScale = isHovered ? HANDLE_HOVER_SCALE : 1;

        // Offset handle outward for small cutouts
        let offsetX = localX;
        let offsetY = localY;
        if (isSmall && corner) {
          offsetX += Math.sign(localX) * handleOffset;
          offsetY += Math.sign(localY) * handleOffset;
        } else if (isSmall) {
          // Edge handles
          if (handle === 'n' || handle === 's') offsetY += Math.sign(localY) * handleOffset;
          if (handle === 'e' || handle === 'w') offsetX += Math.sign(localX) * handleOffset;
        }

        return (
          <group key={handle} position={[offsetX, offsetY, 0]} scale={[hoverScale, hoverScale, 1]}>
            {/* Amber fill */}
            <mesh
              renderOrder={RENDER_ORDER.HANDLES}
              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                if (e.nativeEvent.button !== 0) return;
                e.stopPropagation();
                onResizeStart(cutout.id, handle, e.point.x, e.point.y);
              }}
              onPointerEnter={() => setHoveredHandle(handle)}
              onPointerLeave={() => setHoveredHandle(null)}
            >
              <planeGeometry args={[worldWidth, worldHeight]} />
              <meshBasicMaterial color={handleFillColor} depthTest={false} transparent />
            </mesh>
            {/* Darker amber border behind */}
            <mesh renderOrder={RENDER_ORDER.HANDLES} position={[0, 0, -0.001]}>
              <planeGeometry args={[worldWidth + strokeWidth, worldHeight + strokeWidth]} />
              <meshBasicMaterial color={handleBorderColor} depthTest={false} transparent />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
