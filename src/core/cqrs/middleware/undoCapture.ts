/**
 * Undo Capture Middleware
 *
 * Snapshots layout state before command execution for undo/redo.
 * NOT included in the default pipeline — undo is still handled by
 * `useUndoableAction()` which wraps `useMutations()` calls in components.
 * Exported for future use when undo ownership moves fully into CQRS.
 */

import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore } from '@/core/store/history';
import { isOk } from '@/core/result';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { CommandResult, NextFn } from '../types';

export function undoCaptureMiddleware(
  command: Command,
  next: NextFn<Command, DomainEvent>
): CommandResult<unknown, DomainEvent> {
  // Skip undo capture for replayed commands
  if (command.meta.source === 'replay') {
    return next(command);
  }

  const layout = useLayoutStore.getState().layout;
  const snapshot = structuredClone(layout);

  const result = next(command);

  // Only push to history if the command succeeded
  if (isOk(result)) {
    useHistoryStore.getState().push(snapshot);
  }

  return result;
}
