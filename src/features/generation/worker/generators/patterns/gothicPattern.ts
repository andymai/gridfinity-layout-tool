/**
 * Gothic arch pattern calculator.
 *
 * Calculates center positions for pointed arch cutouts in a staggered grid.
 * Pure math module — no brepjs imports.
 *
 * Gothic arch geometry:
 *   - Pointed ogive shape (simplified lancet arch)
 *   - Width at base: ~1.2 × radius
 *   - Height to apex: ~1.8 × radius (tall pointed arch)
 *   - Vertical orientation (point facing up)
 *
 * The staggered grid layout (like honeycomb) provides:
 *   - Even visual distribution
 *   - Structural integrity between arches
 *   - FDM-friendly printing (pointed tops bridge naturally at ~45-60°)
 */

import type { PatternCalculator, PatternCenter, PatternGridConfig } from './types';
import { calculateStaggeredGrid } from './gridUtils';

/** Default radius for gothic arch arcs (mm). Controls overall arch size. */
export const DEFAULT_GOTHIC_RADIUS = 2.0;

/** Default solid web thickness between adjacent arches (mm). */
export const DEFAULT_GOTHIC_WEB_THICKNESS = 0.8;

/** Arch width multiplier (relative to radius). */
const ARCH_WIDTH_FACTOR = 1.2;

/** Arch height multiplier (relative to radius). Creates tall pointed arch. */
const ARCH_HEIGHT_FACTOR = 1.8;

/**
 * Gothic arch pattern calculator.
 *
 * Creates a staggered vertical grid of pointed arch positions.
 */
export class GothicPatternCalculator implements PatternCalculator {
  readonly archRadius: number;
  readonly webThickness: number;
  readonly archWidth: number;
  readonly archHeight: number;

  constructor(archRadius = DEFAULT_GOTHIC_RADIUS, webThickness = DEFAULT_GOTHIC_WEB_THICKNESS) {
    if (archRadius <= 0) {
      throw new Error('archRadius must be positive');
    }
    if (webThickness < 0) {
      throw new Error('webThickness must be non-negative');
    }
    this.archRadius = archRadius;
    this.webThickness = webThickness;
    this.archWidth = archRadius * ARCH_WIDTH_FACTOR;
    this.archHeight = archRadius * ARCH_HEIGHT_FACTOR;
  }

  calculateCenters(config: PatternGridConfig): PatternCenter[] {
    const { fillW, fillH } = config;
    const { archWidth, archHeight, webThickness } = this;

    // Column spacing: arch width + web
    const colSpacing = archWidth + webThickness;
    // Row spacing: arch height + web (vertical stacking)
    const rowSpacing = archHeight + webThickness;

    // Bounds: ensure no arch protrudes past fill area
    // Arch center is at geometric center, so bound by half-dimensions
    const maxX = fillW / 2 - archWidth / 2;
    const maxY = fillH / 2 - archHeight / 2;

    return calculateStaggeredGrid({ maxX, maxY, colSpacing, rowSpacing });
  }

  getShapeRadius(): number {
    return this.archRadius;
  }

  getSidesCount(): number {
    // Gothic arches are not polygonal - return 0 to signal custom shape needed
    return 0;
  }

  getWebThickness(): number {
    return this.webThickness;
  }

  getPatternType(): string {
    return 'gothic';
  }

  /**
   * Get the arch width for shape building.
   */
  getArchWidth(): number {
    return this.archWidth;
  }

  /**
   * Get the arch height for shape building.
   */
  getArchHeight(): number {
    return this.archHeight;
  }

  /**
   * Get the minimum pattern height required for at least one row of arches.
   * Height = archHeight + web for spacing.
   */
  getMinPatternHeight(): number {
    return this.archHeight + this.webThickness;
  }
}

/**
 * Factory function for creating gothic calculators with size-adaptive radius.
 *
 * Smaller bins (≤3u height) use smaller arches for better visual density.
 * Larger bins use bigger arches for performance (fewer boolean operations).
 */
export function createGothicCalculator(binHeight: number): GothicPatternCalculator {
  const archRadius = binHeight <= 3 ? 2.0 : 3.2;
  return new GothicPatternCalculator(archRadius, DEFAULT_GOTHIC_WEB_THICKNESS);
}
