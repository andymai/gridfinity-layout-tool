/**
 * Tag normalization for saved designs.
 *
 * This MUST stay byte-for-byte equivalent to the server's `sanitizeTags` in
 * `api/lib/designerValidation.ts`: the same `MAX_TAGS` / `MAX_TAG_LENGTH` caps
 * AND the same control-char stripping. If they diverge, a tag the client keeps
 * but the server rewrites would flicker back on the next sync pull.
 */

export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 32;

/**
 * Normalize a raw tag list: strip control chars, trim, drop empties, cap
 * length, dedupe (case-insensitive, first-casing-wins), cap count. Returns
 * `[]` for non-array or junk input.
 */
export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    // Mirror the server's sanitizeString: strip null bytes + control chars,
    // then trim and cap. Keeps the cross-boundary contract exact.
    const clean = raw
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim()
      .slice(0, MAX_TAG_LENGTH);
    if (clean === '') continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** True when two already-normalized tag lists are identical (same order, same values). */
export function tagsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, i) => tag === b[i]);
}
