/**
 * API client for collection endpoints.
 *
 * Collections enable real-time collaboration on layouts without user accounts.
 * All operations return a discriminated union result type for type-safe error handling.
 */

import type {
  Layout,
  LayoutPreview,
  CollectionErrorCode,
} from '../types';

// ============================================================================
// Response Types
// ============================================================================

export interface CollectionLayoutMetadata {
  id: string;
  name: string;
  modifiedAt: number;
  preview: LayoutPreview;
}

export interface CreateCollectionResponse {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  url: string;
  viewOnlyUrl: string;
  layouts: CollectionLayoutMetadata[];
}

export interface FetchCollectionResponse {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  expiresAt: number;
  layoutCount: number;
  layouts: CollectionLayoutMetadata[];
  viewOnly?: boolean;
}

export interface UpdateCollectionResponse {
  id: string;
  name: string;
  modifiedAt: number;
  expiresAt: number;
}

export interface AddLayoutResponse {
  id: string;
  name: string;
  modifiedAt: number;
  preview: LayoutPreview;
}

export interface FetchLayoutResponse {
  layout: Layout;
  modifiedAt: number;
}

export interface UpdateLayoutResponse {
  modifiedAt: number;
}

export interface DeleteResponse {
  success: true;
  message: string;
}

export interface PollResponse {
  modifiedAt: number;
  layouts: Array<{
    id: string;
    modifiedAt: number;
    activeEditors: number;
  }>;
}

export interface HeartbeatResponse {
  acknowledged: true;
  activeEditors: number;
}

// ============================================================================
// Error Types
// ============================================================================

export interface CollectionErrorResponse {
  error: string;
  code: CollectionErrorCode;
  retryAfter?: number;
  // For conflict resolution
  serverModifiedAt?: number;
  serverLayout?: Layout;
}

export type CollectionResult<T> =
  | { success: true; data: T }
  | { success: false; error: CollectionErrorResponse };

// ============================================================================
// Collection Operations
// ============================================================================

/**
 * Create a new collection, optionally with an initial layout.
 */
