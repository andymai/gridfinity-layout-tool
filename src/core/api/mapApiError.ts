/**
 * Shared mapping from API error responses to domain ApiError types.
 *
 * This is the single source of truth for translating server error codes
 * into the client-side Result error system. Covers codes from the shared
 * ErrorCode enum (api/lib/shared.ts) and validation-specific codes
 * (api/lib/validation.ts). All API clients should use this instead of
 * rolling their own switch statements.
 */

import type { ApiError } from '@/core/result';
import {
  apiRateLimited,
  apiUnauthorized,
  apiNotFound,
  apiServerError,
  apiValidationError,
  apiContentBlocked,
  apiSizeLimit,
  apiBinLimit,
  apiExpired,
  apiInvalidExpiration,
} from '@/core/result';

/**
 * Shape of an error response from any API endpoint.
 * Mirrors the server's ApiErrorResponse in api/lib/shared.ts.
 */
export interface ApiErrorResponseBody {
  error: string;
  code: string;
  retryAfter?: number;
}

/**
 * Type guard to check if an unknown response body is an API error response.
 */
export function isApiErrorResponse(data: unknown): data is ApiErrorResponseBody {
  if (typeof data !== 'object' || data === null) return false;
  const record = data as Record<string, unknown>;
  return (
    typeof record.error === 'string' &&
    typeof record.code === 'string' &&
    (!('retryAfter' in record) || typeof record.retryAfter === 'number')
  );
}

/**
 * Map an API error response to a domain ApiError.
 *
 * Covers all codes from the server's ErrorCode enum (api/lib/shared.ts)
 * and validation-specific codes (e.g. INVALID_EXPIRATION from api/lib/validation.ts).
 * Unknown codes fall through to apiServerError() as a safe default.
 */
export function mapApiErrorResponse(response: ApiErrorResponseBody): ApiError {
  switch (response.code) {
    case 'RATE_LIMITED':
      return apiRateLimited(response.retryAfter);
    case 'SIZE_LIMIT':
      return apiSizeLimit();
    case 'BIN_LIMIT':
      return apiBinLimit();
    case 'CONTENT_BLOCKED':
      return apiContentBlocked();
    case 'NOT_FOUND':
      return apiNotFound();
    case 'UNAUTHORIZED':
      return apiUnauthorized();
    case 'VALIDATION_ERROR':
      return apiValidationError();
    case 'EXPIRED':
      return apiExpired();
    case 'INVALID_EXPIRATION':
      return apiInvalidExpiration();
    case 'INVALID_PERMISSION':
      return apiValidationError();
    case 'SERVICE_UNAVAILABLE':
    case 'SERVER_ERROR':
    case 'CONFIGURATION_ERROR':
    case 'METHOD_NOT_ALLOWED':
      return apiServerError();
    default:
      return apiServerError();
  }
}
