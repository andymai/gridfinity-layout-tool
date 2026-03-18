import { computeEmbeddingBucket } from '../labelEmbedding';
import { VOCABULARY, TERM_DOMAINS } from './vocabulary';
import type { LabelDomain } from './vocabulary';

/**
 * Build reverse lookup map for O(1) matching.
 * Maps each alias to its canonical term.
 */
const ALIAS_MAP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(VOCABULARY)) {
  for (const alias of aliases) {
    ALIAS_MAP.set(alias.toLowerCase(), canonical);
  }
}

// LABEL PROCESSING CACHE

/**
 * Cache for processLabel results.
 * Avoids repeated expensive partial matching for the same labels.
 * Max size prevents unbounded memory growth.
 */
const LABEL_CACHE_MAX_SIZE = 500;
const labelCache = new Map<string, LabelData>();

/**
 * Clear the label cache.
 * Useful for testing or when vocabulary changes.
 */
export function clearLabelCache(): void {
  labelCache.clear();
}

/**
 * Simple hash function for labels.
 * Returns first 8 chars of a basic hash - enough for grouping, not reversible.
 *
 * This is the PRIMARY identifier for labels - vocabulary is just enrichment.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to hex and take first 8 chars
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

export interface LabelData {
  /**
   * Hash of the label - ALWAYS populated.
   * This is the primary grouping key that works for ANY label in ANY language.
   * Identical labels will have identical hashes, enabling aggregation.
   */
  hash: string;

  /**
   * Canonical term from vocabulary, or null if not recognized.
   * This is optional enrichment - absence doesn't mean the label is invalid.
   */
  normalized: string | null;

  /**
   * Domain category for the label, or null if not recognized.
   * Useful for broader aggregation (e.g., "all tools" vs specific tool).
   */
  domain: LabelDomain | null;

  /**
   * Confidence of the vocabulary match.
   * 1.0 = exact match, 0.8 = partial match (label contains alias),
   * 0.7 = reverse partial (alias contains label), 0 = no match
   */
  confidence: number;

  /**
   * Embedding bucket for semantic similarity grouping.
   * 4-char hex encoding structural features (length, char class, pattern, n-gram).
   * Enables ML to learn "labels like this tend to be in bins of size X".
   */
  embedding_bucket: string;
}

/**
 * Process a user-entered label for ML telemetry.
 *
 * HASH-FIRST STRATEGY:
 * - Hash is ALWAYS computed and is the primary grouping mechanism
 * - Vocabulary matching is optional enrichment
 * - Unknown labels still contribute to the data via their hash
 *
 * This approach works for:
 * - Any language (hash groups identical labels regardless of language)
 * - Any domain (makeup, hardware, fishing, etc.)
 * - Specialized terminology (M3x8 SHCS, MAC Ruby Woo, etc.)
 *
 * Results are cached to avoid repeated expensive partial matching.
 * Cache size is bounded to prevent unbounded memory growth.
 *
 * @param raw - Raw user input
 * @returns Label data with hash (always) and optional enrichment
 *
 * @example
 * // Known vocabulary term
 * processLabel("Phillips Head Screwdriver")
 * // → { hash: "a3f2b1c4", normalized: "screwdriver", domain: "tools", confidence: 0.8 }
 *
 * @example
 * // Unknown specialized term - still tracked via hash!
 * processLabel("M3x8 SHCS")
 * // → { hash: "d4e5f6a7", normalized: null, domain: null, confidence: 0 }
 *
 * @example
 * // Non-English term that matches vocabulary
 * processLabel("Schraubenzieher")
 * // → { hash: "b2c3d4e5", normalized: "screwdriver", domain: "tools", confidence: 1.0 }
 */
export function processLabel(raw: string): LabelData {
  const cleaned = raw.toLowerCase().trim();

  // Check cache first
  const cached = labelCache.get(cleaned);
  if (cached) {
    return cached;
  }

  const hash = simpleHash(cleaned);
  const embedding_bucket = computeEmbeddingBucket(raw); // Use original casing for embedding

  if (!cleaned) {
    const result: LabelData = {
      hash,
      normalized: null,
      domain: null,
      confidence: 0,
      embedding_bucket,
    };
    cacheResult(cleaned, result);
    return result;
  }

  const exactMatch = ALIAS_MAP.get(cleaned);
  if (exactMatch) {
    const result: LabelData = {
      hash,
      normalized: exactMatch,
      domain: TERM_DOMAINS[exactMatch] ?? null,
      confidence: 1.0,
      embedding_bucket,
    };
    cacheResult(cleaned, result);
    return result;
  }

  for (const [alias, canonical] of ALIAS_MAP) {
    if (alias.length >= 3 && cleaned.includes(alias)) {
      const result: LabelData = {
        hash,
        normalized: canonical,
        domain: TERM_DOMAINS[canonical] ?? null,
        confidence: 0.8,
        embedding_bucket,
      };
      cacheResult(cleaned, result);
      return result;
    }
  }

  if (cleaned.length >= 4) {
    for (const [alias, canonical] of ALIAS_MAP) {
      if (alias.includes(cleaned)) {
        const result: LabelData = {
          hash,
          normalized: canonical,
          domain: TERM_DOMAINS[canonical] ?? null,
          confidence: 0.7,
          embedding_bucket,
        };
        cacheResult(cleaned, result);
        return result;
      }
    }
  }

  const result: LabelData = {
    hash,
    normalized: null,
    domain: null,
    confidence: 0,
    embedding_bucket,
  };
  cacheResult(cleaned, result);
  return result;
}

/**
 * Add a result to the cache, evicting oldest entries if full.
 * Uses simple FIFO eviction for simplicity.
 */
function cacheResult(key: string, value: LabelData): void {
  // Evict oldest entries if cache is full
  if (labelCache.size >= LABEL_CACHE_MAX_SIZE) {
    // Delete first 10% of entries (FIFO eviction)
    const toDelete = Math.ceil(LABEL_CACHE_MAX_SIZE * 0.1);
    const keys = labelCache.keys();
    for (let i = 0; i < toDelete; i++) {
      const next = keys.next();
      if (!next.done) {
        labelCache.delete(next.value);
      }
    }
  }
  labelCache.set(key, value);
}

/**
 * Get all canonical terms in the vocabulary.
 * Useful for debugging or UI display.
 */
export function getCanonicalTerms(): string[] {
  return Object.keys(VOCABULARY).sort();
}

/**
 * Check if a canonical term exists in the vocabulary.
 */
export function isKnownTerm(term: string): boolean {
  return Object.hasOwn(VOCABULARY, term);
}

/**
 * Get the domain for a canonical term.
 */
export function getTermDomain(term: string): LabelDomain | null {
  return TERM_DOMAINS[term] ?? null;
}
