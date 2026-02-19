export { useLayoutStore } from './layout';
export { useHistoryStore, useUndoableAction } from './history';
export { useToastStore } from './toast';
export { useLibraryStore, computePreview, createDefaultLibrary } from './library';
export { useSettingsStore, DEFAULT_SETTINGS } from './settings';
export type { UserSettings } from './settings';
export { useLabsStore, LABS_STORAGE_KEY } from './labs';

// New stores extracted from ui.ts
export { useSelectionStore } from './selection';
export type { SelectionStore } from './selection';

export { useViewStore } from './view';
export type { ViewStore, ContextMenuState } from './view';

export { useInteractionStore } from './interaction';
export type { InteractionStore, DropTarget, PaintSize, LayerViewMode } from './interaction';

export { useMobileStore } from './mobile';
export type { MobileStore, MobilePanel, MobileLayersTab } from './mobile';

export { useHalfBinModeStore } from './halfBinMode';
export type { HalfBinModeStore } from './halfBinMode';

export { useSharedPreviewStore } from './sharedPreview';
export type { SharedPreviewStore } from './sharedPreview';

export { useSnapshotStore } from './snapshots';
export type { SnapshotState } from './snapshots';

// Legacy re-export for backwards compatibility
// Production code has been migrated to specific stores.
// Test files still use this facade for convenience.
// eslint-disable-next-line @typescript-eslint/no-deprecated -- kept for backward compat
export { useUIStore } from './ui';
