/**
 * Baseplate Registry - Lightweight localStorage index of saved baseplate designs.
 *
 * UI surfaces (selectors, sidebar switcher) read this synchronously to populate
 * the active-baseplate list without loading full design params from IndexedDB.
 *
 * Registry is updated whenever the baseplate library saves or deletes a design.
 */

import type { BaseplateDesignId } from '@/core/types';
import type { Result } from '@/core/result';
import type { StorageError } from '@/core/result/errors';
import { isOk } from '@/core/result';
import { saveToLocalStorage, loadFromLocalStorage } from '@/core/storage/backends/localStorage';

const REGISTRY_KEY = 'gridfinity-baseplate-registry-v1';

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

/** Lightweight reference to a saved baseplate design (for selectors). */
export interface BaseplateRef {
  readonly id: BaseplateDesignId;
  readonly name: string;
  /** ISO timestamp of last update */
  readonly updatedAt: string;
}

/**
 * Validate one raw localStorage entry and project it onto the `BaseplateRef`
 * shape. Returns `null` for anything that does not match so malformed or
 * legacy records are dropped rather than trusted.
 */
function parseEntry(raw: unknown): BaseplateRef | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, name, updatedAt } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof updatedAt !== 'string') {
    return null;
  }
  return {
    id: id as BaseplateDesignId,
    name,
    updatedAt,
  };
}

/**
 * Retrieve the saved baseplate registry from localStorage.
 *
 * @returns The array of saved `BaseplateRef` entries; returns an empty array if no registry is stored, the stored value is not a valid array, or reading/parsing fails. Malformed entries are dropped individually.
 */
export function loadRegistry(): BaseplateRef[] {
  const result = loadFromLocalStorage<unknown>(REGISTRY_KEY);
  if (!isOk(result) || !result.value) return [];
  if (!Array.isArray(result.value)) return [];

  return result.value.map(parseEntry).filter((entry): entry is BaseplateRef => entry !== null);
}

/**
 * Persist the provided registry array to localStorage, replacing any previously stored registry.
 */
function saveRegistry(refs: BaseplateRef[]): Result<void, StorageError> {
  return saveToLocalStorage(REGISTRY_KEY, refs);
}

/**
 * Inserts a baseplate reference into the local registry or replaces an existing entry with the same `id`.
 *
 * The in-memory registry and subscribers are always updated regardless of storage outcome.
 */
export function upsertRegistryEntry(ref: BaseplateRef): Result<void, StorageError> {
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
 */
export function removeRegistryEntry(id: string): Result<void, StorageError> {
  const refs = loadRegistry().filter((r) => r.id !== id);
  const result = saveRegistry(refs);
  notifySubscribers();
  return result;
}

/**
 * Replace the stored baseplate registry with the provided list of references.
 */
export function rebuildRegistry(refs: BaseplateRef[]): Result<void, StorageError> {
  const result = saveRegistry(refs);
  notifySubscribers();
  return result;
}
