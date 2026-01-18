// Hooks barrel export
// Note: Prefer direct imports (e.g., '@/hooks/useDrawerSettings') over barrel imports

export { useDrawerSettings } from './useDrawerSettings';
export type { UseDrawerSettingsReturn } from './useDrawerSettings';

export { useBinGeometry, createBinGeometry } from './useBinGeometry';

export { useLayoutSwitcher } from './useLayoutSwitcher';
export { useLayoutRouting } from './useLayoutRouting';
export { useAnalytics } from './useAnalytics';
export { useStorageMigration } from './useStorageMigration';
export { useTabletPanels } from './useTabletPanels';
export type { TabletPanelsState } from './useTabletPanels';
export { useFeatureFlag, isFeatureEnabled } from './useFeatureFlag';

// Collaborative editing hooks
export { useCollabMode, getCollabMode } from './useCollabMode';
export type { CollabModeState } from './useCollabMode';
export { useCollabPresence } from './useCollabPresence';
export type { CollabPresenceActions } from './useCollabPresence';
export { useCollabSync } from './useCollabSync';
export { useCollabLayout, useCollabLayoutSelector } from './useCollabLayout';
