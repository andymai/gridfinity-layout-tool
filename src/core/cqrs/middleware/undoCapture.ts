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
import { useHistoryStore, captureSelectionSnapshot } from '@/core/store/history';
import { isOk } from '@/core/result';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { CommandResult, NextFn } from '../types';
import { getMiddlewareFlags } from './middlewareConfig';

/** When true, a batch is active — middleware skips individual snapshots */
let isBatching = false;

/** Tracks the first command type dispatched during a batch */
let batchCommandType: string | null = null;

export function undoCaptureMiddleware(
  command: Command,
  next: NextFn<Command, DomainEvent>
): CommandResult<unknown, DomainEvent> {
  // Skip undo capture for commands that don't need it (library, designer, UI, restore)
  const flags = getMiddlewareFlags(command.type);
  if (!flags.undo) {
    return next(command);
  }

  // Skip undo capture for replayed, cascaded, and collab commands.
  //
  // `collab` was added here because `CommandSource` already reserves it for
  // remote Liveblocks mutations. Today remote mutations bypass the command
  // bus entirely (useCollabSync applies them via useLayoutStore.importLayout),
  // so this is defense-in-depth for the day collab commands flow through
  // the pipeline — without the skip they would pick up their own undo
  // entry, and a local undo would revert a remote peer's edit.
  //
  // NOTE: if a collab command is dispatched *during* a local `batch()`, the
  // skip here only prevents a per-command entry. The batch itself still
  // captures a pre-batch snapshot, so the undo-the-batch path would ALSO
  // revert any mutations that landed during the batch, including a collab
  // one. Full batch isolation of remote commands needs a separate change
  // (e.g. re-snapshot mid-batch on remote mutation); the safe interim
  // behavior is that collab mutations bypass this path entirely.
  if (
    command.meta.source === 'replay' ||
    command.meta.source === 'cascade' ||
    command.meta.source === 'collab'
  ) {
    return next(command);
  }

  // Skip if inside a batch — batch() handles the snapshot
  if (isBatching) {
    // Track the first command type for the batch's undo description
    if (batchCommandType === null) {
      batchCommandType = command.type;
    }
    return next(command);
  }

  // Clone BEFORE next() — Immer produces a new state object on mutation,
  // so the pre-mutation reference stays immutable, but we need a deep copy
  // for the undo stack (the snapshot must survive future mutations).
  // Selection is captured at the same moment so undo restores the user's
  // activeLayerId/activeCategoryId/focus rather than silently resetting to
  // `layers[0]` via post-hoc pruning.
  const layout = useLayoutStore.getState().layout;
  const snapshot = structuredClone(layout);
  const selectionSnapshot = captureSelectionSnapshot();

  const result = next(command);

  if (isOk(result)) {
    useHistoryStore.getState().push(snapshot, command.type, selectionSnapshot);
    mlTracking.recordAction();
  }

  return result;
}

/**
 * Execute multiple mutations under a single undo snapshot.
 *
 * Captures one layout snapshot before the callback runs. All commands
 * dispatched inside the callback skip individual undo capture. If the
 * layout changes during the batch, the snapshot is pushed to the
 * history stack.
 *
 * Only accepts synchronous callbacks — async callbacks would escape the
 * batch scope when `isBatching` is cleared in the `finally` block.
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
  const selectionSnapshot = captureSelectionSnapshot();

  isBatching = true;
  batchCommandType = null;
  try {
    const result = fn();

    // Check if layout actually changed (Immer produces new reference on mutation)
    const currentLayout = useLayoutStore.getState().layout;
    if (currentLayout !== layout) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- batchCommandType is mutated by the inner middleware via fn(); TS's flow analysis can't see across that boundary so it narrows to null here
      useHistoryStore.getState().push(snapshot, batchCommandType ?? 'unknown', selectionSnapshot);
      mlTracking.recordAction();
    }

    return result;
  } catch (e: unknown) {
    // Push undo snapshot even on error so partial mutations can be reverted
    const currentLayout = useLayoutStore.getState().layout;
    if (currentLayout !== layout) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- batchCommandType is mutated by the inner middleware via fn(); TS's flow analysis can't see across that boundary so it narrows to null here
      useHistoryStore.getState().push(snapshot, batchCommandType ?? 'unknown', selectionSnapshot);
      mlTracking.recordAction();
    }
    throw e;
  } finally {
    isBatching = false;
    batchCommandType = null;
  }
}

/**
 * Reset batch state.
 * Exported for testing only — not part of the public API.
 */
export function _resetUndoCaptureState(): void {
  isBatching = false;
  batchCommandType = null;
}
