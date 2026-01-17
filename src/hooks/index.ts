export { useGridCoords } from './useGridCoords';
export { useInteraction } from './useInteraction';
export { useDrawerSettings } from './useDrawerSettings';

// Grid component hooks (extracted from Grid/index.tsx)
export { useGridZoom } from './useGridZoom';
export type { GridZoomState, UseGridZoomOptions } from './useGridZoom';
export { useGridAxisLabels } from './useGridAxisLabels';
export type { GridAxisLabelsState, UseGridAxisLabelsOptions } from './useGridAxisLabels';
export { useGridRowColumnSelection } from './useGridRowColumnSelection';
export type { GridRowColumnSelectionState, UseGridRowColumnSelectionOptions } from './useGridRowColumnSelection';
export { useGridResize } from './useGridResize';
export type { GridResizeState, UseGridResizeOptions, ResizeDirection, PendingResize } from './useGridResize';
export { useGridFirstUseHints } from './useGridFirstUseHints';
export type { GridFirstUseHintsState, UseGridFirstUseHintsOptions } from './useGridFirstUseHints';
export { useGridTemplate } from './useGridTemplate';
export type { GridTemplateState, UseGridTemplateOptions } from './useGridTemplate';
export type { UseDrawerSettingsReturn } from './useDrawerSettings';

// Bin inspector hook (shared by RightPanel and MobileInspector)
export { useBinInspector } from './useBinInspector';
export type { UseBinInspectorReturn, BinField, BinConstraints, ConfirmDeleteState } from './useBinInspector';

// 3D preview hooks
export { useBinGeometry, createBinGeometry } from './useBinGeometry';

// Re-export shared hooks for backward compatibility
export { useKeyboard, useAutoSave, useResponsive, prefersTouch, useCrossTabSync, usePWAUpdate } from '../shared/hooks';
export type { SaveStatus, ResponsiveState, LayoutMode } from '../shared/hooks';

export { usePrintList } from './usePrintList';
export type { UsePrintListReturn } from './usePrintList';
export { useLayoutSwitcher } from './useLayoutSwitcher';
export { useLayoutRouting } from './useLayoutRouting';
export { useAnalytics } from './useAnalytics';
export { useStorageMigration } from './useStorageMigration';
export { useTabletPanels } from './useTabletPanels';
export type { TabletPanelsState } from './useTabletPanels';
export { useFeatureFlag, isFeatureEnabled } from './useFeatureFlag';
export { useSharedWithMe } from './useSharedWithMe';
export type { SharedWithMeStatus } from './useSharedWithMe';

// Collaborative editing hooks
export { useCollabMode, getCollabMode } from './useCollabMode';
export type { CollabModeState } from './useCollabMode';
export { useCollabPresence } from './useCollabPresence';
export type { CollabPresenceActions } from './useCollabPresence';
export { useCollabSync } from './useCollabSync';
export { useCollabLayout, useCollabLayoutSelector } from './useCollabLayout';
