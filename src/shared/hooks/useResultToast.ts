/**
 * Hook and utility for showing domain errors as toasts with recovery hints.
 *
 * Replaces the common pattern:
 *   addToast(getUserMessage(result.error), 'error')
 *
 * With:
 *   showErrorToast(result.error)
 *
 * This automatically:
 * - Uses getUserMessage() for the user-facing message
 * - Appends the recovery hint from the error catalog when available
 * - Maps the catalog severity to the toast type
 */

import { useCallback } from 'react';
import { useToastStore } from '@/core/store/toast';
import type { DomainError } from '@/core/result';
import { getUserMessage, getRecoveryHint, getSeverity } from '@/core/result';

/**
 * Show a domain error as a toast notification.
 *
 * Can be called from non-React contexts (store actions, callbacks).
 * Uses the error catalog to build the message and determine severity.
 */
export function showErrorToast(error: DomainError): void {
  const message = getUserMessage(error);
  const hint = getRecoveryHint(error);
  const severity = getSeverity(error.code);
  const toastType = severity === 'warning' ? 'info' : 'error';

  const fullMessage = hint ? `${message}\n${hint}` : message;

  useToastStore.getState().addToast(fullMessage, toastType);
}

/**
 * Hook that returns a function to show domain errors as toasts.
 *
 * @example
 * ```ts
 * const { showErrorToast } = useResultToast();
 *
 * const result = execute(() => addBin({ ... }));
 * if (isErr(result)) {
 *   showErrorToast(result.error);
 * }
 * ```
 */
export function useResultToast() {
  const addToast = useToastStore((state) => state.addToast);

  const showError = useCallback(
    (error: DomainError): void => {
      const message = getUserMessage(error);
      const hint = getRecoveryHint(error);
      const severity = getSeverity(error.code);
      const toastType = severity === 'warning' ? 'info' : 'error';

      const fullMessage = hint ? `${message}\n${hint}` : message;

      addToast(fullMessage, toastType);
    },
    [addToast]
  );

  return { showErrorToast: showError };
}
