/**
 * Grid Editor feature module.
 *
 * Provides the main grid canvas for layout editing, including:
 * - CSS Grid-based layout rendering
 * - Drag/draw/resize/paint interactions
 * - Isometric 3D preview (lazy loaded)
 * - Grid navigation and zoom
 */

// Main component
export { Grid } from './components/Grid';

export {
  useGridAxisLabels,
  useGridCoords,
  useGridFirstUseHints,
  useGridNavigation,
  useGridResize,
  useGridRowColumnSelection,
  useGridTemplate,
  useGridZoom,
  useInteraction,
} from './hooks';
export type { GridTemplateState, UseGridTemplateOptions } from './hooks';

// Types used externally (3D preview integration)
export type { SceneHandle } from './components/Grid/IsometricPreview/Scene';
export type { CameraPreset } from './components/Grid/IsometricPreview/Scene';

export { helpEntries } from './helpEntries';
