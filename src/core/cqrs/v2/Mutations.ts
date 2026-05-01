/**
 * Mutations<R> — auto-derived typed mutation surface from a registry.
 *
 * Maps each command in the registry to a callable keyed by the command's
 * literal `type` string. Payload, return value, and error union are all
 * inferred per command — no `as T` casts, no central interface that
 * must be hand-maintained alongside the registry.
 *
 * Usage (target shape, no runtime in this PR):
 *   const mutations = createMutations(registry, commandBus);
 *   mutations['bin.add']({ ... });   // Result<BinId, ValidationError>
 *
 * PR 2 ships the type only — runtime `createMutations()` lands when the
 * first domain (bin/) migrates and needs a real dispatcher.
 */

import type { Result } from '@/core/result';
import type { AnyCommandDef, CommandDefShape } from './types';
import type { Registry } from './createRegistry';

/** Extract the value type from a command def. */
export type ValueOf<C> =
  C extends CommandDefShape<string, unknown, infer V, string, unknown, unknown, never> ? V : never;

/** Extract the error union from a command def — the union of every `err()` return inside `handle`. */
export type ErrorOf<C> =
  C extends CommandDefShape<string, unknown, unknown, string, unknown, infer E, never> ? E : never;

/** Extract the payload type from a command def. */
export type PayloadOf<C> =
  C extends CommandDefShape<string, infer P, unknown, string, unknown, unknown, never> ? P : never;

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
