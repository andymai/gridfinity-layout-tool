/**
 * Interaction hooks module.
 *
 * This module provides the core interaction system for the grid editor,
 * split into mode-specific hooks for maintainability and testability.
 *
 * Architecture:
 * - useInteraction: Main facade hook (public API, unchanged from before refactor)
 * - useDrawInteraction: Draw & paint modes (new bin creation and area fill)
 * - useDragInteraction: Drag mode (bin movement, duplication)
 * - useResizeInteraction: Resize mode (bin resizing via handles)
 * - useStagingDragInteraction: Staging drag (moving bins from stash to grid)
 *
 * The facade pattern means consumers of useInteraction see no API changes.
 */

// Types
export type {
  InteractionContext,
  ModeHandlers,
  AddBinParams,
  PointerCaptureHandle,
  PaintSize,
  DrawStartArgs,
  DragStartArgs,
  ResizeStartArgs,
  StagingDragStartArgs,
} from './types';

// Mode hooks
export { useDrawInteraction } from './useDrawInteraction';
export { useDragInteraction } from './useDragInteraction';
export { useResizeInteraction } from './useResizeInteraction';
export { useStagingDragInteraction } from '@/features/staging/hooks/useStagingDragInteraction';
