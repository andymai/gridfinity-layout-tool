import type { Vector3 } from 'three';
import { sceneToStore } from './workshopPlacement';
import { type HoverSurface } from './useWorkshopInteraction';

/**
 * While the gizmo is grabbed, every pointer move must resolve to a world
 * point on the ring's plane regardless of what is underneath — same trick
 * as DragCatchPlane, at the ring's height so the angle has no parallax.
 */
export function RotationCatchPlane({
  baseW,
  baseD,
  z,
  onRotateMove,
  sceneFromWorld,
}: {
  baseW: number;
  baseD: number;
  z: number;
  onRotateMove: (world: { x: number; y: number }) => void;
  sceneFromWorld: (point: Vector3) => Vector3;
}) {
  return (
    <mesh
      position={[0, 0, z]}
      onPointerMove={(e) => {
        const local = sceneFromWorld(e.point);
        onRotateMove({
          x: sceneToStore(local.x, baseW),
          y: sceneToStore(local.y, baseD),
        });
      }}
    >
      <planeGeometry args={[baseW * 6, baseD * 6]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/**
 * While a part is dragged, pointer moves over empty space still need a
 * surface — an oversized invisible plane at the base floor answers them.
 */
export function DragCatchPlane({
  baseW,
  baseD,
  onSurfaceMove,
  sceneFromWorld,
}: {
  baseW: number;
  baseD: number;
  onSurfaceMove: (surface: HoverSurface) => void;
  sceneFromWorld: (point: Vector3) => Vector3;
}) {
  return (
    <mesh
      position={[0, 0, -0.05]}
      onPointerMove={(e) => {
        const local = sceneFromWorld(e.point);
        onSurfaceMove({
          parentId: null,
          topZ: 0,
          x: sceneToStore(local.x, baseW),
          y: sceneToStore(local.y, baseD),
        });
      }}
    >
      <planeGeometry args={[baseW * 4, baseD * 4]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}
