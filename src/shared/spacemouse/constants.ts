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
export const TRANSLATE_RATE = 2.0; // fraction of camera-to-target distance / s
export const ZOOM_RATE = 2.6; // e-fold dolly factor / s
export const ORBIT_RATE = 3.6; // radians / s

/** Keeps the orbit from tumbling over the pole, matching OrbitControls' clamp. */
export const MIN_POLAR = 0.01;

/**
 * How far the swept angle may sit from the over-a-pole distance and still be
 * read as a pole crossing (radians).
 *
 * A crossing sweeps the two polar angles added together and every other route
 * between the same pair is shorter, so the only competing motion is a spin of
 * very nearly half a turn IN ONE FRAME, which closes the gap to nothing. This
 * sits below where that becomes a risk: a 143 deg/frame spin still reads a
 * quarter radian short, while a real crossing matches to float precision.
 */
export const FOLD_SWEEP_TOLERANCE = 0.01;

/**
 * How far the orbit target may drift outside the model's bounding box before
 * panning stops. The smaller of two bounds, and each one answers a case the
 * other cannot:
 *
 * - {@link PAN_LEASH_RADII}, in model radii, is the absolute bound. Without it
 *   the leash grows with viewing distance, so zooming out first buys a target
 *   thousands of millimetres away and the dolly back in drags it home in one
 *   long lurch.
 * - {@link PAN_LEASH_VIEWPORT_FRACTION}, of what the viewport shows, tightens
 *   as you zoom in, and is what keeps a large layout pannable: a target inside
 *   the box overshoots by nothing, so this only governs leaving the model.
 *
 * Both are halves rather than wholes. At a whole radius the nearest face of a
 * small model sat right on the edge of the screen and everything past it was
 * off, which is the "still possible to move the model out of view" in #4041 —
 * a bound that let the model leave while reporting that it had not.
 */
export const PAN_LEASH_RADII = 0.5;
export const PAN_LEASH_VIEWPORT_FRACTION = 0.5;

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

export const SENSITIVITY_RANGE = { min: 0.1, max: 5, step: 0.1 } as const;
export const SPEED_RANGE = { min: 0, max: 3, step: 0.05 } as const;

/** 3Dconnexion (0x256f) and the Logitech-era vendor id (0x046d) its pucks use. */
export const SPACEMOUSE_VENDOR_IDS = [0x256f, 0x046d] as const;
