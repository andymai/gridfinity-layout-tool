// Grid editor hooks - barrel export
export { useGridAxisLabels } from './useGridAxisLabels';
export { useGridCoords } from './useGridCoords';
export { useGridFirstUseHints } from './useGridFirstUseHints';
export { useGridNavigation } from './useGridNavigation';
export { useGridResize } from './useGridResize';
export { useGridRowColumnSelection } from './useGridRowColumnSelection';
// Re-export from shared (useGridTemplate moved to shared layer)
export { useGridTemplate } from '@/shared/hooks';
export type { GridTemplateState, UseGridTemplateOptions } from '@/shared/hooks';
export { useGridZoom } from './useGridZoom';
export { useInteraction } from './useInteraction';
// Re-export from shared (used by both grid-editor and command-palette)
export { useAlignBins } from '@/shared/hooks/useAlignBins';
