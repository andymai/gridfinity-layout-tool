/**
 * Constraint system public API.
 *
 * Import from '@/shared/constraints' for all constraint operations.
 */

// Types
export type {
  FeatureKey,
  FeatureChange,
  FeatureStatus,
  ConstraintResolution,
  ConstraintRule,
  ImplicationRule,
  FeatureManifest,
  ConstraintGraph,
  GraphNode,
  GraphEdge,
} from './types';

// Feature manifests
export { FEATURE_MANIFESTS } from './features';

// Constraint rules
export { CONSTRAINT_RULES, IMPLICATION_RULES } from './rules';

// Engine (resolution + queries)
export {
  resolveConstraints,
  getFeatureStatus,
  getAllFeatureStatuses,
  isFeatureActive,
} from './engine';

// Validation (generation layer)
export { validateConstraints } from './validation';
export type { ConstraintValidationError } from './validation';

// DevTools
export { buildConstraintGraph, toGraphviz } from './devtools';
