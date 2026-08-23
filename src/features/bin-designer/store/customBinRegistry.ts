/**
 * Custom Bin Registry - Lightweight localStorage index of saved bin designs.
 *
 * The Layout Planner reads this synchronously to populate its "Custom Bins"
 * palette without loading full design params from IndexedDB.
 *
 * Registry is updated whenever the Bin Designer saves or deletes a design.
 */

import type { DesignId } from '@/core/types';
import type { ItemEnvelope, ItemKind } from '@/shared/types/item';
import type { AssemblyStructure } from '@/shared/types/assembly';
import { assemblyOverhangMm, assemblyRiseMm } from '@/shared/types/assemblyPlacement';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import type { Result } from '@/core/result';
import type { StorageError } from '@/core/result/errors';
import { isOk } from '@/core/result';
import { saveToLocalStorage, loadFromLocalStorage } from '@/core/storage/backends/localStorage';
import {
  assembledHeight,
  type AssembledHeightSource,
} from '@/shared/printSettings/assembledHeight';
import { planKnifeRest } from '@/shared/utils/knifeRestPlan';
import { hasOverhang, resolveOverhang } from '@/shared/utils/overhang';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { BinParams } from '../types';
import { isSocketlessBase } from '../types/base';

const REGISTRY_KEY = 'gridfinity-custom-bins-v1';

/** Subscribers notified when the registry changes */
const subscribers = new Set<() => void>();

