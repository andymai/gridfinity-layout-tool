/**
 * Feature builder protocol for composable bin generation.
 *
 * Each FeatureBuilder encapsulates a single bin feature (compartment walls,
 * inserts, scoops, etc.) with co-located enable check, cache key, and build
 * logic. The generic runner iterates a composition root array of builders,
 * handling caching, clone ownership, origin tracking, and target bucketing.
 *
 * Pattern: Composition Root + Plugin Interface (not registry).
 * Rationale: full type safety, tree-shaking in Web Workers, no global
 * mutable state, explicit dependency graph.
 */

import type { Shape3D } from 'brepjs';
import type { PipelineContext } from './types';
import type { FeatureTag } from '../featureTags';

/** Which boolean pass a feature's shapes participate in. */
export type FeatureTarget = 'fuse' | 'cut' | 'patternCut';

/**
 * Result of running a single feature builder. Collects shapes with
 * their target bucket and provenance tag.
 */
export interface BuildResult {
  readonly shapes: readonly Shape3D[];
  readonly target: FeatureTarget;
  readonly tag: FeatureTag;
}

/**
 * Protocol for a single bin feature.
 *
 * Each builder is a plain object implementing this interface.
 * The composition root (an explicit typed array) wires builders
 * into the pipeline — no self-registration or global state.
 *
 * Clone ownership: `build()` returns shapes the caller owns.
 * The generic runner handles caching (cache owns originals,
 * caller gets clones) and origin tracking.
 */
export interface FeatureBuilder {
  /** Unique name used as cache namespace and for diagnostics. */
  readonly name: string;
  /** Face provenance tag for multi-color export. */
  readonly tag: FeatureTag;
  /** Which boolean pass this feature's shapes participate in. */
  readonly target: FeatureTarget;
  /**
   * Whether this builder handles non-rectangular (cellMask) footprints.
   * Defaults to false — unsupported builders are filtered out before running.
   * Opt in per feature as polygon-awareness is added.
   */
  readonly supportsCellMask?: boolean;
  /** Fast check — return false to skip cache lookup and build entirely. */
  shouldBuild(ctx: PipelineContext): boolean;
  /** Deterministic cache key for this feature's current parameters. */
  cacheKey(ctx: PipelineContext): string;
  /**
   * Build the feature geometry.
   *
   * Returns an array of shapes (single-shape builders return [shape]),
   * or null if no geometry is needed for the current parameters.
   */
  build(ctx: PipelineContext): readonly Shape3D[] | null;
}
