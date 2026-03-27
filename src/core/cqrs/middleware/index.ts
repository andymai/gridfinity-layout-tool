/**
 * Middleware barrel
 */

export { undoCaptureMiddleware, batch } from './undoCapture';
/** @internal Test-only — reset the undo capture state */
export { _resetUndoCaptureState } from './undoCapture';
export { loggingMiddleware } from './logging';
export { analyticsMiddleware } from './analytics';
export { getMiddlewareFlags } from './middlewareConfig';
export type { MiddlewareFlags, MiddlewareProfile } from './middlewareConfig';

import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { Middleware } from '../types';
import { validationMiddleware } from '../validation/validationMiddleware';
import { loggingMiddleware } from './logging';
import { analyticsMiddleware } from './analytics';
import { undoCaptureMiddleware } from './undoCapture';

/**
 * @deprecated Use `getDefaultPipeline()` instead.
 */
export const defaultPipeline: ReadonlyArray<Middleware<Command, DomainEvent>> = [
  validationMiddleware,
  undoCaptureMiddleware,
  analyticsMiddleware,
  loggingMiddleware,
];

/**
 * Build the default middleware pipeline.
 *
 * Order: validation (fail-fast) -> undoCapture -> analytics -> logging.
 */
export function getDefaultPipeline(): ReadonlyArray<Middleware<Command, DomainEvent>> {
  return [validationMiddleware, undoCaptureMiddleware, analyticsMiddleware, loggingMiddleware];
}
