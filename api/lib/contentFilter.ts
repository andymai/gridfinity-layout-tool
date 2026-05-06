/**
 * Content filter for detecting offensive content in shared layouts.
 * Uses blocklist + pattern matching on user-generated text fields.
 */

// Common offensive terms blocklist (lowercase)
// This is a minimal set - in production, use a more comprehensive list or external service
const BLOCKLIST = new Set([
  // Slurs and hate speech (abbreviated list)
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'retard',
  'spic',
  'chink',
  'kike',
  'tranny',
  'dyke',
  'cunt',
  'twat',
  // Violence
  'kill yourself',
  'kys',
  // Other harmful content
  'cp ',
  'child porn',
]);

// Patterns that suggest harmful content
const HARMFUL_PATTERNS = [
  // Potential XSS attempts (shouldn't execute but signals bad intent)
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
  // URLs (could be phishing/malicious)
  /https?:\/\/[^\s]+/i,
  // Repeated characters suggesting spam
  /(.)\1{10,}/,
  // Zalgo text (combining characters spam)
  /[\u0300-\u036f]{5,}/,
];

export interface ContentFilterResult {
  passed: boolean;
  reason?: string;
}

/**
 * Check text fields in a layout for offensive content.
 */
export function filterLayoutContent(layout: {
  name: string;
  bins: Array<{ label?: string; notes?: string; customProperties?: Record<string, string> }>;
  categories: Array<{ name: string }>;
}): ContentFilterResult {
  // Check layout name
  const nameResult = checkText(layout.name);
  if (!nameResult.passed) {
    return { passed: false, reason: `Layout name: ${nameResult.reason}` };
  }

  // Check category names
  for (const category of layout.categories) {
    const catResult = checkText(category.name);
    if (!catResult.passed) {
      return { passed: false, reason: `Category "${category.name}": ${catResult.reason}` };
    }
  }

  // Check bin labels and notes
  for (const bin of layout.bins) {
    if (bin.label) {
      const labelResult = checkText(bin.label);
      if (!labelResult.passed) {
        return { passed: false, reason: `Bin label: ${labelResult.reason}` };
      }
    }
    if (bin.notes) {
      const notesResult = checkText(bin.notes);
      if (!notesResult.passed) {
        return { passed: false, reason: `Bin notes: ${notesResult.reason}` };
      }
    }
    if (bin.customProperties) {
      for (const [key, value] of Object.entries(bin.customProperties)) {
        const keyResult = checkText(key);
        if (!keyResult.passed) {
          return { passed: false, reason: `Custom property key: ${keyResult.reason}` };
        }
        const valueResult = checkText(value);
        if (!valueResult.passed) {
          return { passed: false, reason: `Custom property value: ${valueResult.reason}` };
        }
      }
    }
  }

  return { passed: true };
}

// Confusable Latin-letter mapping for the small alphabet our blocklist needs.
// Covers Cyrillic and Greek homoglyphs that NFKD doesn't fold (decomposition
// only separates marks, it doesn't change script). Defense-in-depth on top
// of the report flow — not a complete confusables table.
//
// Scope is intentionally narrow: we map only characters that are visually
// indistinguishable from their Latin counterparts in common UI fonts AND
// have no legitimate ASCII-text use. Digits and punctuation (@, $, !, 5,
// 7, etc.) are deliberately NOT mapped — they appear in legitimate layout
// names like "Bin 1/4 inch" or "@home storage" and would rewrite ordinary
// text into unpredictable strings as the blocklist grows. Only the four
// classic leetspeak digit substitutions (0/1/3/4) are kept because those
// appear most often in actual bypass attempts.
const CONFUSABLE_TO_LATIN: Record<string, string> = {
  // Cyrillic
  а: 'a',
  в: 'b',
  с: 'c',
  е: 'e',
  һ: 'h',
  і: 'i',
  ј: 'j',
  к: 'k',
  м: 'm',
  о: 'o',
  р: 'p',
  ѕ: 's',
  т: 't',
  у: 'y',
  х: 'x',
  // Greek
  α: 'a',
  β: 'b',
  ε: 'e',
  ι: 'i',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  // Classic leetspeak digit substitutions (kept narrow — see note above)
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
};

// Strip zero-width (U+200B–U+200D, U+FEFF) and combining marks (U+0300–U+036F).
// Unicode escapes (not literal characters) so the source stays ASCII-only.
const INVISIBLE_AND_COMBINING = new RegExp('[\u0300-\u036f\u200B-\u200D\uFEFF]', 'g');

/**
 * Normalize text for blocklist matching. NFKD decomposes precomposed accents
 * AND folds compatibility forms (fullwidth, ligatures); zero-width and combining
 * marks are then stripped; confusable Latin look-alikes are mapped back to ASCII.
 *
 * NFKD (not NFKC) is required: NFKC would re-compose `n` + COMBINING_ACUTE
 * back into `ń`, leaving the combining mark unreachable to the strip step.
 */
function normalizeForBlocklist(text: string): string {
  const folded = text.normalize('NFKD').toLowerCase().replace(INVISIBLE_AND_COMBINING, '');
  let out = '';
  for (const ch of folded) {
    out += CONFUSABLE_TO_LATIN[ch] ?? ch;
  }
  return out.trim();
}

/**
 * Check a single text string for offensive content.
 */
function checkText(text: string): ContentFilterResult {
  const normalized = normalizeForBlocklist(text);

  // Check blocklist against the normalized form so Unicode tricks
  // (homoglyphs, zero-width chars, fullwidth, combining marks) can't bypass.
  for (const term of BLOCKLIST) {
    if (normalized.includes(term)) {
      return { passed: false, reason: 'contains prohibited content' };
    }
  }

  // Pattern matching runs against the *raw* text — the zalgo detector
  // explicitly looks for combining-mark spam, which normalization would erase.
  for (const pattern of HARMFUL_PATTERNS) {
    if (pattern.test(text)) {
      return { passed: false, reason: 'contains prohibited patterns' };
    }
  }

  return { passed: true };
}

/**
 * Increment report count for a share.
 * If threshold exceeded, content should be reviewed/removed.
 */
export const REPORT_THRESHOLD = 5;
