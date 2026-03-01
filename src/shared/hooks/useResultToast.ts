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
import type { ToastType } from '@/core/store/toast';

/** Map catalog severity to toast type. */
function severityToToastType(severity: 'error' | 'warning' | 'info'): ToastType {
  if (severity === 'error') return 'error';
  return 'info';
}

/** Build a toast message and type from a domain error using the error catalog. */
function buildErrorToast(error: DomainError): { message: string; type: ToastType } {
  const message = getUserMessage(error);
  const hint = getRecoveryHint(error);
  const severity = getSeverity(error.code);

  return {
    message: hint ? `${message}\n${hint}` : message,
    type: severityToToastType(severity),
  };
}

/**
 * Show a domain error as a toast notification.
 *
 * Can be called from non-React contexts (store actions, callbacks).
 * Uses the error catalog to build the message and determine severity.
 */
export function showErrorToast(error: DomainError): void {
  const { message, type } = buildErrorToast(error);
  useToastStore.getState().addToast(message, type);
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
      const { message, type } = buildErrorToast(error);
      addToast(message, type);
    },
    [addToast]
  );

  return { showErrorToast: showError };
}
