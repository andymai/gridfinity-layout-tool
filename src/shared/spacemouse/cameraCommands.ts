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
import { MIN_POLAR, PAN_LEASH_RADII, PAN_LEASH_VIEWPORT_FRACTION } from './constants';
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

export interface PolarLimits {
  min: number;
  max: number;
}

/** The elevation band the host canvas itself imposes; absent means the whole sphere. */
export function canvasPolarLimits(controls: OrbitLike): PolarLimits {
  return { min: controls.minPolarAngle ?? 0, max: controls.maxPolarAngle ?? Math.PI };
}

/**
 * The canvas's band, never reaching a pole itself: a view direction parallel
 * to the up axis has no defined horizon, so `lookAt` picks one arbitrarily and
 * the scene appears to spin.
 */
export function polarLimits(controls: OrbitLike): PolarLimits {
  const canvas = canvasPolarLimits(controls);
  return {
    min: Math.max(canvas.min, MIN_POLAR),
    max: Math.min(canvas.max, Math.PI - MIN_POLAR),
  };
}

/** Half the shorter viewport dimension, in world units, `distance` from the camera. */
function visibleRadius(camera: Camera, distance: number): number {
  if (camera instanceof PerspectiveCamera) {
    const halfHeight = distance * Math.tan((camera.fov * Math.PI) / 360);
    return Math.min(halfHeight, halfHeight * camera.aspect);
  }
  if (camera instanceof OrthographicCamera) {
    // The driver writes these extents through `setViewExtents`, so they are not
    // guaranteed to arrive with min below max or with a usable zoom.
    const height = Math.abs(camera.top - camera.bottom);
    const width = Math.abs(camera.right - camera.left);
    return Math.min(height, width) / (2 * Math.max(Math.abs(camera.zoom), 1e-6));
  }
  return Infinity;
}

type PoleCrossing = 'zenith' | 'nadir' | null;

/** Which pole a known vertical step carried the view over, if either. */
function foldFromStep(prevPhi: number, polarStep: number): PoleCrossing {
  const intended = prevPhi + polarStep;
  if (intended < 0) return 'zenith';
  if (intended > Math.PI) return 'nadir';
  return null;
}

/**
 * Pull a camera that integrated its own orbit back inside the canvas's limits,
 * `prevOffset` being the target-to-camera vector from before the move and
 * `polarStep` the vertical orbit just applied.
 *
 * OrbitControls only limits the moves it makes itself, so a WebHID frame gets
 * nothing from it. Whether the step went over a pole is NOT recoverable from
 * the two poses: the folded and unfolded readings describe the same final
 * vector, so both hypotheses predict every measurable thing about it. The
 * caller integrated the step, so it knows the answer outright and says so.
 */
