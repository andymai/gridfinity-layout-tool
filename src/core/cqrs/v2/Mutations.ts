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
import type { AggregateName, AnyCommandDef, CommandDefShape } from './types';
import type { Registry } from './createRegistry';

/**
 * Extract the value type from a command def.
 *
 * The seventh slot uses `AggregateName` (the full union) rather than `never`:
 * `'layout' extends never` is `false`, which would make the conditional
 * collapse to `never` for any concrete command def. `'layout' extends AggregateName`
 * is trivially true, so the conditional matches and `infer V` succeeds.
 */
export type ValueOf<C> =
  C extends CommandDefShape<string, unknown, infer V, string, unknown, unknown, AggregateName>
    ? V
    : never;

/** Extract the error union from a command def — the union of every `err()` return inside `handle`. */
export type ErrorOf<C> =
  C extends CommandDefShape<string, unknown, unknown, string, unknown, infer E, AggregateName>
    ? E
    : never;

/** Extract the payload type from a command def. */
export type PayloadOf<C> =
  C extends CommandDefShape<string, infer P, unknown, string, unknown, unknown, AggregateName>
    ? P
    : never;

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
