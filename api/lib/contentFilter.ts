/**
 * Content filter for detecting offensive content in shared layouts.
 * Uses blocklist + pattern matching on user-generated text fields.
 */

// Matched as whole words in normalized text, so a term inside a longer word
// ("spic" in "Spices", "retard" in "retardant") never blocks. An inflected
// form only matches if it is listed here.
//
// Leave "cp" out: in maker text it is centipoise, chrome-plated or the Chicago
// Pneumatic tool brand, and no word rule tells those apart from the slang.
const BLOCKLIST = new Set([
  // Slurs and hate speech (abbreviated list)
  'nigga',
  'niggas',
  'niggaz',
  'fag',
  'fags',
  'retard',
  'retards',
  'retarded',
  'spic',
  'spics',
  'chink',
  'chinks',
  'kike',
  'kikes',
  'tranny',
  'trannies',
  'dyke',
  'dykes',
  'cunt',
  'cunts',
  'twat',
  'twats',
  // Violence
  'kys',
]);

// Matched anywhere in normalized text with every separator removed, so a
// compound ("niggerish") or a joined phrase ("killyourself") still blocks.
//
// A term belongs here only if no string in the app's locales or label
// vocabulary contains it. "cunt" fails that ("Aucun trou" joins across the
// space). "nigga" stays out because the only longer words that hold it are
// "niggardly" and its kin. The known cost: "snigger", "faggoting" and
// "skill yourself" block.
const ANYWHERE_TERMS = [
  'nigger',
  'faggot',
  // Phrases, written without their spaces
  'killyourself',
  'childporn',
];

// Patterns that suggest harmful content.
//
// Quantifiers here are bounded on purpose. `/on\w+\s*=/` backtracks
// quadratically on input like "ononon…" (each "on" is a candidate start, and
// the greedy \w+ walks the rest before failing to find "="), which is a
// polynomial ReDoS on any caller that passes unbounded user text. Real inline
// handlers are `onclick`/`onmouseover`-shaped, so the caps cost no detection.
const HARMFUL_PATTERNS = [
  // Potential XSS attempts (shouldn't execute but signals bad intent)
  /<script/i,
  /javascript:/i,
  // An HTML attribute name starts after whitespace, "/" or a quote, never
  // mid-word, so the \b keeps every real handler and lets "Connector=JST"
  // through. The shortest handlers are oncut and onend.
  /\bon[a-z]{3,20}\s{0,10}=/i,
  // URLs (could be phishing/malicious)
  /https?:\/\/[^\s]+/i,
  // Scheme-less links. Bare hosts stay allowed: "bracket.stl" and
  // "README.md" have the same shape as a domain. \p{M} is there because
  // scripts such as Devanagari write vowels as marks (".भारत").
  /\bwww\.[\p{L}\p{M}\p{N}-]{1,63}\.\p{L}[\p{L}\p{M}\p{N}]/iu,
  // Repeated characters suggesting spam
  /(.)\1{10,}/,
  // Zalgo text (combining characters spam)
  /[\u0300-\u036f]{5,}/,
];

/**
 * The kind of user text a block came from, sent as the CONTENT_BLOCKED body's
 * `field` so the client can name it.
 *
 * MIRROR: `BLOCKED_FIELD_KEYS` in `src/features/cloud-share/hooks/useCloudShare.ts`.
 */
export type ContentField =
  | 'layoutName'
  | 'category'
  | 'binLabel'
  | 'binNotes'
  | 'binItem'
  | 'binProperty'
  | 'linkedDesign'
  | 'authorName';

export interface ContentFilterResult {
  passed: boolean;
  reason?: string;
  field?: ContentField;
}

/**
 * Check text fields in a layout for offensive content.
 */
