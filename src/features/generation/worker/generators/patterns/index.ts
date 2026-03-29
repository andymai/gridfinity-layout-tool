/**
 * Pattern system public API.
 *
 * Re-exports all pattern-related types, calculators, and utilities.
 * The registry-based architecture allows easy addition of new patterns.
 */

export type { PatternCalculator, PatternCenter, PatternGridConfig } from './types';

// Grid utilities
export { calculateStaggeredGrid } from './gridUtils';
export type { StaggeredGridConfig } from './gridUtils';

// Calculators
export {
  HoneycombPatternCalculator,
  createHoneycombCalculator,
  DEFAULT_HEX_RADIUS,
  DEFAULT_HEX_WEB_THICKNESS,
} from './honeycombPattern';

// Corrugated pattern
export {
  createCorrugatedSpec,
  generateInnerFacePoints,
  CORRUGATED_MIN_WALL_THICKNESS,
} from './corrugatedPattern';
export type { CorrugatedWallSpec } from './corrugatedPattern';

// Registry
export {
  PATTERN_REGISTRY,
  getPatternCalculator,
  getPatternMode,
  isHoneycombCalculator,
  getAvailablePatterns,
} from './registry';
export type { CutPatternEntry, ReplacePatternEntry, PatternRegistryEntry } from './registry';
