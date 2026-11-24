import type { Cutout, ToolSetSpec } from '@/features/bin-designer/types';
import {
  MAX_CUTOUT_GROUP_NAMES,
  TOOL_FAMILY_IDS,
  TOOL_SET_LIMITS,
  TOOL_SET_STYLES,
  TOOL_UNITS,
} from '@/features/bin-designer/types';
import { isRecord } from '@/shared/utils/isRecord';
import { sizeEntries, TOOL_FAMILIES } from '@/shared/toolSets/catalog';
import { labelPart, pocketPart, type ToolSetPart } from '@/shared/types/toolSet';
import { toolSetOf } from '../utils/toolSetMembership';

/** Matches the group-name map's ceiling, since both are keyed by group id. */
export const MAX_CUTOUT_TOOL_SETS = MAX_CUTOUT_GROUP_NAMES;
/** Mirrors the server's group-id bound. */
const MAX_SET_ID_LENGTH = 64;
// eslint-disable-next-line no-control-regex -- the server refuses control characters in keys
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function clamp(n: unknown, min: number, max: number): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

function migrateSpec(raw: unknown): ToolSetSpec | null {
  if (!isRecord(raw)) return null;
  if (!includes(TOOL_FAMILY_IDS, raw.family) || !includes(TOOL_UNITS, raw.units)) return null;
  if (!includes(TOOL_SET_STYLES, raw.style) || !Array.isArray(raw.sizes)) return null;
  const sizes = raw.sizes
    .filter(
      (s): s is string =>
        typeof s === 'string' &&
        s !== '' &&
        s.length <= TOOL_SET_LIMITS.maxSizeKeyLength &&
        !CONTROL_CHARS.test(s)
    )
    .slice(0, TOOL_SET_LIMITS.maxSizes);
  const clearanceMm = clamp(
    raw.clearanceMm,
    TOOL_SET_LIMITS.clearanceMm.min,
    TOOL_SET_LIMITS.clearanceMm.max
  );
  const labelSizeMm = clamp(
    raw.labelSizeMm,
    TOOL_SET_LIMITS.labelSizeMm.min,
    TOOL_SET_LIMITS.labelSizeMm.max
  );
  if (sizes.length === 0 || clearanceMm === null || labelSizeMm === null) return null;
  return {
    family: raw.family,
    units: raw.units,
    sizes,
    style: raw.style,
    clearanceMm,
    labelSizeMm,
    fingerChannel: raw.fingerChannel === true,
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
  if (!isRecord(raw)) return undefined;
  const kept = Object.entries(raw)
    .filter(
      ([id]) => referenced.has(id) && id.length <= MAX_SET_ID_LENGTH && !CONTROL_CHARS.test(id)
    )
    .flatMap(([id, spec]) => {
      const migrated = migrateSpec(spec);
      return migrated ? [[id, migrated] as const] : [];
    })
    .slice(0, MAX_CUTOUT_TOOL_SETS);
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/**
 * Marks the cutouts of a set saved before cutouts carried a part, so Edit set
 * replaces them rather than adding a second set. Pockets take their sizes in
 * the order the generator wrote them, smallest jaw first; when the count no
 * longer matches the recipe they get placeholder parts, which still mark them
 * for replacement.
 *
 * Such a set has no parts and a stored name: that release always stored one,
 * and later sets store one only when the user types it. A later set with no
 * parts left (the user deleted them, kept their own shapes) has no stored name,
 * and marking its shapes would let Edit set delete them.
 */
export function withLegacyToolSetParts(
  cutouts: Cutout[],
  sets: Readonly<Record<string, ToolSetSpec>> | undefined,
  names: Readonly<Record<string, string>> | undefined
): Cutout[] {
  if (!sets) return cutouts;
  const members = new Map<string, Cutout[]>();
  for (const c of cutouts) {
    const owner = toolSetOf([c], sets);
    if (owner !== null) members.set(owner, [...(members.get(owner) ?? []), c]);
  }
  const parts = new Map<string, ToolSetPart>();
  for (const [setId, list] of members) {
    if (!names || !Object.hasOwn(names, setId)) continue;
    if (list.some((c) => c.toolSetPart !== undefined)) continue;
    const spec = sets[setId];
    const pockets = list.filter((c) => c.shape === 'path');
    const keys = sizeEntries(TOOL_FAMILIES[spec.family], spec.units, spec.sizes).map((e) => e.key);
    pockets.forEach((c, i) => {
      parts.set(c.id, pocketPart(keys.length === pockets.length ? keys[i] : `#${i}`));
    });
    const channel = list.find((c) => c.shape === 'slot' && c.finger !== undefined);
    if (channel) parts.set(channel.id, 'channel');
    for (const c of list) {
      if (
        c.shape === 'text' &&
        c.label !== '' &&
        labelPart(c.label).length <= TOOL_SET_LIMITS.maxPartLength
      ) {
        parts.set(c.id, labelPart(c.label));
      }
    }
  }
  if (parts.size === 0) return cutouts;
  return cutouts.map((c) => {
    const part = parts.get(c.id);
    return part ? { ...c, toolSetPart: part } : c;
  });
}
