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

export { useDocumentMeta, buildLayoutDescription } from './useDocumentMeta';
