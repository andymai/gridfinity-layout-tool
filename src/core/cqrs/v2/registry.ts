/**
 * v2 Command Registry
 *
 * Lists all migrated v2 commands. Imported by `handlers/index.ts` to
 * install v2 wrapped handlers, overriding the corresponding v1 entries.
 *
 * As more domains migrate, add their commands here. Once all v1 entries
 * are gone, the v1 handler imports in `handlers/index.ts` can be removed.
 */

import type { CommandResult, CommandMeta } from '../types';
import type { DomainEvent } from '../events';
import { wrapV2Handler } from './runtime';
import { addBin } from './domain/bin/addBin';

export const v2Commands = [addBin] as const;

type V2HandlerFn = (command: {
  type: string;
  payload: unknown;
  meta: CommandMeta;
}) => CommandResult<unknown, DomainEvent>;

/**
 * Map of v2 command type → wrapped handler. Spread into the existing
 * handler registry in `handlers/index.ts` so the bus dispatches v2
 * commands through the new path while v1 commands keep working unchanged.
 */
export const v2HandlerOverrides: Record<string, V2HandlerFn> = Object.fromEntries(
  v2Commands.map((def) => [def.type, wrapV2Handler(def) as V2HandlerFn])
);
