/**
 * Logging Middleware
 *
 * Dev-mode logging of commands and produced events.
 * Uses console.debug (allowed, unlike console.log).
 */

import { isOk } from '@/core/result';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { CommandResult, NextFn } from '../types';

export function loggingMiddleware(
  command: Command,
  next: NextFn<Command, DomainEvent>
): CommandResult<unknown, DomainEvent> {
  if (!import.meta.env.DEV) {
    return next(command);
  }

  const start = performance.now();
  const result = next(command);
  const duration = performance.now() - start;

  if (isOk(result)) {
    const eventTypes = result.value.events.map((e) => e.type);
    // eslint-disable-next-line no-console -- Dev-only debug logging for CQRS pipeline
    console.debug(
      `[CQRS] ${command.type} → ${eventTypes.length} event(s) [${duration.toFixed(1)}ms]`,
      { command: command.payload, events: eventTypes }
    );
  } else {
    // eslint-disable-next-line no-console -- Dev-only debug logging for CQRS pipeline
    console.debug(`[CQRS] ${command.type} FAILED [${duration.toFixed(1)}ms]`, {
      error: result.error,
    });
  }

  return result;
}
