/**
 * Pure helpers for the phone-scan handoff.
 *
 * The desktop creates a short-lived session; the phone uploads a traced SVG
 * outline against the session token; the desktop polls and picks it up. Token
 * validation and SVG validation live here (pure, testable); the route handlers
 * stay thin.
 */

import { ErrorCode } from './shared.js';

/** How long a pending handoff lives before expiring (10 minutes). */
export const SCAN_SESSION_TTL_SECONDS = 600;

/** Outlines are a few KB; cap generously to reject anything that isn't one. */
export const MAX_SCAN_SVG_BYTES = 512 * 1024;

export type ScanSessionStatus = 'pending' | 'ready';

export interface ScanSessionRecord {
  readonly status: ScanSessionStatus;
  readonly svg?: string;
  readonly createdAt: string;
}

/** Tokens are `crypto.randomUUID()` (v4) — matches the `/scan/:token` rewrite. */
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidScanToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

export type ScanSvgValidation =
  | { readonly valid: true; readonly svg: string }
  | { readonly valid: false; readonly code: string; readonly error: string };

/**
 * Validate an uploaded traced outline before it is stored for pickup.
 *
 * SECURITY INVARIANT: the uploaded SVG is never injected into a live DOM. It is
 * only ever (a) previewed via an `<img>` data-URL — SVG-in-`<img>` runs in the
 * browser's secure static mode (no scripts, no external fetches), and (b) parsed
 * with DOMParser to read geometric attributes (never `innerHTML`/append). That
 * render path is the real guarantee. The regex checks below are best-effort
 * defense-in-depth (a regex can't fully parse SVG) and a fast reject for junk —
 * do NOT weaken the inert render path on the assumption this sanitizes.
 */
export function validateScanSvg(input: unknown): ScanSvgValidation {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return { valid: false, code: ErrorCode.VALIDATION_ERROR, error: 'Missing SVG outline' };
  }

  const svg = input.trim();

  if (Buffer.byteLength(svg, 'utf8') > MAX_SCAN_SVG_BYTES) {
    return { valid: false, code: ErrorCode.SIZE_LIMIT, error: 'Outline is too large' };
  }

  if (!/<svg[\s>]/i.test(svg) || !/<\/svg>/i.test(svg)) {
    return { valid: false, code: ErrorCode.VALIDATION_ERROR, error: 'Not a valid SVG outline' };
  }

  if (/<script\b/i.test(svg) || /\son\w+\s*=/i.test(svg) || /javascript:/i.test(svg)) {
    return {
      valid: false,
      code: ErrorCode.CONTENT_BLOCKED,
      error: 'Outline contains disallowed content',
    };
  }

  // A cutout outline is paths/shapes only. Reject external-reference elements
  // and href attributes (`<image>`, `<use>`, `href`/`xlink:href`) so a crafted
  // upload can't make the desktop fetch external resources when previewing.
  if (/<(?:image|use|foreignObject)\b/i.test(svg) || /\b(?:xlink:)?href\s*=/i.test(svg)) {
    return {
      valid: false,
      code: ErrorCode.CONTENT_BLOCKED,
      error: 'Outline contains disallowed elements',
    };
  }

  return { valid: true, svg };
}
