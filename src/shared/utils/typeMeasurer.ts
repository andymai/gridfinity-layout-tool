/**
 * Font measurement behind `typePlan`: advances, reference runs and glyph
 * outlines, memoised per font. Free of brepjs so main-thread callers can use
 * it; font access arrives through the structural {@link GlyphFont}.
 */

import type { TextFontFamily } from '@/shared/types/bin';

/** One drawing command from an opentype path. */
interface GlyphPathCommand {
  readonly type: string;
  readonly x?: number;
  readonly y?: number;
  readonly x1?: number;
  readonly y1?: number;
  readonly x2?: number;
  readonly y2?: number;
}

interface GlyphRecord {
  readonly advanceWidth?: number;
}

/**
 * The slice of opentype's `Font` this module needs. Structural rather than
 * imported so `shared/` keeps no dependency on the kernel bundle: the worker
 * hands over brepjs's `getFont` and the main thread hands over its own.
 */
export interface GlyphFont {
  readonly unitsPerEm: number;
  readonly ascender: number;
  readonly descender: number;
  readonly tables?: { readonly os2?: { readonly sCapHeight?: number } };
  getPath(text: string, x: number, y: number, fontSize: number): { commands: GlyphPathCommand[] };
  stringToGlyphs(text: string): GlyphRecord[];
  getAdvanceWidth(text: string, fontSize?: number): number;
}

export type GetGlyphFont = (family: TextFontFamily) => GlyphFont | undefined;

/** Everything measured about one string, at a font size of 1. Linear in size. */
interface ReferenceRun {
  /** Per-code-point advances including kerning, in em. */
  readonly advances: readonly number[];
  readonly chars: readonly string[];
  /** Total advance with no tracking, in em. */
  readonly advance: number;
  readonly inkMinX: number;
  readonly inkMaxX: number;
  readonly inkMinY: number;
  readonly inkMaxY: number;
}

/** Font-level vertical datums at a font size of 1, in em. */
interface ReferenceVertical {
  readonly capHeight: number;
  readonly ascender: number;
  /** Negative, measured down from the baseline. */
  readonly descender: number;
}

/**
 * One glyph outline command in the SKETCH frame (+Y up, baseline at 0), at a
 * font size of 1. Same shape opentype emits, with Y already negated so callers
 * never have to remember which way the font format points.
 */
export interface OutlineCommand {
  readonly type: string;
  readonly x?: number;
  readonly y?: number;
  readonly x1?: number;
  readonly y1?: number;
  readonly x2?: number;
  readonly y2?: number;
}

export interface TypeMeasurer {
  run(text: string, family: TextFontFamily): ReferenceRun | null;
  vertical(family: TextFontFamily): ReferenceVertical | null;
  /**
   * Glyph outlines at size 1, for previews that draw the caption rather than
   * measuring it. The designer's specimen and its ghost overlay both render
   * from these, so what is on screen is the same curve the kernel extrudes,
   * not a lookalike from a web font.
   */
  outline(text: string, family: TextFontFamily): readonly OutlineCommand[] | null;
  /**
   * Narrowest vertical stem in the run, in em. Approximated from the ink of
   * the run's own glyphs rather than a reference letter, because a caption's
   * thinnest feature is frequently a comma or a digit rather than an `I`.
   */
  stem(text: string, family: TextFontFamily): number | null;
}

const MEMO_MAX = 512;

function memoSet<T>(memo: Map<string, T>, key: string, value: T): T {
  if (memo.size >= MEMO_MAX) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, value);
  return value;
}

/**
 * Build a measurer over an injected font registry. Every measurement is taken
 * once at size 1 and scaled, which is exact (opentype path coordinates and
 * advances are linear in font size, with no hinting on this path) and makes the
 * size search below pure arithmetic.
 */
