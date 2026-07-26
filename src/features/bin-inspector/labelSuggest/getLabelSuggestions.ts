import {
  processLabel,
  getCanonicalTerms,
  getDisplayTerm,
  getTermDomain,
  conceptDomain,
  relatedTermsForQuery,
  type LabelDomain,
} from '@/shared/analytics/labelVocabulary';
import { detectSequenceSuggestions } from './sequence';
import { isModelUsable, modelScore, type LabelSuggesterModel } from './model';
import type {
  LabelGhost,
  LabelSuggestion,
  SuggestionBin,
  SuggestionContext,
  SuggestionReason,
} from './types';

/** Score below which the top suggestion is not offered as inline ghost text. */
export const GHOST_MIN_SCORE = 0.6;

const DEFAULT_LIMIT = 6;
const FUZZY_MAX_DISTANCE = 2;

const WEIGHTS = {
  // Above the max neighbor+reuse total so the *next* item in a series outranks
  // the existing members it was inferred from.
  sequence: 2.0,
  neighbor: 0.9,
  reuseBase: 0.5,
  reusePer: 0.08,
  domain: 0.4,
  catalog: 0.15,
  text: 1.0,
} as const;

// Text-equivalent score for a candidate that matches only by meaning (concept
// expansion or related-terms graph) rather than by letters. Below a prefix (1.0)
// or substring (0.6) match so literal matches still rank first.
const SEMANTIC_SCORE = 0.5;

interface Candidate {
  value: string;
  isCatalog: boolean;
  isSequence: boolean;
  domain: LabelDomain | null;
  canonical: string | null;
}

type TextKind = 'prefix' | 'substring' | 'alias' | 'fuzzy' | 'semantic' | 'none';
interface TextMatch {
  score: number;
  kind: TextKind;
}

// Kinds that reflect a real letter match (vs. meaning-only 'semantic' / 'none').
// Literal matches always outrank meaning-only ones while typing.
const LITERAL_KINDS = new Set<TextKind>(['prefix', 'substring', 'alias', 'fuzzy']);

interface ScoredSuggestion extends LabelSuggestion {
  literal: boolean;
}

/**
 * Rank label suggestions for a bin from the current layout alone.
 *
 * Blends five on-device signals: sequence continuation (M3/M4 → M5), reuse of
 * an existing label, co-occurrence with neighboring or same-category bins,
 * vocabulary-domain affinity (semantic-ish), and text match (prefix / substring
 * / cross-language alias / typo-tolerant fuzzy). With an empty query it predicts
 * from context; while typing it ranks by how well each candidate matches.
 */
