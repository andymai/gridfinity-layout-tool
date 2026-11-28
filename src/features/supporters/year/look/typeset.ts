import { clampLines } from '../utils/shareText';
import { DISPLAY, TEXT, familyFor, isLooseScript } from './fonts';

export interface FontSpec {
  /** A CSS family list. */
  readonly family: string;
  readonly weight: number;
  /** px in the 1080-wide card. */
  readonly size: number;
  /** px. */
  readonly lineHeight: number;
  /** Letter spacing in em; the display face sets a touch tight. */
  readonly tracking?: number;
}

export const DISPLAY_TRACKING = -0.01;

export function cssFont(font: FontSpec): string {
  return `${font.weight} ${font.size}px ${font.family}`;
}

/** Canvas letter spacing where the browser has it; elsewhere text sets a hair wider. */
export function applyTracking(ctx: CanvasRenderingContext2D, font: FontSpec): void {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(font.tracking ?? 0) * font.size}px`;
}

/** Text width in px for a font. */
export type Measure = (text: string, font: FontSpec) => number;

/**
 * The card's type scale, by role: the title, a line of copy, a smaller
 * reason, and the footer label.
 */
export type TextRole = 'title' | 'line' | 'small' | 'label';

export function roleFont(role: TextRole, locale: string): FontSpec {
  const loose = isLooseScript(locale);
  switch (role) {
    case 'title':
      return {
        tracking: DISPLAY_TRACKING,
        family: familyFor(DISPLAY, locale),
        weight: 900,
        size: 120,
        lineHeight: loose ? 136 : 108,
      };
    case 'line':
      return {
        family: familyFor(TEXT, locale),
        weight: 600,
        size: 56,
        lineHeight: loose ? 72 : 65,
      };
    case 'small':
      return {
        family: familyFor(TEXT, locale),
        weight: 500,
        size: 44,
        lineHeight: loose ? 58 : 54,
      };
    case 'label':
      return { family: familyFor(TEXT, locale), weight: 500, size: 34, lineHeight: 34 };
  }
}

export function withSize(font: FontSpec, size: number, lineHeight = size): FontSpec {
  return { ...font, size, lineHeight };
}

/** Characters set a full em wide: CJK, kana, hangul and full-width forms. */
const WIDE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}、-〿！-￯]/u;

/** A rough width for when no canvas can measure, as under jsdom. */
function estimate(text: string, font: FontSpec): number {
  let em = 0;
  for (const char of text) em += WIDE.test(char) ? 1 : 0.5;
  return em * font.size;
}

function canvasContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  try {
    return document.createElement('canvas').getContext('2d');
  } catch {
    return null;
  }
}

/** Canvas measurement with the same faces the page draws, or an estimate. */
export function createMeasure(): Measure {
  const context = canvasContext();
  if (!context) return estimate;
  const cache = new Map<string, number>();
  return (text, font) => {
    const key = `${cssFont(font)}|${text}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    context.font = cssFont(font);
    applyTracking(context, font);
    const width = context.measureText(text).width;
    cache.set(key, width);
    return width;
  };
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
/** Never starts a line in Japanese or Chinese. */
const CLOSING = /^[、。，．,.！？!?」』）)〉》】・ー：:；;…％%]+$/;
/** A particle or ending of one or two kana stays with the word before it, as a reader groups it. */
const PARTICLE = /^\p{Script=Hiragana}{1,2}$/u;
/** Never ends a line. */
const OPENING = /^[「『（(〈《【“‘]+$/;

function segment(word: string, locale: string): string[] {
  if (!CJK.test(word)) return [word];
  const parts =
    typeof Intl.Segmenter === 'function'
      ? Array.from(
          new Intl.Segmenter(locale, { granularity: 'word' }).segment(word),
          (s) => s.segment
        )
      : Array.from(word);
  const units: string[] = [];
  let carry = '';
  for (const part of parts) {
    if (OPENING.test(part)) {
      carry += part;
      continue;
    }
    if ((CLOSING.test(part) || PARTICLE.test(part)) && units.length > 0 && !carry) {
      units[units.length - 1] += part;
      continue;
    }
    units.push(carry + part);
    carry = '';
  }
  if (carry) units.push(carry);
  return units;
}

/** Break opportunities: words and the spaces between them, CJK split by word. */
export function breakUnits(text: string, locale: string): string[] {
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .flatMap((token) => (/^\s+$/.test(token) ? [token] : segment(token, locale)));
}

function greedy(units: readonly string[], fits: (text: string) => boolean): string[] {
  const lines: string[] = [];
  let line = '';
  const push = (): void => {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
    line = '';
  };
  for (const unit of units) {
    if (/^\s+$/.test(unit)) {
      if (line) line += ' ';
      continue;
    }
    if (fits((line + unit).trim())) {
      line += unit;
      continue;
    }
    push();
    if (fits(unit)) {
      line = unit;
      continue;
    }
    for (const char of unit) {
      if (line && !fits(line + char)) push();
      line += char;
    }
  }
  push();
  return lines;
}

/**
 * Lines no wider than `width`, as even in length as the line count allows,
 * like CSS `text-wrap: balance`, so the card and its saved image agree. The
 * balance never narrows below the widest word, so no word breaks to even out.
 */
export function wrapBalanced(
  text: string,
  width: number,
  font: FontSpec,
  measure: Measure,
  locale: string
): string[] {
  const units = breakUnits(text, locale);
  const at = (w: number): string[] => greedy(units, (each) => measure(each, font) <= w);
  const lines = at(width);
  if (lines.length <= 1) return lines;
  const widest = Math.max(
    0,
    ...units.map((unit) => (/^\s+$/.test(unit) ? 0 : measure(unit, font)))
  );
  let lo = Math.max(width / lines.length, Math.min(width, widest));
  let hi = width;
  if (at(lo).length === lines.length) return at(lo);
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid).length === lines.length) hi = mid;
    else lo = mid;
  }
  return at(hi);
}

