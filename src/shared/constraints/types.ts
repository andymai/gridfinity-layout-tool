import type { BinParams } from '@/shared/types/bin';

/** Top-level feature keys that can participate in constraints. */
export type FeatureKey =
  | 'base.halfSockets'
  | 'base.magnet'
  | 'base.screw'
  | 'base.flat'
  | 'style.slotted'
  | 'style.solid'
  | 'compartments'
  | 'scoop'
  | 'label'
  | 'wallPattern'
  | 'inserts'
  | 'cutouts'
  | 'slotConfig'
  | 'wallCutouts';

/**
 * Constraint rule: when `source` is active, listed features are disabled.
 * The `when` predicate allows dynamic/computed constraints.
 */
export interface ConstraintRule {
  /** Human-readable description for debugging and tests */
  readonly description: string;
  /** Feature that triggers this constraint */
  readonly source: FeatureKey;
  /** Predicate: is this constraint currently active? */
  readonly when: (params: BinParams) => boolean;
  /** Features disabled when constraint is active */
  readonly disables: readonly FeatureKey[];
  /** i18n key explaining why features are disabled */
  readonly reason: string;
}

/**
 * Implication rule: when predicate matches, force param updates.
 * Used for derived state (e.g., style='solid' → base.solid=true).
 */
export interface ImplicationRule {
  readonly description: string;
  readonly when: (params: BinParams) => boolean;
  readonly apply: (params: BinParams) => Partial<BinParams>;
}

/**
 * Declares a feature's relationship to BinParams.
 * Each feature must register: how to check if enabled, and how to toggle it.
 */
export interface FeatureManifest {
  readonly key: FeatureKey;
  /** Human-readable label (used in dev tools / debug) */
  readonly label: string;
  /** Check whether this feature is currently enabled */
  readonly isEnabled: (params: BinParams) => boolean;
  /** Produce a partial BinParams that enables or disables this feature */
  readonly apply: (params: BinParams, enabled: boolean) => Partial<BinParams>;
}

/** Intent to change a feature's enabled state. */
export interface FeatureChange {
  readonly feature: FeatureKey;
  readonly enabled: boolean;
}

/** Result of constraint resolution. */
export interface ConstraintResolution {
  /** Fully resolved BinParams (safe to apply to store) */
  readonly params: BinParams;
  /** Features that were auto-disabled to satisfy constraints */
  readonly autoDisabled: readonly FeatureKey[];
  /** Params changed by implication rules */
  readonly impliedChanges: Partial<BinParams>;
}

/** Current availability status of a feature given params. */
export interface FeatureStatus {
  readonly feature: FeatureKey;
  readonly enabled: boolean;
  /** False when disabled by a constraint rule */
  readonly available: boolean;
  /** i18n key explaining why unavailable (undefined when available) */
  readonly reason: string | undefined;
  /** Features whose active state blocks this feature */
  readonly conflicts: readonly FeatureKey[];
}

export interface ConstraintGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export interface GraphNode {
  readonly id: FeatureKey;
  readonly label: string;
  readonly enabled: boolean;
  readonly available: boolean;
}

export interface GraphEdge {
  readonly from: FeatureKey;
  readonly to: FeatureKey;
  readonly type: 'disables' | 'implies';
  readonly active: boolean;
  readonly description: string;
}
