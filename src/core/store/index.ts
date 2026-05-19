export { useLayoutStore } from './layout';
export { useToastStore, INITIAL_TOAST_STATE } from './toast';
export { useLibraryStore, computePreview, createDefaultLibrary } from './library';
export { useSettingsStore, DEFAULT_SETTINGS } from './settings';
export type { UserSettings } from './settings';
export { useLabsStore, LABS_STORAGE_KEY } from './labs';

export { useSelectionStore, INITIAL_SELECTION_STATE } from './selection';
export type { SelectionStore } from './selection';

export { useViewStore, INITIAL_VIEW_STATE } from './view';
export type { ViewStore, ContextMenuState, LayerViewMode } from './view';

export { useInteractionStore, INITIAL_INTERACTION_STATE } from './interaction';
export type { InteractionStore, DropTarget, PaintSize } from './interaction';

export { useMobileStore, INITIAL_MOBILE_STATE } from './mobile';
export type { MobileStore, MobilePanel, MobileLayersTab } from './mobile';

export { useHalfGridModeStore, INITIAL_HALF_GRID_MODE_STATE } from './halfGridMode';
export type { HalfGridModeStore } from './halfGridMode';

export { useSharedPreviewStore, INITIAL_SHARED_PREVIEW_STATE } from './sharedPreview';
export type { SharedPreviewStore } from './sharedPreview';

export { useSharePopoverStore, INITIAL_SHARE_POPOVER_STATE } from './sharePopover';
export type { SharePopoverStore } from './sharePopover';

export { useSharedWithMeStore, INITIAL_SHARED_WITH_ME_STATE } from './sharedWithMe';

export { useSnapshotStore, INITIAL_SNAPSHOT_STATE } from './snapshots';
export type { SnapshotState } from './snapshots';

// Extracted selectors (cross-store derived hooks)
export {
  selectBins,
  selectLayers,
  useActiveLayerBins,
  useActiveLayer,
  useLayerBinCounts,
  useStagingBins,
  useSelectedBins,
} from './selectors';
