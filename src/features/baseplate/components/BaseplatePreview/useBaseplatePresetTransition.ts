import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import type { RefObject } from 'react';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import {
  CAMERA_PRESETS,
  TRANSITION_DURATION,
  easeOutCubic,
  calculateIdealDistance,
} from './cameraUtils';
import type { CameraPreset } from './cameraUtils';

/**
 * Manages smooth camera preset transitions using spherical coordinate interpolation.
 * Adapted from the bin designer's usePresetTransition -- uses baseplate's
 * calculateIdealDistance (with padding params) and fixed SOCKET_HEIGHT center.
 */
export function useBaseplatePresetTransition(
  controlsRef: RefObject<OrbitControlsType | null>,
  invalidateRef: RefObject<(() => void) | null>,
  width: number,
  depth: number,
  gridUnitMm: number,
  paddingLeft: number,
  paddingRight: number,
  paddingFront: number,
  paddingBack: number
): (preset: CameraPreset) => void {
  const animFrameRef = useRef<number | null>(null);

  const setCameraPreset = useCallback(
    (preset: CameraPreset) => {
      const controls = controlsRef.current;
      if (!controls) return;

      const camera = controls.object;
      const fov = 45;
      const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;
      const binCenter = new THREE.Vector3(0, 0, totalH / 2);
      const idealDistance = calculateIdealDistance(
        width,
        depth,
        gridUnitMm,
        paddingLeft,
        paddingRight,
        paddingFront,
        paddingBack,
        fov
      );

      const direction = new THREE.Vector3(...CAMERA_PRESETS[preset]).normalize();
      const targetPosition = direction.multiplyScalar(idealDistance).add(binCenter);

      const startPosition = camera.position.clone();
      const target = binCenter.clone();

      // Convert to spherical for smooth arc interpolation
      const startSpherical = new THREE.Spherical().setFromVector3(
        startPosition.clone().sub(target)
      );
      const targetSpherical = new THREE.Spherical().setFromVector3(
        targetPosition.clone().sub(target)
      );

      const startTime = performance.now();

      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
        const eased = easeOutCubic(progress);

        const currentSpherical = new THREE.Spherical(
          startSpherical.radius + (targetSpherical.radius - startSpherical.radius) * eased,
          startSpherical.phi + (targetSpherical.phi - startSpherical.phi) * eased,
          startSpherical.theta + (targetSpherical.theta - startSpherical.theta) * eased
        );

        const newPosition = new THREE.Vector3().setFromSpherical(currentSpherical).add(target);
        camera.position.copy(newPosition);
        camera.up.set(0, 0, 1);
        camera.lookAt(target);
        controls.target.copy(target);
        controls.update();
        invalidateRef.current?.();

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          animFrameRef.current = null;
        }
      };

      animate();
    },
    [
      controlsRef,
      invalidateRef,
      width,
      depth,
      gridUnitMm,
      paddingLeft,
      paddingRight,
      paddingFront,
      paddingBack,
    ]
  );

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return setCameraPreset;
}
