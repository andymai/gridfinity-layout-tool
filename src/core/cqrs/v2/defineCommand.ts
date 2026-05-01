/**
 * defineCommand — typed identity factory for v2 commands.
 *
 * Captures all generic parameters from the literal object passed in.
 * No runtime transformation; the value returned is the same value
 * passed in, with its types fully narrowed.
 *
 * Example:
 *   const addBin = defineCommand({
 *     type: 'bin.add',
 *     aggregate: 'layout',
 *     payload: z.object({ ... }),
 *     emitted: 'bin.added',
 *     handle: (payload, ctx) => ok({ value: ..., event: { payload: ... } }),
 *     apply: (event, draft) => { draft.bins.push(event.payload.bin); },
 *     ...
 *   });
 */

import type { z } from 'zod';
import type { AggregateName, CommandDefShape } from './types';

export function defineCommand<
  TType extends string,
  TPayload,
  TValue,
  TEventType extends string,
  TEventPayload,
  TError,
  A extends AggregateName,
>(
  def: CommandDefShape<TType, TPayload, TValue, TEventType, TEventPayload, TError, A> & {
    readonly payload: z.ZodType<TPayload>;
  }
): CommandDefShape<TType, TPayload, TValue, TEventType, TEventPayload, TError, A> {
  return def;
}