/** Subscribe to registry changes. Returns unsubscribe function. */
export function subscribeToRegistry(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/** Notify all subscribers that registry has changed */
function notifySubscribers(): void {
  subscribers.forEach((cb) => cb());
}

/** Lightweight reference to a saved bin design (for planner palette) */
export interface CustomBinRef {
  readonly id: DesignId;
  readonly name: string;
  /** Grid units width */
  readonly width: number;
  /** Grid units depth */
  readonly depth: number;
  /** Height units */
  readonly height: number;
  /**
   * Fractional-edge orientation carried so the layout planner / bin inspector
   * can flag a drawer mismatch without loading the full design.
   * Optional: older registry entries omit them until the design is re-saved.
   */
  readonly fractionalEdgeX?: 'start' | 'end';
  readonly fractionalEdgeY?: 'start' | 'end';
  readonly fractionalEdgeManualX?: boolean;
  readonly fractionalEdgeManualY?: boolean;
  /**
   * Half-socket base, carried for the same reason as the edges: such a bin is
   * built from uniform 0.5-unit cells, so its fractional edge has no geometric
   * effect and must not be flagged as mismatched (...).
   * Optional — entries saved before this omit it until the design is re-saved.
   */
  readonly halfSockets?: boolean;
  /**
   * Item kind of the design; absent = parametric bin (pre-kind registry
   * entries and every bin save omit it). `importedMesh` designs are immutable
   * meshes — the planner/inspector use this to suppress resize affordances.
   */
  readonly kind?: ItemKind;
  /**
   * `assembledHeight(...).totalMm` without a plate: how far this design stands
   * above whatever it lands on, lid and all. Carried for the same reason as the
   * fractional edges — the layout's drawer-ceiling check runs in a selector and
   * cannot await the full params out of IndexedDB. Absent on entries saved
   * before it, which the ceiling measures as a plain bin.
   */
  readonly assembledRiseMm?: number;
  /**
   * Whether the base has no socket. Such a design neither nests into the bin
   * below nor seats in a baseplate, so it stands on whatever is under it.
   */
  readonly socketless?: boolean;
  /**
   * Whether the design keeps its stacking lip. A bin stacked on a lipless
   * design has nothing to settle into, so the junction credit is the
   * SUPPORTER's to grant — the upper bin's socket alone earns nothing.
   * Absent on entries saved before the field; the ceiling assumes a lip then,
   * which errs toward reporting the column shorter (the pre-field behaviour).
   */
  readonly hasLip?: boolean;
  /**
   * Companion handle-rest footprint for a knife-block design, so the layout
   * can place (and keep) the paired rest bin without loading the full params
   * out of IndexedDB. Absent = the design has no companion rest.
   */
  readonly knifeRest?: {
    readonly side: 'front' | 'back' | 'left' | 'right';
    /** Along the knife axis, grid units. */
    readonly alongU: number;
    /** Across the knives, grid units (matches the block's cross size). */
    readonly crossU: number;
    /** Rest body height in Gridfinity height units. */
    readonly heightU: number;
    /** Free drawer space between block face and rest (mm). */
    readonly gapMm: number;
  };
  /**
   * Per-side millimetres the design's own body extends past its grid
   * footprint, already resolved outward-only. Carried for the same reason as
   * {@link assembledRiseMm}: "does this bin fit the print bed" is asked in
   * synchronous selectors that cannot await full params out of IndexedDB, and
   * an overhang grows the part in mm without changing a single grid unit — so
   * a design whose units fit can still be far too wide to print.
   *
   * A PLACED bin's own overhang (`extendToMargin`, "Expand to Fit") takes
   * precedence over this; see `resolveBinOverhang`, whose third tier this is.
   * Absent = no overhang, or an entry saved before the field.
   */
  readonly overhangMm?: {
    readonly left: number;
    readonly right: number;
    readonly front: number;
    readonly back: number;
  };
  /** ISO timestamp of last update */
  readonly updatedAt: string;
}

/**
 * Project the fractional-edge fields a registry entry carries out of a full
 * `BinParams`. Every `upsertRegistryEntry` call site spreads this so the
 * lightweight ref never drifts from the design's real edge orientation.
 */
export function registryEdgeFields(params: {
  readonly fractionalEdgeX?: 'start' | 'end';
  readonly fractionalEdgeY?: 'start' | 'end';
  readonly fractionalEdgeManualX?: boolean;
  readonly fractionalEdgeManualY?: boolean;
  readonly base?: { readonly halfSockets?: boolean };
}): Pick<
  CustomBinRef,
  | 'fractionalEdgeX'
  | 'fractionalEdgeY'
  | 'fractionalEdgeManualX'
  | 'fractionalEdgeManualY'
  | 'halfSockets'
> {
  return {
    fractionalEdgeX: params.fractionalEdgeX,
    fractionalEdgeY: params.fractionalEdgeY,
    fractionalEdgeManualX: params.fractionalEdgeManualX,
    fractionalEdgeManualY: params.fractionalEdgeManualY,
    halfSockets: params.base?.halfSockets,
  };
}

/**
 * Project the assembled-height fields a registry entry carries out of a full
 * `BinParams`. Mirrors {@link registryEdgeFields}: every `upsertRegistryEntry`
 * call site spreads it so a linked bin's drawer-ceiling contribution never
 * drifts from the design it points at.
 */
export function registryHeightFields(
  params: AssembledHeightSource
): Pick<CustomBinRef, 'assembledRiseMm' | 'socketless' | 'hasLip'> {
  return {
    assembledRiseMm: assembledHeight(params).totalMm,
    socketless: isSocketlessBase(params.base.style),
    hasLip: params.base.stackingLip,
  };
}

/**
 * Project the companion handle-rest footprint out of a full `BinParams`.
 * Spread wherever {@link registryHeightFields} is, so the layout's paired
 * placement never drifts from what the design would actually generate.
 * Explicitly `undefined` when there is no companion, so a re-save that
 * disabled the rest clears the stale field instead of carrying it.
 */
export function registryKnifeRestFields(params: BinParams): Pick<CustomBinRef, 'knifeRest'> {
  const plan = planKnifeRest(params);
  if (!plan || plan.style !== 'companion') return { knifeRest: undefined };
  return {
    knifeRest: {
      side: plan.side,
      alongU: plan.alongU,
      crossU: plan.crossU,
      heightU: plan.heightUnits,
      gapMm: plan.gapMm,
    },
  };
}

/**
 * Project the design's own overhang out of a full `BinParams`.
 *
 * Spread wherever {@link registryHeightFields} is. Explicitly `undefined` when
 * there is none, so a re-save that turned the overhang off clears the stale
 * field rather than carrying it — the same contract as
 * {@link registryKnifeRestFields}, and the reason `withCarriedGeometry` tests
 * key presence for both.
 *
 * Suppressed for a partial cell mask, matching `deriveDimensions`: a custom
 * shape defines its own footprint and the overhang does not apply.
 */
export function registryOverhangFields(
  params: Pick<BinParams, 'overhang' | 'cellMask'>
): Pick<CustomBinRef, 'overhangMm'> {
  const o = resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang);
  if (!hasOverhang(o)) return { overhangMm: undefined };
  return { overhangMm: { left: o.left, right: o.right, front: o.front, back: o.back } };
}

