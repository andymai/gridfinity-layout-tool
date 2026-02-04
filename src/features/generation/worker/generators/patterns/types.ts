/**
 * Pattern system type definitions.
 *
 * Shared interfaces for wall pattern calculators. Each pattern implements
 * the PatternCalculator interface to provide grid positions and shape metadata.
 */

/** Center position of a single pattern element. */
export interface PatternCenter {
  readonly x: number;
  readonly y: number;
}

/** Configuration for pattern grid generation (all dimensions in mm). */
export interface PatternGridConfig {
  /** Width to fill — pattern elements stay within this boundary */
  readonly fillW: number;
  /** Height to fill — pattern elements stay within this boundary */
  readonly fillH: number;
}

/**
 * Pattern calculator interface.
 *
 * Each pattern type implements this interface to provide:
 * - Grid calculation (positions for pattern elements)
 * - Shape metadata (for 3D geometry creation in binGenerator)
 */
export interface PatternCalculator {
  /**
   * Calculate pattern element center positions.
   *
   * Returns positions that are strictly bounded within the fill area.
   * Empty array if fill area is too small for any elements.
   */
  calculateCenters(config: PatternGridConfig): PatternCenter[];

  /**
   * Get the primary radius of the pattern element.
   * Used for building the 3D shape template.
   */
  getShapeRadius(): number;

  /**
   * Get the number of sides for polygonal patterns.
   * Used with drawPolysides() for hex patterns.
   */
  getSidesCount(): number;

  /**
   * Get the web thickness between pattern elements.
   * Used for spacing calculations.
   */
  getWebThickness(): number;

  /**
   * Get the pattern type identifier.
   * Used for cache key generation.
   */
  getPatternType(): string;

  /**
   * Get the minimum pattern height required for at least one row of elements.
   * Used to validate if wall is tall enough for the pattern.
   */
  getMinPatternHeight(): number;
}
