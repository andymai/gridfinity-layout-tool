/**
 * Command Handler Registry
 */

import type { Command, CommandType } from '../commands';
import type { CommandResult } from '../types';
import type { DomainEvent } from '../events';
import { binHandlers } from './binHandlers';
import { layerHandlers } from './layerHandlers';
import { categoryHandlers } from './categoryHandlers';
import { drawerHandlers } from './drawerHandlers';
import { libraryHandlers } from './libraryHandlers';
import { designerHandlers } from './designerHandlers';
import { restoreHandlers } from './restoreHandlers';
import { v2HandlerOverrides } from '../v2/registry';

export { resetVersionCounters } from './shared';

type HandlerFn = (command: never) => CommandResult<unknown, DomainEvent>;

// v2 overrides spread LAST: migrated commands route through their
// defineCommand wrappers; the rest keep the legacy handler path.
const handlerRegistry: Record<string, HandlerFn> = {
  ...binHandlers,
  ...layerHandlers,
  ...categoryHandlers,
  ...drawerHandlers,
  ...libraryHandlers,
  ...designerHandlers,
  ...restoreHandlers,
  ...(v2HandlerOverrides as Record<string, HandlerFn>),
};

export function getHandler(
  commandType: CommandType
): (command: Command) => CommandResult<unknown, DomainEvent> {
  const handler = handlerRegistry[commandType];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive guard against unregistered command types
  if (!handler) {
    throw new Error(`No handler registered for command type: ${commandType}`);
  }
  return handler as (command: Command) => CommandResult<unknown, DomainEvent>;
}

export function hasHandler(commandType: string): commandType is CommandType {
  return commandType in handlerRegistry;
}