export function filterLayoutContent(layout: {
  name: string;
  bins: Array<{
    label?: string;
    notes?: string;
    customProperties?: Record<string, string>;
    items?: Array<{ name: string; note?: string }>;
  }>;
  categories: Array<{ name: string }>;
}): ContentFilterResult {
  const nameResult = checkText(layout.name);
  if (!nameResult.passed) {
    return { passed: false, reason: `Layout name: ${nameResult.reason}`, field: 'layoutName' };
  }

  // Check category names
  for (const category of layout.categories) {
    const catResult = checkText(category.name);
    if (!catResult.passed) {
      return {
        passed: false,
        reason: `Category "${category.name}": ${catResult.reason}`,
        field: 'category',
      };
    }
  }

  // Check bin labels and notes
  for (const bin of layout.bins) {
    if (bin.label) {
      const labelResult = checkText(bin.label);
      if (!labelResult.passed) {
        return { passed: false, reason: `Bin label: ${labelResult.reason}`, field: 'binLabel' };
      }
    }
    if (bin.notes) {
      const notesResult = checkText(bin.notes);
      if (!notesResult.passed) {
        return { passed: false, reason: `Bin notes: ${notesResult.reason}`, field: 'binNotes' };
      }
    }
    if (bin.customProperties) {
      for (const [key, value] of Object.entries(bin.customProperties)) {
        const keyResult = checkText(key);
        if (!keyResult.passed) {
          return {
            passed: false,
            reason: `Custom property key: ${keyResult.reason}`,
            field: 'binProperty',
          };
        }
        const valueResult = checkText(value);
        if (!valueResult.passed) {
          return {
            passed: false,
            reason: `Custom property value: ${valueResult.reason}`,
            field: 'binProperty',
          };
        }
      }
    }
    for (const item of bin.items ?? []) {
      for (const text of [item.name, item.note]) {
        if (!text) continue;
        const itemResult = checkText(text);
        if (!itemResult.passed) {
          return { passed: false, reason: `Bin item: ${itemResult.reason}`, field: 'binItem' };
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

const NOT_A_LETTER = /[^a-z]+/g;

/**
 * Normalize text for blocklist matching. NFKD decomposes precomposed accents
 * AND folds compatibility forms (fullwidth, ligatures); zero-width and combining
 * marks are then stripped; confusable Latin look-alikes are mapped back to ASCII.
 *
 * NFKD (not NFKC) is required: NFKC would re-compose `n` + COMBINING_ACUTE
 * back into `ń`, leaving the combining mark unreachable to the strip step.
 *
 * Returns the words with one space between them and one at each end, so
 * `includes(' term ')` only hits whole words. Any character the folding left
 * outside a-z separates words: punctuation, "_", and digits other than 0/1/3/4.
 */
function normalizeForBlocklist(text: string): string {
  const folded = text.normalize('NFKD').toLowerCase().replace(INVISIBLE_AND_COMBINING, '');
  let out = '';
  for (const ch of folded) {
    out += CONFUSABLE_TO_LATIN[ch] ?? ch;
  }
  return ` ${out.replace(NOT_A_LETTER, ' ').trim()} `;
}

/**
 * Check a single user-supplied display name (e.g. a Ko-fi `from_name`) before
 * it renders on a public page.
 *
 * Same gate as layout text. Callers should treat a failure as "show this
 * person as anonymous", not "drop them" — the name is untrusted, the
 * supporter isn't.
 */
export function filterDisplayName(name: string): ContentFilterResult {
  return checkText(name);
}

/**
 * Check a single text string for offensive content.
 *
 * Exported for free-text fields (e.g. a community design description) that
 * aren't display names. Callers must bound the string's length BEFORE calling:
 * the harmful-pattern regexes are only safe on capped input (see the ReDoS
 * note above HARMFUL_PATTERNS).
 */
export function checkText(text: string): ContentFilterResult {
  const normalized = normalizeForBlocklist(text);

  // Check blocklist against the normalized form so Unicode tricks
  // (homoglyphs, zero-width chars, fullwidth, combining marks) can't bypass.
  for (const term of BLOCKLIST) {
    if (normalized.includes(` ${term} `)) {
      return { passed: false, reason: 'contains prohibited content' };
    }
  }
  const letters = normalized.replace(/ /g, '');
  for (const term of ANYWHERE_TERMS) {
    if (letters.includes(term)) {
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
 * Object keys whose *string* values are user-authored prose rendered to the
 * recipient — engraved surface text, cutout labels. Keyed rather than scanning
 * every string so enum values, hex colours, font names and ids don't get run
 * through the blocklist.
 *
 * Every one of these is engraved into geometry the recipient sees, so adding a
 * new user-authored text field to `BinParams` means adding its key here. The
 * designer validators accept the field either way; this set is the only thing
 * that decides whether it is moderated.
 */
const TEXT_BEARING_KEYS = new Set([
  'text',
  'label',
  'name',
  // surfaceText.lidText, surfaceText.floorText, surfaceText.walls.{front,back,left,right}
  'lidText',
  'floorText',
  'front',
  'back',
  'left',
  'right',
  // Arrays of strings: compartments.compartmentTexts[], label.rowTexts[]
  'compartmentTexts',
  'rowTexts',
]);

/** Bounds the walk over attacker-supplied params (depth and total strings). */
const MAX_PARAM_DEPTH = 8;
const MAX_TEXT_FIELDS = 500;

/**
 * Collect one past the cap so a caller can tell "exactly at the cap, fully
 * collected" from "truncated". Without the sentinel those are the same length
 * and truncation is undetectable.
 */
const COLLECT_LIMIT = MAX_TEXT_FIELDS + 1;

/**
 * Collect user-authored strings nested anywhere inside a design's params.
 *
 * A string reached through an array carries its ARRAY's key, not its index —
 * `compartmentTexts[3]` is prose because `compartmentTexts` is a text-bearing
 * key. Without threading that key down, array elements hit the "not an object"
 * return and every entry of `compartmentTexts` / `rowTexts` escaped the filter.
 */
function collectDesignText(value: unknown, out: string[], depth = 0, key?: string): void {
  if (depth > MAX_PARAM_DEPTH || out.length >= COLLECT_LIMIT) return;

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (out.length >= COLLECT_LIMIT) return;
      if (typeof entry === 'string') {
        if (key !== undefined && TEXT_BEARING_KEYS.has(key)) out.push(entry);
      } else {
        collectDesignText(entry, out, depth + 1, key);
      }
    }
    return;
  }
  if (typeof value !== 'object' || value === null) return;

  for (const [nestedKey, nested] of Object.entries(value)) {
    if (out.length >= COLLECT_LIMIT) return;
    if (typeof nested === 'string') {
      if (TEXT_BEARING_KEYS.has(nestedKey)) out.push(nested);
    } else {
      collectDesignText(nested, out, depth + 1, nestedKey);
    }
  }
}

/**
 * Check the bin designs travelling with a shared layout.
 *
 * Design names and the text engraved into their geometry are user-authored and
 * shown to whoever opens the link, so they need the same moderation the layout
 * itself gets — otherwise `linkedDesigns` is a way around it.
 */
export function filterSharedDesignsContent(
  designs: ReadonlyArray<{ name: string; params?: unknown }>
): ContentFilterResult {
  for (const design of designs) {
    const nameResult = checkText(design.name);
    if (!nameResult.passed) {
      return { passed: false, reason: `Design name: ${nameResult.reason}`, field: 'linkedDesign' };
    }

    const result = filterDesignParamsContent(design.params);
    if (!result.passed) {
      return {
        passed: false,
        reason: `Design "${design.name}" text: ${result.reason}`,
        field: 'linkedDesign',
      };
    }
  }

  return { passed: true };
}

/**
 * Check the engraved text inside one design's params.
 *
 * Split out of `filterSharedDesignsContent` so the standalone designer share
 * (`POST /api/share` with `type: 'designer'`) runs the same gate: its params
 * carry exactly the same user-authored text, and it only ever passed through
 * structural validation. Two filter implementations would drift; one cannot.
 */
export function filterDesignParamsContent(params: unknown): ContentFilterResult {
  const texts: string[] = [];
  collectDesignText(params, texts);

  // Fail CLOSED on truncation. The walk stops at the cap, so passing what it
  // did collect would let an attacker pad the first MAX_TEXT_FIELDS entries
  // with benign strings and park the blocked content past the cutoff — the
  // filter would report "passed" on text it never looked at. No legitimate
  // design comes close: the engraved-text fields are individually bounded
  // (MAX_COMPARTMENT_GRID, MAX_INSERTS, six surfaceText fields). Mesh names
  // and labels have no count cap of their own: a design needs a couple of
  // hundred meshes, each far below the import detail, to reach this one.
  if (texts.length > MAX_TEXT_FIELDS) {
    return { passed: false, reason: 'contains too many text fields to moderate' };
  }

  for (const text of texts) {
    const result = checkText(text);
    if (!result.passed) return result;
  }
  return { passed: true };
}

/**
 * Increment report count for a share.
 * If threshold exceeded, content should be reviewed/removed.
 */
export const REPORT_THRESHOLD = 5;