export function getLabelSuggestions(
  rawQuery: string,
  ctx: SuggestionContext,
  options: {
    limit?: number;
    maxLength?: number;
    model?: LabelSuggesterModel | null;
    locale?: string;
  } = {}
): LabelSuggestion[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  // Never surface a suggestion the field can't hold verbatim — otherwise the
  // committed label (clamped downstream) diverges from what the user picked.
  const maxLength = options.maxLength ?? Number.POSITIVE_INFINITY;
  const query = rawQuery.trim().toLowerCase();
  const currentLabel = ctx.target.label.trim().toLowerCase();
  const others = ctx.bins.filter((b) => b.id !== ctx.target.id);

  // Reuse counts across the layout (label → occurrences on other bins).
  const counts = new Map<string, { value: string; count: number }>();
  for (const b of others) {
    const value = b.label.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { value, count: 1 });
  }

  // Neighbor labels: edge-adjacent on the same layer, or in the same category.
  const model = isModelUsable(options.model) ? options.model : null;
  const neighborKeys = new Set<string>();
  const neighborHashes: string[] = [];
  const domainTally = new Map<LabelDomain, number>();
  for (const b of others) {
    const value = b.label.trim();
    if (!value) continue;
    const isNeighbor =
      (b.layerId === ctx.target.layerId && edgeAdjacent(ctx.target, b)) ||
      b.category === ctx.target.category;
    if (!isNeighbor) continue;
    neighborKeys.add(value.toLowerCase());
    const label = processLabel(value);
    if (model) neighborHashes.push(label.hash);
    if (label.domain) domainTally.set(label.domain, (domainTally.get(label.domain) ?? 0) + 1);
  }
  const dominantDomain = pickDominant(domainTally);

  // Sequence predictions consider every label (target included) so a partly
  // typed series still extends.
  const sequencePreds = detectSequenceSuggestions(ctx.bins.map((b) => b.label));
  const sequenceKeys = new Set(sequencePreds.map((p) => p.value.toLowerCase()));

  // Assemble the candidate pool, deduped case-insensitively.
  const candidates = new Map<string, Candidate>();
  const add = (rawValue: string, meta: Partial<Candidate>) => {
    const value = rawValue.trim();
    const key = value.toLowerCase();
    if (!key || key === currentLabel) return;
    const existing = candidates.get(key);
    if (existing) {
      if (meta.isCatalog) existing.isCatalog = true;
      if (meta.isSequence) existing.isSequence = true;
      if (meta.domain && !existing.domain) existing.domain = meta.domain;
      if (meta.canonical && !existing.canonical) existing.canonical = meta.canonical;
    } else {
      candidates.set(key, {
        value,
        isCatalog: meta.isCatalog ?? false,
        isSequence: meta.isSequence ?? false,
        domain: meta.domain ?? null,
        canonical: meta.canonical ?? null,
      });
    }
  };

  for (const pred of sequencePreds)
    add(pred.value, { isSequence: true, domain: processLabel(pred.value).domain });
  for (const { value } of counts.values()) add(value, {});
  for (const term of getCanonicalTerms())
    add(getDisplayTerm(term, options.locale), {
      isCatalog: true,
      domain: getTermDomain(term),
      canonical: term,
    });

  // Semantic expansion of a typed concept word ("fasteners" → the fasteners
  // domain) or a term's related items ("screwdriver" → screw/bolt). Empty until
  // the user types — pre-type prediction already leans on neighbor domains.
  const conceptDom = query ? conceptDomain(query) : null;
  const relatedSet = new Set(query ? relatedTermsForQuery(query) : []);

  const scored: ScoredSuggestion[] = [];
  for (const cand of candidates.values()) {
    if (cand.value.length > maxLength) continue;
    const key = cand.value.toLowerCase();
    const reuse = counts.get(key)?.count ?? 0;
    const isNeighbor = neighborKeys.has(key);
    const isSequence = cand.isSequence || sequenceKeys.has(key);
    const domainMatch = !!cand.domain && cand.domain === dominantDomain;
    let text = query ? textScore(cand.value, query) : { score: 0, kind: 'none' as TextKind };

    // Meaning-based match when letters don't line up: a concept word expands to
    // its domain's terms; a term expands to its related items. Reason → similar.
    if (query && text.score <= 0) {
      const semantic =
        (conceptDom !== null && cand.domain === conceptDom) ||
        (cand.canonical !== null && relatedSet.has(cand.canonical));
      if (semantic) text = { score: SEMANTIC_SCORE, kind: 'semantic' };
    }

    // While typing, only surface candidates that relate to the typed text —
    // the learned prior refines ranking, it never bypasses text relevance.
    if (query && text.score <= 0) continue;

    // Learned cross-user prior (popularity + neighbor co-occurrence), or 0 when
    // no trained model is loaded.
    const learned = model ? modelScore(model, processLabel(cand.value).hash, neighborHashes) : 0;

    // Pre-type: drop bare catalog terms with no contextual pull, else focusing
    // the field floods the list with generic vocabulary entries. A strong
    // learned prior counts as context.
    const hasContext = isSequence || isNeighbor || reuse > 0 || domainMatch || learned > 0;
    if (!query && cand.isCatalog && !hasContext) continue;

    let score = 0;
    if (isSequence) score += WEIGHTS.sequence;
    if (isNeighbor) score += WEIGHTS.neighbor;
    if (reuse > 0) score += WEIGHTS.reuseBase + WEIGHTS.reusePer * Math.min(reuse, 5);
    if (domainMatch) score += WEIGHTS.domain;
    if (cand.isCatalog) score += WEIGHTS.catalog;
    score += text.score * WEIGHTS.text;
    score += learned;
    if (score <= 0) continue;

    const reason = pickReason({
      isSequence,
      isNeighbor,
      reuse,
      domainMatch,
      isCatalog: cand.isCatalog,
      kind: text.kind,
    });
    scored.push({
      value: cand.value,
      reason,
      score,
      count: reason === 'usedBefore' ? reuse : undefined,
      domain: cand.domain,
      literal: LITERAL_KINDS.has(text.kind),
    });
  }

  scored.sort((a, b) => {
    // A literal letter match always ranks above a meaning-only match, so typing
    // never surfaces an unrelated-looking word above what the letters match.
    if (a.literal !== b.literal) return a.literal ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    if (a.value.length !== b.value.length) return a.value.length - b.value.length;
    return a.value.localeCompare(b.value);
  });
  return scored.slice(0, limit).map((s) => ({
    value: s.value,
    reason: s.reason,
    score: s.score,
    count: s.count,
    domain: s.domain,
  }));
}

