/**
 * Middleware barrel
 */

export { undoCaptureMiddleware } from './undoCapture';
export { loggingMiddleware } from './logging';
export { analyticsMiddleware } from './analytics';

import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { Middleware } from '../types';
import { loggingMiddleware } from './logging';
import { analyticsMiddleware } from './analytics';

/**
 * Default middleware pipeline.
 *
 * Undo is NOT included here — it's handled by useUndoableAction() which
 * wraps useMutations() calls in components. Including undoCaptureMiddleware
 * here would cause double undo entries. The middleware is exported separately
 * for future use when undo ownership moves fully into CQRS.
 */
export const defaultPipeline: ReadonlyArray<Middleware<Command, DomainEvent>> = [
  analyticsMiddleware,
  loggingMiddleware,
];
