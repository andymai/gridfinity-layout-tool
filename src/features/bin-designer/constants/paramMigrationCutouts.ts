/** Migration of persisted cutouts: legacy fields, parent groups and chains, arrays, knife spec and rest, lid cutouts. */

import type { Cutout, KnifeRestConfig, KnifeSpec } from '../types';
import type { CutoutArrayConfig } from '../types';
import {
  MAX_ARRAY_INSTANCES,
  MAX_CUTOUT_GROUP_NAMES,
  MAX_GROUP_NAME_LENGTH,
  MAX_PARENT_GROUPS,
} from '../types';
import { sameChain } from '../utils/cutoutHierarchy';
import { groupRepeatConfig } from '@/shared/utils/cutoutArray';
import {
  KNIFE_REST_DEFAULT_GAP_MM,
  KNIFE_REST_GROOVE_DEPTH_MM,
  KNIFE_REST_MAX_GAP_MM,
  KNIFE_REST_MIN_DEPTH_U,
  KNIFE_REST_MAX_DEPTH_U,
  KNIFE_REST_MIN_GROOVE_DEPTH_MM,
  KNIFE_REST_MAX_GROOVE_DEPTH_MM,
} from '../types';
import { MAX_LID_CUTOUTS } from '../types/lid';
import { TEXT_MAX_LENGTH } from '../types/text';
import { clampNumber } from './paramMigrationHelpers';

/** Legacy cutout fields from older versions, accepted by migrateCutout. */
export interface LegacyCutoutFields {
  /** Pre-split scoop radius (mm). Migrated to scoopRadiusW + scoopRadiusD. */
  scoopRadius?: number;
}

/**
 * A knife spec as it may arrive from a pre-split file: one round
 * `handleDiameterMm` and no width/height yet.
 */
type LegacyKnifeSpec = Omit<KnifeSpec, 'handleWidthMm' | 'handleHeightMm'> & {
  handleWidthMm?: number;
  handleHeightMm?: number;
  handleDiameterMm?: number;
};

/**
 * Split a legacy round `handleDiameterMm` into the width/height pair. A knife
 * already carrying both comes back by reference so a current design keeps its
 * fingerprint; an absent knife (the common case) is left untouched.
 */
function migrateKnifeSpec(knife: KnifeSpec | undefined): KnifeSpec | undefined {
  if (knife === undefined) return knife;
  const legacy = knife as LegacyKnifeSpec;
  if (legacy.handleDiameterMm === undefined) return knife;
  const { handleDiameterMm, ...rest } = legacy;
  return {
    ...rest,
    handleWidthMm: rest.handleWidthMm ?? handleDiameterMm,
    handleHeightMm: rest.handleHeightMm ?? handleDiameterMm,
  };
}

/**
 * Normalize a persisted ancestry chain.
 *
 * The store maintains these invariants by construction, but a hand-authored or
 * crafted file reaches here without ever having passed through it: non-string
 * entries, a group repeated at two depths (which would make the tree a cycle to
 * anything walking it), and a chain deeper than the editor can show all have to
 * be flattened out before the rest of the app trusts the field.
 *
 * Returns `undefined` for the absent/empty case so a design that never nested
 * serializes exactly as it did before the field existed.
 */
function migrateParentGroups(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const chain: string[] = [];
  for (const entry of raw as unknown[]) {
    if (typeof entry !== 'string' || entry === '' || seen.has(entry)) continue;
    seen.add(entry);
    chain.push(entry);
    if (chain.length === MAX_PARENT_GROUPS) break;
  }
  return chain.length > 0 ? chain : undefined;
}

/**
 * Set a cutout's ancestry, dropping the field entirely for a top-level one so a
 * design that never nests serializes as it did before the field existed.
 *
 * An unchanged cutout comes back by reference, which is what lets the callers
 * leave an already-consistent design's fingerprint alone.
 */
function withParentGroups(cutout: Cutout, parents: readonly string[]): Cutout {
  if (parents.length === 0) {
    if (cutout.parentGroups === undefined) return cutout;
    const { parentGroups: _drop, ...rest } = cutout;
    return rest;
  }
  if (sameChain(parents, cutout.parentGroups ?? [])) return cutout;
  return { ...cutout, parentGroups: [...parents] };
}

/**
 * Migrate a single cutout's legacy fields to current shape.
 *
 * Idempotent: re-running on an already-migrated cutout leaves W/D untouched.
 * Only copies legacy scoopRadius into both axes when neither axis is set.
 */
