export { BaseplatePage } from './components/BaseplatePage';
export { BaseplateLibraryInitMount } from './components/BaseplateLibraryInitMount';
export { helpEntries } from './helpEntries';
export { buildBaseplateExportPieces } from './utils/buildBaseplateExportPieces';

export type { SavedBaseplateDesign } from './types/library';
export * as BaseplateStorage from './storage/BaseplateStorage';
export type { BaseplateSyncEvent } from './sync/baseplateEvents';
export { baseplateAdapter } from './sync/baseplateAdapter';
export {
  loadRegistry,
  upsertRegistryEntry,
  removeRegistryEntry,
  rebuildRegistry,
  subscribeToRegistry,
  type BaseplateRef,
} from './store/baseplateRegistry';
export { useBaseplateLibrary, type UseBaseplateLibrary } from './hooks/useBaseplateLibrary';
export { useBaseplateAutoSave } from './hooks/useBaseplateAutoSave';
