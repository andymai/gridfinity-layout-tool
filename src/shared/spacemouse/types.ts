/** Raw axis values as emitted by spacemouse-webhid (signed 16-bit). */
export interface RawTranslation {
  x: number;
  y: number;
  z: number;
}

export interface RawRotation {
  pitch: number;
  roll: number;
  yaw: number;
}

export interface RawDeflection {
  translation: RawTranslation;
  rotation: RawRotation;
}

/**
 * The five navigation axes we drive, named by what they do rather than by the
 * device axis. The puck's roll is intentionally unmapped: every preview locks
 * its camera up-vector, so a rolled camera would fight OrbitControls.
 */
export interface SpaceMouseInvert {
  panX: boolean;
  panY: boolean;
  zoom: boolean;
  orbitH: boolean;
  orbitV: boolean;
}

export interface SpaceMouseSettings {
  /** Overall multiplier applied on top of the per-family speeds. */
  sensitivity: number;
  /** Multiplier for pan + zoom. */
  translateSpeed: number;
  /** Multiplier for orbit. */
  rotateSpeed: number;
  invert: SpaceMouseInvert;
}

/** Normalized, deadzoned, invert-applied deflection in roughly [-1, 1]. */
export interface Deflection {
  panX: number;
  panY: number;
  zoom: number;
  orbitH: number;
  orbitV: number;
}

/** Per-frame camera motion amounts, already scaled by dt, speeds and distance. */
export interface FrameMotion {
  /** World units along the camera's right axis. */
  panX: number;
  /** World units along the camera's up axis. */
  panY: number;
  /** Signed dolly; positive dollies toward the target (zoom in). */
  zoom: number;
  /** Azimuth radians around the up axis. */
  orbitH: number;
  /** Polar radians around the camera's right axis. */
  orbitV: number;
}

export type SpaceMouseConnectionStatus =
  'unsupported' | 'idle' | 'connecting' | 'connected' | 'error';

/**
 * Which transport is driving the previews. `navlib` is the 3Dconnexion driver
 * (per-app speed/axis config lives in its control panel); `webhid` is the raw-HID
 * fallback that keeps the in-app tuning controls.
 */
export type SpaceMouseTransport = 'navlib' | 'webhid';

export type SpaceMouseCommand =
  'fit' | 'reset' | 'view-top' | 'view-front' | 'view-right' | 'view-iso' | 'undo' | 'redo';

export type CameraViewPreset = 'top' | 'front' | 'right' | 'iso';
