/**
 * A bin's slant, on a design or a layout bin. Kept when well-formed and
 * dropped alone when not, so a malformed value never costs the design.
 */
import { isBoolean, isNumber, isObject, inRange } from './validationUtils.js';

/** Mirror `SLANT_MAX_DEG` and `SLANT_SIDES` on the client; pinned by the cross-boundary test. */
export const SLANT_MAX_DEG = 60;
export const SLANT_SIDES = ['front', 'back', 'left', 'right'] as const;

export interface SlantShape {
  angleDeg: number;
  side: (typeof SLANT_SIDES)[number];
  endSupport?: boolean;
}

const SLANT_KEYS = new Set(['angleDeg', 'side', 'endSupport']);

export function sanitizeSlant(value: unknown): SlantShape | null {
  if (!isObject(value)) return null;
  if (Object.keys(value).some((key) => !SLANT_KEYS.has(key))) return null;
  const { angleDeg, side, endSupport } = value;
  if (!isNumber(angleDeg) || !inRange(angleDeg, 0, SLANT_MAX_DEG) || angleDeg === 0) return null;
  if (!(SLANT_SIDES as readonly unknown[]).includes(side)) return null;
  if (endSupport !== undefined && !isBoolean(endSupport)) return null;
  return {
    angleDeg,
    side: side as SlantShape['side'],
    ...(endSupport !== undefined ? { endSupport } : {}),
  };
}

export function withSanitizedSlant(params: Record<string, unknown>): Record<string, unknown> {
  const { slant, ...rest } = params;
  const clean = sanitizeSlant(slant);
  return clean ? { ...rest, slant: clean } : rest;
}
