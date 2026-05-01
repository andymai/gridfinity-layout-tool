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
import { duplicateBin } from './domain/bin/duplicateBin';
import { moveBinToStaging } from './domain/bin/moveBinToStaging';
import { moveBinFromStaging } from './domain/bin/moveBinFromStaging';
import { fillLayer } from './domain/bin/fillLayer';
import { fillGaps } from './domain/bin/fillGaps';
import { clearLayer } from './domain/bin/clearLayer';
import { addLayer } from './domain/layer/addLayer';
import { updateLayer } from './domain/layer/updateLayer';
import { deleteLayer } from './domain/layer/deleteLayer';
import { reorderLayers } from './domain/layer/reorderLayers';
import { addCategory } from './domain/category/addCategory';
import { updateCategory } from './domain/category/updateCategory';
import { deleteCategory } from './domain/category/deleteCategory';
import { updateDrawer } from './domain/drawer/updateDrawer';
import { setName } from './domain/layout/setName';
import { setPrintBedSize } from './domain/layout/setPrintBedSize';
import { setGridUnitMm } from './domain/layout/setGridUnitMm';
import { setHeightUnitMm } from './domain/layout/setHeightUnitMm';
import { setBaseplateParams } from './domain/layout/setBaseplateParams';

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
  [duplicateBin.type]: wrapV2Handler(duplicateBin) as V2HandlerFn,
  [moveBinToStaging.type]: wrapV2Handler(moveBinToStaging) as V2HandlerFn,
  [moveBinFromStaging.type]: wrapV2Handler(moveBinFromStaging) as V2HandlerFn,
  [fillLayer.type]: wrapV2Handler(fillLayer) as V2HandlerFn,
  [fillGaps.type]: wrapV2Handler(fillGaps) as V2HandlerFn,
  [clearLayer.type]: wrapV2Handler(clearLayer) as V2HandlerFn,
  [addLayer.type]: wrapV2Handler(addLayer) as V2HandlerFn,
  [updateLayer.type]: wrapV2Handler(updateLayer) as V2HandlerFn,
  [deleteLayer.type]: wrapV2Handler(deleteLayer) as V2HandlerFn,
  [reorderLayers.type]: wrapV2Handler(reorderLayers) as V2HandlerFn,
  [addCategory.type]: wrapV2Handler(addCategory) as V2HandlerFn,
  [updateCategory.type]: wrapV2Handler(updateCategory) as V2HandlerFn,
  [deleteCategory.type]: wrapV2Handler(deleteCategory) as V2HandlerFn,
  [updateDrawer.type]: wrapV2Handler(updateDrawer) as V2HandlerFn,
  [setName.type]: wrapV2Handler(setName) as V2HandlerFn,
  [setPrintBedSize.type]: wrapV2Handler(setPrintBedSize) as V2HandlerFn,
  [setGridUnitMm.type]: wrapV2Handler(setGridUnitMm) as V2HandlerFn,
  [setHeightUnitMm.type]: wrapV2Handler(setHeightUnitMm) as V2HandlerFn,
  [setBaseplateParams.type]: wrapV2Handler(setBaseplateParams) as V2HandlerFn,
};

/** All registered v2 commands, exposed for tests + future tooling. */
export const v2Commands = [
  addBin,
  updateBin,
  deleteBin,
  deleteBins,
  duplicateBin,
  moveBinToStaging,
  moveBinFromStaging,
  fillLayer,
  fillGaps,
  clearLayer,
  addLayer,
  updateLayer,
  deleteLayer,
  reorderLayers,
  addCategory,
  updateCategory,
  deleteCategory,
  updateDrawer,
  setName,
  setPrintBedSize,
  setGridUnitMm,
  setHeightUnitMm,
  setBaseplateParams,
] as const;
