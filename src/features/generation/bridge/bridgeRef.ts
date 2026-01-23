/**
 * Module-level reference to the active GenerationBridge.
 *
 * Shared between useGeneration (which owns the bridge lifecycle)
 * and useExport (which uses it for STEP/STL export).
 * This avoids loading WASM twice or putting non-serializable
 * objects in the Zustand store.
 */
import type { GenerationBridge } from './GenerationBridge';

let bridge: GenerationBridge | null = null;

/** Register the active bridge (called by useGeneration on mount). */
export function setActiveBridge(b: GenerationBridge | null): void {
  bridge = b;
}

/** Get the active bridge (called by useExport for BREP export). */
export function getActiveBridge(): GenerationBridge | null {
  return bridge;
}
