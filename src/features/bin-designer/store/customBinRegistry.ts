/**
 * Custom Bin Registry - Lightweight localStorage index of saved bin designs.
 *
 * The Layout Planner reads this synchronously to populate its "Custom Bins"
 * palette without loading full design params from IndexedDB.
 *
 * Registry is updated whenever the Bin Designer saves or deletes a design.
 */

import type { DesignId } from '@/core/types';
import type { ItemKind } from '@/shared/types/item';
import type { Result } from '@/core/result';
import type { StorageError } from '@/core/result/errors';
import { isOk } from '@/core/result';
import { saveToLocalStorage, loadFromLocalStorage } from '@/core/storage/backends/localStorage';

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
   * can flag a drawer mismatch without loading the full design (issue #2518).
   * Optional: pre-#2518 registry entries omit them until the design is re-saved.
   */
  readonly fractionalEdgeX?: 'start' | 'end';
  readonly fractionalEdgeY?: 'start' | 'end';
  readonly fractionalEdgeManualX?: boolean;
  readonly fractionalEdgeManualY?: boolean;
  /**
   * Item kind of the design; absent = parametric bin (pre-kind registry
   * entries and every bin save omit it). `importedMesh` designs are immutable
   * meshes — the planner/inspector use this to suppress resize affordances.
   */
  readonly kind?: ItemKind;
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
}): Pick<
  CustomBinRef,
  'fractionalEdgeX' | 'fractionalEdgeY' | 'fractionalEdgeManualX' | 'fractionalEdgeManualY'
> {
  return {
    fractionalEdgeX: params.fractionalEdgeX,
    fractionalEdgeY: params.fractionalEdgeY,
    fractionalEdgeManualX: params.fractionalEdgeManualX,
    fractionalEdgeManualY: params.fractionalEdgeManualY,
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
    kind,
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
    ...(kind === 'bin' || kind === 'toolRack' || kind === 'importedMesh' ? { kind } : {}),
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
    refs[idx] = ref;
  } else {
    refs.push(ref);
  }
  const result = saveRegistry(refs);
  notifySubscribers();
  return result;
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
