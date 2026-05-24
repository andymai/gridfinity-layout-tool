/* eslint-disable react-refresh/only-export-components -- usePresetTransition (hook) is co-located with the camera components it's paired with */

/**
 * Auto-frame and preset transitions branch on the active camera type:
 * perspective animates `position`, orthographic animates `zoom`. Distance ↔
 * zoom conversion uses {@link distanceToOrthoZoom} so both projections share
 * the same "bin fills 65% of viewport" framing math.
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Spherical, OrthographicCamera } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { distanceToOrthoZoom } from '@/shared/utils/cameraProjection';
import type { CameraPreset } from '../preview';

/** Mutation happens outside any hook closure to satisfy react-hooks immutability. */
function setOrthoZoom(ortho: OrthographicCamera, zoom: number): void {
  ortho.zoom = zoom;
  ortho.updateProjectionMatrix();
}

/** Eye-position directions per preset; scaled by distance at apply time. */
const CAMERA_PRESETS: Record<CameraPreset, [number, number, number]> = {
  front: [0, -1, 0.3],
  side: [1, 0, 0.3],
  top: [0, -0.01, 1],
  isometric: [0.6, -0.6, 0.5],
};

/** Animation duration for camera transitions (ms) */
const TRANSITION_DURATION = 500;
/** Animation duration for auto-framing (ms) */
const AUTO_FRAME_DURATION = 300;
/** Margin factor: how much of the viewport the bin should fill */
const FRAME_FILL = 0.65;
/** Minimum change in distance to trigger auto-frame animation */
const REFRAME_THRESHOLD = 0.1; // 10% change
/** Perspective FOV (degrees) used for framing math — shared by CameraController and usePresetTransition */
const CAMERA_FOV = 45;

/**
 * Calculate ideal camera distance to frame a bin of the given dimensions.
 * Uses perspective camera FOV geometry to ensure the bin fills ~65% of viewport.
 */
function calculateIdealDistance(
  width: number,
  depth: number,
  height: number,
  fov: number,
  gridUnitMm: number,
  heightUnitMm: number
): number {
  const outerW = width * gridUnitMm;
  const outerD = depth * gridUnitMm;
  const totalH = height * heightUnitMm;

  // Bounding sphere radius (from center of bin)
  const halfW = outerW / 2;
  const halfD = outerD / 2;
  const halfH = totalH / 2;
  const boundingRadius = Math.sqrt(halfW * halfW + halfD * halfD + halfH * halfH);

  // Distance = radius / sin(halfFov) * marginFactor
  const halfFovRad = (fov / 2) * (Math.PI / 180);
  return (boundingRadius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);
}

/**
 * Calculate the bin's center point in 3D space (for camera target).
 * Mesh is centered at (0, 0) in XY, base at Z=0 — only height affects the target.
 */
function calculateBinCenter(
  _width: number,
  _depth: number,
  height: number,
  heightUnitMm: number
): Vector3 {
  const totalH = height * heightUnitMm;
  return new Vector3(0, 0, totalH / 2);
}

/**
 * Inner scene component that handles camera animation via useFrame.
 * Must be inside the Canvas to access Three.js context.
 */
