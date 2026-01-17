// Re-export grid hooks from features/grid-editor for backward compatibility
export { useGridCoords } from '../features/grid-editor/hooks/useGridCoords';
export { useInteraction } from '../features/grid-editor/hooks/useInteraction';
export { useDrawerSettings } from './useDrawerSettings';

// Grid component hooks (extracted from Grid/index.tsx) - re-exported from features/grid-editor
export { useGridZoom } from '../features/grid-editor/hooks/useGridZoom';
export type { GridZoomState, UseGridZoomOptions } from '../features/grid-editor/hooks/useGridZoom';
export { useGridAxisLabels } from '../features/grid-editor/hooks/useGridAxisLabels';
export type { GridAxisLabelsState, UseGridAxisLabelsOptions } from '../features/grid-editor/hooks/useGridAxisLabels';
export { useGridRowColumnSelection } from '../features/grid-editor/hooks/useGridRowColumnSelection';
export type { GridRowColumnSelectionState, UseGridRowColumnSelectionOptions } from '../features/grid-editor/hooks/useGridRowColumnSelection';
export { useGridResize } from '../features/grid-editor/hooks/useGridResize';
export type { GridResizeState, UseGridResizeOptions, ResizeDirection, PendingResize } from '../features/grid-editor/hooks/useGridResize';
export { useGridFirstUseHints } from '../features/grid-editor/hooks/useGridFirstUseHints';
export type { GridFirstUseHintsState, UseGridFirstUseHintsOptions } from '../features/grid-editor/hooks/useGridFirstUseHints';
export { useGridTemplate } from '../features/grid-editor/hooks/useGridTemplate';
export type { GridTemplateState, UseGridTemplateOptions } from '../features/grid-editor/hooks/useGridTemplate';
export { useGridNavigation } from '../features/grid-editor/hooks/useGridNavigation';
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
