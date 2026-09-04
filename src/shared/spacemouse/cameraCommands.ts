import {
  Box3,
  type Camera,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  Spherical,
  Vector3,
} from 'three';
import { MIN_POLAR, PAN_LEASH_RADII } from './constants';
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
  minPolarAngle?: number;
  maxPolarAngle?: number;
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

/** `Spherical` measures its polar angle from +Y, so any up-vector is rotated onto it. */
const SPHERICAL_UP = new Vector3(0, 1, 0);

const SCAFFOLD_NAMES = ['grid', 'shadow', 'floor', 'helper'];

/** Meshes that frame the scene rather than being the model, matched by name. */
export function isScaffoldName(name: string): boolean {
  const lower = name.toLowerCase();
  return SCAFFOLD_NAMES.some((part) => lower.includes(part));
}

/** Content bounding box: meshes only, so a fit frames the model, not the scaffolding. */
export function computeContentBox(scene: Object3D): Box3 {
  const box = new Box3();
  scene.traverse((obj) => {
    const isMesh = (obj as { isMesh?: boolean }).isMesh === true;
    if (isMesh && !isScaffoldName(obj.name)) box.expandByObject(obj);
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

/** Signed angle folded into (-PI, PI]. */
function wrapPi(angle: number): number {
  return ((((angle + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

/**
 * The polar band this canvas allows, never reaching a pole itself: a view
 * direction parallel to the up axis has no defined horizon, so `lookAt` picks
 * one arbitrarily and the scene appears to spin.
 */
function polarLimits(controls: OrbitLike): { min: number; max: number } {
  return {
    min: Math.max(controls.minPolarAngle ?? 0, MIN_POLAR),
    max: Math.min(controls.maxPolarAngle ?? Math.PI, Math.PI - MIN_POLAR),
  };
}

/** Half the shorter viewport dimension, in world units, `distance` from the camera. */
function visibleRadius(camera: Camera, distance: number): number {
  if (camera instanceof PerspectiveCamera) {
    const halfHeight = distance * Math.tan((camera.fov * Math.PI) / 360);
    return Math.min(halfHeight, halfHeight * camera.aspect);
  }
  if (camera instanceof OrthographicCamera) {
    return Math.min(camera.top - camera.bottom, camera.right - camera.left) / (2 * camera.zoom);
  }
  return Infinity;
}

/**
 * Pull a camera that has already moved back inside its canvas's navigation
 * limits, `prevOffset` being the target-to-camera vector from before the move.
 *
 * Both puck transports need this and neither gets it from OrbitControls, which
 * only limits the moves it makes itself: a WebHID frame integrates its own
 * orbit, and the driver hands over a finished pose. Without it the puck reaches
 * poses the mouse refuses on the same canvas.
 */
export function constrainPose(
  camera: Camera,
  controls: OrbitLike,
  prevOffset: Vector3,
  contentBox?: Box3 | null
): void {
  const offset = camera.position.clone().sub(controls.target);
  const distance = offset.length();
  if (distance > 1e-9) {
    const toSpherical = new Quaternion().setFromUnitVectors(
      camera.up.clone().normalize(),
      SPHERICAL_UP
    );
    const spherical = new Spherical().setFromVector3(offset.applyQuaternion(toSpherical));
    // A pose that went over a pole comes back mirrored: the polar angle folds
    // back into [0, PI] and the azimuth jumps half a turn. Unfolding it is what
    // makes the clamp below stall the orbit rather than pin it facing backwards.
    // Half a turn of azimuth within one frame is not reachable at any puck
    // speed, so it can only be the fold; which pole it went over is whichever
    // unfolding continues from where the view already was.
    if (prevOffset.lengthSq() > 1e-18) {
      const prev = new Spherical().setFromVector3(prevOffset.clone().applyQuaternion(toSpherical));
      if (Math.abs(wrapPi(spherical.theta - prev.theta)) > Math.PI / 2) {
        const overZenith = -spherical.phi;
        const overNadir = 2 * Math.PI - spherical.phi;
        spherical.phi =
          Math.abs(overZenith - prev.phi) < Math.abs(overNadir - prev.phi) ? overZenith : overNadir;
        spherical.theta = wrapPi(spherical.theta + Math.PI);
      }
    }
    const { min, max } = polarLimits(controls);
    const phi = Math.min(max, Math.max(min, spherical.phi));
    // A pose already within the limits keeps its exact position: the spherical
    // round-trip is lossy, and an untouched frame must not creep.
    if (phi !== spherical.phi) {
      spherical.phi = phi;
      spherical.radius = distance;
      camera.position
        .copy(controls.target)
        .add(new Vector3().setFromSpherical(spherical).applyQuaternion(toSpherical.invert()));
    }
  }

  // The leash is a limit on panning, so a canvas that forbids panning must not
  // be pulled by it either.
  if (controls.enablePan !== false && contentBox && !contentBox.isEmpty()) {
    const leash = Math.min(
      boundingSphere(contentBox).radius * PAN_LEASH_RADII,
      visibleRadius(camera, distance)
    );
    const away = controls.target.clone().sub(contentBox.clampPoint(controls.target, new Vector3()));
    const overshoot = away.length() - leash;
    if (overshoot > 0) {
      const shift = away.setLength(overshoot).negate();
      controls.target.add(shift);
      camera.position.add(shift);
    }
  }
}

/**
 * Walking the scene for the content box on every motion frame is wasted work on
 * a model that cannot change mid-gesture, so the walk runs on a timer.
 */
export function createContentBoxCache(ttlMs = 200): (scene: Object3D) => Box3 {
  let box: Box3 | null = null;
  let walked: Object3D | null = null;
  let at = 0;
  return (scene) => {
    const now = performance.now();
    if (!box || walked !== scene || now - at > ttlMs) {
      box = computeContentBox(scene);
      walked = scene;
      at = now;
    }
    return box;
  };
}

/**
 * Apply one frame of 6-DOF motion in object mode: pan the camera + target
 * together, orbit around the target, and dolly toward/away from it. The camera
 * up-vector is left untouched so mouse OrbitControls resume cleanly.
 */
export function applyFrameMotion(
  camera: Camera,
  controls: OrbitLike,
  motion: FrameMotion,
  contentBox?: Box3 | null
): void {
  const target = controls.target;
  const prevOffset = camera.position.clone().sub(target);

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
      if (right.lengthSq() > 1e-8) offset.applyAxisAngle(right, motion.orbitV);
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

  constrainPose(camera, controls, prevOffset, contentBox);
  controls.update();
}
