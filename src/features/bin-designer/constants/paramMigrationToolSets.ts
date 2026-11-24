import type { ToolSetSpec } from '@/features/bin-designer/types';
import {
  TOOL_FAMILY_IDS,
  TOOL_SET_LIMITS,
  TOOL_SET_STYLES,
  TOOL_UNITS,
} from '@/features/bin-designer/types';

/** Matches the group-name map's ceiling, since both are keyed by group id. */
export const MAX_CUTOUT_TOOL_SETS = 1000;

function clamp(n: unknown, min: number, max: number): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

function migrateSpec(raw: unknown): ToolSetSpec | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!includes(TOOL_FAMILY_IDS, r.family) || !includes(TOOL_UNITS, r.units)) return null;
  if (!includes(TOOL_SET_STYLES, r.style) || !Array.isArray(r.sizes)) return null;
  const sizes = r.sizes
    .filter(
      (s): s is string =>
        typeof s === 'string' && s !== '' && s.length <= TOOL_SET_LIMITS.maxSizeKeyLength
    )
    .slice(0, TOOL_SET_LIMITS.maxSizes);
  const clearanceMm = clamp(
    r.clearanceMm,
    TOOL_SET_LIMITS.clearanceMm.min,
    TOOL_SET_LIMITS.clearanceMm.max
  );
  const labelSizeMm = clamp(
    r.labelSizeMm,
    TOOL_SET_LIMITS.labelSizeMm.min,
    TOOL_SET_LIMITS.labelSizeMm.max
  );
  if (sizes.length === 0 || clearanceMm === null || labelSizeMm === null) return null;
  return {
    family: r.family,
    units: r.units,
    sizes,
    style: r.style,
    clearanceMm,
    labelSizeMm,
    fingerChannel: r.fingerChannel === true,
  };
}

/**
 * Keep the specs of tool sets the design still has. A spec whose container is
 * gone would ride along in every save and shift the design's community
 * fingerprint, and the server refuses a spec it cannot read, so a bad one is
 * dropped here rather than failing at publish.
 */
export function migrateCutoutToolSets(
  raw: unknown,
  referenced: ReadonlySet<string>
): Record<string, ToolSetSpec> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const kept = Object.entries(raw)
    .filter(([id]) => referenced.has(id))
    .flatMap(([id, spec]) => {
      const migrated = migrateSpec(spec);
      return migrated ? [[id, migrated] as const] : [];
    })
    .slice(0, MAX_CUTOUT_TOOL_SETS);
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}
