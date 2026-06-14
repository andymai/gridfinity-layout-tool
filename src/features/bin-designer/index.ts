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
// Deep paths on purpose: the ./hooks barrel also re-exports useAutoSave /
// useThumbnailCapture, which import ./utils/thumbnail (full three.js namespace).
// This module is eagerly imported by App and the sync flows, so going through the
// barrel would pull three core onto first paint.
export { useBackgroundThumbnailRegen } from './hooks/useBackgroundThumbnailRegen';
export { useCustomBins } from './hooks/useCustomBins';
export {
  useDesignThumbnail,
  clearThumbnailCache,
  updateThumbnailCache,
} from './hooks/useDesignThumbnail';
export { useBinDefaults } from './hooks/useBinDefaults';
export type { UseBinDefaults } from './hooks/useBinDefaults';

// --- Utils ---
// Deep path on purpose: the ./utils barrel re-exports ./thumbnail, which imports
// the full three.js namespace for offscreen rendering. Pulling the barrel here
// would drag three core onto first paint (this module is eagerly imported by App
// and the sync flows). fileNaming is three-free.
export { generateFileName } from './utils/fileNaming';

// --- Sync ---
// Exposed for `shared/sync/` to wire into the sync engine without reaching
// into the feature's internal path.
export { designAdapter } from './sync/designAdapter';

// --- Components ---
// Intentionally NOT re-exported here. DesignerPage/ExampleGallery pull in the
// full three.js + drei + troika 3D stack. This barrel is statically imported by
// many eager modules (sync flows, design-linking hooks, SettingsModal) for its
// hooks/types/adapter; re-exporting the 3D components dragged that ~360 kB gzip
// chunk onto first paint. Consumers must deep-import them via their own paths so
// they stay behind lazy boundaries.

// --- Help modal integration ---
export { helpEntries } from './helpEntries';
