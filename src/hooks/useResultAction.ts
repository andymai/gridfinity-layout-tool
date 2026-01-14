import { useCallback } from 'react';
import type { Result, AppError } from '../result';
import { isOk, getUserMessage, getSeverity } from '../result';
import { useToastStore } from '../store/toast';
import type { ToastType } from '../store/toast';

interface ExecuteOptions<T> {
  /** Optional success message to display as a toast */
  successMessage?: string;
  /** Callback when operation succeeds */
  onSuccess?: (value: T) => void;
  /** Callback when operation fails */
  onError?: (error: AppError) => void;
  /** If true, suppress error toast (for silent operations) */
  silent?: boolean;
}

/**
 * Hook to execute Result-returning operations with automatic toast notifications.
 *
 * This hook provides ergonomic error handling for components and hooks that
 * need to call store operations returning Result<T, E>. It automatically:
 * - Shows error toasts with user-friendly messages from the error catalog
 * - Optionally shows success toasts
 * - Provides callbacks for success/error handling
 *
 * @example Basic usage
 * ```ts
 * const { execute } = useResultAction();
 *
 * const handleAdd = () => {
 *   const binId = execute(() => addBin({ ... }));
 *   if (binId) {
 *     setSelectedBin(binId);
 *   }
 * };
 * ```
 *
 * @example With callbacks
 * ```ts
 * const { execute } = useResultAction();
 *
 * execute(() => deleteLayer(id), {
 *   successMessage: 'Layer deleted',
 *   onSuccess: () => setActiveLayer(null),
 * });
 * ```
 *
 * @example Silent operation (no error toast)
 * ```ts
 * const { execute } = useResultAction();
 *
 * // Used in paint mode where we don't want toast spam
 * execute(() => addBin({ ... }), { silent: true });
 * ```
 */
export function useResultAction() {
  const addToast = useToastStore((state) => state.addToast);

  const execute = useCallback(
    <T, E extends AppError>(
      fn: () => Result<T, E>,
      options?: ExecuteOptions<T>
    ): T | undefined => {
      const result = fn();

      if (isOk(result)) {
        if (options?.successMessage) {
          addToast(options.successMessage, 'success');
        }
        options?.onSuccess?.(result.value);
        return result.value;
      } else {
        if (!options?.silent) {
          const message = getUserMessage(result.error);
          // Map catalog severity to toast type
          // Severity: 'info' | 'warning' | 'error' | 'critical'
          // ToastType: 'success' | 'error' | 'info'
          const severity = getSeverity(result.error.code);
          const severityToToast: Record<string, ToastType> = {
            info: 'info',
            warning: 'error',
            error: 'error',
            critical: 'error',
          };
          const toastType = severityToToast[severity] ?? 'error';
          addToast(message, toastType);
        }
        options?.onError?.(result.error);
        return undefined;
      }
    },
    [addToast]
  );

  return { execute };
}
