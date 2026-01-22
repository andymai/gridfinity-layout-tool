/**
 * API client for cloud sharing endpoints.
 *
 * All functions return Result<T, ApiError> for consistent error handling
 * that integrates with the centralized error system.
 */

import type { Layout, SharePermission } from '@/core/types';
import type { Result, ApiError, ValidationError } from '@/core/result';
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
  validationImportFailed,
} from '@/core/result';
import { validateImport } from '@/shared/utils/validation';

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
  code:
    | 'VALIDATION_ERROR'
    | 'SIZE_LIMIT'
    | 'BIN_LIMIT'
    | 'RATE_LIMITED'
    | 'CONTENT_BLOCKED'
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'EXPIRED'
    | 'INVALID_PERMISSION'
    | 'SERVER_ERROR'
    | 'CONFIGURATION_ERROR'
    | 'METHOD_NOT_ALLOWED';
  retryAfter?: number;
}

// Type guards for runtime validation of API responses

function isShareErrorResponse(data: unknown): data is ShareErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    'code' in data &&
    typeof (data as Record<string, unknown>).error === 'string' &&
    typeof (data as Record<string, unknown>).code === 'string'
  );
}

function isShareResponse(data: unknown): data is ShareResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    'id' in data &&
    'url' in data &&
    'deleteToken' in data &&
    'permission' in data &&
    typeof obj.id === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.deleteToken === 'string' &&
    (obj.permission === 'view' || obj.permission === 'edit')
  );
}

function isUpdateShareResponse(data: unknown): data is UpdateShareResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    'id' in data &&
    'url' in data &&
    'permission' in data &&
    typeof obj.id === 'string' &&
    typeof obj.url === 'string' &&
    (obj.permission === 'view' || obj.permission === 'edit')
  );
}

/**
 * Basic structural check for FetchShareResponse.
 * Does not validate Layout contents - use validateFetchShareResponse for full validation.
 */
function isFetchShareResponseStructure(data: unknown): data is FetchShareResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'layout' in data &&
    'metadata' in data &&
    typeof (data as Record<string, unknown>).layout === 'object' &&
    typeof (data as Record<string, unknown>).metadata === 'object'
  );
}

/**
 * Validate a FetchShareResponse including Layout contents.
 * Returns validation errors if the layout structure is invalid.
 */
function validateFetchShareResponse(
  data: unknown
): { valid: true; data: FetchShareResponse } | { valid: false; errors: string[] } {
  if (!isFetchShareResponseStructure(data)) {
    return { valid: false, errors: ['Invalid response structure'] };
  }

  // Validate the Layout using the import validator
  const layoutValidation = validateImport(data.layout);
  if (!layoutValidation.valid) {
    return { valid: false, errors: layoutValidation.errors };
  }

  return { valid: true, data };
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
    case 'VALIDATION_ERROR':
      return apiValidationError();
    case 'EXPIRED':
      return apiExpired();
    case 'INVALID_PERMISSION':
      // Invalid permission errors are treated as validation errors
      return apiValidationError();
    case 'SERVER_ERROR':
    case 'CONFIGURATION_ERROR':
    case 'METHOD_NOT_ALLOWED':
      // Server-side errors
      return apiServerError();
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

    const data: unknown = await response.json();

    if (!response.ok) {
      if (isShareErrorResponse(data)) {
        return err(mapShareErrorToApiError(data));
      }
      return err(apiServerError());
    }

    if (isShareResponse(data)) {
      return ok(data);
    }
    return err(apiServerError());
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

    const data: unknown = await response.json();

    if (!response.ok) {
      if (isShareErrorResponse(data)) {
        return err(mapShareErrorToApiError(data));
      }
      return err(apiServerError());
    }

    if (isUpdateShareResponse(data)) {
      return ok(data);
    }
    return err(apiServerError());
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

    const data: unknown = await response.json();

    if (!response.ok) {
      if (isShareErrorResponse(data)) {
        return err(mapShareErrorToApiError(data));
      }
      return err(apiServerError());
    }

    if (isUpdateShareResponse(data)) {
      return ok(data);
    }
    return err(apiServerError());
  } catch (error) {
    return err(apiNetworkError(error));
  }
}

/**
 * Fetch a shared layout by ID.
 * Validates the layout structure after deserialization to ensure data integrity.
 */
export async function fetchShare(
  id: string
): Promise<Result<FetchShareResponse, ApiError | ValidationError>> {
  try {
    const response = await fetch(`/api/share/${id}`);
    const data: unknown = await response.json();

    if (!response.ok) {
      if (isShareErrorResponse(data)) {
        return err(mapShareErrorToApiError(data));
      }
      return err(apiServerError());
    }

    // Validate both structure and layout contents
    const validation = validateFetchShareResponse(data);
    if (!validation.valid) {
      return err(validationImportFailed(validation.errors));
    }

    return ok(validation.data);
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

    const data: unknown = await response.json();

    if (!response.ok) {
      if (isShareErrorResponse(data)) {
        return err(mapShareErrorToApiError(data));
      }
      return err(apiServerError());
    }

    // Validate success response structure
    if (typeof data === 'object' && data !== null && 'success' in data && 'message' in data) {
      return ok(data as { success: true; message: string });
    }
    return err(apiServerError());
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

    const data: unknown = await response.json();

    if (!response.ok) {
      if (isShareErrorResponse(data)) {
        return err(mapShareErrorToApiError(data));
      }
      return err(apiServerError());
    }

    // Validate success response structure
    if (typeof data === 'object' && data !== null && 'success' in data && 'message' in data) {
      return ok(data as { success: true; message: string });
    }
    return err(apiServerError());
  } catch (error) {
    return err(apiNetworkError(error));
  }
}