/**
 * Project the fields a Workshop assembly's registry entry carries out of its
 * envelope + structure — the assembly counterpart of
 * {@link registryHeightFields} + {@link registryOverhangFields}. `hasLip` is
 * always false (a holder's parts stand proud of a plate with no lip), so the
 * ceiling charges the full rise with no junction credit; parts placed past the
 * plate edge surface as `overhangMm` so print-bed fit sees the real extent.
 */
export function registryAssemblyFields(
  envelope: ItemEnvelope,
  structure: AssemblyStructure
): Pick<CustomBinRef, 'kind' | 'assembledRiseMm' | 'socketless' | 'hasLip' | 'overhangMm'> {
  const socketAndFloorMm = GRIDFINITY_SPEC.SOCKET_HEIGHT + structure.base.floorThickness;
  return {
    kind: 'assembly',
    assembledRiseMm: assemblyRiseMm(structure, socketAndFloorMm),
    socketless: false,
    hasLip: false,
    overhangMm: assemblyOverhangMm(structure, {
      w: envelope.width * envelope.gridUnitMm,
      d: envelope.depth * envelope.gridUnitMm,
    }),
  };
}

/**
 * Validate one raw localStorage entry and project it onto the `CustomBinRef`
 * shape. Returns `null` for anything that does not match so malformed or
 * legacy records are dropped rather than trusted. Building the object
 * explicitly also discards the legacy `thumbnail` field (and any other extra
 * keys) without copying them into the in-memory registry.
 */
function parseEntry(raw: unknown): CustomBinRef | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const {
    id,
    name,
    width,
    depth,
    height,
    updatedAt,
    fractionalEdgeX,
    fractionalEdgeY,
    fractionalEdgeManualX,
    fractionalEdgeManualY,
    halfSockets,
    kind,
    assembledRiseMm,
    socketless,
    hasLip,
    knifeRest,
    overhangMm,
  } = raw as Record<string, unknown>;
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof width !== 'number' ||
    typeof depth !== 'number' ||
    typeof height !== 'number' ||
    typeof updatedAt !== 'string'
  ) {
    return null;
  }
  const edge = (v: unknown): 'start' | 'end' | undefined =>
    v === 'start' || v === 'end' ? v : undefined;
  const edgeX = edge(fractionalEdgeX);
  const edgeY = edge(fractionalEdgeY);
  return {
    id: id as DesignId,
    name,
    width,
    depth,
    height,
    ...(edgeX ? { fractionalEdgeX: edgeX } : {}),
    ...(edgeY ? { fractionalEdgeY: edgeY } : {}),
    ...(typeof fractionalEdgeManualX === 'boolean' ? { fractionalEdgeManualX } : {}),
    ...(typeof fractionalEdgeManualY === 'boolean' ? { fractionalEdgeManualY } : {}),
    ...(typeof halfSockets === 'boolean' ? { halfSockets } : {}),
    ...(kind === 'bin' || kind === 'toolRack' || kind === 'importedMesh' || kind === 'assembly'
      ? { kind }
      : {}),
    ...(typeof assembledRiseMm === 'number' &&
    Number.isFinite(assembledRiseMm) &&
    assembledRiseMm > 0
      ? { assembledRiseMm }
      : {}),
    ...(typeof socketless === 'boolean' ? { socketless } : {}),
    ...(typeof hasLip === 'boolean' ? { hasLip } : {}),
    ...(() => {
      if (typeof overhangMm !== 'object' || overhangMm === null) return {};
      const o = overhangMm as Record<string, unknown>;
      const side = (v: unknown): number =>
        typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
      const sides = {
        left: side(o.left),
        right: side(o.right),
        front: side(o.front),
        back: side(o.back),
      };
      // An all-zero record is the same as no record; dropping it keeps the
      // "absent = nothing to charge" read at every consumer.
      if (sides.left + sides.right + sides.front + sides.back <= 0) return {};
      return { overhangMm: sides };
    })(),
    ...(() => {
      if (typeof knifeRest !== 'object' || knifeRest === null) return {};
      const kr = knifeRest as Record<string, unknown>;
      const validSide =
        kr.side === 'front' || kr.side === 'back' || kr.side === 'left' || kr.side === 'right';
      const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
      if (!validSide || !num(kr.alongU) || !num(kr.crossU) || !num(kr.heightU)) return {};
      return {
        knifeRest: {
          side: kr.side as 'front' | 'back' | 'left' | 'right',
          alongU: kr.alongU,
          crossU: kr.crossU,
          heightU: kr.heightU,
          gapMm: typeof kr.gapMm === 'number' && Number.isFinite(kr.gapMm) ? kr.gapMm : 21,
        },
      };
    })(),
    updatedAt,
  };
}

