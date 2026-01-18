/**
 * API client for cloud sharing endpoints.
 *
 * All functions return Result<T, ApiError> for consistent error handling
 * that integrates with the centralized error system.
 */

import type { Layout, SharePermission } from '@/core/types';
import type { Result, ApiError } from '@/core/result';
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
} from '@/core/result';

// API Response types
export interface ShareResponse {
  id: string;
  url: string;
  deleteToken: string;
  permission: SharePermission;
}

export interface ShareMetadata {
  createdAt: string;
  lastUpdatedAt?: string;
  permission: SharePermission;
  authorName?: string;
}

export interface FetchShareResponse {
  layout: Layout;
  metadata: ShareMetadata;
}

export interface UpdateShareResponse {
  id: string;
  url: string;
  permission: SharePermission;
}

export interface ShareErrorResponse {
  error: string;
  code: 'VALIDATION_ERROR' | 'SIZE_LIMIT' | 'BIN_LIMIT' | 'RATE_LIMITED' |
        'CONTENT_BLOCKED' | 'NETWORK_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED' |
        'EXPIRED' | 'INVALID_PERMISSION';
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
    case 'UNAUTHORIZED':
      return apiUnauthorized();
    case 'NETWORK_ERROR':
      return apiNetworkError();
    case 'VALIDATION_ERROR':
      return apiValidationError();
    case 'EXPIRED':
      return apiExpired();
    case 'INVALID_PERMISSION':
      // Invalid permission errors are treated as validation errors
      return apiValidationError();
    default:
      return apiServerError();
  }
}

/**
 * Create a new cloud share.
 *
 * @param layoutId - The layout's unique ID (used as the share ID for URL consistency)
 * @param layout - The layout data to share
 * @param permission - 'view' or 'edit'
 * @param authorName - Optional author name to display
 *
 * @example
 * ```ts
 * const result = await createShare(layoutId, layout, 'view');
 * if (isOk(result)) {
 *   console.log('Share URL:', result.value.url);
 * } else {
 *   console.error(getUserMessage(result.error));
 * }
 * ```
 */
export async function createShare(
  layoutId: string,
  layout: Layout,
  permission: SharePermission = 'view',
  authorName?: string
): Promise<Result<ShareResponse, ApiError>> {
  try {
    const response = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layoutId, layout, permission, authorName }),
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
 * Update an existing cloud share with new layout data.
 */
export async function updateShare(
  id: string,
  deleteToken: string,
  layout: Layout,
  permission?: SharePermission
): Promise<Result<UpdateShareResponse, ApiError>> {
  try {
    const response = await fetch(`/api/share/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout, permission, deleteToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return err(mapShareErrorToApiError(data as ShareErrorResponse));
    }

    return ok(data as UpdateShareResponse);
  } catch (error) {
    return err(apiNetworkError(error));
  }
}

/**
 * Update only the permission of an existing cloud share.
 */
export async function updatePermission(
  id: string,
  deleteToken: string,
  permission: SharePermission
): Promise<Result<UpdateShareResponse, ApiError>> {
  try {
    const response = await fetch(`/api/share/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission, deleteToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return err(mapShareErrorToApiError(data as ShareErrorResponse));
    }

    return ok(data as UpdateShareResponse);
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
