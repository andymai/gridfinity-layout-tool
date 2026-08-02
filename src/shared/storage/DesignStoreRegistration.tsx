import { registerDesignStorePort } from '@/core/storage/designStorePort';
import { designStoreAdapter } from '@/features/bin-designer';

/**
 * Composition root wiring the bin-designer's concrete `DesignStorePort` into
 * the core-owned holder, so `core/storage` share/archive flows can persist and
 * read designs without a `core → feature` import.
 *
 * Registration runs at module load (not in an effect) so the port is in place
 * before first paint and before any user-triggered export/share — those paths
 * read the port synchronously and would otherwise see `null` during the gap
 * between mount and the first effect flush.
 */
registerDesignStorePort(designStoreAdapter);

/**
 * Eager mount anchor. Renders nothing; its only job is to keep this module in
 * the shell's import graph (alongside the sync mount) so the registration
 * above always runs. Not gated behind any Labs flag.
 */
export function DesignStoreRegistration(): null {
  return null;
}
