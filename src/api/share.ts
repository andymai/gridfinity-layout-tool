/**
 * API client for cloud sharing endpoints.
 *
 * All functions return Result<T, ApiError> for consistent error handling
 * that integrates with the centralized error system.
 */

import type { Layout, ShareExpiration } from '../types';
import type { Result, ApiError } from '../result';
import {
  ok,
  err,
  apiRateLimited,
  apiUnauthorized,
  apiNotFound,
  apiServerError,
  apiNetworkError,
  apiValidationError,
  apiContentBlocked,
  apiSizeLimit,
  apiBinLimit,
  apiExpired,
  apiInvalidExpiration,
} from '../result';

// API Response types
export interface ShareResponse {
  id: string;
  url: string;
  deleteToken: string;
  expiresAt: string;
}

export interface ShareMetadata {
  expiresAt: string;
  expiresInDays: number;
  createdAt: string;
  authorName?: string;
}

export interface FetchShareResponse {
  layout: Layout;
  metadata: ShareMetadata;
}

export interface ShareErrorResponse {
  error: string;
  code: 'VALIDATION_ERROR' | 'SIZE_LIMIT' | 'BIN_LIMIT' | 'RATE_LIMITED' |
        'CONTENT_BLOCKED' | 'NETWORK_ERROR' | 'NOT_FOUND' | 'EXPIRED' |
        'UNAUTHORIZED' | 'INVALID_EXPIRATION';
  retryAfter?: number;
}

/**
 * Map a ShareErrorResponse to an ApiError.
 * This bridges the server error format to the Result type system.
 */
function mapShareErrorToApiError(error: ShareErrorResponse): ApiError {
  switch (error.code) {
    case 'RATE_LIMITED':
      return apiRateLimited(error.retryAfter);
    case 'SIZE_LIMIT':
      return apiSizeLimit();
    case 'BIN_LIMIT':
      return apiBinLimit();
    case 'CONTENT_BLOCKED':
      return apiContentBlocked();
    case 'NOT_FOUND':
      return apiNotFound();
    case 'EXPIRED':
      return apiExpired();
    case 'UNAUTHORIZED':
      return apiUnauthorized();
    case 'INVALID_EXPIRATION':
      return apiInvalidExpiration();
    case 'NETWORK_ERROR':
      return apiNetworkError();
    case 'VALIDATION_ERROR':
      return apiValidationError();
    default:
      return apiServerError();
  }
}

/**
 * Create a new cloud share.
 *
 * @example
 * ```ts
 * const result = await createShare(layout, 30);
 * if (isOk(result)) {
 *   console.log('Share URL:', result.value.url);
 * } else {
 *   console.error(getUserMessage(result.error));
 * }
 * ```
 */
export async function createShare(
  layout: Layout,
  expiresInDays: ShareExpiration,
  authorName?: string
): Promise<Result<ShareResponse, ApiError>> {
  try {
    const response = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout, expiresInDays, authorName }),
    });

    const data = await response.json();

    if (!response.ok) {
      return err(mapShareErrorToApiError(data as ShareErrorResponse));
    }

    return ok(data as ShareResponse);
  } catch (error) {
    return err(apiNetworkError(error));
  }
}

/**
 * Update an existing cloud share.
 */
export async function updateShare(
  id: string,
  deleteToken: string,
  layout: Layout,
  expiresInDays: ShareExpiration
): Promise<Result<Omit<ShareResponse, 'deleteToken'>, ApiError>> {
  try {
    const response = await fetch(`/api/share/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout, expiresInDays, deleteToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return err(mapShareErrorToApiError(data as ShareErrorResponse));
    }

    return ok(data);
  } catch (error) {
    return err(apiNetworkError(error));
  }
}

/**
 * Fetch a shared layout by ID.
 */
export async function fetchShare(
  id: string
): Promise<Result<FetchShareResponse, ApiError>> {
  try {
    const response = await fetch(`/api/share/${id}`);
    const data = await response.json();

    if (!response.ok) {
      return err(mapShareErrorToApiError(data as ShareErrorResponse));
    }

    return ok(data as FetchShareResponse);
  } catch (error) {
    return err(apiNetworkError(error));
  }
}

/**
 * Delete a cloud share.
 */
export async function deleteShare(
  id: string,
  deleteToken: string
): Promise<Result<{ success: true; message: string }, ApiError>> {
  try {
    const response = await fetch(`/api/share/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Delete-Token': deleteToken,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return err(mapShareErrorToApiError(data as ShareErrorResponse));
    }

    return ok(data);
  } catch (error) {
    return err(apiNetworkError(error));
  }
}

/**
 * Report a share for inappropriate content.
 */
export async function reportShare(
  id: string,
  reason?: string
): Promise<Result<{ success: true; message: string }, ApiError>> {
  try {
    const response = await fetch(`/api/report/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    const data = await response.json();

    if (!response.ok) {
      return err(mapShareErrorToApiError(data as ShareErrorResponse));
    }

    return ok(data);
  } catch (error) {
    return err(apiNetworkError(error));
  }
}
