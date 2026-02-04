/**
 * Honeycomb pattern calculator.
 *
 * Calculates pointy-top hexagonal grid positions for honeycomb wall patterns.
 * Pure math module — no brepjs imports.
 *
 * Pointy-top hex geometry (circumradius R):
 *   flat-to-flat width    = √3 × R
 *   vertex-to-vertex height = 2R
 *   column spacing         = √3R + web
 *   row spacing            = 1.5R + web
 *   odd rows offset        = colSpacing / 2
 *
 * Pointy-top orientation improves 3D printing bridging (printer bridges
 * across a point, not a flat edge).
 */

import type { PatternCalculator, PatternCenter, PatternGridConfig } from './types';
import { calculateStaggeredGrid } from './gridUtils';

/** Default circumradius of each hex hole (center to vertex, mm). ~3.1mm flat-to-flat. */
export const DEFAULT_HEX_RADIUS = 1.8;

/** Default solid web thickness between adjacent hex holes (mm). */
export const DEFAULT_HEX_WEB_THICKNESS = 0.8;

/**
 * Honeycomb pattern calculator using pointy-top hexagons.
 */
export class HoneycombPatternCalculator implements PatternCalculator {
  readonly hexRadius: number;
  readonly webThickness: number;

  constructor(hexRadius = DEFAULT_HEX_RADIUS, webThickness = DEFAULT_HEX_WEB_THICKNESS) {
    if (hexRadius <= 0) {
      throw new Error('hexRadius must be positive');
    }
    if (webThickness < 0) {
      throw new Error('webThickness must be non-negative');
    }
    this.hexRadius = hexRadius;
    this.webThickness = webThickness;
  }

  calculateCenters(config: PatternGridConfig): PatternCenter[] {
    const { fillW, fillH } = config;
    const { hexRadius, webThickness } = this;

    const R = hexRadius;
    const inradius = (Math.sqrt(3) / 2) * R;

    // Pointy-top: flat-to-flat width is horizontal (inradius), vertex-to-vertex is vertical (R)
    const colSpacing = Math.sqrt(3) * R + webThickness;
    const rowSpacing = 1.5 * R + webThickness;

    // maxX bounded by inradius (horizontal flat-to-flat), maxY by R (vertical vertex)
    const maxX = fillW / 2 - inradius;
    const maxY = fillH / 2 - R;

    return calculateStaggeredGrid({ maxX, maxY, colSpacing, rowSpacing });
  }

  getShapeRadius(): number {
    return this.hexRadius;
  }

  getSidesCount(): number {
    return 6; // Hexagon
  }

  getWebThickness(): number {
    return this.webThickness;
  }

  getPatternType(): string {
    return 'honeycomb';
  }

  /**
   * Get the minimum pattern height required for at least one row of hexes.
   * Height = 2R (vertex-to-vertex) + web for spacing.
   */
  getMinPatternHeight(): number {
    return 2 * this.hexRadius + this.webThickness;
  }
}

/**
 * Factory function for creating honeycomb calculators with size-adaptive radius.
 *
 * Smaller bins (≤3u height) use smaller hexes for better visual density.
 * Larger bins use bigger hexes for performance (fewer boolean operations).
 */
export function createHoneycombCalculator(binHeight: number): HoneycombPatternCalculator {
  const hexRadius = binHeight <= 3 ? 2.1 : 3.6;
  return new HoneycombPatternCalculator(hexRadius, DEFAULT_HEX_WEB_THICKNESS);
}
