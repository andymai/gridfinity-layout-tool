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
// UI handlers removed in PR 12 (telemetry exit) — ui.* commands are now
// direct trackEvent() calls instead of bus dispatches.
import { v2HandlerOverrides } from '../v2/registry';

export { resetVersionCounters } from './shared';

type HandlerFn = (command: never) => CommandResult<unknown, DomainEvent>;

// v2 overrides spread LAST so migrated commands route through defineCommand
// wrappers instead of the v1 handler. Other commands keep the v1 path until
// their domain migrates.
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
