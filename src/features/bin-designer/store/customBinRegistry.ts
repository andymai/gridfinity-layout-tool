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
 * Load the custom bin registry from localStorage.
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
 * Save the registry to localStorage.
 */
function saveRegistry(refs: CustomBinRef[]): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(refs));
  } catch {
    // Storage full or unavailable - silently fail
  }
}

/**
 * Add or update a design in the registry.
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
 * Remove a design from the registry by ID.
 */
export function removeRegistryEntry(id: string): void {
  const refs = loadRegistry().filter((r) => r.id !== id);
  saveRegistry(refs);
}

/**
 * Rebuild the entire registry from a list of designs.
 * Used during initialization or sync.
 */
export function rebuildRegistry(refs: CustomBinRef[]): void {
  saveRegistry(refs);
}
