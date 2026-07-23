/**
 * Pattern system public API.
 *
 * Re-exports all pattern-related types, calculators, and utilities.
 * The registry-based architecture allows easy addition of new patterns.
 */

export type {
  PatternCalculator,
  StampPatternCalculator,
  MotifPatternCalculator,
  BasePatternCalculator,
  PatternCenter,
  PatternGridConfig,
  PatternStrategyKind,
  ShapeDescriptor,
  PolygonShape,
  RectShape,
  MotifCell,
  MotifPath,
  MotifSegment,
  MotifMode,
  WrappedLatticeCalculator,
} from './types';
export {
  isStampCalculator,
  isMotifCalculator,
  isWrappedLatticeCalculator,
  shapeDescriptorKey,
} from './types';

// Kumiko wrapped-lattice patterns
export type {
  KumikoSegment,
  KumikoLattice,
  KumikoBandConfig,
  KumikoPatternDef,
} from './kumiko/types';
export {
  KUMIKO_STRUT_WIDTH,
  KUMIKO_BASE_CELL_SIZE,
  quantizeColumns,
  clipSegmentToBand,
  generateKumikoLattice,
} from './kumiko/segmentLattice';
export { createKumikoCalculator } from './kumiko/calculator';
export { createMitsukudeCalculator, MITSUKUDE_DEF } from './kumiko/mitsukude';
export { createGomaCalculator, GOMA_DEF } from './kumiko/goma';
export { createAsanohaCalculator, ASANOHA_DEF } from './kumiko/asanoha';
export { createSakuraCalculator, SAKURA_DEF } from './kumiko/sakura';
export { createRindoCalculator, RINDO_DEF } from './kumiko/rindo';
export { createMikadoCalculator, MIKADO_DEF } from './kumiko/mikado';
export { createTsumiishiKikkoCalculator, TSUMIISHI_KIKKO_DEF } from './kumiko/tsumiishiKikko';
export { replicateRotations, SIX_FOLD } from './kumiko/fillingUtils';

// Grid utilities
export { calculateStaggeredGrid, calculateAlignedGrid } from './gridUtils';
export type { StaggeredGridConfig } from './gridUtils';

// Scale model
export {
  PATTERN_WEB_THICKNESS,
  clampScale,
  scaleFactor,
  resolveElementRadius,
  elementRadiusFloor,
} from './patternScale';

// Calculators
export {
  HoneycombPatternCalculator,
  createHoneycombCalculator,
  DEFAULT_HEX_RADIUS,
  DEFAULT_HEX_WEB_THICKNESS,
} from './honeycombPattern';
export { RoundPatternCalculator, createRoundCalculator, ROUND_SIDES } from './roundPattern';
export { DiamondPatternCalculator, createDiamondCalculator } from './diamondPattern';
export { TrianglePatternCalculator, createTriangleCalculator } from './trianglePattern';
export { SlotPatternCalculator, createSlotCalculator } from './slotPattern';

// Registry
export {
  PATTERN_REGISTRY,
  getPatternCalculator,
  isHoneycombCalculator,
  getAvailablePatterns,
} from './registry';
