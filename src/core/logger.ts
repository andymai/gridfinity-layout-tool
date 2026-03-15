/**
 * Structured Logger — Client-side logging with consistent format.
 *
 * Uses console.warn/console.debug under the hood. All log calls include
 * a `[tag]` prefix and optional structured context for filtering.
 *
 * This is the client-side counterpart to `api/lib/logger.ts`.
 */

type LogContext = Record<string, unknown>;

function formatMessage(tag: string, message: string): string {
  return `[${tag}] ${message}`;
}

interface Logger {
  warn: (message: string, context?: LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
}

/**
 * Create a tagged logger instance.
 *
 * @example
 * ```ts
 * const logger = createLogger('EventStore');
 * logger.warn('Failed to persist event', { eventType: 'bin.added', attempt: 3 });
 * // => [EventStore] Failed to persist event { eventType: 'bin.added', attempt: 3 }
 * ```
 */
export function createLogger(tag: string): Logger {
  return {
    warn(message: string, context?: LogContext): void {
      if (context) {
        // eslint-disable-next-line no-console -- Structured logger internals
        console.warn(formatMessage(tag, message), context);
      } else {
        // eslint-disable-next-line no-console -- Structured logger internals
        console.warn(formatMessage(tag, message));
      }
    },
    debug(message: string, context?: LogContext): void {
      if (context) {
        // eslint-disable-next-line no-console -- Structured logger internals
        console.debug(formatMessage(tag, message), context);
      } else {
        // eslint-disable-next-line no-console -- Structured logger internals
        console.debug(formatMessage(tag, message));
      }
    },
  };
}

/** Default application logger */
export const logger = createLogger('App');
