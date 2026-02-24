import { timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';
import type { VercelResponse } from '@vercel/node';

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
 * Constant-time comparison for strings.
 * Uses Node's native `timingSafeEqual` to prevent timing attacks.
 * When lengths differ, a dummy comparison is performed to keep the
 * execution path consistent and avoid leaking length via timing.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBuf = Buffer.from(encoder.encode(a));
  const bBuf = Buffer.from(encoder.encode(b));
  if (aBuf.length !== bBuf.length) {
    // Dummy comparison — keeps timing consistent regardless of length mismatch
    nodeTimingSafeEqual(bBuf, bBuf);
    return false;
  }
  return nodeTimingSafeEqual(aBuf, bBuf);
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
 *
 * deleteTokenHash and reportCount are stored in Redis for new shares
 * (created after the security migration). For backwards compatibility,
 * old shares may still carry these fields in the blob — readers should
 * check Redis first and fall back to the blob value if absent.
 */
export interface ShareMetadata {
  /** Stored in Redis (share:hash:{id}). May be present in blob for pre-migration shares. */
  deleteTokenHash?: string;
  createdAt: string;
  lastUpdatedAt: string;
  lastAccessedAt: string;
  permission: 'view' | 'edit';
  authorName?: string;
  /** Stored in Redis (share:reports:{id}). May be present in blob for pre-migration shares. */
  reportCount?: number;
}

/** Redis key for a share's delete token hash */
export function shareHashKey(shareId: string): string {
  return `share:hash:${shareId}`;
}

/** Redis key for a share's report count */
export function shareReportKey(shareId: string): string {
  return `share:reports:${shareId}`;
}

/**
 * Shared data structure for stored shares.
 */
export interface ShareData {
  layout: unknown;
  metadata: ShareMetadata;
}

export function methodNotAllowed(res: VercelResponse, allowed: string): VercelResponse {
  res.setHeader('Allow', allowed);
  return res.status(405).json({ error: 'Method not allowed', code: ErrorCode.METHOD_NOT_ALLOWED });
}

export function getBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://localhost:3000';
}
