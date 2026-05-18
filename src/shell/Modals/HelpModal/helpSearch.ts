/**
 * Token-based search for the Help modal. Matches the user's query against
 * entry titles, keyword synonyms, descriptions, and id paths — ranking
 * title hits highest and id-path hits lowest (the latter exists as an
 * English-fallback safety net).
 *
 * Word-boundary matching is intentional: "bed" must match "print bed size"
 * but not "embedded". Tokens match by prefix within word boundaries so
 * partial typing ("set" → "settings") still ranks.
 */

import type { TFunction } from '@/i18n/context';
import { KEYWORDS_DELIMITER, type HelpEntry } from './helpEntry';

const SCORE = {
  TITLE_FULL: 100,
  TITLE_PREFIX: 60,
  KEYWORD_FULL: 80,
  KEYWORD_PREFIX: 50,
  DESCRIPTION: 25,
  ID_PATH: 10,
} as const;

const TOKEN_BOUNDARY = /[\s\-_/,.;:!?()[\]{}'"]+/g;

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(TOKEN_BOUNDARY)
    .filter((token) => token.length > 0);
}

function scoreTokenAgainstField(
  queryToken: string,
  fieldTokens: readonly string[],
  fullScore: number,
  prefixScore: number
): number {
  let best = 0;
  for (const token of fieldTokens) {
    if (token === queryToken) {
      best = Math.max(best, fullScore);
    } else if (token.startsWith(queryToken) && queryToken.length >= 2) {
      best = Math.max(best, prefixScore);
    }
  }
  return best;
}

interface ResolvedEntryFields {
  title: string[];
  keywords: string[];
  description: string[];
  idPath: string[];
}

function resolveEntryFields(entry: HelpEntry, t: TFunction): ResolvedEntryFields {
  const title = tokenize(t(entry.titleKey));
  const description = tokenize(t(entry.descriptionKey));
  const idPath = tokenize(entry.id.replace(/[-_/]/g, ' '));
  const keywords = entry.keywordsKey
    ? tokenize(t(entry.keywordsKey).split(KEYWORDS_DELIMITER).join(' '))
    : [];

  // Shortcut entries also match on their key sequences ("Z" finds Undo) — the
  // old substring-based search supported this; the new tokenized search must
  // preserve it. Treated as keyword-strength signals.
  if (entry.kind === 'shortcut') {
    const keyTokens = (Array.isArray(entry.keys) ? entry.keys : [entry.keys]).flatMap(tokenize);
    keywords.push(...keyTokens);
  }
  return { title, keywords, description, idPath };
}

export interface RankedEntry<E extends HelpEntry = HelpEntry> {
  entry: E;
  score: number;
}

export function searchHelpEntries<E extends HelpEntry>(
  entries: readonly E[],
  query: string,
  t: TFunction
): RankedEntry<E>[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const ranked: RankedEntry<E>[] = [];

  for (const entry of entries) {
    const fields = resolveEntryFields(entry, t);
    let score = 0;
    let matchedAllTokens = true;

    for (const queryToken of queryTokens) {
      const tokenScore = Math.max(
        scoreTokenAgainstField(queryToken, fields.title, SCORE.TITLE_FULL, SCORE.TITLE_PREFIX),
        scoreTokenAgainstField(
          queryToken,
          fields.keywords,
          SCORE.KEYWORD_FULL,
          SCORE.KEYWORD_PREFIX
        ),
        scoreTokenAgainstField(
          queryToken,
          fields.description,
          SCORE.DESCRIPTION,
          SCORE.DESCRIPTION
        ),
        scoreTokenAgainstField(queryToken, fields.idPath, SCORE.ID_PATH, SCORE.ID_PATH)
      );

      if (tokenScore === 0) {
        matchedAllTokens = false;
        break;
      }
      score += tokenScore;
    }

    if (matchedAllTokens && score > 0) {
      ranked.push({ entry, score });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
