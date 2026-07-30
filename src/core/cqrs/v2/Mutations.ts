/**
 * Mutations<R> — auto-derived typed mutation surface from a registry.
 *
 * Maps each command in the registry to a callable keyed by the command's
 * literal `type` string. Payload, return value, and error union are all
 * inferred per command — no `as T` casts, no central interface to
 * hand-maintain alongside the registry.
 *
 *   const mutations = createMutations(registry, commandBus);
 *   mutations['bin.add']({ ... });   // Result<BinId, ValidationError>
 *
 * Type only today; runtime `createMutations()` lands when callers move
 * off the existing `MutationsContext` adapter.
 */

import type { Result } from '@/core/result';
import type { AnyCommandDef, CommandDefShape } from './types';
import type { Registry } from './createRegistry';

/**
 * Every generic slot of a command def, recovered in one match.
 *
 * All seven slots must be `infer`, never a fixed type like `unknown`. Pinning
 * the payload slot to `unknown` requires `handle: (payload: unknown, …)`, and
 * function-parameter contravariance means a concrete def — whose `handle` takes
 * a narrow payload — is not assignable to that. The conditional then fails and
 * every extractor silently yields `never`. This is the same trap `AnyCommandDef`
 * documents for the registry constraint.
 *
 * Extracting once and indexing keeps that reasoning in a single place, so a
 * future extractor cannot reintroduce it.
 */
type DefParts<C> =
  C extends CommandDefShape<
    infer TType,
    infer TPayload,
    infer TValue,
    infer TEventType,
    infer TEventPayload,
    infer TError,
    infer TAggregate
  >
    ? {
        type: TType;
        payload: TPayload;
        value: TValue;
        eventType: TEventType;
        eventPayload: TEventPayload;
        error: TError;
        aggregate: TAggregate;
      }
    : never;

/** Extract the value type from a command def. */
export type ValueOf<C> = DefParts<C>['value'];

/** Extract the error union from a command def — the union of every `err()` return inside `handle`. */
export type ErrorOf<C> = DefParts<C>['error'];

/** Extract the payload type from a command def. */
export type PayloadOf<C> = DefParts<C>['payload'];

/**
 * Mutations surface derived from a registry. One method per command,
 * keyed by the command's literal `type`.
 */
export type Mutations<R extends Registry<readonly AnyCommandDef[]>> =
  R extends Registry<infer T>
    ? {
        readonly [K in T[number] as K['type']]: (
          payload: PayloadOf<K>
        ) => Result<ValueOf<K>, ErrorOf<K>>;
      }
    : never;
