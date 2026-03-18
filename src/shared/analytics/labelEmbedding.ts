/**
 * Label Embedding Buckets for ML Telemetry
 *
 * Provides semantic bucketing for labels to enable similarity-based
 * aggregation even for unknown labels. This allows the ML model to
 * learn patterns like "labels of type X tend to be in bins of size Y".
 *
 * Privacy: Only structural features are captured, not the actual content.
 */

// LENGTH BUCKETS

/**
 * Compute length bucket (2 bits of information).
 * short: 1-4 chars, medium: 5-12 chars, long: 13+ chars
 */
function getLengthBucket(label: string): number {
  if (label.length <= 4) return 0; // short
  if (label.length <= 12) return 1; // medium
  return 2; // long
}

// CHARACTER CLASS DETECTION

/**
 * Detect the dominant character class (2 bits of information).
 * 0: alpha (mostly letters)
 * 1: numeric (mostly numbers)
 * 2: alphanumeric (mixed letters and numbers)
 * 3: special (contains significant punctuation/symbols)
 */
function getCharacterClass(label: string): number {
  let letters = 0;
  let digits = 0;
  let special = 0;

  for (const char of label) {
    if (/[a-zA-Z]/.test(char)) letters++;
    else if (/[0-9]/.test(char)) digits++;
    else if (!/\s/.test(char)) special++; // Non-whitespace special chars
  }

  const total = letters + digits + special;
  if (total === 0) return 0; // Empty or all whitespace

  // If >20% special characters, it's "special"
  if (special / total > 0.2) return 3;

  // If >80% letters, it's "alpha"
  if (letters / total > 0.8) return 0;

  // If >60% digits, it's "numeric"
  if (digits / total > 0.6) return 1;

  // Mixed
  return 2;
}

// N-GRAM FINGERPRINT

/**
 * Compute a simple n-gram based fingerprint (8 bits of information).
 * Uses character trigrams to capture structural patterns.
 */
function computeNgramFingerprint(label: string): number {
  const normalized = label.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized.length < 3) {
    // For very short labels, use character codes
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = (hash * 31 + normalized.charCodeAt(i)) & 0xff;
    }
    return hash;
  }

  // Extract trigrams
  const trigrams = new Set<string>();
  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.slice(i, i + 3));
  }

  // Hash the trigram set
  let hash = 0;
  for (const trigram of trigrams) {
    for (let i = 0; i < trigram.length; i++) {
      hash = (hash * 31 + trigram.charCodeAt(i)) & 0xffff;
    }
  }

  // Reduce to 8 bits
  return ((hash >> 8) ^ (hash & 0xff)) & 0xff;
}

// PATTERN DETECTION

/**
 * Detect common label patterns (2 bits of information).
 * 0: plain text
 * 1: measurement pattern (e.g., "M3x8", "1/4 inch")
 * 2: code pattern (e.g., "AA", "608ZZ", "WD-40")
 * 3: descriptive pattern (e.g., "red screwdriver", "small box")
 */
function getPatternType(label: string): number {
  // Measurement patterns: dimensions, sizes
  if (/\d+\s*(mm|cm|m|in|inch|"|'|x)\s*\d*/i.test(label)) return 1;
  if (/\bm\d+\b/i.test(label)) return 1; // M3, M4, etc. (word boundary to avoid "medium3")
  if (/\d+\/\d+/.test(label)) return 1; // Fractions like 1/4

  // Code patterns: short alphanumeric codes
  if (/^[A-Z0-9]{2,6}(-[A-Z0-9]+)*$/i.test(label.trim())) return 2;
  if (/\d{3,}[A-Z]{2,}/i.test(label)) return 2; // Like "608ZZ"

  // Descriptive patterns: adjective + noun
  if (/^(small|large|big|tiny|red|blue|green|black|white|old|new)\s+/i.test(label)) return 3;

  return 0;
}

// PUBLIC API

/**
 * Compute an embedding bucket for a label.
 * Returns a 4-character hex string that groups similar labels together
 * without revealing the actual label content.
 *
 * The bucket captures:
 * - Length class (short/medium/long)
 * - Character composition (alpha/numeric/mixed/special)
 * - Pattern type (plain/measurement/code/descriptive)
 * - N-gram fingerprint for structural similarity
 *
 * Labels with similar embedding buckets likely have similar characteristics,
 * enabling ML to learn "labels like this tend to be in bins of size X".
 *
 * @param label - Raw label string
 * @returns 4-character hex bucket identifier
 *
 * @example
 * computeEmbeddingBucket("screwdriver")  // alpha, medium length
 * computeEmbeddingBucket("M3x8 SHCS")    // measurement pattern
 * computeEmbeddingBucket("608ZZ")        // code pattern
 * computeEmbeddingBucket("small red box") // descriptive pattern
 */
export function computeEmbeddingBucket(label: string): string {
  const cleaned = label.trim();
  if (!cleaned) return '0000';

  // Combine features into 16 bits
  const lengthBucket = getLengthBucket(cleaned); // 2 bits
  const charClass = getCharacterClass(cleaned); // 2 bits
  const patternType = getPatternType(cleaned); // 2 bits
  const ngramFp = computeNgramFingerprint(cleaned); // 8 bits

  // Pack into 16-bit value:
  // [15:14] length | [13:12] charClass | [11:10] pattern | [9:8] unused | [7:0] ngram
  const bucket =
    ((lengthBucket & 0x3) << 14) |
    ((charClass & 0x3) << 12) |
    ((patternType & 0x3) << 10) |
    (ngramFp & 0xff);

  // Convert to 4-char hex
  return bucket.toString(16).padStart(4, '0');
}

/**
 * Decode an embedding bucket for debugging/analysis.
 * Returns human-readable description of the bucket features.
 *
 * @param bucket - 4-char hex bucket string
 * @returns Object with decoded features
 */
export function decodeEmbeddingBucket(bucket: string): {
  length: 'short' | 'medium' | 'long';
  charClass: 'alpha' | 'numeric' | 'alphanumeric' | 'special';
  pattern: 'plain' | 'measurement' | 'code' | 'descriptive';
  ngramHash: number;
} {
  const value = parseInt(bucket, 16);

  const lengthBucket = (value >> 14) & 0x3;
  const charClass = (value >> 12) & 0x3;
  const patternType = (value >> 10) & 0x3;
  const ngramHash = value & 0xff;

  const lengths = ['short', 'medium', 'long', 'long'] as const;
  const charClasses = ['alpha', 'numeric', 'alphanumeric', 'special'] as const;
  const patterns = ['plain', 'measurement', 'code', 'descriptive'] as const;

  return {
    length: lengths[lengthBucket],
    charClass: charClasses[charClass],
    pattern: patterns[patternType],
    ngramHash,
  };
}
