/**
 * Keyboard shortcut effect for the cutout workspace.
 *
 * Wires the global `keydown` listener to `handleCutoutKeyDown`, which routes
 * each event to the appropriate parent action (delete, copy, paste, nudge,
 * undo, group, lock, etc.).
 */

import { useEffect } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import { handleCutoutKeyDown } from './handlers';
import type { PathDrawingPreviewState, SegmentHoverInfo } from './handlers';
import type { InteractionMode, PreviewMap } from './cutoutInteractionTypes';
import type { AlignmentGuide } from './geometry';

interface UseCutoutKeyboardShortcutsOptions {
  readonly selection: ReadonlySet<string>;
  readonly cutouts: readonly Cutout[];
  readonly mode: InteractionMode;
  readonly deleteSelected: () => void;
  readonly deselectAll: () => void;
  readonly selectAll: () => void;
  readonly nudgeSelected: (dx: number, dy: number) => void;
  readonly copySelected: () => void;
  readonly pasteFromClipboard: () => void;
  readonly duplicateSelected: () => void;
  readonly undoWithToast: () => void;
  readonly redoWithToast: () => void;
  readonly onGroup?: (cutoutIds: readonly string[]) => void;
  readonly onUngroup?: (cutoutIds: readonly string[]) => void;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onUpdateBatch?: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly onLock?: (ids: readonly string[]) => void;
  readonly onUnlock?: (ids: readonly string[]) => void;
  readonly setPreview: (next: PreviewMap | ((prev: PreviewMap) => PreviewMap)) => void;
  readonly setActiveGuides: React.Dispatch<React.SetStateAction<AlignmentGuide[]>>;
  readonly setDrawingPreview: (next: null) => void;
  readonly setPathDrawingPreview: (next: PathDrawingPreviewState | null) => void;
  readonly setMode: (next: InteractionMode) => void;
  readonly setSegmentHover: (next: SegmentHoverInfo | null) => void;
  readonly setSelection: (next: ReadonlySet<string>) => void;
}

export function useCutoutKeyboardShortcuts(deps: UseCutoutKeyboardShortcutsOptions): void {
  const {
    selection,
    cutouts,
    mode,
    deleteSelected,
    deselectAll,
    selectAll,
    nudgeSelected,
    copySelected,
    pasteFromClipboard,
    duplicateSelected,
    undoWithToast,
    redoWithToast,
    onGroup,
    onUngroup,
    onUpdate,
    onUpdateBatch,
    onLock,
    onUnlock,
    setPreview,
    setActiveGuides,
    setDrawingPreview,
    setPathDrawingPreview,
    setMode,
    setSegmentHover,
    setSelection,
  } = deps;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleCutoutKeyDown(e, {
        selection,
        cutouts,
        mode,
        deleteSelected,
        deselectAll,
        selectAll,
        nudgeSelected,
        copySelected,
        pasteFromClipboard,
        duplicateSelected,
        onUndo: undoWithToast,
        onRedo: redoWithToast,
        onGroup,
        onUngroup,
        onUpdate,
        onUpdateBatch,
        onLock,
        onUnlock,
        setPreview,
        clearActiveGuides: () => setActiveGuides([]),
        clearDrawingPreview: () => setDrawingPreview(null),
        clearPathDrawingPreview: () => setPathDrawingPreview(null),
        setPathDrawingPreview,
        setMode,
        setSegmentHover,
        setSelection,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selection,
    cutouts,
    mode,
    deleteSelected,
    deselectAll,
    selectAll,
    nudgeSelected,
    copySelected,
    pasteFromClipboard,
    duplicateSelected,
    undoWithToast,
    redoWithToast,
    onGroup,
    onUngroup,
    onUpdate,
    onUpdateBatch,
    onLock,
    onUnlock,
    setPreview,
    setActiveGuides,
    setDrawingPreview,
    setPathDrawingPreview,
    setMode,
    setSegmentHover,
    setSelection,
  ]);
}