export function migrateCutout(cutout: Cutout & LegacyCutoutFields): Cutout {
  const { scoopRadius, ...rest } = cutout;
  const knife = migrateKnifeSpec(rest.knife);
  const withKnife = knife === rest.knife ? rest : { ...rest, knife };
  const array = migrateCutoutArray(withKnife.array);
  const withArray = array === withKnife.array ? withKnife : { ...withKnife, array };
  const withParents = withParentGroups(
    withArray,
    migrateParentGroups(withArray.parentGroups) ?? []
  );
  return migrateScoopRadius(withParents, scoopRadius);
}

function migrateScoopRadius(cutout: Cutout, scoopRadius: number | undefined): Cutout {
  if (
    scoopRadius !== undefined &&
    cutout.scoopRadiusW === undefined &&
    cutout.scoopRadiusD === undefined
  ) {
    return { ...cutout, scoopRadiusW: scoopRadius, scoopRadiusD: scoopRadius };
  }
  return cutout;
}

/**
 * Reconcile group ancestry across a cutout array.
 *
 * Two things the store cannot produce but a file can:
 *
 *  - Members of one boolean group claiming DIFFERENT ancestors. The tree is
 *    denormalized across members, so a disagreement has no honest reading; the
 *    first member in array order settles it, the same tiebreak `cutoutBuilder`
 *    already uses to pick a group's op.
 *  - A group used as both a boolean group and a container. That would let a
 *    subgroup change which shapes an op fuses, so the container reading loses
 *    and the id is stripped from every ancestry chain that names it.
 *
 * Untouched cutouts come back by reference, so a design that was already
 * consistent keeps its fingerprint.
 */
export function normalizeGroupChains(cutouts: readonly Cutout[]): Cutout[] {
  const booleanIds = new Set<string>();
  for (const c of cutouts) {
    if (c.groupId !== null) booleanIds.add(c.groupId);
  }
  const asContainers = (chain: readonly string[] | undefined): readonly string[] =>
    (chain ?? []).filter((id) => !booleanIds.has(id));

  const canonical = new Map<string, readonly string[]>();
  for (const c of cutouts) {
    if (c.groupId === null || canonical.has(c.groupId)) continue;
    canonical.set(c.groupId, asContainers(c.parentGroups));
  }

  return cutouts.map((c) =>
    withParentGroups(
      c,
      c.groupId === null ? asContainers(c.parentGroups) : (canonical.get(c.groupId) ?? [])
    )
  );
}

/**
 * Keep the names of groups the design still has, the same way mesh assets are
 * swept: the field survives on `...rest`, so without this a deleted assembly's
 * name rides along in every later save and shifts the design's
 * `communityParamsFingerprint`.
 *
 * Clamped, not just filtered: the server rejects an over-long name or an
 * oversized map, so a hand-authored file has to be refused HERE too — the
 * alternative is a design that edits fine locally and fails at publish.
 */
export function migrateCutoutGroupNames(
  raw: unknown,
  referenced: ReadonlySet<string>
): Record<string, string> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const kept = Object.entries(raw)
    .filter(([id, name]) => referenced.has(id) && typeof name === 'string')
    .map(([id, name]) => [id, (name as string).trim().slice(0, MAX_GROUP_NAME_LENGTH)] as const)
    // Trimmed BEFORE the empty test: the editor reads a whitespace-only name as
    // unnamed, so keeping one leaves an inert entry that still shifts the
    // design's fingerprint.
    .filter(([, name]) => name !== '')
    .slice(0, MAX_CUTOUT_GROUP_NAMES);
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/**
 * Give every member of a group the repeat its group runs.
 *
 * Repeating a loose cutout and THEN grouping it used to leave the config on
 * that member alone. The worker has always cut every copy of such a group, so
 * the config is spread across the members here rather than dropped, and the
 * editor then draws the same copies the export cuts.
 *
 * A group whose members disagree is left exactly as it is: `groupRepeatConfig`
 * declines to repeat it, and rewriting one member's pattern onto the others
 * would move cuts in a design nothing in this app produced.
 *
 * When nothing needed changing the result is a fresh array holding the same
 * cutout objects, so a design that was already consistent serializes
 * byte-identically.
 */
export function shareGroupArrays(cutouts: readonly Cutout[]): Cutout[] {
  const byGroup = new Map<string, Cutout[]>();
  for (const cutout of cutouts) {
    if (cutout.groupId === null) continue;
    const members = byGroup.get(cutout.groupId);
    if (members) members.push(cutout);
    else byGroup.set(cutout.groupId, [cutout]);
  }
  const shared = new Map<string, CutoutArrayConfig>();
  for (const [groupId, members] of byGroup) {
    if (members.every((m) => m.array !== undefined)) continue;
    const config = groupRepeatConfig(members);
    if (config) shared.set(groupId, config);
  }
  if (shared.size === 0) return [...cutouts];
  return cutouts.map((c) => {
    if (c.groupId === null || c.array !== undefined) return c;
    const config = shared.get(c.groupId);
    return config ? { ...c, array: config } : c;
  });
}

