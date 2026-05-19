/**
 * Bin Designer feature module — public API.
 *
 * Only symbols that external consumers (design-linking, App.tsx, shared/)
 * actually need are exported here. Internal implementation details stay
 * behind sub-barrel boundaries.
 *
 * If you need to add a new export, verify that the consumer cannot import
 * from @/shared/types/bin or @/shared/constants/bin instead.
 */

// --- Types ---
export type { BinParams, SavedDesign } from './types';
export type { CustomBinRef } from './store';

// --- Store ---
export { useDesignerStore, removeRegistryEntry, upsertRegistryEntry } from './store';

// --- Storage ---
export { loadDesign, deleteDesign, listDesigns, updateDesignParams } from './storage';

// --- Hooks ---
export {
  useBackgroundThumbnailRegen,
  useCustomBins,
  useDesignThumbnail,
  clearThumbnailCache,
  updateThumbnailCache,
} from './hooks';

// --- Utils ---
export { generateFileName } from './utils';

// --- Sync ---
// Exposed for `shared/sync/` to wire into the sync engine without reaching
// into the feature's internal path.
export { designAdapter } from './sync/designAdapter';

// --- Components ---
export { DesignerPage } from './components';

// --- Help modal integration ---
export { helpEntries } from './helpEntries';
