/**
 * Pure low-effort submission predicates for community publishing.
 *
 * The client uses these to disable the Publish button with an actionable
 * reason before a request is ever sent; the server re-runs the same predicates
 * as the authority.
 *
 * MIRROR: `api/lib/communityLowEffort.ts` duplicates this logic (api/ cannot
 * import from src/). Update both sides together; the cross-boundary equality
 * test in `communityLowEffort.crossBoundary.test.ts` guards against drift.
 */

/** Minimum trimmed name length accepted for a community submission. */
export const COMMUNITY_NAME_MIN_LENGTH = 3;

/**
 * Placeholder names the designer assigns automatically; publishing one is a
 * sign the author never named the design. Compared case-insensitively after
 * trimming (see `designName` defaults in the bin-designer store).
 */
export const COMMUNITY_PLACEHOLDER_NAMES: readonly string[] = ['untitled bin', 'untitled'];

export type CommunityNameIssue = 'empty' | 'too-short' | 'placeholder' | 'low-effort';

/**
 * Classify why a chosen name is too low-effort to publish, or null when it is
 * acceptable. Letter detection uses the Unicode letter class so names in any
 * script (not just Latin) count as informative.
 */
export function classifyCommunityName(rawName: string): CommunityNameIssue | null {
  const trimmed = rawName.trim();
  if (trimmed.length === 0) return 'empty';
  if (trimmed.length < COMMUNITY_NAME_MIN_LENGTH) return 'too-short';
  if (COMMUNITY_PLACEHOLDER_NAMES.includes(trimmed.toLowerCase())) return 'placeholder';
  // A name with no letters in any script ("1234", "-----") or one built from a
  // single repeated non-space character ("aaa", "!!!") carries no information.
  if (!/\p{L}/u.test(trimmed)) return 'low-effort';
  if (new Set(trimmed.replace(/\s+/gu, '')).size <= 1) return 'low-effort';
  return null;
}

/**
 * Minimum trimmed description length. Sized against the densest script we ship
 * ("M3ネジ用の仕切り付きビン" is 13), not against English.
 */
export const COMMUNITY_DESCRIPTION_MIN_LENGTH = 12;

/**
 * Stands in for a word count: whitespace tokenisation reports one word for a
 * whole ja/ko/zh-CN sentence, so a word floor would reject those locales.
 */
export const COMMUNITY_DESCRIPTION_MIN_DISTINCT_CHARS = 5;

export type CommunityDescriptionIssue = 'empty' | 'too-short' | 'low-effort';

/**
 * Classify why a description is too low-effort to publish, or null when it is
 * acceptable.
 */
export function classifyCommunityDescription(
  rawDescription: string
): CommunityDescriptionIssue | null {
  const trimmed = rawDescription.trim();
  if (trimmed.length === 0) return 'empty';
  // Code points, not UTF-16 code units: `.length` counts an emoji or a
  // supplementary-plane kanji as 2, so "ab😀😃😄😁😆" would clear a floor
  // documented in characters with seven of them.
  if ([...trimmed].length < COMMUNITY_DESCRIPTION_MIN_LENGTH) return 'too-short';
  if (!/\p{L}/u.test(trimmed)) return 'low-effort';
  if (new Set(trimmed.replace(/\s+/gu, '')).size < COMMUNITY_DESCRIPTION_MIN_DISTINCT_CHARS) {
    return 'low-effort';
  }
  return null;
}
