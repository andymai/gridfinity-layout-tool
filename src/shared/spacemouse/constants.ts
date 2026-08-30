import type { SpaceMouseSettings } from './types';

export const SPACEMOUSE_FEATURE_ID = 'spacemouse' as const;

export const SPACEMOUSE_SETTINGS_STORAGE_KEY = 'gridfinity-spacemouse-v1';

/**
 * 3Dconnexion pucks report each axis as a signed 16-bit value that saturates
 * near ±350 at full deflection, not a normalized range. We divide by this to
 * get a roughly [-1, 1] deflection before applying the deadzone and speeds.
 */
export const RAW_AXIS_FULL_SCALE = 350;

/** Fraction of full scale below which an axis is treated as centered (jitter). */
export const AXIS_DEADZONE = 0.06;

/** Per-second rates at full deflection, before user speed/sensitivity scaling. */
export const TRANSLATE_RATE = 1.2; // fraction of camera-to-target distance / s
export const ZOOM_RATE = 1.6; // e-fold dolly factor / s
export const ORBIT_RATE = 2.2; // radians / s

/** Keeps the orbit from tumbling over the pole, matching OrbitControls' clamp. */
export const MIN_POLAR = 0.01;

export const DEFAULT_SETTINGS: SpaceMouseSettings = {
  sensitivity: 1,
  translateSpeed: 1,
  rotateSpeed: 1,
  invert: {
    panX: false,
    panY: false,
    zoom: false,
    orbitH: false,
    orbitV: false,
  },
};

export const SENSITIVITY_RANGE = { min: 0.1, max: 3, step: 0.1 } as const;
export const SPEED_RANGE = { min: 0, max: 2, step: 0.05 } as const;

/** 3Dconnexion (0x256f) and the Logitech-era vendor id (0x046d) its pucks use. */
export const SPACEMOUSE_VENDOR_IDS = [0x256f, 0x046d] as const;
