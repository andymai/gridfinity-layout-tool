import type { LayoutId } from '@/core/types';

/**
 * Generate a UUID v4 (RFC 4122) for contexts that need a globally unique
 * 122-bit identifier — e.g. PostHog analytics user IDs, where stability and
 * standard format matter more than URL-friendliness.
 *
 * For layout IDs, prefer `generateLayoutId()` instead: it produces a shorter
 * 12-char alphanumeric ID better suited to share URLs.
 *
 * Uses crypto.randomUUID() when available, falls back to manual generation
 * via crypto.getRandomValues for older environments.
 */
export function generateUUID(): string {
  const c = globalThis.crypto;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- randomUUID may not exist in test/older environments
  if (c?.randomUUID) {
    return c.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  // Set version (4) and variant (RFC 4122)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generate a short alphanumeric ID for layouts.
 *
 * Format: 12-character alphanumeric (a-z, A-Z, 0-9)
 * Collision probability: ~1 in 320 billion at 100k layouts
 *
 * Uses globalThis.crypto.getRandomValues for secure randomness.
 *
 * The character set and length live inside the function rather than at
 * module scope. This makes the function safe to call from any
 * module-init context (e.g. Zustand store creators that run eagerly):
 * a chunk-level static-import cycle can leave imported `var` bindings
 * as `undefined` until the producing module finishes its top-level
 * statements, which crashes (or silently miscomputes) anything that
 * reads them at call time. Self-contained = cycle-immune. See #1466.
 */
export function generateLayoutId(): LayoutId {
  const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const LENGTH = 12;
  const bytes = new Uint8Array(LENGTH);
  globalThis.crypto.getRandomValues(bytes);

  let id = '';
  for (let i = 0; i < LENGTH; i++) {
    id += ID_CHARS[bytes[i] % ID_CHARS.length];
  }
  return id as LayoutId;
}

/**
 * Check if a string is a valid layout ID (12-char alphanumeric).
 */
export function isValidLayoutId(id: string): boolean {
  return /^[a-zA-Z0-9]{12}$/.test(id);
}

/**
 * Check if a string is a legacy UUID.
 */
export function isLegacyUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