/**
 * The inline ghost completion for the top suggestion, or null when the top
 * suggestion is not confident enough or cannot be completed from the typed text.
 */
export function computeGhost(
  currentText: string,
  suggestions: LabelSuggestion[]
): LabelGhost | null {
  if (suggestions.length === 0) return null;
  const top = suggestions[0];
  if (top.score < GHOST_MIN_SCORE) return null;
  // Match against the literal field text (not trimmed) so the completion is
  // sliced at the true caret offset — trimming here would misalign the ghost.
  if (!top.value.toLowerCase().startsWith(currentText.toLowerCase())) return null;
  const completion = top.value.slice(currentText.length);
  if (!completion) return null;
  return { value: top.value, completion };
}

function pickReason(x: {
  isSequence: boolean;
  isNeighbor: boolean;
  reuse: number;
  domainMatch: boolean;
  isCatalog: boolean;
  kind: TextKind;
}): SuggestionReason {
  if (x.isSequence) return 'nextInSet';
  if (x.isNeighbor) return 'matchesNeighbors';
  if (x.reuse > 0) return 'usedBefore';
  if (x.domainMatch || x.kind === 'alias' || x.kind === 'fuzzy' || x.kind === 'semantic')
    return 'similar';
  return 'catalog';
}

function textScore(value: string, query: string): TextMatch {
  const v = value.toLowerCase();
  if (!query || v === query) return { score: 0, kind: 'none' };
  if (v.startsWith(query)) return { score: 1.0, kind: 'prefix' };
  if (v.includes(query)) return { score: 0.6, kind: 'substring' };

  // Cross-language / alias match: the query normalizes to the same canonical
  // term as the candidate (e.g. "vis" → screw, "schraube" → screw).
  const qNorm = processLabel(query);
  if (qNorm.normalized && qNorm.confidence >= 0.8) {
    const vNorm = processLabel(value).normalized;
    if (vNorm && vNorm === qNorm.normalized) return { score: 0.7, kind: 'alias' };
  }

  // Typo tolerance for near-complete words.
  if (query.length >= 3) {
    const dist = editDistance(v, query);
    const maxLen = Math.max(v.length, query.length);
    if (dist <= FUZZY_MAX_DISTANCE && maxLen > 0 && dist / maxLen <= 0.34) {
      return { score: 0.4 * (1 - dist / maxLen), kind: 'fuzzy' };
    }
  }
  return { score: 0, kind: 'none' };
}

/** Edge-share adjacency (mirrors `areBinsAdjacent` in layoutPatterns.ts). */
function edgeAdjacent(a: SuggestionBin, b: SuggestionBin): boolean {
  const aRight = a.x + a.width;
  const aTop = a.y + a.depth;
  const bRight = b.x + b.width;
  const bTop = b.y + b.depth;

  const vOverlap = Math.max(0, Math.min(aTop, bTop) - Math.max(a.y, b.y));
  if ((aRight === b.x || bRight === a.x) && vOverlap > 0) return true;

  const hOverlap = Math.max(0, Math.min(aRight, bRight) - Math.max(a.x, b.x));
  if ((aTop === b.y || bTop === a.y) && hOverlap > 0) return true;

  return false;
}

function pickDominant(tally: Map<LabelDomain, number>): LabelDomain | null {
  let best: LabelDomain | null = null;
  let bestCount = 0;
  for (const [domain, count] of tally) {
    if (count > bestCount) {
      best = domain;
      bestCount = count;
    }
  }
  return best;
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let cur = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
