import type { SavedDesign } from '../types';

/** Sorted, case-insensitively-deduped union of every tag across the designs. */
export function collectTags(designs: readonly SavedDesign[]): string[] {
  const seen = new Map<string, string>(); // lowercased key -> first-seen casing
  for (const d of designs) {
    for (const tag of d.tags ?? []) {
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Filter designs to those carrying every active tag (AND). With no active
 * tags, returns the input unchanged. Matching is case-insensitive.
 */
export function filterByTags(
  designs: readonly SavedDesign[],
  activeTags: readonly string[]
): SavedDesign[] {
  if (activeTags.length === 0) return [...designs];
  const wanted = activeTags.map((t) => t.toLowerCase());
  return designs.filter((d) => {
    const has = new Set((d.tags ?? []).map((t) => t.toLowerCase()));
    return wanted.every((w) => has.has(w));
  });
}

/** Add or remove a tag from a list, comparing case-insensitively. */
export function toggleTag(tags: readonly string[], tag: string): string[] {
  const key = tag.toLowerCase();
  return tags.some((t) => t.toLowerCase() === key)
    ? tags.filter((t) => t.toLowerCase() !== key)
    : [...tags, tag];
}
