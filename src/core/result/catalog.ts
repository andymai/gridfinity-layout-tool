/**
 * Centralized error catalog - single source of truth for error codes,
 * messages, and recovery hints.
 *
 * This module provides:
 * - ErrorCatalogEntry: Structure for each error definition
 * - ERROR_CATALOG: Complete catalog of all error codes
 * - Helper functions: getUserMessage(), getRecoveryHint(), formatErrorMessage()
 *
 * The catalog is designed to be i18n-ready. User messages can be replaced
 * with translation keys in the future without changing error handling code.
 */

/**
 * Entry in the error catalog.
 */
export interface ErrorCatalogEntry {
  /** Unique error code */
  code: string;
  /** Default message for logging/debugging */
  defaultMessage: string;
  /** User-friendly message (if different from default) */
  userMessage?: string;
  /** Hint for how the user can recover from this error */
  recoveryHint?: string;
  /** Whether this operation can be retried */
  retryable: boolean;
  /** Severity level for UI display */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Complete error catalog with all error codes and their metadata.
 *
 * Error codes follow the pattern: DOMAIN_ERROR_TYPE
 * - STORAGE_*: Browser storage operations
 * - VALIDATION_*: Data validation errors
 * - LAYOUT_*: Layout operation errors
 * - API_*: Cloud API errors
 * - UNKNOWN_*: Fallback errors
 */
export const ERROR_CATALOG: Record<string, ErrorCatalogEntry> = {
  // ===========================================================================
  // Storage Errors
  // ===========================================================================

  STORAGE_QUOTA_EXCEEDED: {
    code: 'STORAGE_QUOTA_EXCEEDED',
    defaultMessage: 'Browser storage is full',
    userMessage: 'Storage full. Export your layout to save it.',
    recoveryHint: 'Export layouts or delete unused layouts to free up space',
    retryable: false,
    severity: 'error',
  },

  STORAGE_NOT_FOUND: {
    code: 'STORAGE_NOT_FOUND',
    defaultMessage: 'Layout not found in storage',
    userMessage: 'Layout not found',
    recoveryHint: 'The layout may have been deleted',
    retryable: false,
    severity: 'error',
  },

  STORAGE_CORRUPTED: {
    code: 'STORAGE_CORRUPTED',
    defaultMessage: 'Layout data is corrupted',
    userMessage: 'Layout data is corrupted',
    recoveryHint: 'Try importing from a JSON backup',
    retryable: false,
    severity: 'error',
  },

  STORAGE_UNAVAILABLE: {
    code: 'STORAGE_UNAVAILABLE',
    defaultMessage: 'Storage backend unavailable',
    userMessage: 'Storage is unavailable',
    recoveryHint: 'Check browser settings and ensure storage is enabled',
    retryable: true,
    severity: 'error',
  },

  STORAGE_NETWORK_ERROR: {
    code: 'STORAGE_NETWORK_ERROR',
    defaultMessage: 'Network error during storage operation',
    userMessage: 'Network error',
    recoveryHint: 'Check your internet connection and retry',
    retryable: true,
    severity: 'error',
  },

  // ===========================================================================
  // Validation Errors
  // ===========================================================================

  VALIDATION_OUT_OF_BOUNDS: {
    code: 'VALIDATION_OUT_OF_BOUNDS',
    defaultMessage: 'Bin placement is out of bounds',
    userMessage: 'Bin does not fit in the drawer',
    recoveryHint: 'Resize the bin or expand the drawer',
    retryable: false,
    severity: 'warning',
  },

  VALIDATION_COLLISION: {
    code: 'VALIDATION_COLLISION',
    defaultMessage: 'Bin collides with existing bins',
    userMessage: 'Bin overlaps with another bin',
    recoveryHint: 'Move or resize the bin to avoid overlap',
    retryable: false,
    severity: 'warning',
  },

  VALIDATION_INVALID_LAYER: {
    code: 'VALIDATION_INVALID_LAYER',
    defaultMessage: 'Layer does not exist',
    userMessage: 'Invalid layer',
    recoveryHint: 'Select a different layer',
    retryable: false,
    severity: 'error',
  },

  VALIDATION_HEIGHT_EXCEEDED: {
    code: 'VALIDATION_HEIGHT_EXCEEDED',
    defaultMessage: 'Bin height exceeds drawer height',
    userMessage: 'Bin is too tall',
    recoveryHint: 'Reduce bin height or increase drawer height',
    retryable: false,
    severity: 'warning',
  },

  VALIDATION_BLOCKED_ZONE: {
    code: 'VALIDATION_BLOCKED_ZONE',
    defaultMessage: 'Bin placement blocked by clearance zone',
    userMessage: 'Space blocked by tall bin above',
    recoveryHint: 'Move bin or reduce clearance height of blocking bin',
    retryable: false,
    severity: 'warning',
  },

  VALIDATION_IMPORT_FAILED: {
    code: 'VALIDATION_IMPORT_FAILED',
    defaultMessage: 'Layout import validation failed',
    userMessage: 'Invalid layout file',
    recoveryHint: 'Check the JSON file format',
    retryable: false,
    severity: 'error',
  },

  // ===========================================================================
  // Layout Errors
  // ===========================================================================

  LAYOUT_LAYER_LIMIT: {
    code: 'LAYOUT_LAYER_LIMIT',
    defaultMessage: 'Maximum layer count reached',
    userMessage: 'Cannot add more layers (max 10)',
    recoveryHint: 'Remove unused layers',
    retryable: false,
    severity: 'warning',
  },

  LAYOUT_CATEGORY_LIMIT: {
    code: 'LAYOUT_CATEGORY_LIMIT',
    defaultMessage: 'Maximum category count reached',
    userMessage: 'Cannot add more categories (max 20)',
    recoveryHint: 'Remove unused categories',
    retryable: false,
    severity: 'warning',
  },

  LAYOUT_LIBRARY_LIMIT: {
    code: 'LAYOUT_LIBRARY_LIMIT',
    defaultMessage: 'Maximum layout count reached',
    userMessage: 'Cannot add more layouts (max 100)',
    recoveryHint: 'Delete unused layouts',
    retryable: false,
    severity: 'warning',
  },

  LAYOUT_LAST_ENTITY: {
    code: 'LAYOUT_LAST_ENTITY',
    defaultMessage: 'Cannot delete last entity',
    userMessage: 'Cannot delete the only {entityType}',
    recoveryHint: 'Create a new {entityType} first',
    retryable: false,
    severity: 'warning',
  },

  LAYOUT_INVALID_OPERATION: {
    code: 'LAYOUT_INVALID_OPERATION',
    defaultMessage: 'Invalid layout operation',
    userMessage: 'Operation not allowed',
    recoveryHint: 'Check operation requirements',
    retryable: false,
    severity: 'error',
  },

  // ===========================================================================
  // API Errors
  // ===========================================================================

  API_RATE_LIMITED: {
    code: 'API_RATE_LIMITED',
    defaultMessage: 'Rate limit exceeded',
    userMessage: 'Too many requests. Try again later.',
    recoveryHint: 'Wait {retryAfter} seconds before retrying',
    retryable: true,
    severity: 'warning',
  },

  API_UNAUTHORIZED: {
    code: 'API_UNAUTHORIZED',
    defaultMessage: 'Unauthorized',
    userMessage: 'Invalid delete token',
    recoveryHint: 'Verify you have permission to modify this share',
    retryable: false,
    severity: 'error',
  },

  API_NOT_FOUND: {
    code: 'API_NOT_FOUND',
    defaultMessage: 'Resource not found',
    userMessage: 'Share not found or has expired',
    recoveryHint: 'Check the share URL',
    retryable: false,
    severity: 'error',
  },

  API_SERVER_ERROR: {
    code: 'API_SERVER_ERROR',
    defaultMessage: 'Server error',
    userMessage: 'Server error. Try again later.',
    recoveryHint: 'Wait a moment and retry',
    retryable: true,
    severity: 'error',
  },

  API_NETWORK_ERROR: {
    code: 'API_NETWORK_ERROR',
    defaultMessage: 'Network error',
    userMessage: 'Network error. Check your connection.',
    recoveryHint: 'Verify internet connection',
    retryable: true,
    severity: 'error',
  },

  API_VALIDATION_ERROR: {
    code: 'API_VALIDATION_ERROR',
    defaultMessage: 'Validation error',
    userMessage: 'Invalid data',
    recoveryHint: 'Check input data',
    retryable: false,
    severity: 'error',
  },

  API_CONTENT_BLOCKED: {
    code: 'API_CONTENT_BLOCKED',
    defaultMessage: 'Content blocked',
    userMessage: 'Content blocked. Check bin labels and notes.',
    recoveryHint: 'Remove inappropriate content',
    retryable: false,
    severity: 'error',
  },

  API_SIZE_LIMIT: {
    code: 'API_SIZE_LIMIT',
    defaultMessage: 'Layout size exceeds limit',
    userMessage: 'Layout is too large (max 500KB). Try removing some bins.',
    recoveryHint: 'Remove bins or simplify layout to reduce size',
    retryable: false,
    severity: 'error',
  },

  API_BIN_LIMIT: {
    code: 'API_BIN_LIMIT',
    defaultMessage: 'Bin count exceeds limit',
    userMessage: 'Too many bins (max 2500). Remove some bins before sharing.',
    recoveryHint: 'Delete unused bins to reduce count',
    retryable: false,
    severity: 'error',
  },

  API_EXPIRED: {
    code: 'API_EXPIRED',
    defaultMessage: 'Share has expired',
    userMessage: 'Share not found or has expired',
    recoveryHint: 'Request a new share link from the author',
    retryable: false,
    severity: 'error',
  },

  API_INVALID_EXPIRATION: {
    code: 'API_INVALID_EXPIRATION',
    defaultMessage: 'Invalid expiration period',
    userMessage: 'Invalid expiration. Choose 30, 60, 90, or 365 days.',
    recoveryHint: 'Select a valid expiration period',
    retryable: false,
    severity: 'error',
  },

  // ===========================================================================
  // Unknown/Generic Errors
  // ===========================================================================

  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    defaultMessage: 'An unexpected error occurred',
    userMessage: 'Something went wrong',
    recoveryHint: 'Try again or refresh the page',
    retryable: true,
    severity: 'error',
  },
};

