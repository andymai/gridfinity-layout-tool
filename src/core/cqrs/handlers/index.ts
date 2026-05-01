/**
 * Command Handler Registry
 *
 * After PRs 5–14 (CQRS DX redesign), bin / layer / category / drawer /
 * library / layout-metadata commands route through v2 `defineCommand`
 * wrappers (registered in `v2HandlerOverrides`). Designer + restore
 * stay on v1 by design — designer.save is an event-only no-op handler
 * (no aggregate to mutate); layout.restore replaces the entire layout
 * which doesn't fit the apply-on-draft model.
 */

import type { Command, CommandType } from '../commands';
import type { CommandResult } from '../types';
import type { DomainEvent } from '../events';
import { designerHandlers } from './designerHandlers';
import { restoreHandlers } from './restoreHandlers';
import { v2HandlerOverrides } from '../v2/registry';

export { resetVersionCounters } from './shared';

type HandlerFn = (command: never) => CommandResult<unknown, DomainEvent>;

const handlerRegistry: Record<string, HandlerFn> = {
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
