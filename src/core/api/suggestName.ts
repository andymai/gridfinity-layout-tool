/**
 * API client for LLM-powered name suggestions.
 *
 * Returns Result<T, ApiError> for consistent error handling.
 */

import type { Result, ApiError } from '@/core/result';
import { ok, err, apiServerError, apiNetworkError, apiTimeout } from '@/core/result';
import { isApiErrorResponse, mapApiErrorResponse } from './mapApiError';

// Re-export shared types for consumers
export type {
  SuggestNameRequest,
  SuggestNameResponse,
  LLMSuggestion,
  SuggestNameErrorResponse,
} from '@/features/name-suggestions/api-types';

import type {
  SuggestNameResponse,
  SuggestNameRequest,
} from '@/features/name-suggestions/api-types';

/**
 * Type guard for success responses.
 */
function isSuggestNameResponse(data: unknown): data is SuggestNameResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return 'suggestions' in obj && Array.isArray(obj.suggestions) && typeof obj.cached === 'boolean';
}

/**
 * Request LLM-generated name suggestions from the server.
 *
 * @param request - Labels, drawer size, locale, and optional purpose
 * @param options - Request options
 * @returns Result with suggestions or error
 *
 * @example
 * ```ts
 * const result = await fetchNameSuggestions({
 *   labels: ['screwdriver', 'pliers', 'wrench'],
 *   drawerSize: { w: 4, d: 2, h: 6 },
 *   locale: 'de',
 *   purpose: 'Tools',
 * });
 * if (isOk(result)) {
 *   console.log('Suggestions:', result.value.suggestions);
 * }
 * ```
 */
export async function fetchNameSuggestions(
  request: SuggestNameRequest,
  options?: { timeout?: number; signal?: AbortSignal }
): Promise<Result<SuggestNameResponse, ApiError>> {
  const { timeout = 5000, signal } = options ?? {};

  // Create an AbortController for timeout if none provided
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

  // Combine external signal with timeout signal
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch('/api/suggest-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);

    const data: unknown = await response.json();

    if (!response.ok) {
      if (isApiErrorResponse(data)) {
        return err(mapApiErrorResponse(data));
      }
      return err(apiServerError());
    }

    if (isSuggestNameResponse(data)) {
      return ok(data);
    }
    return err(apiServerError());
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort (timeout or manual cancellation)
    if (error instanceof Error && error.name === 'AbortError') {
      return err(apiTimeout());
    }

    return err(apiNetworkError(error));
  }
}
