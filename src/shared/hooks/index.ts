// UI & browser hooks
export { useAutoSave } from './useAutoSave';
export type { SaveStatus } from './useAutoSave';
export { useResponsive, prefersTouch } from './useResponsive';
export type { ResponsiveState, LayoutMode } from './useResponsive';
export { useCrossTabSync } from './useCrossTabSync';
export { usePWAUpdate } from './usePWAUpdate';
export { usePrefetchChunks } from './usePrefetchChunks';
export { useFocusTrap } from './useFocusTrap';
export { useInlineEdit } from './useInlineEdit';
export { useKeyboard } from './useKeyboard';

// Grid & layout hooks
export { useGridTemplate } from './useGridTemplate';
export type { GridTemplateState, UseGridTemplateOptions } from './useGridTemplate';
export { useDrawerSettings } from './useDrawerSettings';
export type { UseDrawerSettingsReturn } from './useDrawerSettings';
export { useBinGeometry, createBinGeometry } from './useBinGeometry';
export { useLayoutSwitcher } from './useLayoutSwitcher';
export { useSelectionActions } from './useSelectionActions';
export { useAlignBins } from './useAlignBins';

// Ref hooks
export { useLatestRef } from './useLatestRef';
export { useLayoutRef } from './useLayoutRef';

// Result & toast hooks
export { useResultToast, showErrorToast } from './useResultToast';

// Share & sync hooks
export { useSharedWithMe } from './useSharedWithMe';
export type { SharedWithMeStatus } from './useSharedWithMe';

// Lifecycle & persistence hooks
export { useAnalytics } from './useAnalytics';
export { useStorageMigration } from './useStorageMigration';
export { useIndexedDBRecovery } from './useIndexedDBRecovery';
export { useSnapshotAutoSave } from './useSnapshotAutoSave';
export { useLocalStorageCleanup } from './useLocalStorageCleanup';
export { useFeatureFlag, isFeatureEnabled } from './useFeatureFlag';
export { useTabletPanels } from './useTabletPanels';
export type { TabletPanelsState } from './useTabletPanels';

// Collaboration hooks
export { useCollabMode, getCollabMode } from './useCollabMode';
export type { CollabModeState } from './useCollabMode';
export { useCollabPresence } from './useCollabPresence';
export type { CollabPresenceActions } from './useCollabPresence';
export { useCollabSync } from './useCollabSync';
export { useCollabLayout, useCollabLayoutSelector } from './useCollabLayout';
