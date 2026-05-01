/**
 * CQRS v2 Foundations — Types
 *
 * Type-only foundations for the redesigned `defineCommand({...})` shape.
 * No runtime here — the goal is to validate that a single literal-object
 * command definition can drive end-to-end type inference for payload,
 * value, error union, event payload, and the auto-derived `Mutations`
 * surface, without inference collapsing or compile-time regressing.
 *
 * v1 (the existing surface under cqrs/commands, cqrs/handlers, etc.)
 * remains the source of truth until per-domain migrations land.
 */

import type { z } from 'zod';
import type { Draft } from 'immer';
import type { Result } from '@/core/result';
import type { Layout, LayoutLibrary } from '@/core/types';

/**
 * Aggregate roots that commands can target. The aggregate selects which
 * store's draft `apply()` receives.
 */
export type AggregateName = 'layout' | 'library' | 'designer';

/**
 * Read-only snapshot shape per aggregate.
 *
 * Designer is `unknown` because no command currently targets that
 * aggregate; revise the shape if/when one does.
 */
export interface AggregateRoot {
  readonly layout: Layout;
  readonly library: LayoutLibrary;
  readonly designer: unknown;
}

/**
 * Mutable Immer draft shape per aggregate. `apply()` receives the draft
 * for its declared aggregate and writes through it directly. Wrapped in
 * Immer's `Draft<T>` so the deep-readonly bits of the source types
 * (Layout's branded `Mm`/`GridUnits`, frozen arrays, etc.) become
 * writable for the duration of `apply()`.
 *
 * Designer is `unknown` until that migration lands.
 */
export interface AggregateDraft {
  layout: Draft<Layout>;
  library: Draft<LayoutLibrary>;
  designer: unknown;
}

/**
 * Context passed to `handle()`. Read-only by construction — handlers
 * cannot mutate state directly. Planning logic (placement search,
 * ID generation, validation against current state) lives here.
 *
 * Future PRs extend this with `ids` (generators) and `refs` (read-only
 * snapshots of other aggregates for cross-aggregate queries).
 */
export interface HandleCtx<A extends AggregateName> {
  readonly aggregate: AggregateRoot[A];
}

/**
 * Successful handle return. The event payload alone (plus apply) must
 * deterministically reproduce the mutation — this is the core invariant
 * of the v2 design.
 */
export interface HandleSuccess<TValue, TEventPayload> {
  readonly value: TValue;
  readonly event: { readonly payload: TEventPayload };
}

/**
 * Per-command middleware flags. Replaces the central middlewareConfig
 * profile registry — each command declares its own middleware policy
 * inline.
 */
export interface MiddlewareFlags {
  readonly undoCapture?: boolean;
  readonly validate?: boolean;
  readonly analytics?: boolean | { readonly eventName?: string };
}

/**
 * The shape of a single command definition. All generic parameters are
 * inferred from the literal passed to `defineCommand({...})`.
 */
export interface CommandDefShape<
  TType extends string,
  TPayload,
  TValue,
  TEventType extends string,
  TEventPayload,
  TError,
  A extends AggregateName,
> {
  readonly type: TType;
  readonly aggregate: A;
  readonly aggregateId: (payload: TPayload, ctx: HandleCtx<A>) => string;
  readonly payload: z.ZodType<TPayload>;
  readonly emitted: TEventType;
  readonly schemaVersion: number;
  readonly descriptionKey: string;
  readonly middleware?: MiddlewareFlags;
  readonly handle: (
    payload: TPayload,
    ctx: HandleCtx<A>
  ) => Result<HandleSuccess<TValue, TEventPayload>, TError>;
  readonly apply: (
    event: { readonly type: TEventType; readonly payload: TEventPayload },
    draft: AggregateDraft[A]
  ) => void;
}

/**
 * Minimal structural shape required for a value to act as a command def
 * in a heterogeneous collection (e.g. the registry array).
 *
 * We intentionally do NOT use `CommandDefShape<string, unknown, ...>` as
 * the constraint: function-arg contravariance would block concrete defs
 * (whose `handle` takes a narrower payload) from being assignable. The
 * static parts (`type`, `aggregate`, `emitted`) are enough to drive
 * registry assembly and `Mutations<R>` derivation; the function fields
 * are accessed via the preserved literal type, not via this constraint.
 */
export interface AnyCommandDef {
  readonly type: string;
  readonly aggregate: AggregateName;
  readonly emitted: string;
  readonly schemaVersion: number;
  readonly descriptionKey: string;
}
