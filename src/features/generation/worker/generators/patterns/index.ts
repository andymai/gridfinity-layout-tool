/**
 * Pattern system public API.
 *
 * Re-exports all pattern-related types, calculators, and utilities.
 */

// Types
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

export {
  GothicPatternCalculator,
  createGothicCalculator,
  DEFAULT_GOTHIC_RADIUS,
  DEFAULT_GOTHIC_WEB_THICKNESS,
} from './gothicPattern';

// Registry
export {
  PATTERN_REGISTRY,
  getPatternCalculator,
  isHoneycombCalculator,
  isGothicCalculator,
  getAvailablePatterns,
} from './registry';
