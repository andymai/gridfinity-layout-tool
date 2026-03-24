/**
 * Undo Capture Middleware + Batch Transactions
 *
 * Snapshots layout state before command execution for undo/redo.
 * Always included in the middleware pipeline.
 *
 * Batch mode: `batch(() => { ... })` groups multiple dispatches under
 * a single undo snapshot. The middleware skips per-command snapshots
 * when a batch is active — the batch function handles the snapshot.
 */

import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore } from '@/core/store/history';
import { isOk } from '@/core/result';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { CommandResult, NextFn } from '../types';

/** When true, a batch is active — middleware skips individual snapshots */
let isBatching = false;

export function undoCaptureMiddleware(
  command: Command,
  next: NextFn<Command, DomainEvent>
): CommandResult<unknown, DomainEvent> {
  // Skip undo capture for replayed commands
  if (command.meta.source === 'replay') {
    return next(command);
  }

  // Skip if inside a batch — batch() handles the snapshot
  if (isBatching) {
    return next(command);
  }

  const layout = useLayoutStore.getState().layout;
  const snapshot = structuredClone(layout);

  const result = next(command);

  if (isOk(result)) {
    useHistoryStore.getState().push(snapshot);
    mlTracking.recordAction?.();
  }

  return result;
}

/**
 * Execute multiple mutations under a single undo snapshot.
 *
 * Captures one layout snapshot before the callback runs. All commands
 * dispatched inside the callback skip individual undo capture. If any
 * command succeeds, the snapshot is pushed to the history stack.
 *
 * Supports nesting — inner batch() calls are no-ops (the outermost
 * batch owns the snapshot).
 *
 * @returns The return value of the callback.
 *
 * @example
 * ```ts
 * batch(() => {
 *   deleteBin(id1);
 *   deleteBin(id2);
 * });
 * // One undo step reverts both deletions
 * ```
 */
export function batch<T>(fn: () => T): T {
  // Nested batch — just run, outer batch owns the snapshot
  if (isBatching) {
    return fn();
  }

  const layout = useLayoutStore.getState().layout;
  const snapshot = structuredClone(layout);

  isBatching = true;
  try {
    const result = fn();

    // Check if layout actually changed
    const currentLayout = useLayoutStore.getState().layout;
    if (currentLayout !== layout) {
      useHistoryStore.getState().push(snapshot);
      mlTracking.recordAction?.();
    }

    return result;
  } finally {
    isBatching = false;
  }
}

/**
 * Reset batch state.
 * Exported for testing only — not part of the public API.
 */
export function _resetUndoCaptureState(): void {
  isBatching = false;
}
