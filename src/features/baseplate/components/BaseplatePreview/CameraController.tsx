import { useRef, useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import type { RefObject } from 'react';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import {
  CAMERA_PRESETS,
  easeOutCubic,
  calculateIdealDistance,
  calculateMaxOrbitDistance,
  calculateFarPlane,
} from './cameraUtils';

function setCameraFar(camera: THREE.Camera, far: number): void {
  if (!(camera instanceof PerspectiveCamera)) return;
  camera.far = far;
  camera.updateProjectionMatrix();
}

/**
 * Camera controller that frames the baseplate on mount.
 * Also exposes invalidate to hooks outside Canvas context via invalidateRef.
 */
export function CameraController({
  controlsRef,
  invalidateRef,
  width,
  depth,
  gridUnitMm,
  paddingLeft,
  paddingRight,
  paddingFront,
  paddingBack,
}: {
  controlsRef: RefObject<OrbitControlsType | null>;
  invalidateRef: RefObject<(() => void) | null>;
  width: number;
  depth: number;
  gridUnitMm: number;
  paddingLeft: number;
  paddingRight: number;
  paddingFront: number;
  paddingBack: number;
}) {
  const { camera, invalidate } = useThree();
  const initializedRef = useRef(false);

  // Expose invalidate to hooks outside Canvas context
  useEffect(() => {
    invalidateRef.current = invalidate;
  }, [invalidate, invalidateRef]);

  const fov = 45;
  const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;
  const binCenter = useMemo(() => new THREE.Vector3(0, 0, totalH / 2), [totalH]);
  const idealDistance = useMemo(
    () =>
      calculateIdealDistance(
        width,
        depth,
        gridUnitMm,
        paddingLeft,
        paddingRight,
        paddingFront,
        paddingBack,
        fov
      ),
    [width, depth, gridUnitMm, paddingLeft, paddingRight, paddingFront, paddingBack]
  );

  // Keep the far plane ahead of the user's zoom-out range. Without this,
  // the geometry's farthest corner clips off-screen at maximum zoom for
  // large baseplates (50×50 + 100mm padding pushes the corner past 21m).
  useEffect(() => {
    const targetFar = calculateFarPlane(calculateMaxOrbitDistance(idealDistance));
    setCameraFar(camera, targetFar);
    invalidate();
  }, [camera, idealDistance, invalidate]);

  const animRef = useRef<{
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    startTime: number;
    duration: number;
  } | null>(null);
  const prevDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!initializedRef.current) {
      const direction = new THREE.Vector3(...CAMERA_PRESETS.top).normalize();
      camera.position.copy(direction.multiplyScalar(idealDistance).add(binCenter));
      camera.up.set(0, 0, 1);
      camera.lookAt(binCenter);
      if (controlsRef.current) {
        controlsRef.current.target.copy(binCenter);
        controlsRef.current.update();
      }
      prevDistanceRef.current = idealDistance;
      initializedRef.current = true;
      return;
    }

    const prevDistance = prevDistanceRef.current ?? idealDistance;
    const distanceChange = Math.abs(idealDistance - prevDistance) / prevDistance;

    if (distanceChange > 0.1) {
      const currentPos = camera.position.clone();
      const currentDir = currentPos.clone().sub(binCenter).normalize();
      const targetPos = currentDir.multiplyScalar(idealDistance).add(binCenter);

      animRef.current = {
        startPos: currentPos,
        targetPos,
        startTime: performance.now(),
        duration: 300,
      };
    }

    prevDistanceRef.current = idealDistance;
  }, [idealDistance, binCenter, camera, controlsRef]);

  useEffect(() => {
    if (controlsRef.current && initializedRef.current) {
      controlsRef.current.target.copy(binCenter);
      controlsRef.current.update();
    }
  }, [binCenter, controlsRef]);

  useFrame(() => {
    const anim = animRef.current;
    if (!anim) return;

    const elapsed = performance.now() - anim.startTime;
    const progress = Math.min(elapsed / anim.duration, 1);
    const eased = easeOutCubic(progress);

    camera.position.lerpVectors(anim.startPos, anim.targetPos, eased);
    camera.lookAt(binCenter);
    invalidate();

    if (progress >= 1) {
      animRef.current = null;
      controlsRef.current?.update();
    }
  });

  return null;
}
