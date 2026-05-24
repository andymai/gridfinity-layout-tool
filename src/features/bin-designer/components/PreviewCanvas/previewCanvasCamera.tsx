/* eslint-disable react-refresh/only-export-components -- CAMERA_PRESETS and usePresetTransition are co-located with the camera components they're paired with */

/**
 * Camera-related pieces of the bin designer's 3D preview:
 *   - `calculateIdealDistance` — perspective-FOV math to frame the bin
 *   - `calculateBinCenter` — Z-aligned center for the orbit target
 *   - `CAMERA_PRESETS` — directional vectors per preset
 *   - `CameraController` — auto-framing component (must be inside Canvas)
 *   - `usePresetTransition` — spherical-interp animation between presets
 *   - `SceneLighting` — theme-aware 3-point lighting
 *
 * Auto-frame and preset transitions branch on the active camera type:
 * perspective animates `position`, orthographic animates `zoom`. Distance ↔
 * zoom conversion uses {@link distanceToOrthoZoom} so both projections share
 * the same "bin fills 65% of viewport" framing math.
 */

import { useLayoutEffect, useRef, useCallback, useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  PerspectiveCamera as DreiPerspectiveCamera,
  OrthographicCamera as DreiOrthographicCamera,
} from '@react-three/drei';
import { Vector3, Spherical, OrthographicCamera } from 'three';
import type {
  PerspectiveCamera as PerspectiveCameraImpl,
  OrthographicCamera as OrthographicCameraImpl,
} from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { distanceToOrthoZoom, orthoZoomToDistance } from '@/shared/utils/cameraProjection';
import type { CameraPreset, Projection } from '../preview';

/**
 * Set an orthographic camera's zoom and refresh its projection matrix. The
 * mutation happens outside any hook closure, which keeps the react-hooks
 * immutability rule happy without disabling it for the call site.
 */
function setOrthoZoom(ortho: OrthographicCamera, zoom: number): void {
  ortho.zoom = zoom;
  ortho.updateProjectionMatrix();
}

/** Camera positions for each preset (eye position looking toward center) */
export const CAMERA_PRESETS: Record<CameraPreset, [number, number, number]> = {
  front: [0, -1, 0.3], // Normalized direction — scaled by distance
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

/**
 * Mounts both a perspective and orthographic drei camera; only one carries
 * `makeDefault` at a time. On every projection swap, copies position/up from
 * the previously active camera to the newly active one and converts the
 * scale-preserving distance ↔ zoom round-trip via {@link distanceToOrthoZoom}
 * and {@link orthoZoomToDistance} so the user keeps their angle and apparent
 * framing across toggles.
 *
 * `useLayoutEffect` runs before paint, which lets the new makeDefault camera
 * adopt the prior position before the first frame renders — compatible with
 * `frameloop="demand"` since we don't depend on a per-frame sync loop.
 */
export function CameraRig({
  projection,
  initialPosition,
  target = [0, 0, 0],
  fov = CAMERA_FOV,
  near = 0.1,
  far = 2000,
  orthoNear = -20000,
  orthoFar = 20000,
}: {
  projection: Projection;
  initialPosition: readonly [number, number, number];
  /**
   * World-space orbit target. The scale-preserving distance ↔ zoom math is
   * computed relative to this point — pass the same target you give to
   * `<OrbitControls target={...}>` so a projection swap doesn't drift scale
   * for scenes whose center isn't at the origin (e.g. the bin floor + lid
   * stack rises along +Z).
   */
  target?: readonly [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
  orthoNear?: number;
  orthoFar?: number;
}) {
  const perspRef = useRef<PerspectiveCameraImpl>(null);
  const orthoRef = useRef<OrthographicCameraImpl>(null);
  // Track the projection that was active on the previous effect run so a
  // canvas resize doesn't masquerade as a swap and overwrite the user's
  // orbited ortho/perspective position with the *other* camera's pose.
  const prevProjectionRef = useRef<Projection | null>(null);
  const { camera, size, invalidate } = useThree();
  const [tx, ty, tz] = target;

  // Sync position + scale on projection swap. Runs before paint so the first
  // frame after the swap reflects the round-tripped framing. The position
  // copy is gated on an actual projection change — resize-only re-runs only
  // refresh the ortho zoom against the ortho camera's own current pose.
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
    // `camera` is included so we re-sync if R3F reassigns it externally.
  }, [projection, camera, size.height, fov, invalidate, tx, ty, tz]);

  // Frustum bounds for the ortho camera, pixel-mapped to the canvas. drei
  // re-mounts the projection matrix when these change; size.width/height come
  // from `useThree().size` which updates on canvas resize.
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
