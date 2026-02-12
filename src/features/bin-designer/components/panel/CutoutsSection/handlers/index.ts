/**
 * Barrel export for cutout interaction handlers.
 *
 * Each handler manages pointer-move logic for a single interaction mode,
 * keeping the main hook focused on orchestration.
 */

export { handlePendingPlaceMove } from './pendingPlaceHandler';
export { handleDragMove } from './dragHandler';
export { handleResizeMove } from './resizeHandler';
export { handleRotateMove } from './rotateHandler';
export { handleGroupRotateMove } from './groupRotateHandler';
export { handleGroupScaleMove } from './groupScaleHandler';
export { handleDrawMove } from './drawHandler';
export { handleCutoutKeyDown } from './keyboardHandler';
export type { KeyboardHandlerContext } from './keyboardHandler';
export {
  handlePathDrawingPointerDown,
  handlePathDrawingPointerMove,
  handlePathDrawingPointerUp,
  handlePathDrawingVertexDown,
} from './pathDrawingHandler';
export type {
  PathDrawingMode,
  PathDrawingPreviewState,
  PathDrawingSetters,
} from './pathDrawingHandler';
export {
  handleVertexEditPointerDown,
  handleVertexEditPointerMove,
  handleVertexEditPointerUp,
  handleVertexEditKeyDown,
} from './pathEditHandler';
export type {
  VertexEditMode,
  VertexDragTarget,
  VertexEditSetters,
  SegmentHoverInfo,
} from './pathEditHandler';

export type {
  PointerMoveEvent,
  BinBounds,
  SnapFn,
  PreviewMap,
  PreviewSetters,
  DeadZoneRef,
} from './types';
