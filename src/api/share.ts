/**
 * API client for cloud sharing endpoints.
 *
 * This module provides two APIs:
 * - Legacy API: Functions returning ShareResult<T> with success/error pattern
 * - Result API: Functions with *Result suffix returning Result<T, ApiError>
 *
 * The Result API is preferred for new code as it integrates with the
 * centralized error handling system.
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

export type ShareResult<T> =
  | { success: true; data: T }
  | { success: false; error: ShareErrorResponse };

/**
 * Create a new cloud share.
 */
export async function createShare(
  layout: Layout,
  expiresInDays: ShareExpiration,
  authorName?: string
): Promise<ShareResult<ShareResponse>> {
  try {
    const response = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout, expiresInDays, authorName }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as ShareErrorResponse };
    }

    return { success: true, data: data as ShareResponse };
  } catch (error) {
    console.error('Create share error:', error);
    return {
      success: false,
      error: {
        error: 'Network error. Check your connection.',
        code: 'NETWORK_ERROR',
      },
    };
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
): Promise<ShareResult<Omit<ShareResponse, 'deleteToken'>>> {
  try {
    const response = await fetch(`/api/share/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout, expiresInDays, deleteToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as ShareErrorResponse };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Update share error:', error);
    return {
      success: false,
      error: {
        error: 'Network error. Check your connection.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

/**
 * Fetch a shared layout by ID.
 */
export async function fetchShare(id: string): Promise<ShareResult<FetchShareResponse>> {
  try {
    const response = await fetch(`/api/share/${id}`);
    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as ShareErrorResponse };
    }

    return { success: true, data: data as FetchShareResponse };
  } catch (error) {
    console.error('Fetch share error:', error);
    return {
      success: false,
      error: {
        error: 'Network error. Check your connection.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

/**
 * Delete a cloud share.
 */
export async function deleteShare(
  id: string,
  deleteToken: string
): Promise<ShareResult<{ success: true; message: string }>> {
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
      return { success: false, error: data as ShareErrorResponse };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Delete share error:', error);
    return {
      success: false,
      error: {
        error: 'Network error. Check your connection.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

/**
 * Report a share for inappropriate content.
 */
export async function reportShare(
  id: string,
  reason?: string
): Promise<ShareResult<{ success: true; message: string }>> {
  try {
    const response = await fetch(`/api/report/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as ShareErrorResponse };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Report share error:', error);
    return {
      success: false,
      error: {
        error: 'Network error. Check your connection.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

/**
 * Get user-friendly error message from error code.
 */
export function getErrorMessage(error: ShareErrorResponse): string {
  switch (error.code) {
    case 'RATE_LIMITED':
      if (error.retryAfter) {
        const minutes = Math.ceil(error.retryAfter / 60);
        return `Too many requests. Try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
      }
      return 'Too many requests. Try again later.';
    case 'SIZE_LIMIT':
      return 'Layout is too large (max 500KB). Try removing some bins.';
    case 'BIN_LIMIT':
      return 'Too many bins (max 2500). Remove some bins before sharing.';
    case 'CONTENT_BLOCKED':
      return 'Content blocked. Please check bin labels and notes for inappropriate content.';
    case 'NOT_FOUND':
    case 'EXPIRED':
      return 'Share not found or has expired.';
    case 'UNAUTHORIZED':
      return 'Invalid delete token.';
    case 'INVALID_EXPIRATION':
      return 'Invalid expiration. Choose 30, 60, 90, or 365 days.';
    case 'NETWORK_ERROR':
      return 'Connection failed. Check your internet connection.';
    case 'VALIDATION_ERROR':
    default:
      return error.error || 'An error occurred. Please try again.';
  }
}

// =============================================================================
// Result-Based API Functions
// =============================================================================

/**
 * Map a ShareErrorResponse to an ApiError.
 * This bridges the legacy error format to the Result type system.
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
 * Create a new cloud share with Result-based error handling.
 *
 * @example
 * ```ts
 * const result = await createShareResult(layout, 30);
 * if (isOk(result)) {
 *   console.log('Share URL:', result.value.url);
 * } else {
 *   console.error(getUserMessage(result.error));
 * }
 * ```
 */
export async function createShareResult(
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
 * Update an existing cloud share with Result-based error handling.
 */
export async function updateShareResult(
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
 * Fetch a shared layout by ID with Result-based error handling.
 */
export async function fetchShareResult(
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
 * Delete a cloud share with Result-based error handling.
 */
export async function deleteShareResult(
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
 * Report a share for inappropriate content with Result-based error handling.
 */
export async function reportShareResult(
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
