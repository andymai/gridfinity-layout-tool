import {
  Box3,
  type Camera,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
} from 'three';
import { MIN_POLAR } from './constants';
import type { CameraViewPreset, FrameMotion } from './types';

/**
 * OrbitControls surface the controller needs. The `enable*` flags are the host
 * canvas's own limits: a preview that turns off mouse panning means it, so the
 * puck honours them too. Absent means enabled, matching OrbitControls' defaults.
 */
export interface OrbitLike {
  target: Vector3;
  update: () => void;
  autoRotate?: boolean;
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
}

const FIT_PADDING = 1.25;

/** Bounding sphere of the box: center + radius. */
export function boundingSphere(box: Box3): { center: Vector3; radius: number } {
  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);
  return { center, radius: Math.max(size.length() / 2, 1e-3) };
}

/**
 * Content bounding box: real meshes only, skipping grids, shadows, floors and
 * helpers by name so a fit frames the model rather than the scaffolding.
 */
export function computeContentBox(scene: Object3D): Box3 {
  const box = new Box3();
  scene.traverse((obj: Object3D) => {
    if (!(obj as { isMesh?: boolean }).isMesh) return;
    const name = obj.name.toLowerCase();
    if (
      name.includes('grid') ||
      name.includes('shadow') ||
      name.includes('floor') ||
      name.includes('helper')
    ) {
      return;
    }
    box.expandByObject(obj);
  });
  // No content meshes matched; frame whatever is in the scene.
  if (box.isEmpty()) box.setFromObject(scene);
  return box;
}

/**
 * Unit direction from target to camera for a view preset, derived from the
 * scene's up axis so it works for both Y-up and Z-up canvases.
 */
export function presetDirection(preset: CameraViewPreset, up: Vector3): Vector3 {
  const u = up.clone().normalize();
  // A reference axis not parallel to up, to build a horizontal basis.
  const ref = Math.abs(u.z) < 0.9 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0);
  const side = new Vector3().crossVectors(u, ref).normalize();
  const fwd = new Vector3().crossVectors(side, u).normalize();
  switch (preset) {
    case 'top':
      return u;
    case 'front':
      return fwd;
    case 'right':
      return side;
    case 'iso':
      return u.add(fwd).add(side).normalize();
  }
}

/** Perspective distance that fits a sphere of `radius` given a vertical fov. */
export function fitPerspectiveDistance(radius: number, fovDegrees: number, aspect: number): number {
  const vFov = (fovDegrees * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(aspect, 0.001));
  const fov = Math.min(vFov, hFov);
  return (radius * FIT_PADDING) / Math.sin(fov / 2);
}

/**
 * Frame `box` in `camera`, keeping the current view direction unless `direction`
 * is given. Handles perspective (distance) and orthographic (zoom) cameras.
 */
export function frameBox(
  camera: Camera,
  controls: OrbitLike,
  box: Box3,
  opts: { direction?: Vector3; viewportHeight: number; aspect: number }
): void {
  const { center, radius } = boundingSphere(box);
  let dir = opts.direction?.clone();
  if (!dir) {
    dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir = presetDirection('iso', camera.up);
  }
  dir.normalize();
  controls.target.copy(center);

  if (camera instanceof PerspectiveCamera) {
    const distance = fitPerspectiveDistance(radius, camera.fov, opts.aspect);
    camera.position.copy(center).addScaledVector(dir, distance);
  } else if (camera instanceof OrthographicCamera) {
    camera.position.copy(center).addScaledVector(dir, radius * 4 + 1);
    camera.zoom = opts.viewportHeight / (2 * radius * FIT_PADDING);
    camera.updateProjectionMatrix();
  }
  camera.lookAt(center);
  controls.update();
}

/**
 * Apply one frame of 6-DOF motion in object mode: pan the camera + target
 * together, orbit around the target, and dolly toward/away from it. The camera
 * up-vector is left untouched so mouse OrbitControls resume cleanly.
 */
export function applyFrameMotion(camera: Camera, controls: OrbitLike, motion: FrameMotion): void {
  const target = controls.target;

  if (controls.enablePan !== false && (motion.panX !== 0 || motion.panY !== 0)) {
    const right = new Vector3().setFromMatrixColumn(camera.matrix, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrix, 1);
    const pan = right.multiplyScalar(motion.panX).add(up.multiplyScalar(motion.panY));
    camera.position.add(pan);
    target.add(pan);
  }

  if (controls.enableRotate !== false && (motion.orbitH !== 0 || motion.orbitV !== 0)) {
    const up = camera.up.clone().normalize();
    const offset = camera.position.clone().sub(target);
    if (motion.orbitH !== 0) offset.applyAxisAngle(up, motion.orbitH);
    if (motion.orbitV !== 0) {
      const right = new Vector3().crossVectors(up, offset).normalize();
      if (right.lengthSq() > 1e-8) {
        const current = offset.angleTo(up);
        // Clamp so we can't tumble past either pole.
        const next = Math.min(Math.PI - MIN_POLAR, Math.max(MIN_POLAR, current - motion.orbitV));
        offset.applyAxisAngle(right, current - next);
      }
    }
    camera.position.copy(target).add(offset);
  }

  if (controls.enableZoom !== false && motion.zoom !== 0) {
    if (camera instanceof OrthographicCamera) {
      camera.zoom = Math.max(1e-4, camera.zoom * Math.exp(motion.zoom));
      camera.updateProjectionMatrix();
    } else {
      const offset = camera.position.clone().sub(target);
      const scaled = Math.max(1e-3, offset.length() * Math.exp(-motion.zoom));
      offset.setLength(scaled);
      camera.position.copy(target).add(offset);
    }
  }

  controls.update();
}