/**
 * Get error catalog entry by code.
 * Returns UNKNOWN_ERROR entry if code is not found.
 *
 * @param code - The error code to look up
 * @returns The catalog entry for this error
 */
export function getErrorInfo(code: string): ErrorCatalogEntry {
  return ERROR_CATALOG[code] || ERROR_CATALOG.UNKNOWN_ERROR;
}

/**
 * Format an error message template with variable interpolation.
 *
 * @param template - Message template with {variable} placeholders
 * @param vars - Object with values to interpolate
 * @returns Formatted message string
 *
 * @example
 * ```ts
 * formatErrorMessage('Cannot delete the only {entityType}', { entityType: 'layer' });
 * // Returns: 'Cannot delete the only layer'
 * ```
 */
export function formatErrorMessage(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;

  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

/**
 * Get user-facing error message from an error object.
 * Uses the error catalog to look up the user-friendly message
 * and interpolates any metadata variables.
 *
 * @param error - Error object with code and optional metadata
 * @returns User-friendly error message
 *
 * @example
 * ```ts
 * const error = layoutLastEntity('layer');
 * getUserMessage(error); // 'Cannot delete the only layer'
 * ```
 */
export function getUserMessage(error: {
  code: string;
  metadata?: Record<string, unknown>;
}): string {
  const info = getErrorInfo(error.code);
  const message = info.userMessage || info.defaultMessage;

  if (error.metadata) {
    return formatErrorMessage(
      message,
      error.metadata as Record<string, string | number>
    );
  }

  return message;
}

/**
 * Get recovery hint from an error object.
 * Recovery hints tell users how to fix the problem.
 *
 * @param error - Error object with code and optional metadata
 * @returns Recovery hint string, or undefined if not available
 *
 * @example
 * ```ts
 * const error = apiRateLimited(60);
 * getRecoveryHint(error); // 'Wait 60 seconds before retrying'
 * ```
 */
export function getRecoveryHint(error: {
  code: string;
  metadata?: Record<string, unknown>;
}): string | undefined {
  const info = getErrorInfo(error.code);

  if (!info.recoveryHint) return undefined;

  if (error.metadata) {
    return formatErrorMessage(
      info.recoveryHint,
      error.metadata as Record<string, string | number>
    );
  }

  return info.recoveryHint;
}

/**
 * Check if an error is retryable.
 *
 * @param code - The error code to check
 * @returns Whether the operation can be retried
 */
export function isRetryable(code: string): boolean {
  return getErrorInfo(code).retryable;
}

/**
 * Get error severity for UI display.
 *
 * @param code - The error code to check
 * @returns Severity level ('error', 'warning', or 'info')
 */
export function getSeverity(code: string): 'error' | 'warning' | 'info' {
  return getErrorInfo(code).severity;
}
