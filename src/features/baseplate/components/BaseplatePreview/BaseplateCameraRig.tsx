/**
 * Camera rig for the baseplate preview — mirrors the bin-designer rig.
 *
 * Mounts a perspective and orthographic drei camera; only one carries
 * `makeDefault` at a time. On the actual projection swap, copies pose from
 * the previously active camera and round-trips perspective distance ↔
 * orthographic zoom relative to the orbit `target` so on-screen scale is
 * preserved. Canvas resizes only refresh the ortho zoom against the ortho
 * camera's *current* pose — they don't masquerade as a swap and reset the
 * user's orbit. `useLayoutEffect` runs before paint so the first frame
 * after the swap is already framed.
 */

import { useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  PerspectiveCamera as DreiPerspectiveCamera,
  OrthographicCamera as DreiOrthographicCamera,
} from '@react-three/drei';
import { Vector3 } from 'three';
import type {
  PerspectiveCamera as PerspectiveCameraImpl,
  OrthographicCamera as OrthographicCameraImpl,
} from 'three';
import { distanceToOrthoZoom, orthoZoomToDistance } from '@/shared/utils/cameraProjection';

/** Default vertical FOV (degrees) used for the perspective camera and round-trip math. */
const CAMERA_FOV = 45;

/** World is Z-up across the baseplate preview; pass to drei cameras at construction. */
const UP_Z: [number, number, number] = [0, 0, 1];

/** Outside-of-hook helper to keep the react-hooks immutability rule satisfied. */
function setOrthoZoom(ortho: OrthographicCameraImpl, zoom: number): void {
  ortho.zoom = zoom;
  ortho.updateProjectionMatrix();
}

export type BaseplateProjection = 'perspective' | 'orthographic';

interface BaseplateCameraRigProps {
  projection: BaseplateProjection;
  initialPosition: readonly [number, number, number];
  /**
   * World-space orbit target. The scale-preserving distance ↔ zoom math is
   * computed relative to this point — pass the same target you give to
   * `<OrbitControls target={...}>` so a projection swap doesn't drift scale
   * for scenes whose center isn't at the origin.
   */
  target?: readonly [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
  orthoNear?: number;
  orthoFar?: number;
}

export function BaseplateCameraRig({
  projection,
  initialPosition,
  target = [0, 0, 0],
  fov = CAMERA_FOV,
  near = 0.1,
  far = 20000,
  orthoNear = -20000,
  orthoFar = 20000,
}: BaseplateCameraRigProps) {
  const perspRef = useRef<PerspectiveCameraImpl>(null);
  const orthoRef = useRef<OrthographicCameraImpl>(null);
  // Track the projection that was active on the previous effect run so a
  // canvas resize doesn't masquerade as a swap and overwrite the user's
  // orbited ortho pose with the perspective camera's last pose.
  const prevProjectionRef = useRef<BaseplateProjection | null>(null);
  const { camera, size, invalidate } = useThree();
  const [tx, ty, tz] = target;

  useLayoutEffect(() => {
    const persp = perspRef.current;
    const ortho = orthoRef.current;
    if (!persp || !ortho) return;

    const prevProjection = prevProjectionRef.current;
    const projectionChanged = prevProjection !== null && prevProjection !== projection;
    const targetVec = new Vector3(tx, ty, tz);

    if (projection === 'orthographic') {
      if (projectionChanged) {
        // One-time copy of perspective pose into ortho on the actual swap.
        ortho.position.copy(persp.position);
        ortho.up.copy(persp.up);
        ortho.quaternion.copy(persp.quaternion);
      }
      // Always recompute zoom against the ortho camera's *current* distance
      // to the orbit target so resizes keep on-screen scale without
      // discarding any orbiting the user did in ortho mode.
      if (size.height > 0) {
        const distance = ortho.position.distanceTo(targetVec);
        if (distance > 0) {
          setOrthoZoom(ortho, distanceToOrthoZoom(distance, fov, size.height));
        } else {
          ortho.updateProjectionMatrix();
        }
      }
    } else if (projectionChanged) {
      // Swap ortho → perspective: derive the equivalent perspective distance
      // from the ortho camera's current zoom (so the user's ortho-mode zoom
      // is honored) and place the camera along the same direction relative
      // to the orbit target.
      const offset = ortho.position.clone().sub(targetVec);
      const direction = offset.lengthSq() > 0 ? offset.normalize() : new Vector3(0, 0, 1);
      const distance =
        size.height > 0 && ortho.zoom > 0
          ? orthoZoomToDistance(ortho.zoom, fov, size.height)
          : ortho.position.distanceTo(targetVec) || persp.position.distanceTo(targetVec);
      if (distance > 0) {
        persp.position.copy(direction.multiplyScalar(distance).add(targetVec));
      } else {
        persp.position.copy(ortho.position);
      }
      persp.up.copy(ortho.up);
      persp.quaternion.copy(ortho.quaternion);
      persp.updateProjectionMatrix();
    }
    // Perspective-mode resize is a no-op — drei's PerspectiveCamera updates
    // its aspect ratio automatically on canvas resize.

    prevProjectionRef.current = projection;
    invalidate();
  }, [projection, camera, size.height, fov, invalidate, tx, ty, tz]);

  const halfW = size.width / 2;
  const halfH = size.height / 2;

  return (
    <>
      <DreiPerspectiveCamera
        ref={perspRef}
        makeDefault={projection === 'perspective'}
        position={initialPosition}
        // Z-up at construction time. Without this the camera is born Three.js-
        // default Y-up; OrbitControls binds before CameraController's effect
        // flips up, and caches its spherical angles relative to the Y-up pose
        // — visible as a 90° roll about the view axis on first render.
        up={UP_Z}
        fov={fov}
        near={near}
        far={far}
      />
      <DreiOrthographicCamera
        ref={orthoRef}
        makeDefault={projection === 'orthographic'}
        position={initialPosition}
        up={UP_Z}
        near={orthoNear}
        far={orthoFar}
        left={-halfW}
        right={halfW}
        top={halfH}
        bottom={-halfH}
      />
    </>
  );
}
