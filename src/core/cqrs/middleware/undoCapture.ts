/**
 * Undo Capture Middleware
 *
 * Snapshots layout state before command execution for undo/redo.
 * Included in the pipeline when the `cqrs_undo` Labs flag is enabled.
 *
 * A module-scoped re-entrancy guard prevents double undo entries during
 * the transition period when both `useUndoableAction()` and this middleware
 * may be active simultaneously.
 */

import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore } from '@/core/store/history';
import { isOk } from '@/core/result';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { CommandResult, NextFn } from '../types';

/** Re-entrancy guard — prevents double-push when useUndoableAction() wraps a CQRS-routed mutation */
let isCapturing = false;

export function undoCaptureMiddleware(
  command: Command,
  next: NextFn<Command, DomainEvent>
): CommandResult<unknown, DomainEvent> {
  // Skip undo capture for replayed commands
  if (command.meta.source === 'replay') {
    return next(command);
  }

  // Skip if already capturing (re-entrant call)
  if (isCapturing) {
    return next(command);
  }

  isCapturing = true;
  try {
    const layout = useLayoutStore.getState().layout;
    const snapshot = structuredClone(layout);

    const result = next(command);

    // Only push to history if the command succeeded
    if (isOk(result)) {
      useHistoryStore.getState().push(snapshot);
    }

    return result;
  } finally {
    isCapturing = false;
  }
}

/**
 * Reset the re-entrancy guard.
 * Exported for testing only — not part of the public API.
 */
export function _resetUndoCaptureState(): void {
  isCapturing = false;
}
