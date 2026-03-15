/**
 * Middleware barrel
 */

export { undoCaptureMiddleware } from './undoCapture';
/** @internal Test-only — reset the undo capture re-entrancy guard */
export { _resetUndoCaptureState } from './undoCapture';
export { loggingMiddleware } from './logging';
export { analyticsMiddleware } from './analytics';

import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { Middleware } from '../types';
import { useLabsStore } from '@/core/store/labs';
import { validationMiddleware } from '../validation/validationMiddleware';
import { loggingMiddleware } from './logging';
import { analyticsMiddleware } from './analytics';
import { undoCaptureMiddleware } from './undoCapture';

/**
 * @deprecated Use `getDefaultPipeline()` instead, which respects the `cqrs_undo` Labs flag.
 * This static array does not include undo capture middleware.
 */
export const defaultPipeline: ReadonlyArray<Middleware<Command, DomainEvent>> = [
  validationMiddleware,
  analyticsMiddleware,
  loggingMiddleware,
];

/**
 * Build the default middleware pipeline, respecting Labs flags.
 *
 * When the `cqrs_undo` flag is enabled, undo capture middleware is inserted
 * after validation so that layout snapshots are taken before handler execution.
 *
 * Order: validation (fail-fast) -> [undoCapture?] -> analytics -> logging.
 */
export function getDefaultPipeline(): ReadonlyArray<Middleware<Command, DomainEvent>> {
  const isCqrsUndoEnabled = useLabsStore.getState().isFeatureEnabled('cqrs_undo');

  if (isCqrsUndoEnabled) {
    return [validationMiddleware, undoCaptureMiddleware, analyticsMiddleware, loggingMiddleware];
  }

  return [validationMiddleware, analyticsMiddleware, loggingMiddleware];
}
