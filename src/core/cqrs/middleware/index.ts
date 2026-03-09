/**
 * Middleware barrel
 */

export { undoCaptureMiddleware } from './undoCapture';
export { loggingMiddleware } from './logging';
export { analyticsMiddleware } from './analytics';

import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { Middleware } from '../types';
import { undoCaptureMiddleware } from './undoCapture';
import { loggingMiddleware } from './logging';
import { analyticsMiddleware } from './analytics';

/**
 * Default middleware pipeline.
 * Order matters: undo captures state BEFORE the handler runs,
 * analytics and logging run AFTER.
 */
export const defaultPipeline: ReadonlyArray<Middleware<Command, DomainEvent>> = [
  undoCaptureMiddleware,
  analyticsMiddleware,
  loggingMiddleware,
];
