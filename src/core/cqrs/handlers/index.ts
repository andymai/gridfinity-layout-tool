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

export { resetVersionCounters } from './shared';

type HandlerFn = (command: never) => CommandResult<unknown, DomainEvent>;

const handlerRegistry: Record<string, HandlerFn> = {
  ...binHandlers,
  ...layerHandlers,
  ...categoryHandlers,
  ...drawerHandlers,
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
