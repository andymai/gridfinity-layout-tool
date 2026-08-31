import {
  AXIS_DEADZONE,
  ORBIT_RATE,
  RAW_AXIS_FULL_SCALE,
  TRANSLATE_RATE,
  ZOOM_RATE,
} from './constants';
import type { Deflection, FrameMotion, RawDeflection, SpaceMouseSettings } from './types';

/** Clamp a raw axis to [-1, 1] around its saturation point. */
export function normalizeAxis(raw: number, fullScale = RAW_AXIS_FULL_SCALE): number {
  const n = raw / fullScale;
  if (n > 1) return 1;
  if (n < -1) return -1;
  return n;
}

/**
 * Zero out small deflections, then rescale so motion ramps from 0 at the
 * deadzone edge rather than jumping. Sign is preserved.
 */
export function applyDeadzone(normalized: number, deadzone = AXIS_DEADZONE): number {
  const mag = Math.abs(normalized);
  if (mag <= deadzone) return 0;
  const scaled = (mag - deadzone) / (1 - deadzone);
  return Math.sign(normalized) * scaled;
}

function axis(raw: number, invert: boolean): number {
  const v = applyDeadzone(normalizeAxis(raw));
  return invert ? -v : v;
}

/**
 * Map raw device axes to the five semantic navigation axes, applying the
 * deadzone and per-axis inversion.
 *
 * Axis roles corrected against a SpaceMouse Pro hardware test (#4041): left/right
 * translation followed the puck backwards, and the lift and push axes drove the
 * wrong pair (lift zoomed, push panned). So left/right is negated, and the up/down
 * (y) and forward/back (z) axes now drive pan and zoom respectively. Rotations
 * (orbit) already tested correct and are unchanged. Any residual per-axis sign a
 * given device disagrees on is the user's `invert.*` override.
 */
export function toDeflection(raw: RawDeflection, settings: SpaceMouseSettings): Deflection {
  const { invert } = settings;
  return {
    panX: axis(-raw.translation.x, invert.panX), // puck left pans the view left
    panY: axis(-raw.translation.y, invert.panY), // lift (up/down) pans vertically
    zoom: axis(-raw.translation.z, invert.zoom), // push forward zooms in
    orbitH: axis(raw.rotation.yaw, invert.orbitH),
    orbitV: axis(raw.rotation.pitch, invert.orbitV),
  };
}

export function isDeflectionIdle(d: Deflection): boolean {
  return d.panX === 0 && d.panY === 0 && d.zoom === 0 && d.orbitH === 0 && d.orbitV === 0;
}

/**
 * Turn a normalized deflection into per-frame camera motion. Pan scales with
 * `distance` so it feels the same whether zoomed in or out; zoom stays
 * multiplicative (scale-free); orbit is a fixed angular rate.
 */
export function computeFrameMotion(
  d: Deflection,
  settings: SpaceMouseSettings,
  dtSeconds: number,
  distance: number
): FrameMotion {
  const dt = Math.max(0, dtSeconds);
  const translate = settings.sensitivity * settings.translateSpeed * dt;
  const rotate = settings.sensitivity * settings.rotateSpeed * dt;
  const panScale = distance * TRANSLATE_RATE * translate;
  return {
    panX: d.panX * panScale,
    panY: d.panY * panScale,
    zoom: d.zoom * ZOOM_RATE * translate,
    orbitH: d.orbitH * ORBIT_RATE * rotate,
    orbitV: d.orbitV * ORBIT_RATE * rotate,
  };
}
