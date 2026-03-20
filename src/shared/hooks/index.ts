// Shared hooks - cross-cutting concerns with no domain coupling

export { useAutoSave } from './useAutoSave';
export type { SaveStatus } from './useAutoSave';

export { useResponsive, prefersTouch } from './useResponsive';
export type { ResponsiveState, LayoutMode } from './useResponsive';

export { useCrossTabSync } from './useCrossTabSync';

export { usePWAUpdate } from './usePWAUpdate';

export { useGridTemplate } from './useGridTemplate';
export type { GridTemplateState, UseGridTemplateOptions } from './useGridTemplate';

export { useSharedWithMe } from './useSharedWithMe';
export type { SharedWithMeStatus } from './useSharedWithMe';

export { useInlineEdit } from './useInlineEdit';

export { usePrefetchChunks } from './usePrefetchChunks';

export { useLatestRef } from './useLatestRef';

export { useLayoutRef } from './useLayoutRef';

export { useResultToast, showErrorToast } from './useResultToast';

export { useSelectionActions } from './useSelectionActions';

export { useAlignBins } from './useAlignBins';

export { useFocusTrap } from './useFocusTrap';

// App-level hooks (merged from src/hooks/)

export { useDrawerSettings } from './useDrawerSettings';
export type { UseDrawerSettingsReturn } from './useDrawerSettings';

export { useBinGeometry, createBinGeometry } from './useBinGeometry';

export { useLayoutSwitcher } from './useLayoutSwitcher';
export { useAnalytics } from './useAnalytics';
export { useStorageMigration } from './useStorageMigration';
export { useIndexedDBRecovery } from './useIndexedDBRecovery';
export { useSnapshotAutoSave } from './useSnapshotAutoSave';
export { useLocalStorageCleanup } from './useLocalStorageCleanup';
export { useTabletPanels } from './useTabletPanels';
export type { TabletPanelsState } from './useTabletPanels';
export { useFeatureFlag, isFeatureEnabled } from './useFeatureFlag';

export { useKeyboard } from './useKeyboard';

export { useCollabMode, getCollabMode } from './useCollabMode';
export type { CollabModeState } from './useCollabMode';
export { useCollabPresence } from './useCollabPresence';
export type { CollabPresenceActions } from './useCollabPresence';
export { useCollabSync } from './useCollabSync';
export { useCollabLayout, useCollabLayoutSelector } from './useCollabLayout';
