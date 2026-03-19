/**
 * Constraint resolution engine.
 *
 * Core algorithm: given current params and a user's intended change,
 * produce fully resolved params where all constraints are satisfied.
 * Uses "last write wins" — the user's action takes priority, and
 * conflicting features are auto-disabled.
 */

import type { BinParams } from '@/shared/types/bin';
import type { FeatureKey, FeatureChange, ConstraintResolution, FeatureStatus } from './types';
import { FEATURE_MANIFESTS } from './features';
import { CONSTRAINT_RULES, IMPLICATION_RULES } from './rules';

function mergeParams(base: BinParams, partial: Partial<BinParams>): BinParams {
  const result = { ...base };

  for (const [key, value] of Object.entries(partial)) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Object.entries can yield undefined at runtime for Partial<T>
    if (value === undefined) continue;

    const k = key as keyof BinParams;
    if (k === 'base' && typeof value === 'object') {
      result.base = { ...base.base, ...(value as Partial<BinParams['base']>) };
    } else if (k === 'compartments' && typeof value === 'object') {
      result.compartments = {
        ...base.compartments,
        ...(value as Partial<BinParams['compartments']>),
      };
    } else if (k === 'scoop' && typeof value === 'object') {
      result.scoop = { ...base.scoop, ...(value as Partial<BinParams['scoop']>) };
    } else if (k === 'label' && typeof value === 'object') {
      result.label = { ...base.label, ...(value as Partial<BinParams['label']>) };
    } else if (k === 'walls' && typeof value === 'object') {
      result.walls = { ...base.walls, ...(value as Partial<BinParams['walls']>) };
    } else if (k === 'slotConfig' && typeof value === 'object') {
      const slotPartial = value as Partial<BinParams['slotConfig']>;
      result.slotConfig = {
        ...base.slotConfig,
        ...slotPartial,
        x: slotPartial.x ? { ...base.slotConfig.x, ...slotPartial.x } : base.slotConfig.x,
        y: slotPartial.y ? { ...base.slotConfig.y, ...slotPartial.y } : base.slotConfig.y,
      };
    } else if (k === 'dividerPieces' && typeof value === 'object') {
      result.dividerPieces = {
        ...base.dividerPieces,
        ...(value as Partial<BinParams['dividerPieces']>),
      };
    } else if (k === 'wallPattern' && typeof value === 'object') {
      result.wallPattern = {
        ...base.wallPattern,
        ...(value as Partial<BinParams['wallPattern']>),
      };
    } else if (k === 'cutoutConfig' && typeof value === 'object') {
      result.cutoutConfig = {
        ...base.cutoutConfig,
        ...(value as Partial<BinParams['cutoutConfig']>),
      };
    } else {
      // Primitives and arrays (inserts, cutouts) are replaced wholesale
      (result as Record<string, unknown>)[k] = value;
    }
  }

  return result;
}

/**
 * Resolve constraints for a user action.
 *
 * Algorithm:
 * 1. Apply the user's intended change to params
 * 2. Iteratively apply implications and disable conflicting features until stable
 * 3. Return resolved params + auto-disabled features + implied changes
 *
 * The iterative loop handles transitive cascades (enabling feature A may disable B,
 * which triggers an implication affecting C). Convergence is guaranteed because
 * each iteration can only disable features or trigger implications that already
 * passed their `when` check.
 */
export function resolveConstraints(
  currentParams: BinParams,
  change: FeatureChange
): ConstraintResolution {
  const manifest = FEATURE_MANIFESTS[change.feature];
  const userPatch = manifest.apply(currentParams, change.enabled);
  let params = mergeParams(currentParams, userPatch);

  const autoDisabled: FeatureKey[] = [];
  const impliedChanges: Partial<BinParams> = {};

  const MAX_ITERATIONS = 10;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let changed = false;

    for (const rule of IMPLICATION_RULES) {
      if (rule.when(params)) {
        const patch = rule.apply(params);
        params = mergeParams(params, patch);
        Object.assign(impliedChanges, patch);
        changed = true;
      }
    }

    for (const rule of CONSTRAINT_RULES) {
      if (!rule.when(params)) continue;

      for (const disabledKey of rule.disables) {
        const disabledManifest = FEATURE_MANIFESTS[disabledKey];
        if (!disabledManifest.isEnabled(params)) continue;

        // Don't disable the feature the user just enabled
        if (disabledKey === change.feature && change.enabled) continue;

        const disablePatch = disabledManifest.apply(params, false);
        params = mergeParams(params, disablePatch);
        if (!autoDisabled.includes(disabledKey)) {
          autoDisabled.push(disabledKey);
        }
        changed = true;
      }
    }

    if (!changed) break;
  }

  // Post-check: if the user enabled a feature, verify it's not still blocked
  // by an active one-way constraint. The loop above protects the user's feature
  // (line 128) which is correct for mutual exclusion (enabling halfSockets
  // auto-disables magnet). But for one-way constraints (slotted blocks scoop),
  // the engine can't resolve the conflict. Return currentParams unchanged
  // so callers get a no-op rather than inconsistent state.
  if (change.enabled) {
    const status = getFeatureStatus(params, change.feature);
    if (!status.available) {
      return { params: currentParams, autoDisabled: [], impliedChanges: {} };
    }
  }

  return { params, autoDisabled, impliedChanges };
}

/**
 * Get the current availability status of a feature.
 * Returns whether it's enabled, available, and why it might be blocked.
 */
export function getFeatureStatus(params: BinParams, feature: FeatureKey): FeatureStatus {
  const manifest = FEATURE_MANIFESTS[feature];
  const enabled = manifest.isEnabled(params);

  const conflicts: FeatureKey[] = [];
  let reason: string | undefined;

  for (const rule of CONSTRAINT_RULES) {
    if (!rule.disables.includes(feature)) continue;
    if (!rule.when(params)) continue;

    if (!conflicts.includes(rule.source)) {
      conflicts.push(rule.source);
    }
    if (!reason) {
      reason = rule.reason;
    }
  }

  const available = conflicts.length === 0;
  return { feature, enabled, available, reason, conflicts };
}

export function getAllFeatureStatuses(params: BinParams): ReadonlyMap<FeatureKey, FeatureStatus> {
  const keys = Object.keys(FEATURE_MANIFESTS) as FeatureKey[];
  const statuses = new Map<FeatureKey, FeatureStatus>();
  for (const key of keys) {
    statuses.set(key, getFeatureStatus(params, key));
  }
  return statuses;
}

/**
 * Check if a feature is effectively enabled (shorthand for status query).
 * A feature is "effectively enabled" when it's both enabled in params
 * AND not blocked by any constraint.
 */
export function isFeatureActive(params: BinParams, feature: FeatureKey): boolean {
  const status = getFeatureStatus(params, feature);
  return status.enabled && status.available;
}
