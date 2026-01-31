import type { LayoutId } from '@/core/types';

/**
 * Generate a UUID v4 for layout identification.
 * Uses crypto.randomUUID() when available, falls back to manual generation.
 *
 * @deprecated Use generateLayoutId() for new layouts. UUIDs are kept for
 * backward compatibility with existing layouts.
 */
export function generateUUID(): string {
  const c = globalThis.crypto;
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

/** Character set for short IDs: a-z, A-Z, 0-9 (62 chars) */
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Length of layout IDs (62^12 ≈ 3.2×10²¹ combinations) */
export const LAYOUT_ID_LENGTH = 12;

/**
 * Generate a short alphanumeric ID for layouts.
 *
 * Format: 12-character alphanumeric (a-z, A-Z, 0-9)
 * Collision probability: ~1 in 320 billion at 100k layouts
 *
 * Uses crypto.getRandomValues for secure randomness.
 */
export function generateLayoutId(): LayoutId {
  const bytes = new Uint8Array(LAYOUT_ID_LENGTH);
  crypto.getRandomValues(bytes);

  let id = '';
  for (let i = 0; i < LAYOUT_ID_LENGTH; i++) {
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
