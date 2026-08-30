import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import type { SpaceMouseCommand } from './types';

/**
 * Handle the app-global SpaceMouse commands (undo/redo). Camera commands are
 * handled per-canvas by the controller; this only runs for global ones.
 */
export function runGlobalCommand(command: SpaceMouseCommand): void {
  const history = useHistoryStore.getState();
  if (command === 'undo') {
    if (history.canUndo) history.undo();
  } else if (command === 'redo') {
    if (history.canRedo) history.redo();
  }
}
