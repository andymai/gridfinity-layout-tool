/**
 * Give back what a body-type switch took away.
 *
 * Switching body type clears whatever the new body cannot carry: Base only pins
 * the height to 1u and drops the collar, wall pattern, handles and label tabs,
 * and Spacer, Flat and Tray drop the magnets. Each switch remembers the user's
 * values for what it cleared, and a later switch gives back every one the body
 * it lands on can carry, so trying a body type and leaving it costs nothing.
 *
 * A setting comes back only if nothing has edited it since (its slots still
 * read what the switch left), and only through the constraint engine, which
 * refuses one the new body still blocks and reports anything a restore would
 * have to turn off. A refused setting stays held for the switch after.
 */

import { FEATURE_MANIFESTS, getFeatureStatus, resolveConstraints } from '@/shared/constraints';
import type { FeatureKey } from '@/shared/constraints';
import type { BinParams, BodyTypeMemory, ClearedBodySetting } from '@/features/bin-designer/types';
import { isEffectiveTile } from '@/features/bin-designer/types/base';
import { bodyTypeParams, deriveBodyType } from './bodyType';
import type { BodyType } from './bodyType';
import { finalizeBaseParams } from './finalizeBaseParams';

/** The switch itself sets these, so they are never given back. */
const ARCHETYPE_FEATURES: ReadonlySet<FeatureKey> = new Set<FeatureKey>([
  'base.flat',
  'base.spacer',
  'base.tile',
  'base.lid',
]);

/**
 * Config that belongs to one body type. A feature stored in it (magnets on a
 * Nesting base live in `trayBottom`) is carried by `bodyTypeParams` instead:
 * restoring the slot elsewhere would leave tray config on a bin with no tray.
 */
const ARCHETYPE_SLOTS: ReadonlySet<string> = new Set([
  'base.trayBottom',
  'base.tile',
  'base.spacer',
]);

/** Values a switch pins or floors without any feature turning off. */
const PLAIN_SLOTS = ['height', 'extraWallHeightMm'] as const;

const BASE_PREFIX = 'base.';

function fields(value: object): Readonly<Record<string, unknown>> {
  return value as Readonly<Record<string, unknown>>;
}

type Slots = Readonly<Record<string, unknown>>;

/** Structural equality over JSON data, where an undefined key reads as absent. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, i) => sameValue(value, b[i]))
    );
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => sameValue(left[key], right[key]));
}

function readSlot(params: BinParams, slot: string): unknown {
  if (slot.startsWith(BASE_PREFIX)) {
    return fields(params.base)[slot.slice(BASE_PREFIX.length)];
  }
  return fields(params)[slot];
}

function readSlots(params: BinParams, slots: readonly string[]): Slots {
  return Object.fromEntries(slots.map((slot) => [slot, readSlot(params, slot)]));
}

function slotsMatch(params: BinParams, slots: Slots): boolean {
  return Object.entries(slots).every(([slot, value]) => sameValue(readSlot(params, slot), value));
}

function writeSlots(params: BinParams, values: Slots): BinParams {
  const top: Record<string, unknown> = { ...params };
  const base = new Map<string, unknown>(Object.entries(params.base));
  for (const [slot, value] of Object.entries(values)) {
    if (!slot.startsWith(BASE_PREFIX)) {
      // Kept as an explicit `undefined`: `setParams` merges with
      // `Object.assign`, so a missing key would leave the stale value.
      top[slot] = value;
      continue;
    }
    // Deleted rather than set to `undefined`: `base` is replaced wholesale and
    // hashed for the community fingerprint, where absent is the off state.
    const key = slot.slice(BASE_PREFIX.length);
    if (value === undefined) base.delete(key);
    else base.set(key, value);
  }
  return { ...top, base: Object.fromEntries(base) } as unknown as BinParams;
}

/** The slots turning `feature` off writes, read off its own disable patch. */
function featureSlots(params: BinParams, feature: FeatureKey): string[] {
  const patch = FEATURE_MANIFESTS[feature].apply(params, false);
  return Object.keys(patch).flatMap((key) => {
    if (key !== 'base' || patch.base === undefined) return [key];
    const before = fields(params.base);
    const after = fields(patch.base);
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((baseKey) => !sameValue(before[baseKey], after[baseKey]))
      .map((baseKey) => `${BASE_PREFIX}${baseKey}`);
  });
}

