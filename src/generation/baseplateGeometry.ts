/**
 * Baseplate Geometry - Placeholder
 *
 * This module is being replaced by OpenSCAD WASM generation.
 * See openscadGenerator.ts for the new implementation.
 */

import { GRIDFINITY_SPEC } from '../types/generation';

export interface BaseplateGeometryConfig {
  /** Width in grid units */
  widthUnits: number;
  /** Depth in grid units */
  depthUnits: number;
  /** Grid unit size in mm (default: 42) */
  gridUnitMm?: number;
  /** Include magnet holes at grid intersections */
  magnetHoles?: boolean;
}

// Baseplate-specific constants
const BASE_THICKNESS = 2.6;
const PROFILE_HEIGHT = GRIDFINITY_SPEC.baseProfileHeightMm;
const TOTAL_HEIGHT = BASE_THICKNESS + PROFILE_HEIGHT;

/**
 * Get the expected dimensions of a baseplate in mm.
 */
export function getBaseplateDimensions(config: BaseplateGeometryConfig): {
  widthMm: number;
  depthMm: number;
  heightMm: number;
} {
  const { widthUnits, depthUnits, gridUnitMm = GRIDFINITY_SPEC.gridUnitMm } = config;
  return {
    widthMm: widthUnits * gridUnitMm,
    depthMm: depthUnits * gridUnitMm,
    heightMm: TOTAL_HEIGHT,
  };
}
