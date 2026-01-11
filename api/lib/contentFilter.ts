/**
 * Content filter for detecting offensive content in shared layouts.
 * Uses blocklist + pattern matching on user-generated text fields.
 */

// Common offensive terms blocklist (lowercase)
// This is a minimal set - in production, use a more comprehensive list or external service
const BLOCKLIST = new Set([
  // Slurs and hate speech (abbreviated list)
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'spic', 'chink', 'kike',
  'tranny', 'dyke', 'cunt', 'twat',
  // Violence
  'kill yourself', 'kys',
  // Other harmful content
  'cp ', 'child porn',
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
  bins: Array<{ label?: string; notes?: string }>;
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
  }

  return { passed: true };
}

/**
 * Check a single text string for offensive content.
 */
function checkText(text: string): ContentFilterResult {
  const normalized = text.toLowerCase().trim();

  // Check blocklist
  for (const term of BLOCKLIST) {
    if (normalized.includes(term)) {
      return { passed: false, reason: 'contains prohibited content' };
    }
  }

  // Check harmful patterns
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