export function CameraController({
  controlsRef,
  invalidateRef,
  width,
  depth,
  height,
  gridUnitMm,
  heightUnitMm,
}: {
  controlsRef: React.RefObject<OrbitControlsType | null>;
  invalidateRef: React.RefObject<(() => void) | null>;
  width: number;
  depth: number;
  height: number;
  gridUnitMm: number;
  heightUnitMm: number;
}) {
  const { camera, invalidate, size } = useThree();

  // Expose invalidate to hooks outside Canvas context
  useEffect(() => {
    invalidateRef.current = invalidate;
  }, [invalidate, invalidateRef]);
  const posAnimRef = useRef<{
    startPos: Vector3;
    targetPos: Vector3;
    startTime: number;
    duration: number;
  } | null>(null);
  const zoomAnimRef = useRef<{
    startZoom: number;
    targetZoom: number;
    startTime: number;
    duration: number;
  } | null>(null);
  const prevDistanceRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const fov = CAMERA_FOV;
  const binCenter = useMemo(
    () => calculateBinCenter(width, depth, height, heightUnitMm),
    [width, depth, height, heightUnitMm]
  );
  const idealDistance = useMemo(
    () => calculateIdealDistance(width, depth, height, fov, gridUnitMm, heightUnitMm),
    [width, depth, height, fov, gridUnitMm, heightUnitMm]
  );

  // Auto-frame: when bin dimensions change, smoothly adjust framing.
  // Perspective animates position along the current direction; ortho animates
  // zoom toward the value that yields the same on-screen scale.
  useEffect(() => {
    if (!initializedRef.current) {
      // First render: set camera immediately
      const direction = new Vector3(...CAMERA_PRESETS.isometric).normalize();
      camera.position.copy(direction.multiplyScalar(idealDistance).add(binCenter));
      camera.up.set(0, 0, 1);
      camera.lookAt(binCenter);
      if (camera instanceof OrthographicCamera && size.height > 0) {
        setOrthoZoom(camera, distanceToOrthoZoom(idealDistance, fov, size.height));
      }
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

    if (distanceChange > REFRAME_THRESHOLD) {
      if (camera instanceof OrthographicCamera && size.height > 0) {
        // Significant size change in ortho: animate zoom toward new ideal
        zoomAnimRef.current = {
          startZoom: camera.zoom,
          targetZoom: distanceToOrthoZoom(idealDistance, fov, size.height),
          startTime: performance.now(),
          duration: AUTO_FRAME_DURATION,
        };
      } else {
        // Perspective: animate camera position along the current direction
        const currentPos = camera.position.clone();
        const currentDir = currentPos.clone().sub(binCenter).normalize();
        const targetPos = currentDir.multiplyScalar(idealDistance).add(binCenter);

        posAnimRef.current = {
          startPos: currentPos,
          targetPos,
          startTime: performance.now(),
          duration: AUTO_FRAME_DURATION,
        };
      }
    }

    prevDistanceRef.current = idealDistance;
  }, [idealDistance, binCenter, camera, controlsRef, fov, size.height]);

  // Update target when bin center changes
  useEffect(() => {
    if (controlsRef.current && initializedRef.current) {
      controlsRef.current.target.copy(binCenter);
      controlsRef.current.update();
    }
  }, [binCenter, controlsRef]);

  // Animate camera position / zoom each frame
  useFrame(() => {
    const posAnim = posAnimRef.current;
    if (posAnim) {
      const elapsed = performance.now() - posAnim.startTime;
      const progress = Math.min(elapsed / posAnim.duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(posAnim.startPos, posAnim.targetPos, eased);
      camera.lookAt(binCenter);
      invalidate();

      if (progress >= 1) {
        posAnimRef.current = null;
        controlsRef.current?.update();
      }
    }

    const zoomAnim = zoomAnimRef.current;
    if (zoomAnim && camera instanceof OrthographicCamera) {
      const elapsed = performance.now() - zoomAnim.startTime;
      const progress = Math.min(elapsed / zoomAnim.duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setOrthoZoom(camera, zoomAnim.startZoom + (zoomAnim.targetZoom - zoomAnim.startZoom) * eased);
      invalidate();

      if (progress >= 1) {
        zoomAnimRef.current = null;
        controlsRef.current?.update();
      }
    }
  });

  return null;
}

/**
 * Manages smooth camera preset transitions using spherical coordinate interpolation.
 *
 * Position animation works for both projections — for ortho, the "distance"
 * component is invisible but kept in sync so a later projection swap reads the
 * correct direction. Zoom is unaffected by presets.
 */
export function usePresetTransition(
  controlsRef: React.RefObject<OrbitControlsType | null>,
  invalidateRef: React.RefObject<(() => void) | null>,
  width: number,
  depth: number,
  height: number,
  gridUnitMm: number,
  heightUnitMm: number
) {
  const animFrameRef = useRef<number | null>(null);

  const setCameraPreset = useCallback(
    (preset: CameraPreset) => {
      const controls = controlsRef.current;
      if (!controls) return;

      const camera = controls.object;
      const fov = CAMERA_FOV;
      const binCenter = calculateBinCenter(width, depth, height, heightUnitMm);
      const idealDistance = calculateIdealDistance(
        width,
        depth,
        height,
        fov,
        gridUnitMm,
        heightUnitMm
      );

      // Calculate target position from preset direction
      const direction = new Vector3(...CAMERA_PRESETS[preset]).normalize();
      const targetPosition = direction.multiplyScalar(idealDistance).add(binCenter);

      // Current camera state
      const startPosition = camera.position.clone();
      const target = binCenter.clone();

      // Convert to spherical for smooth arc interpolation
      const startSpherical = new Spherical().setFromVector3(startPosition.clone().sub(target));
      const targetSpherical = new Spherical().setFromVector3(targetPosition.clone().sub(target));

      const startTime = performance.now();

      // Cancel existing animation
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
        // Ease-out cubic for natural deceleration
        const eased = 1 - Math.pow(1 - progress, 3);

        // Interpolate in spherical coordinates for smooth arc
        const currentSpherical = new Spherical(
          startSpherical.radius + (targetSpherical.radius - startSpherical.radius) * eased,
          startSpherical.phi + (targetSpherical.phi - startSpherical.phi) * eased,
          startSpherical.theta + (targetSpherical.theta - startSpherical.theta) * eased
        );

        const newPosition = new Vector3().setFromSpherical(currentSpherical).add(target);
        camera.position.copy(newPosition);
        camera.up.set(0, 0, 1);
        camera.lookAt(target);
        // Update controls and explicitly invalidate for demand mode rendering
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
    [controlsRef, invalidateRef, width, depth, height, gridUnitMm, heightUnitMm]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return setCameraPreset;
}

/** Inner component for theme-aware lighting (hooks must be called inside Canvas). */
export function SceneLighting() {
  const colors = useThreeColors();
  return (
    <>
      <hemisphereLight args={['#ffffff', colors.groundBounce, 0.65]} />
      <directionalLight position={[-50, 60, 80]} intensity={0.85} color="#fff8f0" />
      <directionalLight position={[40, -40, 30]} intensity={0.15} color="#e0e8ff" />
    </>
  );
}
