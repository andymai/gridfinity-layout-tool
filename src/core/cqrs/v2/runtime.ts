/**
 * v2 Runtime Bridge
 *
 * Wraps a `defineCommand({...})` definition as a v1-shape `CommandHandler`
 * so it can be installed into the existing handler registry. The bus is
 * unchanged — middleware (validation, undoCapture, analytics) runs first,
 * then the wrapper executes the definition's `handle()` and applies the
 * resulting event via `apply()` against an Immer draft of the appropriate
 * store.
 *
 * The same store-mutation pathway is used for live commands AND replay,
 * which is the core invariant of the v2 design: the event payload alone
 * (plus apply) reproduces the state change.
 */

import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { ok, err, isErr } from '@/core/result';
import type { CommandResult, CommandMeta } from '../types';
import type { DomainEvent, DomainEventType } from '../events';
import { createEventMeta } from '../handlers/shared';
import type { AggregateName, CommandDefShape, HandleCtx } from './types';

/**
 * Read a frozen snapshot of the aggregate root for `handle()` to inspect.
 */
function aggregateSnapshot<A extends AggregateName>(aggregate: A): HandleCtx<A>['aggregate'] {
  switch (aggregate) {
    case 'layout':
      return useLayoutStore.getState().layout as HandleCtx<A>['aggregate'];
    case 'library':
      return useLibraryStore.getState().library as HandleCtx<A>['aggregate'];
    case 'designer':
      // Designer aggregate not yet wired (see v2/types.ts AggregateDraft).
      throw new Error('v2: designer aggregate not yet wired');
    default: {
      const _exhaustive: never = aggregate;
      throw new Error(`v2: unknown aggregate ${_exhaustive as string}`);
    }
  }
}

/**
 * Apply `mutate` against the appropriate store's Immer draft. Mirrors the
 * existing `setLocal` pattern for the layout store (stamps `lastEditSource`
 * so dirty-tracking + autosave work as before).
 */
function applyToDraft<A extends AggregateName>(
  aggregate: A,
  mutate: (draft: HandleCtx<A>['aggregate']) => void
): void {
  switch (aggregate) {
    case 'layout':
      useLayoutStore.setState((state) => {
        mutate(state.layout as HandleCtx<A>['aggregate']);
        state.lastEditSource = 'local';
      });
      return;
    case 'library':
      useLibraryStore.setState((state) => {
        mutate(state.library as HandleCtx<A>['aggregate']);
      });
      return;
    case 'designer':
      throw new Error('v2: designer aggregate not yet wired');
    default: {
      const _exhaustive: never = aggregate;
      throw new Error(`v2: unknown aggregate ${_exhaustive as string}`);
    }
  }
}

/**
 * Convert a `defineCommand` definition into a v1-shape `CommandHandler`
 * the existing bus can dispatch. Validation middleware runs first (using
 * the schema in `validation/schemas.ts`); this wrapper trusts the payload
 * has been validated by the time it executes.
 */
export function wrapV2Handler<
  TType extends string,
  TPayload,
  TValue,
  TEventType extends string,
  TEventPayload,
  TError,
  A extends AggregateName,
>(
  def: CommandDefShape<TType, TPayload, TValue, TEventType, TEventPayload, TError, A>
): (command: {
  type: TType;
  payload: TPayload;
  meta: CommandMeta;
}) => CommandResult<TValue, DomainEvent> {
  return (command) => {
    const ctx: HandleCtx<A> = { aggregate: aggregateSnapshot(def.aggregate) };

    const handleResult = def.handle(command.payload, ctx);
    if (isErr(handleResult)) {
      // TError isn't structurally guaranteed to satisfy CommandResult's
      // error union (LayoutError | ValidationError) — we trust handlers to
      // return errors from that union by convention. Cast keeps the
      // wrapper type-erasure-free at the boundary.
      return err(handleResult.error as never);
    }

    const { value, event } = handleResult.value;
    const eventWithType = { type: def.emitted, payload: event.payload };

    applyToDraft(def.aggregate, (draft) => {
      def.apply(eventWithType, draft);
    });

    const meta = createEventMeta(command.meta, def.emitted as DomainEventType);
    const fullEvent = { ...eventWithType, meta } as DomainEvent;

    return ok({ value, events: [fullEvent] });
  };
}