/**
 * Retrieve the saved custom bin registry from localStorage.
 *
 * @returns The array of saved `CustomBinRef` entries; returns an empty array if no registry is stored, the stored value is not a valid array, or reading/parsing fails. Malformed entries are dropped individually.
 */
export function loadRegistry(): CustomBinRef[] {
  const result = loadFromLocalStorage<unknown>(REGISTRY_KEY);
  if (!isOk(result) || !result.value) return [];
  if (!Array.isArray(result.value)) return [];

  return result.value.map(parseEntry).filter((entry): entry is CustomBinRef => entry !== null);
}

/**
 * Persist the provided registry array to localStorage, replacing any previously stored registry.
 *
 * Returns Result with StorageError if storage is full or unavailable.
 *
 * @param refs - The list of `CustomBinRef` objects to store as the full registry
 */
function saveRegistry(refs: CustomBinRef[]): Result<void, StorageError> {
  return saveToLocalStorage(REGISTRY_KEY, refs);
}

/**
 * Inserts a custom bin reference into the local registry or replaces an existing entry with the same `id`.
 *
 * Returns Result with StorageError if persistence fails. The in-memory registry
 * and subscribers are always updated regardless of storage outcome.
 *
 * @param ref - The CustomBinRef to add or update in the registry
 */
export function upsertRegistryEntry(ref: CustomBinRef): Result<void, StorageError> {
  const refs = loadRegistry();
  const idx = refs.findIndex((r) => r.id === ref.id);
  if (idx >= 0) {
    refs[idx] = withCarriedGeometry(ref, refs[idx]);
  } else {
    refs.push(ref);
  }
  const result = saveRegistry(refs);
  notifySubscribers();
  return result;
}

/**
 * Carry the geometry-derived fields forward when an update omits them.
 *
 * An upsert replaces the whole entry, and most writers only have a thumbnail or
 * a new name to record — a rename must not silently erase the assembled height
 * the drawer-ceiling check reads. Thirteen call sites write this registry, so
 * the rule is enforced here rather than remembered at each: a writer holding
 * `BinParams` spreads {@link registryHeightFields} and overwrites these with
 * fresh values, and a writer that is not touching geometry cannot drop them.
 */
function withCarriedGeometry(next: CustomBinRef, prev: CustomBinRef): CustomBinRef {
  return {
    ...next,
    ...(next.assembledRiseMm === undefined && prev.assembledRiseMm !== undefined
      ? { assembledRiseMm: prev.assembledRiseMm }
      : {}),
    ...(next.socketless === undefined && prev.socketless !== undefined
      ? { socketless: prev.socketless }
      : {}),
    ...(next.hasLip === undefined && prev.hasLip !== undefined ? { hasLip: prev.hasLip } : {}),
    // Key-presence, not value: `registryKnifeRestFields` writes an explicit
    // `knifeRest: undefined` when a re-save DISABLED the rest, which must
    // clear the field — while a thumbnail/rename writer omits the key
    // entirely and must not erase it.
    // Same key-presence rule as `knifeRest`: `registryOverhangFields` writes an
    // explicit `overhangMm: undefined` when a re-save REMOVED the overhang.
    ...(!('overhangMm' in next) && prev.overhangMm !== undefined
      ? { overhangMm: prev.overhangMm }
      : {}),
    ...(!('knifeRest' in next) && prev.knifeRest !== undefined
      ? { knifeRest: prev.knifeRest }
      : {}),
  };
}

/**
 * Removes the registry entry with the given id.
 *
 * If no entry matches `id`, the registry is unchanged.
 * Returns Result with StorageError if persistence fails.
 *
 * @param id - The identifier of the design to remove
 */
export function removeRegistryEntry(id: string): Result<void, StorageError> {
  const refs = loadRegistry().filter((r) => r.id !== id);
  const result = saveRegistry(refs);
  notifySubscribers();
  return result;
}

/**
 * Replace the stored custom bin registry with the provided list of references.
 *
 * Returns Result with StorageError if persistence fails.
 *
 * @param refs - Array of CustomBinRef objects to persist as the new registry
 */
export function rebuildRegistry(refs: CustomBinRef[]): Result<void, StorageError> {
  const result = saveRegistry(refs);
  notifySubscribers();
  return result;
}