export interface SetText {
  readonly lines: readonly string[];
  /** The font the lines fit in, smaller than asked when the text would not fit. */
  readonly font: FontSpec;
  readonly height: number;
}

/** No block shrinks below this share of its role's size. */
const MIN_SHRINK = 0.6;

/**
 * Wraps, balances and clamps one paragraph. A long word or a long line
 * shrinks the whole block first, down to 60%, rather than break a word or
 * cut the text; only past that does it clamp with an ellipsis.
 */
export function setText(
  text: string,
  width: number,
  font: FontSpec,
  measure: Measure,
  locale: string,
  maxLines: number
): SetText {
  const words = breakUnits(text, locale).filter((unit) => !/^\s+$/.test(unit));
  let fitted = font;
  let wrapped = wrapBalanced(text, width, fitted, measure, locale);
  for (let step = 0; step < 10; step++) {
    const widest = Math.max(0, ...words.map((word) => measure(word, fitted)));
    if (widest <= width && wrapped.length <= maxLines) break;
    const ratio = widest > width ? Math.max(0.5, width / widest) : 0.92;
    const size = Math.max(font.size * MIN_SHRINK, fitted.size * Math.min(0.97, ratio));
    if (size >= fitted.size - 0.01) break;
    fitted = {
      ...fitted,
      size,
      lineHeight: (font.lineHeight * size) / font.size,
    };
    wrapped = wrapBalanced(text, width, fitted, measure, locale);
  }
  const lines = clampLines(wrapped, maxLines, width, (each) => measure(each, fitted));
  return { lines, font: fitted, height: lines.length * fitted.lineHeight };
}

/** The font size at which one line of text fills `width`, capped at `max`. */
export function fitSize(
  text: string,
  width: number,
  font: FontSpec,
  measure: Measure,
  max: number
): number {
  const probe = measure(text, withSize(font, 100));
  if (probe <= 0) return max;
  // A hair under the width, so rounding never pushes the line onto two.
  return Math.min(max, (99 * width) / probe);
}
