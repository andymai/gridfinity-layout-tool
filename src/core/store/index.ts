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

// Legacy re-export for backwards compatibility during migration
// TODO: Remove after all consumers are updated
export { useUIStore } from './ui';
