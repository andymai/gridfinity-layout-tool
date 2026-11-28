/**
 * The cards set parts of one translated string in different type roles: a
 * label above a value, or a value above the words around it. These helpers
 * find the parts in the finished string, so no translation changes, and each
 * returns null when the string has another shape, so the caller keeps it whole.
 */

const COLON = /[:：]/;
/** Punctuation that stays with the value it follows. */
const TRAILING = /^[.,;。、，！？!?)）]+/;

const SENTENCE_END = /[.!?。！？]/;

/** Sentences, each with its own end punctuation. */
export function sentences(text: string, locale: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(
      new Intl.Segmenter(locale, { granularity: 'sentence' }).segment(text),
      (part) => part.segment.trim()
    ).filter(Boolean);
  }
  // No lookbehind: Safari before 16.4 rejects it, and that would stop the whole module.
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (SENTENCE_END.test(text.charAt(i)) && /\s/.test(text.charAt(i + 1))) {
      parts.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

export interface LabelSplit {
  /** Up to and including the colon. */
  readonly label: string;
  /** Everything after it. */
  readonly rest: string;
}

/** "Longest print: 27 hr" into its label and the value, at the last colon before the value. */
export function splitAtLabel(text: string, value: string): LabelSplit | null {
  const at = text.indexOf(value);
  if (at <= 0) return null;
  const before = text.slice(0, at);
  let colon = -1;
  for (let i = before.length - 1; i >= 0; i--) {
    if (COLON.test(before.charAt(i))) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const label = text.slice(0, colon + 1).trim();
  const rest = text.slice(colon + 1).trim();
  return label && rest ? { label, rest } : null;
}

export interface ValueSplit {
  readonly before: string;
  /** The value with any punctuation that closes it. */
  readonly value: string;
  readonly after: string;
}

/** "966 × 798 mm. “Workbench”" into the value, its full stop, and the words around it. */
export function splitAroundValue(text: string, value: string): ValueSplit | null {
  const at = text.indexOf(value);
  if (at < 0 || !value) return null;
  const tail = text.slice(at + value.length);
  const closing = TRAILING.exec(tail)?.[0] ?? '';
  return {
    before: text.slice(0, at).trim(),
    value: value + closing,
    after: tail.slice(closing.length).trim(),
  };
}
