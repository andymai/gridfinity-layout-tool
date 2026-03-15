/**
 * Drawer & Layout Metadata Command Handlers
 */

import { useLayoutStore } from '@/core/store/layout';
import { ok } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import type { CommandResult } from '../types';
import type {
  UpdateDrawerCommand,
  SetNameCommand,
  SetPrintBedSizeCommand,
  SetGridUnitMmCommand,
  SetHeightUnitMmCommand,
  SetBaseplateParamsCommand,
} from '../commands';
import type { DomainEvent } from '../events';
import { createEventMeta, capturePrevious } from './shared';

export function handleUpdateDrawer(command: UpdateDrawerCommand): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const previousDrawer = { ...store.layout.drawer };
  const binsBefore = store.layout.bins.filter((b) => b.layerId === STAGING_ID).length;

  const previous = capturePrevious(previousDrawer, command.payload);

  store.updateDrawer(command.payload);

  const binsAfter = useLayoutStore
    .getState()
    .layout.bins.filter((b) => b.layerId === STAGING_ID).length;
  const binsDisplaced = Math.max(0, binsAfter - binsBefore);

  return ok({
    value: undefined,
    events: [
      {
        type: 'drawer.updated' as const,
        payload: {
          changes: command.payload,
          previous,
          binsDisplacedToStaging: binsDisplaced,
        },
        meta: createEventMeta(command.meta, 'drawer.updated'),
      },
    ],
  });
}

export function handleSetName(command: SetNameCommand): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const previousName = store.layout.name;

  store.setName(command.payload.name);

  return ok({
    value: undefined,
    events: [
      {
        type: 'layout.nameSet' as const,
        payload: { name: command.payload.name, previousName },
        meta: createEventMeta(command.meta, 'layout.nameSet'),
      },
    ],
  });
}

export function handleSetPrintBedSize(
  command: SetPrintBedSizeCommand
): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const previousSize = store.layout.printBedSize;

  store.setPrintBedSize(command.payload.size);

  return ok({
    value: undefined,
    events: [
      {
        type: 'layout.printBedSizeSet' as const,
        payload: { size: command.payload.size, previousSize },
        meta: createEventMeta(command.meta, 'layout.printBedSizeSet'),
      },
    ],
  });
}

export function handleSetGridUnitMm(
  command: SetGridUnitMmCommand
): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const previousMm = store.layout.gridUnitMm;

  store.setGridUnitMm(command.payload.mm);

  return ok({
    value: undefined,
    events: [
      {
        type: 'layout.gridUnitMmSet' as const,
        payload: { mm: command.payload.mm, previousMm },
        meta: createEventMeta(command.meta, 'layout.gridUnitMmSet'),
      },
    ],
  });
}

export function handleSetHeightUnitMm(
  command: SetHeightUnitMmCommand
): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const previousMm = store.layout.heightUnitMm;

  store.setHeightUnitMm(command.payload.mm);

  return ok({
    value: undefined,
    events: [
      {
        type: 'layout.heightUnitMmSet' as const,
        payload: { mm: command.payload.mm, previousMm },
        meta: createEventMeta(command.meta, 'layout.heightUnitMmSet'),
      },
    ],
  });
}

export function handleSetBaseplateParams(
  command: SetBaseplateParamsCommand
): CommandResult<void, DomainEvent> {
  const store = useLayoutStore.getState();
  const previousParams = store.layout.baseplateParams
    ? { ...store.layout.baseplateParams }
    : undefined;

  store.setBaseplateParams(command.payload.params);

  return ok({
    value: undefined,
    events: [
      {
        type: 'layout.baseplateParamsSet' as const,
        payload: { params: command.payload.params, previousParams },
        meta: createEventMeta(command.meta, 'layout.baseplateParamsSet'),
      },
    ],
  });
}

export const drawerHandlers = {
  'drawer.update': handleUpdateDrawer,
  'layout.setName': handleSetName,
  'layout.setPrintBedSize': handleSetPrintBedSize,
  'layout.setGridUnitMm': handleSetGridUnitMm,
  'layout.setHeightUnitMm': handleSetHeightUnitMm,
  'layout.setBaseplateParams': handleSetBaseplateParams,
} as const;
