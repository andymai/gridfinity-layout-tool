/**
 * Shared utilities for API endpoints.
 *
 * This module consolidates common functionality used across multiple API routes:
 * - ID validation (layout/share IDs)
 * - Token hashing for authentication
 * - Shared type definitions
 */

/**
 * Validate a layout/share ID format.
 * Supports multiple formats for backwards compatibility:
 * - Standard UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (older layouts)
 * - Base36 timestamp: {timestamp}-{random 7 chars} e.g., "lszwz1k7v-8j2kqp1"
 * - Legacy 12-char: alphanumeric only
 */
export function isValidShareId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  // Standard UUID format (8-4-4-4-12 hex chars)
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return true;
  // Base36 timestamp format (variable length + hyphen + 7 chars)
  if (/^[a-z0-9]+-[a-z0-9]{7}$/.test(id)) return true;
  // Legacy 12-char alphanumeric format
  if (/^[a-zA-Z0-9]{12}$/.test(id)) return true;
  return false;
}

/**
 * Hash a delete token using SHA-256 with server salt.
 * Uses Web Crypto API (available in Vercel Edge/Node).
 *
 * @throws Error if TOKEN_SALT environment variable is not configured
 */
export async function hashToken(token: string): Promise<string> {
  const salt = process.env.TOKEN_SALT;
  if (!salt) {
    throw new Error('TOKEN_SALT environment variable must be configured');
  }
  const data = new TextEncoder().encode(salt + token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time comparison for hash strings.
 * Prevents timing attacks by always comparing all characters
 * regardless of where the first difference occurs.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a 32-character hex delete token (128-bit entropy).
 */
export function generateDeleteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Standard error codes used across all API endpoints.
 * These map to client-side ApiError types.
 */
export const ErrorCode = {
  // Validation errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  SIZE_LIMIT: 'SIZE_LIMIT',
  BIN_LIMIT: 'BIN_LIMIT',
  CONTENT_BLOCKED: 'CONTENT_BLOCKED',
  EXPIRED: 'EXPIRED',
  INVALID_PERMISSION: 'INVALID_PERMISSION',

  // Server errors (5xx)
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',

  // Network errors (client-side only, not returned by server)
  // NETWORK_ERROR is reserved for client-side fetch failures
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Standard error response shape for all API endpoints.
 */
export interface ApiErrorResponse {
  error: string;
  code: ErrorCodeType;
  retryAfter?: number;
}

/**
 * Shared metadata structure for stored shares.
 */
export interface ShareMetadata {
  deleteTokenHash: string;
  createdAt: string;
  lastUpdatedAt: string;
  lastAccessedAt: string;
  permission: 'view' | 'edit';
  authorName?: string;
  reportCount: number;
}

/**
 * Shared data structure for stored shares.
 */
export interface ShareData {
  layout: unknown;
  metadata: ShareMetadata;
}
