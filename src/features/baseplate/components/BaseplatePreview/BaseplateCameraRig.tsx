/**
 * Camera rig for the baseplate preview — mirrors the bin-designer rig.
 *
 * Mounts a perspective and orthographic drei camera; only one carries
 * `makeDefault` at a time. On every projection swap, copies position/up/quaternion
 * from the previously active camera and round-trips perspective distance ↔
 * orthographic zoom so on-screen scale is preserved. `useLayoutEffect` runs
 * before paint so the first frame after the swap is already framed.
 */

import { useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  PerspectiveCamera as DreiPerspectiveCamera,
  OrthographicCamera as DreiOrthographicCamera,
} from '@react-three/drei';
import type {
  PerspectiveCamera as PerspectiveCameraImpl,
  OrthographicCamera as OrthographicCameraImpl,
} from 'three';
import type { OrthographicCamera as OrthographicCameraType } from 'three';
import { distanceToOrthoZoom, orthoZoomToDistance } from '@/shared/utils/cameraProjection';

/** Default vertical FOV (degrees) used for the perspective camera and round-trip math. */
const CAMERA_FOV = 45;

/** Outside-of-hook helper to keep the react-hooks immutability rule satisfied. */
function setOrthoZoom(ortho: OrthographicCameraType, zoom: number): void {
  ortho.zoom = zoom;
  ortho.updateProjectionMatrix();
}

export type BaseplateProjection = 'perspective' | 'orthographic';

interface BaseplateCameraRigProps {
  projection: BaseplateProjection;
  initialPosition: readonly [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
  orthoNear?: number;
  orthoFar?: number;
}

export function BaseplateCameraRig({
  projection,
  initialPosition,
  fov = CAMERA_FOV,
  near = 0.1,
  far = 20000,
  orthoNear = -20000,
  orthoFar = 20000,
}: BaseplateCameraRigProps) {
  const perspRef = useRef<PerspectiveCameraImpl>(null);
  const orthoRef = useRef<OrthographicCameraImpl>(null);
  const { camera, size, invalidate } = useThree();

  useLayoutEffect(() => {
    const persp = perspRef.current;
    const ortho = orthoRef.current;
    if (!persp || !ortho) return;

    if (projection === 'orthographic') {
      const distance = persp.position.length();
      ortho.position.copy(persp.position);
      ortho.up.copy(persp.up);
      ortho.quaternion.copy(persp.quaternion);
      if (size.height > 0 && distance > 0) {
        setOrthoZoom(ortho, distanceToOrthoZoom(distance, fov, size.height));
      } else {
        ortho.updateProjectionMatrix();
      }
    } else {
      const direction = ortho.position.clone().normalize();
      const distance =
        size.height > 0 && ortho.zoom > 0
          ? orthoZoomToDistance(ortho.zoom, fov, size.height)
          : ortho.position.length();
      if (direction.lengthSq() > 0 && distance > 0) {
        persp.position.copy(direction.multiplyScalar(distance));
      } else {
        persp.position.copy(ortho.position);
      }
      persp.up.copy(ortho.up);
      persp.quaternion.copy(ortho.quaternion);
      persp.updateProjectionMatrix();
    }
    invalidate();
  }, [projection, camera, size.height, fov, invalidate]);

  const halfW = size.width / 2;
  const halfH = size.height / 2;

  return (
    <>
      <DreiPerspectiveCamera
        ref={perspRef}
        makeDefault={projection === 'perspective'}
        position={initialPosition}
        fov={fov}
        near={near}
        far={far}
      />
      <DreiOrthographicCamera
        ref={orthoRef}
        makeDefault={projection === 'orthographic'}
        position={initialPosition}
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