/**
 * Normalize a repeat's per-copy label list. The share/sync validator rejects an
 * oversized one, but a hand-authored JSON imported locally never reaches it, so
 * the caps are applied here too: at most one label per copy the repeat can
 * expand to, each one line long.
 *
 * Returns the input by reference when nothing needed changing, so a design that
 * predates the list serializes byte-identically and its fingerprint holds.
 */
function migrateCutoutArray(array: CutoutArrayConfig | undefined): CutoutArrayConfig | undefined {
  if (!array) return array;
  const raw: unknown = array.labels;
  if (raw === undefined) return array;
  if (!Array.isArray(raw)) {
    const { labels: _drop, ...rest } = array;
    return rest;
  }
  const labels = raw
    .slice(0, MAX_ARRAY_INSTANCES)
    .map((entry: unknown) => (typeof entry === 'string' ? entry.slice(0, TEXT_MAX_LENGTH) : ''));
  const unchanged =
    labels.length === raw.length && labels.every((entry, i) => entry === (raw as unknown[])[i]);
  return unchanged ? array : { ...array, labels };
}

/**
 * Normalize `lid.cutouts`.
 *
 * Lid cutouts are the same {@link Cutout} the interior uses and take the same
 * per-shape migration, with two host-imposed differences:
 *
 * - `shape: 'mesh'` is dropped. A mesh imprint is subtracted AFTER tessellation
 *   and in the bin's mesh frame, so no lid solid could ever describe one — which
 *   is also why STEP export refuses imprinted bins outright (CLAUDE.md gotcha
 *   #20). Dropping is the honest outcome; the alternative is a second imprint
 *   path that cannot be exported.
 * - The array is capped at {@link MAX_LID_CUTOUTS}, so a crafted share cannot
 *   hand the boolean engine an unbounded shape list. Truncation matches the
 *   client action's refusal rather than silently keeping the tail.
 *
 * Returns `undefined` rather than `[]` for the absent/empty case, so a design with
 * no lid cutouts serializes exactly as it did before the field existed.
 */
export function migrateLidCutouts(raw: unknown): Cutout[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = normalizeGroupChains(raw.map((c) => migrateCutout(c as Cutout & LegacyCutoutFields)))
    .filter((c) => c.shape !== 'mesh')
    .slice(0, MAX_LID_CUTOUTS);
  // Absent, not empty: see the field's own note. An array that migrated down to
  // nothing (all-mesh, say) must collapse too, or it would shift the fingerprint
  // of a design that ends up carrying no lid cutouts at all.
  return out.length > 0 ? out : undefined;
}

/**
 * Normalize a persisted `knifeRest`. Invalid shapes drop to `undefined`
 * (pre-feature designs stay byte-identical); numeric fields are clamped to the
 * editor bounds so a hand-edited share can't drive runaway rest geometry.
 * Fields at their defaults are dropped rather than persisted.
 */
export function migrateKnifeRest(raw: unknown): KnifeRestConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const value = raw as Record<string, unknown>;
  if (typeof value.enabled !== 'boolean') return undefined;
  const style = value.style === 'integrated' ? ('integrated' as const) : undefined;
  const gapMm =
    value.gapMm !== undefined
      ? clampNumber(value.gapMm, 0, KNIFE_REST_MAX_GAP_MM, KNIFE_REST_DEFAULT_GAP_MM)
      : undefined;
  const depthU =
    value.depthU !== undefined
      ? Math.round(
          clampNumber(value.depthU, KNIFE_REST_MIN_DEPTH_U, KNIFE_REST_MAX_DEPTH_U, 1) * 2
        ) / 2
      : undefined;
  const grooveDepthMm =
    value.grooveDepthMm !== undefined
      ? clampNumber(
          value.grooveDepthMm,
          KNIFE_REST_MIN_GROOVE_DEPTH_MM,
          KNIFE_REST_MAX_GROOVE_DEPTH_MM,
          KNIFE_REST_GROOVE_DEPTH_MM
        )
      : undefined;
  const color = typeof value.color === 'string' ? value.color : undefined;
  return {
    enabled: value.enabled,
    ...(style !== undefined ? { style } : {}),
    ...(gapMm !== undefined ? { gapMm } : {}),
    ...(depthU !== undefined ? { depthU } : {}),
    ...(grooveDepthMm !== undefined ? { grooveDepthMm } : {}),
    ...(color !== undefined ? { color } : {}),
  };
}
