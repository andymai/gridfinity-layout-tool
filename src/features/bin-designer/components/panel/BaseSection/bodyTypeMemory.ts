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
import { validateCompartmentSizes } from '@/features/bin-designer/utils/validation';
import { heldCutoutFillMm, reanchorCutoutFill } from '@/features/bin-designer/utils/cutoutFill';
import { isOk } from '@/core/result';
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
 * Slots a setting is remembered without, because writing one back carries more
 * than that setting: `trayBottom` is Nesting's own config, and `base.style`
 * encodes the flat and lid bodies and both attachments at once. A feature
 * stored there (magnets, screws) comes back through the target body's enable
 * patch, which composes with what the bin has now.
 */
const SHARED_SLOTS: ReadonlySet<string> = new Set([
  'base.trayBottom',
  'base.style',
  'base.tile',
  'base.spacer',
]);

/**
 * Values a switch pins or floors without any feature turning off. The cutout
 * config is here for its fill: a floor-referenced fill is held in mm across the
 * write, and Base only's slab clamps it to almost nothing.
 */
const PLAIN_SLOTS = ['height', 'extraWallHeightMm', 'cutoutConfig'] as const;

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
    const slots = featureSlots(before, feature).filter((slot) => !SHARED_SLOTS.has(slot));
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

/** `candidate` with `feature` on and `original` kept, or null if body `next` cannot carry it. */
function enableOn(
  candidate: BinParams,
  feature: FeatureKey,
  original: Slots,
  next: BodyType
): BinParams | null {
  const resolution = resolveConstraints(candidate, { feature, enabled: true });
  if (resolution.autoDisabled.length > 0) return null;
  // The engine hands back the candidate untouched when the enable is blocked,
  // so the restored slots alone would read as enabled. Availability is the test.
  const status = getFeatureStatus(resolution.params, feature);
  if (!status.enabled || !status.available) return null;
  // Its enable patch writes defaults (a fresh fillet radius); the user's own
  // values win, while any implication it applied (a solid floor) stays.
  const settled = writeSlots(resolution.params, original);
  // `base.style` holds both the attachment and the flat and lid bodies, so
  // giving magnets back can silently change which body this is.
  return deriveBodyType(settled.base) === next ? settled : null;
}

function compartmentsFit(params: BinParams): boolean {
  const { compartments } = params;
  return isOk(
    validateCompartmentSizes(
      params.width,
      params.depth,
      params.wallThickness,
      compartments.cols,
      compartments.rows,
      compartments.thickness,
      params.gridUnitMm,
      params.gridUnitMmY
    )
  );
}

/** `params` with `setting` restored, or null when the body `next` cannot carry it. */
function giveBack(
  params: BinParams,
  setting: ClearedBodySetting,
  next: BodyType
): BinParams | null {
  const { feature, original } = setting;
  const restored =
    feature === null
      ? writeSlots(params, original)
      : enableOn(writeSlots(params, original), feature, original, next);
  if (!restored) return null;
  // Held, not spent, when finalizing would undo it at once (Base only pins the
  // height, a floor raises it): a later body may keep it.
  const restoredSlots = readSlots(restored, Object.keys(original));
  if (!slotsMatch(finalizeBaseParams(restored), restoredSlots)) return null;
  // `setParams` refuses a grid whose cells no longer fit (the bin may have
  // shrunk since), and would refuse the whole switch with it.
  if ('compartments' in original && !compartmentsFit(restored)) return null;
  return restored;
}

/** `next` with its fill re-held the way `setParams` will on the write. */
function holdFill(next: BinParams, heldMm: number | null): BinParams {
  const topOffset = reanchorCutoutFill(next, heldMm);
  return topOffset === undefined
    ? next
    : { ...next, cutoutConfig: { ...next.cutoutConfig, topOffset } };
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
  const heldFill = heldCutoutFillMm(params);
  const switched = holdFill(finalizeBaseParams(bodyTypeParams(params, next)), heldFill);

  let restored = switched;
  const kept: ClearedBodySetting[] = [];
  const given: ClearedBodySetting[] = [];
  for (const setting of held) {
    if (setting.feature !== null && FEATURE_MANIFESTS[setting.feature].isEnabled(restored)) {
      continue;
    }
    const back = giveBack(restored, setting, next);
    if (back) {
      restored = back;
      given.push(setting);
    } else {
      kept.push(setting);
    }
  }
  // A fill given back is the user's own, so it is not re-held. `setParams`
  // re-holds it anyway, which is why the caller writes it again afterwards.
  const result = given.some((setting) => 'cutoutConfig' in setting.original)
    ? finalizeBaseParams(restored)
    : holdFill(finalizeBaseParams(restored), heldFill);

  const carried = kept.map((setting) => ({
    ...setting,
    left: readSlots(result, Object.keys(setting.left)),
  }));
  // A slot held or just given back already has the user's own value on record,
  // so this switch must not record what it found there instead: that is only
  // a value the user never chose (a 1u pin, a floor). Even a restore that
  // lands on the value this switch would have pinned anyway counts.
  const claimed = new Set([...carried, ...given].flatMap((setting) => Object.keys(setting.left)));
  // Read off the switch alone and kept only where its result still stands.
  const fresh = collectCleared(params, switched).filter(
    (setting) =>
      slotsMatch(result, setting.left) &&
      Object.keys(setting.left).every((slot) => !claimed.has(slot)) &&
      (setting.feature === null || !FEATURE_MANIFESTS[setting.feature].isEnabled(result))
  );

  const cleared = [...carried, ...fresh];
  return { params: result, memory: cleared.length > 0 ? { bodyType: next, cleared } : null };
}
