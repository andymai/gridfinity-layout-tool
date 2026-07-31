/**
 * The reference card's real dimensions, remembered per device.
 *
 * The scan assumes a nominal ID-1 card (85.6 x 53.98mm). Someone measuring
 * their tool with calipers can measure the card too, which turns that
 * assumption into a known quantity. A card belongs to a person rather than to
 * a scan, so the measured size persists and every later scan reuses it.
 *
 * Sides are long-then-short rather than width-then-height because that is what
 * the homography consumes: `cardHomography` maps the first value onto whichever
 * card edge reads as longer in the photo, so a transposed pair rectifies to a
 * transposed rectangle.
 */

import { CARD_WIDTH_MM, CARD_HEIGHT_MM } from '@/shared/scanTrace';

export interface CardSizeMm {
  /** The card's longer side. */
  readonly longMm: number;
  /** The card's shorter side. */
  readonly shortMm: number;
}

export const DEFAULT_CARD_SIZE: CardSizeMm = {
  longMm: CARD_WIDTH_MM,
  shortMm: CARD_HEIGHT_MM,
};

/**
 * Plausible bounds for a hand-held reference card. Tight enough that a
 * misplaced decimal (8.56 or 856 for 85.6) is rejected rather than silently
 * scaling the whole outline by ten.
 */
export const MIN_CARD_MM = 20;
export const MAX_CARD_MM = 200;

const STORAGE_KEY = 'gridfinity-scan-card-size-v1';

export function isValidCardMm(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_CARD_MM && value <= MAX_CARD_MM;
}

/** Parse a typed field, returning null while it is empty or out of range. */
export function parseCardMm(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return isValidCardMm(value) ? value : null;
}

export function isDefaultCardSize(size: CardSizeMm): boolean {
  return size.longMm === DEFAULT_CARD_SIZE.longMm && size.shortMm === DEFAULT_CARD_SIZE.shortMm;
}

export function loadCardSize(): CardSizeMm {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CARD_SIZE;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_CARD_SIZE;
    const { longMm, shortMm } = parsed as Record<string, unknown>;
    if (typeof longMm !== 'number' || typeof shortMm !== 'number') return DEFAULT_CARD_SIZE;
    if (!isValidCardMm(longMm) || !isValidCardMm(shortMm)) return DEFAULT_CARD_SIZE;
    return { longMm, shortMm };
  } catch {
    return DEFAULT_CARD_SIZE;
  }
}

export function saveCardSize(size: CardSizeMm): void {
  try {
    if (isDefaultCardSize(size)) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(size));
  } catch {
    // Private mode / quota — the size still applies to this session.
  }
}