export function constrainPose(
  camera: Camera,
  controls: OrbitLike,
  prevOffset: Vector3,
  contentBox: Box3 | null | undefined,
  polarStep: number
): void {
  const offset = camera.position.clone().sub(controls.target);
  const distance = offset.length();
  if (distance > 1e-9) {
    // `Spherical` measures its polar angle from +Y, so put the up axis there.
    const toSpherical = new Quaternion().setFromUnitVectors(
      camera.up.clone().normalize(),
      new Vector3(0, 1, 0)
    );
    const spherical = new Spherical().setFromVector3(offset.clone().applyQuaternion(toSpherical));
    // A pose that went over a pole comes back mirrored: the polar angle folds
    // back into [0, PI] and the azimuth jumps half a turn. Unfolding it is what
    // makes the clamp below stall the orbit rather than pin it facing backwards.
    if (prevOffset.lengthSq() > 1e-18) {
      const prev = new Spherical().setFromVector3(prevOffset.clone().applyQuaternion(toSpherical));
      const crossed = foldFromStep(prev.phi, polarStep);
      if (crossed === 'zenith') {
        spherical.phi = -spherical.phi;
        spherical.theta = wrapPi(spherical.theta + Math.PI);
      } else if (crossed === 'nadir') {
        spherical.phi = 2 * Math.PI - spherical.phi;
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
    clampPan(camera, controls, contentBox);
  }
}

/**
 * Stop a pan at the leash: slide camera and target back together, by the
 * overshoot only, so the view stops at the edge like a wall and its orientation
 * is untouched.
 */
export function clampPan(camera: Camera, controls: OrbitLike, contentBox: Box3): void {
  const distance = camera.position.distanceTo(controls.target);
  const leash = Math.min(
    boundingSphere(contentBox).radius * PAN_LEASH_RADII,
    visibleRadius(camera, distance) * PAN_LEASH_VIEWPORT_FRACTION
  );
  const away = controls.target.clone().sub(contentBox.clampPoint(controls.target, new Vector3()));
  const overshoot = away.length() - leash;
  if (overshoot > 0) {
    const shift = away.setLength(overshoot).negate();
    controls.target.add(shift);
    camera.position.add(shift);
  }
}

/**
 * Tilt a finished pose back inside an elevation band, as one rotation of
 * position and orientation together about the pose's own right axis, so the
 * screen keeps its heading and any roll the pose carries.
 *
 * The right axis, not the horizontal one: the driver pitched about the pose's
 * right, and the tilt back has to be about the same axis or the pair leaves a
 * residual turn that compounds frame over frame until the view flips over.
 * Of the two angles that reach the limit the smaller wins, being the one that
 * undoes the overshoot. At the pole itself they tie and the positive one moves
 * the camera to the screen-down side, which is the pose a `lookAt` on world up
 * reproduces. A pose rolled too far to reach the band about its right axis
 * tilts about the horizontal instead.
 */
export function clampElevation(
  camera: Camera,
  controls: OrbitLike,
  worldUp: Vector3,
  limits: PolarLimits
): void {
  const offset = camera.position.clone().sub(controls.target);
  const distance = offset.length();
  if (distance < 1e-9) return;
  const phi = offset.angleTo(worldUp);
  const clamped = Math.min(limits.max, Math.max(limits.min, phi));
  if (clamped === phi) return;

  const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const step = new Quaternion();
  const angle = tiltAboutAxis(offset, right, worldUp, distance * Math.cos(clamped));
  if (angle !== null) {
    step.setFromAxisAngle(right, angle);
  } else {
    const axis = new Vector3().crossVectors(worldUp, offset);
    if (axis.lengthSq() < 1e-12) return;
    step.setFromAxisAngle(axis.normalize(), clamped - phi);
  }
  camera.position.copy(controls.target).add(offset.applyQuaternion(step));
  camera.quaternion.premultiply(step);
}

/**
 * The smallest rotation of `offset` about unit `axis` whose result has the
 * given height along `up`, or null when no rotation about that axis reaches
 * it. Rodrigues' formula makes the height `A cos t + B sin t + C (1 - cos t)`.
 */
function tiltAboutAxis(offset: Vector3, axis: Vector3, up: Vector3, height: number): number | null {
  const a = up.dot(offset);
  const b = up.dot(new Vector3().crossVectors(axis, offset));
  const c = up.dot(axis) * axis.dot(offset);
  const reach = Math.hypot(a - c, b);
  if (reach < 1e-12) return null;
  const ratio = (height - c) / reach;
  if (Math.abs(ratio) > 1) return null;
  const phase = Math.atan2(b, a - c);
  const spread = Math.acos(ratio);
  const candidates = [phase + spread, phase - spread].map(wrapPi);
  const [first, second] = candidates;
  const tie = Math.abs(Math.abs(first) - Math.abs(second)) < 1e-9;
  if (tie) return Math.max(first, second);
  return Math.abs(first) < Math.abs(second) ? first : second;
}

/** Whether a pose's horizon is level enough to hand to the mouse on world up. */
export function isLevelPose(camera: Camera, worldUp: Vector3, tolerance: number): boolean {
  const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  return Math.abs(right.dot(worldUp)) < tolerance && up.dot(worldUp) >= 0;
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

  // The vertical orbit is applied as a rotation about an axis perpendicular to
  // both up and the offset, so it moves the polar angle by exactly its own
  // value and the horizontal one cannot move it at all. That makes the pole
  // crossing a fact here rather than something to infer from the result.
  const polarStep = controls.enableRotate !== false ? motion.orbitV : 0;
  constrainPose(camera, controls, prevOffset, contentBox, polarStep);
  controls.update();
}
