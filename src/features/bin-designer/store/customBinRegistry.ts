/**
 * Custom Bin Registry - Lightweight localStorage index of saved bin designs.
 *
 * The Layout Planner reads this synchronously to populate its "Custom Bins"
 * palette without loading full design params from IndexedDB.
 *
 * Registry is updated whenever the Bin Designer saves or deletes a design.
 */

const REGISTRY_KEY = 'gridfinity-custom-bins-v1';

/** Lightweight reference to a saved bin design (for planner palette) */
export interface CustomBinRef {
  readonly id: string;
  readonly name: string;
  /** Grid units width */
  readonly width: number;
  /** Grid units depth */
  readonly depth: number;
  /** Height units */
  readonly height: number;
  /** Base64 thumbnail (small) or null */
  readonly thumbnail: string | null;
  /** ISO timestamp of last update */
  readonly updatedAt: string;
}

/**
 * Retrieve the saved custom bin registry from localStorage.
 *
 * @returns The array of saved `CustomBinRef` entries; returns an empty array if no registry is stored, the stored value is not a valid array, or reading/parsing fails.
 */
export function loadRegistry(): CustomBinRef[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CustomBinRef[];
  } catch {
    return [];
  }
}

/**
 * Persist the provided registry array to localStorage, replacing any previously stored registry.
 *
 * This operation swallows storage errors (e.g., quota exceeded or unavailable storage) and does not throw.
 *
 * @param refs - The list of `CustomBinRef` objects to store as the full registry
 */
function saveRegistry(refs: CustomBinRef[]): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(refs));
  } catch {
    // Storage full or unavailable - silently fail
  }
}

/**
 * Inserts a custom bin reference into the local registry or replaces an existing entry with the same `id`.
 *
 * @param ref - The CustomBinRef to add or update in the registry
 */
export function upsertRegistryEntry(ref: CustomBinRef): void {
  const refs = loadRegistry();
  const idx = refs.findIndex((r) => r.id === ref.id);
  if (idx >= 0) {
    refs[idx] = ref;
  } else {
    refs.push(ref);
  }
  saveRegistry(refs);
}

/**
 * Removes the registry entry with the given id.
 *
 * If no entry matches `id`, the registry is unchanged.
 *
 * @param id - The identifier of the design to remove
 */
export function removeRegistryEntry(id: string): void {
  const refs = loadRegistry().filter((r) => r.id !== id);
  saveRegistry(refs);
}

/**
 * Replace the stored custom bin registry with the provided list of references.
 *
 * @param refs - Array of CustomBinRef objects to persist as the new registry
 */
export function rebuildRegistry(refs: CustomBinRef[]): void {
  saveRegistry(refs);
}