import type { FeatureKey } from '@/shared/constraints';

/**
 * A setting a body-type switch cleared. Keys are top-level `BinParams` keys or
 * `base.<key>`.
 */
export interface ClearedBodySetting {
  /** The feature it turns back on; null for a plain value (height, collar). */
  readonly feature: FeatureKey | null;
  /** The user's values from before the switch that cleared them. */
  readonly original: Readonly<Record<string, unknown>>;
  /** What the switch left. A slot that no longer reads this was edited since. */
  readonly left: Readonly<Record<string, unknown>>;
}

/** What the last body-type switch took away, held so a later one can give it back. */
export interface BodyTypeMemory {
  /** The body type that switch landed on. The memory is void from any other. */
  readonly bodyType: string;
  // Mutable so a history entry holding it stays assignable to an immer draft.
  readonly cleared: ClearedBodySetting[];
}
