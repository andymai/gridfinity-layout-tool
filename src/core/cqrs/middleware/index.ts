/**
 * Middleware barrel
 */

export { undoCaptureMiddleware, batch } from './undoCapture';
/** @internal Test-only — reset the undo capture state */
export { _resetUndoCaptureState } from './undoCapture';
export { loggingMiddleware } from './logging';
export { getMiddlewareFlags } from './middlewareConfig';
export type { MiddlewareFlags, MiddlewareProfile } from './middlewareConfig';

import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { Middleware } from '../types';
import { validationMiddleware } from '../validation/validationMiddleware';
import { loggingMiddleware } from './logging';
import { undoCaptureMiddleware } from './undoCapture';

/**
 * Build the default middleware pipeline.
 *
 * Order: validation (fail-fast) -> undoCapture -> logging.
 */
export function getDefaultPipeline(): ReadonlyArray<Middleware<Command, DomainEvent>> {
  return [validationMiddleware, undoCaptureMiddleware, loggingMiddleware];
}
