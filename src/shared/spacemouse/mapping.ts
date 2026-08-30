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
 * deadzone and per-axis inversion. Device axis meanings (from spacemouse-webhid):
 * translate x = right, y = forward/back, z = up/down; rotate pitch/yaw.
 */
export function toDeflection(raw: RawDeflection, settings: SpaceMouseSettings): Deflection {
  const { invert } = settings;
  return {
    panX: axis(raw.translation.x, invert.panX),
    panY: axis(-raw.translation.z, invert.panY), // device z+ is down; screen up is +
    zoom: axis(-raw.translation.y, invert.zoom), // push forward (y-) zooms in
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
