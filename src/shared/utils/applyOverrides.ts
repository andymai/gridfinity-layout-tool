/**
 * Rebuild a variant's parameters from its parent plus the values it has claimed.
 *
 * Pure and total: given the same parent and overrides it always produces the
 * same params, which is what lets propagation be a recompute rather than a
 * three-way merge, and lets a variant's stored params be treated as a cache of
 * this function's output.
 */

import type { BinParams, Cutout } from '@/shared/types/bin';
import type {
  CutoutOverride,
  DesignOverrides,
  OrphanedOverride,
} from '@/shared/types/designOverrides';
import { resizeAroundCenter } from './cutoutResize';

export interface AppliedOverrides {
  readonly params: BinParams;
  /**
   * Overrides naming a cutout the parent no longer has. Reported rather than
   * dropped: the upstream deletion may itself be undone, and discarding the
   * override would make that unrecoverable.
   */
  readonly orphans: readonly OrphanedOverride[];
}

function applyCutoutOverride(cutout: Cutout, override: CutoutOverride): Cutout {
  let next: Cutout = { ...cutout };

  // Size goes through the same center-preserving resize the inspector uses. A
  // corner-anchored resize here would turn a size override into a position
  // change, sliding a 1/2" pocket off the center the parent placed it on.
  if (override.width !== undefined || override.depth !== undefined) {
    next = {
      ...next,
      ...resizeAroundCenter(next, {
        ...(override.width !== undefined ? { width: override.width } : {}),
        ...(override.depth !== undefined ? { depth: override.depth } : {}),
      }),
    };
  }

  if (override.cutDepth !== undefined) next = { ...next, cutDepth: override.cutDepth };
  if (override.clearance !== undefined) next = { ...next, clearance: override.clearance };
  if (override.chamferWidth !== undefined) {
    next = { ...next, chamferWidth: override.chamferWidth };
  }
  return next;
}

export function applyOverrides(
  parentParams: BinParams,
  overrides: DesignOverrides | undefined
): AppliedOverrides {
  if (!overrides) return { params: parentParams, orphans: [] };

  const dimensions = overrides.dimensions ?? {};
  let params: BinParams = { ...parentParams };
  if (dimensions.width !== undefined) params = { ...params, width: dimensions.width };
  if (dimensions.depth !== undefined) params = { ...params, depth: dimensions.depth };
  if (dimensions.height !== undefined) params = { ...params, height: dimensions.height };
  if (dimensions.wallThickness !== undefined) {
    params = { ...params, wallThickness: dimensions.wallThickness };
  }

  const cutoutOverrides = overrides.cutouts ?? {};
  const overriddenIds = Object.keys(cutoutOverrides);
  if (overriddenIds.length === 0) return { params, orphans: [] };

  const present = new Set((params.cutouts ?? []).map((c) => c.id));
  const orphans: OrphanedOverride[] = overriddenIds
    .filter((id) => !present.has(id))
    .map((id) => ({ cutoutId: id, override: cutoutOverrides[id] }));

  const cutouts = (params.cutouts ?? []).map((cutout) => {
    const override = cutoutOverrides[cutout.id];
    return override ? applyCutoutOverride(cutout, override) : cutout;
  });

  return { params: { ...params, cutouts }, orphans };
}

/**
 * Fields where the parent's value changed while the variant holds its own.
 *
 * Not a conflict: the override wins by definition. It is drift, and the variant
 * reports it so the user can decide whether the upstream change was one they
 * also wanted.
 */
export interface DriftEntry {
  readonly label: string;
  readonly parentValue: number;
  readonly variantValue: number;
}

export function findDrift(
  previousParent: BinParams,
  nextParent: BinParams,
  overrides: DesignOverrides | undefined
): readonly DriftEntry[] {
  if (!overrides) return [];
  const drift: DriftEntry[] = [];

  for (const field of ['width', 'depth', 'height', 'wallThickness'] as const) {
    const claimed = overrides.dimensions?.[field];
    if (claimed === undefined) continue;
    if (previousParent[field] !== nextParent[field]) {
      drift.push({ label: field, parentValue: nextParent[field], variantValue: claimed });
    }
  }

  const previousById = new Map((previousParent.cutouts ?? []).map((c) => [c.id, c]));
  for (const cutout of nextParent.cutouts ?? []) {
    const override = overrides.cutouts?.[cutout.id];
    if (!override) continue;
    const before = previousById.get(cutout.id);
    if (!before) continue;
    for (const field of ['width', 'depth', 'cutDepth', 'clearance', 'chamferWidth'] as const) {
      const claimed = override[field];
      if (claimed === undefined) continue;
      const wasValue = before[field];
      const nowValue = cutout[field];
      if (wasValue !== nowValue && nowValue !== undefined) {
        drift.push({
          // `||`, not `??`: `label` is a required string that is usually '',
          // which would produce a drift entry reading `.width`.
          label: `${cutout.name || cutout.label || cutout.shape}.${field}`,
          parentValue: nowValue,
          variantValue: claimed,
        });
      }
    }
  }
  return drift;
}
