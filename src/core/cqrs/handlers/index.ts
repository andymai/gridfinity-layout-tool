/**
 * Command Handler Registry
 *
 * Maps command types to their handler functions.
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

const handlerRegistry = new Map<string, HandlerFn>(
  Object.entries({
    ...binHandlers,
    ...layerHandlers,
    ...categoryHandlers,
    ...drawerHandlers,
  } as Record<string, HandlerFn>)
);

/**
 * Get the handler for a command type.
 * Throws if no handler is registered (programming error, not runtime).
 */
export function getHandler(
  commandType: CommandType
): (command: Command) => CommandResult<unknown, DomainEvent> {
  const handler = handlerRegistry.get(commandType);
  if (!handler) {
    throw new Error(`No handler registered for command type: ${commandType}`);
  }
  return handler as (command: Command) => CommandResult<unknown, DomainEvent>;
}

/** Check if a handler exists for a command type */
export function hasHandler(commandType: string): commandType is CommandType {
  return handlerRegistry.has(commandType);
}
