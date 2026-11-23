/**
 * Undo and redo on the baseplate page: Ctrl/Cmd+Z, Ctrl/Cmd+Y and
 * Ctrl/Cmd+Shift+Z, plus the handlers for the header buttons.
 *
 * The page uses the layout's history, because the plate settings are part of
 * the layout. Undo on the planner after a visit here takes back these edits
 * in order, and does not drop them with an older snapshot.
 */

import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SHORTCUTS } from '@/core/constants';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { isTextEntryTarget } from '@/shared/utils/formControlTarget';
import { finishBaseplateParamsDrag } from '../components/BaseplatePanel/panelState';

export interface BaseplateUndo {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undo: () => void;
  readonly redo: () => void;
}

export function useBaseplateUndo(): BaseplateUndo {
  const { canUndo, canRedo } = useHistoryStore(
    useShallow((state) => ({ canUndo: state.canUndo, canRedo: state.canRedo }))
  );

  const undo = useCallback(() => {
    finishBaseplateParamsDrag();
    useHistoryStore.getState().undo();
  }, []);

  const redo = useCallback(() => {
    finishBaseplateParamsDrag();
    useHistoryStore.getState().redo();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTextEntryTarget(e.target)) return;
      // Lowercased: with Shift held, a browser may report the key as "z" or "Z".
      const key = e.key.toLowerCase();
      if (key === SHORTCUTS.UNDO) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === SHORTCUTS.REDO) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Leaving the page keeps an open drag as a step of its own in the
      // layout's history, which the planner's undo shares.
      finishBaseplateParamsDrag();
    };
  }, [undo, redo]);

  return { canUndo, canRedo, undo, redo };
}