/** What going from `before` to `after` cleared, as settings to give back later. */
function collectCleared(before: BinParams, after: BinParams): ClearedBodySetting[] {
  const cleared: ClearedBodySetting[] = [];
  for (const feature of Object.keys(FEATURE_MANIFESTS) as FeatureKey[]) {
    if (ARCHETYPE_FEATURES.has(feature)) continue;
    const manifest = FEATURE_MANIFESTS[feature];
    if (!manifest.isEnabled(before) || manifest.isEnabled(after)) continue;
    const slots = featureSlots(before, feature);
    if (slots.length === 0 || slots.some((slot) => ARCHETYPE_SLOTS.has(slot))) continue;
    cleared.push({ feature, original: readSlots(before, slots), left: readSlots(after, slots) });
  }
  for (const slot of PLAIN_SLOTS) {
    if (sameValue(before[slot], after[slot])) continue;
    cleared.push({
      feature: null,
      original: { [slot]: before[slot] },
      left: { [slot]: after[slot] },
    });
  }
  return cleared;
}

/** `params` with `setting` restored, or null when the body `next` cannot carry it. */
function giveBack(
  params: BinParams,
  setting: ClearedBodySetting,
  next: BodyType
): BinParams | null {
  const candidate = writeSlots(params, setting.original);
  if (setting.feature === null) {
    // Base only pins height and collar, so restoring them there would only be
    // undone by `finalizeBaseParams`, and the user's value lost with it.
    return isEffectiveTile(candidate.base) ? null : candidate;
  }
  const { feature } = setting;
  const resolution = resolveConstraints(candidate, { feature, enabled: true });
  if (resolution.autoDisabled.length > 0) return null;
  // The engine hands back the candidate untouched when the enable is blocked,
  // so the restored slots alone would read as enabled. Availability is the test.
  const status = getFeatureStatus(resolution.params, feature);
  if (!status.enabled || !status.available) return null;
  // Its enable patch writes defaults (a fresh fillet radius); the user's own
  // values win, while any implication it applied (a solid floor) stays.
  const settled = writeSlots(resolution.params, setting.original);
  // `base.style` holds both the attachment and the flat and lid bodies, so
  // giving magnets back can silently change which body this is.
  return deriveBodyType(settled.base) === next ? settled : null;
}

export interface BodyTypeSwitch {
  readonly params: BinParams;
  readonly memory: BodyTypeMemory | null;
}

/**
 * Switch to body type `next`, giving back what earlier switches cleared.
 *
 * `memory` is whatever the previous switch returned. It applies only while the
 * bin is still the body type that switch landed on.
 */
export function switchBodyType(
  params: BinParams,
  next: BodyType,
  memory: BodyTypeMemory | null
): BodyTypeSwitch {
  const current = deriveBodyType(params.base);
  if (current === next) return { params, memory };

  const held =
    memory?.bodyType === current
      ? memory.cleared.filter((setting) => slotsMatch(params, setting.left))
      : [];
  const switched = finalizeBaseParams(bodyTypeParams(params, next));

  let restored = switched;
  const kept: ClearedBodySetting[] = [];
  for (const setting of held) {
    if (setting.feature !== null && FEATURE_MANIFESTS[setting.feature].isEnabled(restored)) {
      continue;
    }
    const given = giveBack(restored, setting, next);
    if (given) restored = given;
    else kept.push(setting);
  }
  const result = finalizeBaseParams(restored);

  // A held setting keeps the user's original value, so it outranks anything this
  // switch clears in the same slot: that would only record a value the user
  // never chose (a 1u pin, a floor) as the one to come back to.
  const carried = kept.map((setting) => ({
    ...setting,
    left: readSlots(result, Object.keys(setting.left)),
  }));
  const heldSlots = new Set(carried.flatMap((setting) => Object.keys(setting.left)));
  // Read off the switch alone and kept only where its result still stands. A
  // slot a restore filled since is the user's value, not something this cleared.
  const fresh = collectCleared(params, switched).filter(
    (setting) =>
      slotsMatch(result, setting.left) && Object.keys(setting.left).every((s) => !heldSlots.has(s))
  );

  const cleared = [...carried, ...fresh];
  return { params: result, memory: cleared.length > 0 ? { bodyType: next, cleared } : null };
}
