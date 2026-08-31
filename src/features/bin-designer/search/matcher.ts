/**
 * A small, deterministic ranked matcher for the designer search — pure, with no
 * i18n or React coupling so the golden-set eval can drive it directly.
 *
 * Ranking favors, in order: an exact label, a label prefix, a label word prefix,
 * a label substring, then a subsequence (light typo/gap tolerance), with synonym
 * hits scored below their label equivalents. The label span that matched is
 * returned for highlighting; synonym- and subsequence-only hits carry no span.
 * Deliberately not a fuzzy-search dependency: the corpus is ~50 short records, so
 * a readable, tunable function beats an opaque library at the JS-budget edge.
 */

export interface SearchableRecord<T> {
  readonly id: string;
  readonly label: string;
  readonly keywords: readonly string[];
  readonly meta: T;
}

export type HighlightRange = readonly [start: number, end: number];

export interface MatchResult<T> {
  readonly id: string;
  readonly label: string;
  readonly meta: T;
  readonly score: number;
  /** Ranges in `label` (end-exclusive) to highlight; empty for synonym-only hits. */
  readonly highlight: readonly HighlightRange[];
}

const norm = (s: string): string => s.trim().toLowerCase();

/** How tightly `needle`'s chars sit inside `hay` as a subsequence, 0 if none. */
function subsequenceCompactness(needle: string, hay: string): number {
  let first = -1;
  let last = -1;
  let h = 0;
  for (let n = 0; n < needle.length; n++) {
    const ch = needle[n];
    let found = -1;
    while (h < hay.length) {
      if (hay[h] === ch) {
        found = h;
        h++;
        break;
      }
      h++;
    }
    if (found === -1) return 0;
    if (first === -1) first = found;
    last = found;
  }
  const span = last - first + 1;
  return span > 0 ? needle.length / span : 0;
}

/** Score `needle` against one `text`; returns 0 for no match. */
function scoreText(needle: string, text: string): number {
  if (text === needle) return 100;
  if (text.startsWith(needle)) return 90;
  if (text.split(/\s+/).some((word) => word.startsWith(needle))) return 80;
  if (text.includes(needle)) return 60;
  const compact = subsequenceCompactness(needle, text);
  return compact > 0 ? 40 * compact : 0;
}

function scoreKeywords(needle: string, keywords: readonly string[]): number {
  let best = 0;
  for (const kw of keywords) {
    // Synonyms rank below their label equivalents: cap at 55.
    const s = Math.min(55, scoreText(needle, norm(kw)));
    if (s > best) best = s;
  }
  return best;
}

/** The label span to underline: the contiguous run of `needle`, if present. */
function labelHighlight(needle: string, label: string): readonly HighlightRange[] {
  const at = label.toLowerCase().indexOf(needle);
  return at === -1 ? [] : [[at, at + needle.length]];
}

/**
 * Filters and ranks `records` by `query`. An empty query returns nothing (the
 * caller supplies its own browse ordering). Stable: ties break by shorter label,
 * then alphabetically.
 */
export function matchRecords<T>(
  query: string,
  records: readonly SearchableRecord<T>[]
): MatchResult<T>[] {
  const needle = norm(query);
  if (!needle) return [];

  const scored: MatchResult<T>[] = [];
  for (const record of records) {
    const label = norm(record.label);
    const labelScore = scoreText(needle, label);
    const score = Math.max(labelScore, scoreKeywords(needle, record.keywords));
    if (score <= 0) continue;
    scored.push({
      id: record.id,
      label: record.label,
      meta: record.meta,
      score,
      highlight: labelScore >= 60 ? labelHighlight(needle, record.label) : [],
    });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.label.length - b.label.length || a.label.localeCompare(b.label)
  );
  return scored;
}
