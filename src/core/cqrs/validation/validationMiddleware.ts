/**
 * Command Validation Middleware
 *
 * First middleware in the CQRS pipeline. Validates command payloads
 * against Zod schemas for fail-fast behavior before reaching handlers.
 *
 * - Returns a LayoutError (LAYOUT_INVALID_OPERATION) on invalid payloads
 * - Passes through if no schema is registered (forward-compatible)
 * - Does NOT validate business rules (collisions, limits) — handlers do that
 */

import * as z from 'zod';
import { err } from '@/core/result';
import { layoutInvalidOperation } from '@/core/result/constructors';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { CommandResult, NextFn } from '../types';
import { getCommandSchema } from './schemas';

/**
 * Format Zod validation issues into a human-readable error message.
 */
function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}

/**
 * Validation middleware — validates command payloads against registered Zod schemas.
 *
 * Must be first in the pipeline so invalid payloads never reach handlers.
 * Unregistered command types pass through without validation (forward-compatible).
 */
export function validationMiddleware(
  command: Command,
  next: NextFn<Command, DomainEvent>
): CommandResult<unknown, DomainEvent> {
  const schema = getCommandSchema(command.type);

  // No schema registered — pass through (forward-compatible)
  if (!schema) {
    return next(command);
  }

  const result = z.safeParse(schema, command.payload);

  if (!result.success) {
    const details = formatZodError(result.error);
    return err(layoutInvalidOperation(command.type, `Invalid payload: ${details}`));
  }

  return next(command);
}
