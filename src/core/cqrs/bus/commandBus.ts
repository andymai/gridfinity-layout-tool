/**
 * Command Bus — Dispatches commands through middleware to handlers.
 *
 * The command bus builds a middleware chain around the handler,
 * executes the command, and publishes any resulting domain events.
 */

import { isOk } from '@/core/result';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { CommandResult, Middleware } from '../types';
import { getHandler } from '../handlers';
import { eventBus } from './eventBus';
import { getDefaultPipeline } from '../middleware';
import type { EventBus } from './eventBus';

export interface CommandBus {
  /** Dispatch a command through the middleware pipeline */
  dispatch(command: Command): CommandResult<unknown, DomainEvent>;

  /** Add middleware to the pipeline */
  use(middleware: Middleware<Command, DomainEvent>): void;

  /** Remove all custom middleware (for testing) */
  resetMiddleware(): void;
}

export function createCommandBus(
  bus: EventBus = eventBus,
  initialMiddleware: ReadonlyArray<Middleware<Command, DomainEvent>> = getDefaultPipeline()
): CommandBus {
  const middlewares: Array<Middleware<Command, DomainEvent>> = [...initialMiddleware];

  function dispatch(command: Command): CommandResult<unknown, DomainEvent> {
    const handler = getHandler(command.type);

    // Build the middleware chain from inside out
    // The innermost function calls the handler
    let chain = (cmd: Command): CommandResult<unknown, DomainEvent> => handler(cmd);

    // Wrap from last middleware to first (so first middleware runs first)
    for (let i = middlewares.length - 1; i >= 0; i--) {
      const middleware = middlewares[i];
      const next = chain;
      chain = (cmd: Command) => middleware(cmd, next);
    }

    const result = chain(command);

    if (isOk(result) && result.value.events.length > 0) {
      bus.publishAll(result.value.events);
    }

    return result;
  }

  return {
    dispatch,
    use(middleware) {
      middlewares.push(middleware);
    },
    resetMiddleware() {
      middlewares.length = 0;
      middlewares.push(...initialMiddleware);
    },
  };
}

/** Singleton command bus for the application. */
export const commandBus = createCommandBus();