export function createTypeMeasurer(getFont: GetGlyphFont): TypeMeasurer {
  const runs = new Map<string, ReferenceRun | null>();
  const verticals = new Map<string, ReferenceVertical | null>();
  const stems = new Map<string, number | null>();
  const outlines = new Map<string, readonly OutlineCommand[] | null>();

  const measureRun = (text: string, family: TextFontFamily): ReferenceRun | null => {
    const font = getFont(family);
    if (!font) return null;
    const chars = Array.from(text);
    // Per-glyph advance from the glyph record, and the whole-string advance
    // from the font (which folds in kerning). The difference is distributed as
    // a correction so the per-glyph pen positions still sum to the kerned
    // total; without it a tracked run drifts from its own measured width.
    const glyphs = font.stringToGlyphs(text);
    const scale = 1 / font.unitsPerEm;
    const raw = chars.map((_c, i) => (glyphs[i]?.advanceWidth ?? 0) * scale);
    const rawTotal = raw.reduce((a, b) => a + b, 0);
    const kernedTotal = font.getAdvanceWidth(text, 1);
    const correction =
      chars.length > 1 && Number.isFinite(kernedTotal) && rawTotal > 0
        ? (kernedTotal - rawTotal) / (chars.length - 1)
        : 0;
    const advances = raw.map((a, i) => (i < raw.length - 1 ? a + correction : a));
    const advance = Number.isFinite(kernedTotal) && kernedTotal > 0 ? kernedTotal : rawTotal;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    // opentype's +Y points DOWN, hence the negation into the sketch frame.
    // Bezier control points are folded in, so the box can only over-state the
    // ink: a fit built on it never overflows its host.
    for (const cmd of font.getPath(text, 0, 0, 1).commands) {
      if (cmd.type === 'Z') continue;
      const xs = [cmd.x, cmd.x1, cmd.x2];
      const ys = [cmd.y, cmd.y1, cmd.y2];
      for (const x of xs) {
        if (x === undefined) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      for (const y of ys) {
        if (y === undefined) continue;
        if (-y < minY) minY = -y;
        if (-y > maxY) maxY = -y;
      }
    }
    if (minX > maxX || minY > maxY) return null;
    return { advances, chars, advance, inkMinX: minX, inkMaxX: maxX, inkMinY: minY, inkMaxY: maxY };
  };

  const measureVertical = (family: TextFontFamily): ReferenceVertical | null => {
    const font = getFont(family);
    if (!font) return null;
    const scale = 1 / font.unitsPerEm;
    const declared = font.tables?.os2?.sCapHeight;
    // sCapHeight is optional in OS/2 and absent from some OFL faces. Falling
    // back to the ink height of a flat-topped capital is what the datum
    // actually means, so the fallback is not an approximation of a different
    // quantity.
    const capHeight =
      declared !== undefined && declared > 0
        ? declared * scale
        : (measureRun('H', family)?.inkMaxY ?? font.ascender * scale * 0.72);
    return {
      capHeight,
      ascender: font.ascender * scale,
      descender: font.descender * scale,
    };
  };

  const measureStem = (text: string, family: TextFontFamily): number | null => {
    const font = getFont(family);
    if (!font) return null;
    const scale = 1 / font.unitsPerEm;
    // Scan each glyph's outline for the narrowest horizontal run of ink at the
    // vertical midpoint of the glyph. A full raster is unnecessary: sampling
    // one scanline through the x-height band catches every plain stem, which
    // is the feature that disappears first when a cut is too small.
    let narrowest = Infinity;
    for (const ch of Array.from(text)) {
      if (ch.trim() === '') continue;
      const commands = font.getPath(ch, 0, 0, 1).commands;
      const xsAtBand: number[] = [];
      let prevX: number | undefined;
      let prevY: number | undefined;
      const capish = (measureVertical(family)?.capHeight ?? 0.7) * 0.5;
      for (const cmd of commands) {
        const x = cmd.x;
        const y = cmd.y === undefined ? undefined : -cmd.y;
        if (x === undefined || y === undefined) {
          prevX = undefined;
          prevY = undefined;
          continue;
        }
        if (prevX !== undefined && prevY !== undefined) {
          const lo = Math.min(prevY, y);
          const hi = Math.max(prevY, y);
          if (lo <= capish && capish <= hi && hi > lo) {
            xsAtBand.push(prevX + ((x - prevX) * (capish - prevY)) / (y - prevY));
          }
        }
        prevX = x;
        prevY = y;
      }
      if (xsAtBand.length < 2) continue;
      xsAtBand.sort((a, b) => a - b);
      // Crossings pair up into ink spans: [0,1] is ink, [1,2] is a counter.
      for (let i = 0; i + 1 < xsAtBand.length; i += 2) {
        const width = xsAtBand[i + 1] - xsAtBand[i];
        if (width > 1e-6 && width < narrowest) narrowest = width;
      }
    }
    if (!Number.isFinite(narrowest)) return null;
    return narrowest * (font.unitsPerEm * scale);
  };

  return {
    run(text, family) {
      const key = `${family}|${text}`;
      const hit = runs.get(key);
      if (hit !== undefined) return hit;
      return memoSet(runs, key, measureRun(text, family));
    },
    vertical(family) {
      const hit = verticals.get(family);
      if (hit !== undefined) return hit;
      return memoSet(verticals, family, measureVertical(family));
    },
    stem(text, family) {
      const key = `${family}|${text}`;
      const hit = stems.get(key);
      if (hit !== undefined) return hit;
      return memoSet(stems, key, measureStem(text, family));
    },
    outline(text, family) {
      const key = `${family}|${text}`;
      const hit = outlines.get(key);
      if (hit !== undefined) return hit;
      const font = getFont(family);
      if (!font) return memoSet(outlines, key, null);
      const commands = font.getPath(text, 0, 0, 1).commands.map((cmd) => ({
        type: cmd.type,
        ...(cmd.x !== undefined ? { x: cmd.x } : {}),
        ...(cmd.y !== undefined ? { y: -cmd.y } : {}),
        ...(cmd.x1 !== undefined ? { x1: cmd.x1 } : {}),
        ...(cmd.y1 !== undefined ? { y1: -cmd.y1 } : {}),
        ...(cmd.x2 !== undefined ? { x2: cmd.x2 } : {}),
        ...(cmd.y2 !== undefined ? { y2: -cmd.y2 } : {}),
      }));
      return memoSet(outlines, key, commands);
    },
  };
}
