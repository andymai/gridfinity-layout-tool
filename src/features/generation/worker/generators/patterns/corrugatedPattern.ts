/**
 * Corrugated wall pattern calculator.
 *
 * Computes wave parameters for a sinusoidal corrugated wall profile.
 * Pure math module — no brepjs imports.
 *
 * The corrugated wall replaces the flat wall with a uniform-thickness
 * sinusoidal profile. The wave folds inward from the outer face (which
 * stays at the standard gridfinity boundary). Arc segments approximate
 * the sine curve.
 *
 * Cross-section (top-down, looking at one wall):
 *
 *   outer face (flat, at grid boundary)
 *   │                              │
 *   │─╮    ╭───╮    ╭───╮    ╭──│
 *   │ ╰───╯   ╰───╯   ╰───╯   │
 *   │                              │
 *     interior (wavy surface)
 */

import { TOP_KEEP_OUT, MIN_BOTTOM_KEEP_OUT } from '../wallPatterns';
import { CORRUGATED_MIN_WALL_THICKNESS } from '@/shared/constants/bin';

export { CORRUGATED_MIN_WALL_THICKNESS };

/** Amplitude multiplier: amplitude = wallThickness × this factor. */
const AMPLITUDE_RATIO = 0.4;

/** Base wavelengths by bin height tier (mm). Adaptive sizing like honeycomb. */
const WAVELENGTH_SHORT = 8; // binHeight ≤ 3u
const WAVELENGTH_MEDIUM = 12; // binHeight ≤ 6u
const WAVELENGTH_TALL = 16; // binHeight > 6u

/** Number of line segments per half-wavelength for profile approximation. */
export const SEGMENTS_PER_HALF_WAVE = 8;

/** Specification for building a corrugated wall solid. */
export interface CorrugatedWallSpec {
  /** Wave amplitude (mm) — max inward displacement from outer face */
  readonly amplitude: number;
  /** Wave wavelength (mm) — phase-aligned to fit integer waves in wall span */
  readonly wavelength: number;
  /** Total span this wall covers (mm) */
  readonly wallSpan: number;
  /** Usable height for corrugation after keep-outs (mm) */
  readonly patternH: number;
  /** Z coordinate of the bottom of the corrugated zone (mm) */
  readonly bottomZ: number;
  /** Nominal wall thickness (mm) */
  readonly wallThickness: number;
  /** Number of complete waves fitting in the wall span */
  readonly waveCount: number;
}

/**
 * Get the base wavelength for a given bin height (in grid height units).
 */
export function getBaseWavelength(binHeight: number): number {
  if (binHeight <= 3) return WAVELENGTH_SHORT;
  if (binHeight <= 6) return WAVELENGTH_MEDIUM;
  return WAVELENGTH_TALL;
}

/**
 * Create a corrugated wall specification.
 *
 * Returns null if the wall is too thin, too short, or too narrow
 * for meaningful corrugation.
 *
 * @param wallThickness - Nominal wall thickness (mm)
 * @param wallHeight - Total wall height available (mm)
 * @param wallSpan - Wall span along the face (mm)
 * @param binHeight - Bin height in grid units (for wavelength selection)
 */
export function createCorrugatedSpec(
  wallThickness: number,
  wallHeight: number,
  wallSpan: number,
  binHeight: number
): CorrugatedWallSpec | null {
  if (wallThickness < CORRUGATED_MIN_WALL_THICKNESS) return null;

  const bottomKeepOut = Math.max(MIN_BOTTOM_KEEP_OUT, wallThickness);
  const patternH = wallHeight - TOP_KEEP_OUT - bottomKeepOut;

  const amplitude = wallThickness * AMPLITUDE_RATIO;
  const baseWavelength = getBaseWavelength(binHeight);

  // Phase-align: snap to integer number of complete waves
  const waveCount = Math.max(1, Math.round(wallSpan / baseWavelength));
  const wavelength = wallSpan / waveCount;

  // Must have enough height for a visible corrugated band (at least 2mm)
  if (patternH < 2) return null;

  // Wall span must be meaningful (need at least one full wave)
  if (wallSpan < baseWavelength / 2) return null;

  return {
    amplitude,
    wavelength,
    wallSpan,
    patternH,
    bottomZ: bottomKeepOut,
    wallThickness,
    waveCount,
  };
}

/**
 * Generate 2D profile points for the corrugated inner face.
 *
 * Returns points along the sinusoidal inner surface from left to right
 * (negative X to positive X). The outer face is a straight line at Y=0.
 *
 * The Y coordinate represents depth into the wall (inward from outer face).
 * At wave troughs: Y = wallThickness (minimum depth, wall is thinnest).
 * At wave crests: Y = wallThickness + amplitude (maximum depth, wall is thickest).
 *
 * @returns Array of [x, y] points for the inner face profile
 */
export function generateInnerFacePoints(spec: CorrugatedWallSpec): readonly [number, number][] {
  const { amplitude, wallSpan, wallThickness } = spec;
  const halfSpan = wallSpan / 2;
  const totalSegments = spec.waveCount * SEGMENTS_PER_HALF_WAVE * 2;
  const points: [number, number][] = [];

  for (let i = 0; i <= totalSegments; i++) {
    const x = -halfSpan + (i / totalSegments) * wallSpan;
    // Cosine wave using waveCount to guarantee integer cycles across span.
    // cos(2π × waveCount × normalized_x) has crests at both span edges
    // because normalized_x goes from 0 to 1, and waveCount is an integer.
    const normalized = (x + halfSpan) / wallSpan;
    const y =
      wallThickness + (amplitude * (1 + Math.cos(2 * Math.PI * spec.waveCount * normalized))) / 2;
    points.push([x, y]);
  }

  return points;
}