export async function createCollection(
  name: string,
  initialLayout?: Layout
): Promise<CollectionResult<CreateCollectionResponse>> {
  try {
    const body: { name: string; initialLayout?: Layout } = { name };
    if (initialLayout) {
      body.initialLayout = initialLayout;
    }

    const response = await fetch('/api/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as CollectionErrorResponse };
    }

    return { success: true, data: data as CreateCollectionResponse };
  } catch (error) {
    console.error('Create collection error:', error);
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
 * Fetch collection metadata and layout list.
 */
export async function fetchCollection(
  collectionId: string
): Promise<CollectionResult<FetchCollectionResponse>> {
  try {
    const response = await fetch(`/api/collection/${collectionId}`);
    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as CollectionErrorResponse };
    }

    return { success: true, data: data as FetchCollectionResponse };
  } catch (error) {
    console.error('Fetch collection error:', error);
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
 * Update collection metadata (e.g., rename).
 */
export async function updateCollection(
  collectionId: string,
  name: string
): Promise<CollectionResult<UpdateCollectionResponse>> {
  try {
    const response = await fetch(`/api/collection/${collectionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as CollectionErrorResponse };
    }

    return { success: true, data: data as UpdateCollectionResponse };
  } catch (error) {
    console.error('Update collection error:', error);
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
 * Delete an entire collection and all its layouts.
 */
export async function deleteCollection(
  collectionId: string
): Promise<CollectionResult<DeleteResponse>> {
  try {
    const response = await fetch(`/api/collection/${collectionId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as CollectionErrorResponse };
    }

    return { success: true, data: data as DeleteResponse };
  } catch (error) {
    console.error('Delete collection error:', error);
    return {
      success: false,
      error: {
        error: 'Network error. Check your connection.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

// ============================================================================
// Layout Operations
// ============================================================================

/**
 * Add a new layout to a collection.
 */
export async function addLayout(
  collectionId: string,
  layout: Layout
): Promise<CollectionResult<AddLayoutResponse>> {
  try {
    const response = await fetch(`/api/collection/${collectionId}/layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as CollectionErrorResponse };
    }

    return { success: true, data: data as AddLayoutResponse };
  } catch (error) {
    console.error('Add layout error:', error);
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
 * Fetch full layout data from a collection.
 */
export async function fetchLayout(
  collectionId: string,
  layoutId: string
): Promise<CollectionResult<FetchLayoutResponse>> {
  try {
    const response = await fetch(
      `/api/collection/${collectionId}/layout/${layoutId}`
    );
    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as CollectionErrorResponse };
    }

    return { success: true, data: data as FetchLayoutResponse };
  } catch (error) {
    console.error('Fetch layout error:', error);
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
 * Update options for layout PUT requests.
 */
export interface UpdateLayoutOptions {
  /** For optimistic concurrency control - conflicts if server has newer version */
  expectedModifiedAt?: number;
  /** Optional new name for the layout */
  name?: string;
}

/**
 * Update a layout in a collection.
 *
 * Supports optimistic concurrency control via expectedModifiedAt.
 * If the server has a newer version, returns CONFLICT with server data.
 */
export async function updateLayout(
  collectionId: string,
  layoutId: string,
  layout: Layout,
  options?: UpdateLayoutOptions
): Promise<CollectionResult<UpdateLayoutResponse>> {
  try {
    const body: {
      layout: Layout;
      expectedModifiedAt?: number;
      name?: string;
    } = { layout };

    if (options?.expectedModifiedAt !== undefined) {
      body.expectedModifiedAt = options.expectedModifiedAt;
    }
    if (options?.name !== undefined) {
      body.name = options.name;
    }

    const response = await fetch(
      `/api/collection/${collectionId}/layout/${layoutId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as CollectionErrorResponse };
    }

    return { success: true, data: data as UpdateLayoutResponse };
  } catch (error) {
    console.error('Update layout error:', error);
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
 * Delete a layout from a collection.
 */
export async function deleteLayout(
  collectionId: string,
  layoutId: string
): Promise<CollectionResult<DeleteResponse>> {
  try {
    const response = await fetch(
      `/api/collection/${collectionId}/layout/${layoutId}`,
      { method: 'DELETE' }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as CollectionErrorResponse };
    }

    return { success: true, data: data as DeleteResponse };
  } catch (error) {
    console.error('Delete layout error:', error);
    return {
      success: false,
      error: {
        error: 'Network error. Check your connection.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

// ============================================================================
// Sync Operations
// ============================================================================

/**
 * Poll for collection changes (lightweight).
 * Returns 304 if nothing changed since lastModifiedAt.
 */
export async function pollCollection(
  collectionId: string,
  lastModifiedAt?: number
): Promise<CollectionResult<PollResponse> | { notModified: true }> {
  try {
    const headers: HeadersInit = {};
    if (lastModifiedAt !== undefined) {
      headers['If-Modified-Since'] = lastModifiedAt.toString();
    }

    const response = await fetch(`/api/collection/${collectionId}/poll`, {
      headers,
    });

    // 304 Not Modified
    if (response.status === 304) {
      return { notModified: true };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as CollectionErrorResponse };
    }

    return { success: true, data: data as PollResponse };
  } catch (error) {
    console.error('Poll collection error:', error);
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
 * Type guard to check if poll result is "not modified".
 */
export function isPollNotModified(
  result: CollectionResult<PollResponse> | { notModified: true }
): result is { notModified: true } {
  return 'notModified' in result && result.notModified === true;
}

/**
 * Send heartbeat to indicate active editing.
 */
export async function sendHeartbeat(
  collectionId: string,
  layoutId: string,
  deviceId: string
): Promise<CollectionResult<HeartbeatResponse>> {
  try {
    const response = await fetch(`/api/collection/${collectionId}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layoutId, deviceId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as CollectionErrorResponse };
    }

    return { success: true, data: data as HeartbeatResponse };
  } catch (error) {
    console.error('Heartbeat error:', error);
    // Heartbeats are best-effort, don't fail hard
    return {
      success: false,
      error: {
        error: 'Network error.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

// ============================================================================
// Error Helpers
// ============================================================================

/**
 * Get user-friendly error message from collection error.
 */
export function getCollectionErrorMessage(error: CollectionErrorResponse): string {
  switch (error.code) {
    case 'NOT_FOUND':
      return 'Collection not found.';

    case 'COLLECTION_EXPIRED':
      return 'Collection has expired due to inactivity.';

    case 'CONFLICT':
      return 'Someone else modified this layout. Please review the changes.';

    case 'RATE_LIMITED':
      if (error.retryAfter) {
        const minutes = Math.ceil(error.retryAfter / 60);
        return `Too many requests. Try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
      }
      return 'Too many requests. Try again later.';

    case 'COLLECTION_FULL':
      return 'Collection has reached the maximum of 50 layouts.';

    case 'PAYLOAD_TOO_LARGE':
      return 'Layout is too large. Try removing some bins.';

    case 'VALIDATION_ERROR':
      return error.error || 'Invalid data. Please check your input.';

    case 'NETWORK_ERROR':
      return 'Connection failed. Check your internet connection.';

    case 'UNAUTHORIZED':
      return 'You do not have permission to perform this action.';

    default:
      return error.error || 'An error occurred. Please try again.';
  }
}
