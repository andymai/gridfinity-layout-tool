/**
 * The tag ↔ color contract for per-cutout shadow-board colors.
 *
 * A cutout's cavity faces are stamped, at generation time, with the face tag
 * `CUTOUT_COLOR_TAG_BASE + <unit ordinal>`. The paint layer (3D preview + 3MF
 * export) reads that tag back and looks up the unit's color. The ordinal is the
 * ONLY thing the two sides share, so both derive it from the same function here
 * — never reimplement the ordering, or tags and colors silently drift apart.
 *
 * Every cutout is tagged, colored or not, so switching a color on/off is a pure
 * read-side change that never regenerates geometry.
 */

import type { Cutout, CutoutColorScope } from '@/shared/types/bin';
import { DEFAULT_CUTOUT_COLOR_SCOPE } from '@/shared/types/bin';

/**
 * Face-tag base for per-cutout colors. Sits well above the `FeatureTag` enum
 * (max `UNKNOWN = 255`); any tag at or above this base is a cutout-color tag,
 * and unknown tags fall back to the body color, so pre-color code stays correct.
 */
export const CUTOUT_COLOR_TAG_BASE = 1000;

/**
 * Groups cutouts into a single colorable unit: grouped members share their
 * `groupId` (a boolean-merged cavity is one region — one color); everything
 * else is keyed by its own id. Array masters key by their own id too, so every
 * derived instance inherits the master's color.
 */
export function cutoutUnitKey(cutout: Cutout): string {
  return cutout.groupId ?? cutout.id;
}

export interface CutoutColorUnit {
  readonly key: string;
  /** Undefined = uncolored (inherits body). */
  readonly color?: string;
  readonly colorScope: CutoutColorScope;
}

/**
 * One entry per distinct colorable unit, in first-appearance order over
 * `cutouts`. The array index is the unit's ordinal. Enumerates ALL cutouts
 * (including hidden/uncolored) so ordinals stay stable as colors toggle.
 */
export function enumerateCutoutColorUnits(cutouts: readonly Cutout[]): CutoutColorUnit[] {
  const byKey = new Map<string, number>();
  const order: CutoutColorUnit[] = [];
  for (const c of cutouts) {
    const key = cutoutUnitKey(c);
    const idx = byKey.get(key);
    if (idx === undefined) {
      byKey.set(key, order.length);
      order.push({ key, color: c.color, colorScope: c.colorScope ?? DEFAULT_CUTOUT_COLOR_SCOPE });
    } else if (order[idx].color === undefined && c.color !== undefined) {
      // The store keeps a group's members in lockstep, but be defensive: adopt
      // the first colored member so a tag still resolves to a color even if the
      // first-seen member happened to be uncolored.
      order[idx] = { key, color: c.color, colorScope: c.colorScope ?? DEFAULT_CUTOUT_COLOR_SCOPE };
    }
  }
  return order;
}

/** Face tag for a unit at the given ordinal. */
export function cutoutColorTag(ordinal: number): number {
  return CUTOUT_COLOR_TAG_BASE + ordinal;
}

/** Unit ordinal encoded in a face tag, or null if it isn't a cutout-color tag. */
export function cutoutOrdinalFromTag(tag: number): number | null {
  return tag >= CUTOUT_COLOR_TAG_BASE ? tag - CUTOUT_COLOR_TAG_BASE : null;
}
