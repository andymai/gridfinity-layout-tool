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
import { updateBin } from './domain/bin/updateBin';
import { deleteBin } from './domain/bin/deleteBin';
import { deleteBins } from './domain/bin/deleteBins';
import { moveBinToStaging } from './domain/bin/moveBinToStaging';
import { clearLayer } from './domain/bin/clearLayer';

type V2HandlerFn = (command: {
  type: string;
  payload: unknown;
  meta: CommandMeta;
}) => CommandResult<unknown, DomainEvent>;

/**
 * Map of v2 command type → wrapped handler. Spread into the existing
 * handler registry in `handlers/index.ts` so the bus dispatches v2
 * commands through the new path while v1 commands keep working unchanged.
 *
 * Built as a literal object (not from a `v2Commands` array) so each
 * `wrapV2Handler` call receives a concrete `CommandDefShape<...>` rather
 * than a heterogeneous union — TypeScript can't infer the wrapper's
 * generics when given a union of different shapes.
 */
export const v2HandlerOverrides: Record<string, V2HandlerFn> = {
  [addBin.type]: wrapV2Handler(addBin) as V2HandlerFn,
  [updateBin.type]: wrapV2Handler(updateBin) as V2HandlerFn,
  [deleteBin.type]: wrapV2Handler(deleteBin) as V2HandlerFn,
  [deleteBins.type]: wrapV2Handler(deleteBins) as V2HandlerFn,
  [moveBinToStaging.type]: wrapV2Handler(moveBinToStaging) as V2HandlerFn,
  [clearLayer.type]: wrapV2Handler(clearLayer) as V2HandlerFn,
};

/** All registered v2 commands, exposed for tests + future tooling. */
export const v2Commands = [
  addBin,
  updateBin,
  deleteBin,
  deleteBins,
  moveBinToStaging,
  clearLayer,
] as const;
