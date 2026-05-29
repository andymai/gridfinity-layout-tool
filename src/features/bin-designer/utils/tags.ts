/**
 * Tag normalization for saved designs.
 *
 * `MAX_TAGS` / `MAX_TAG_LENGTH` are a cross-boundary contract: the server
 * mirrors these exact values in `api/lib/designerValidation.ts` (`sanitizeTags`)
 * so a tag accepted locally is never silently dropped on sync.
 */

export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 32;

/**
 * Normalize a raw tag list: trim, drop empties, cap length, dedupe
 * (case-insensitive, first-casing-wins), cap count. Returns `[]` for non-array
 * or junk input.
 */
export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().slice(0, MAX_TAG_LENGTH);
    if (trimmed === '') continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}
