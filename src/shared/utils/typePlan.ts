/**
 * Type-layout plan: the single statement of where a caption's glyphs land on
 * a rectangular host.
 *
 * Everything about a printed caption that is not geometry lives here: case,
 * line splitting and wrapping, tracking, size resolution (auto-fit, the
 * discrete scale, a fixed size and its shrink cascade), the cap-height datum,
 * optical centering and flush-to-margin. The builders in
 * `features/generation/worker/generators` turn the result into solids and the
 * designer's ghost overlay draws the same result on screen, so a preview cannot
 * disagree with a print without one of them ignoring this module.
 *
 * Deliberately free of brepjs (mirroring `labelTabPlan`, and for the same
 * reason: main-thread callers cannot import the kernel). Font access arrives
 * through the structural {@link GlyphFont}, which opentype's `Font` satisfies
 * on both sides.
 *
 * Frame: the host rect is centred on the origin, +X right and +Y up, so a plan
 * is placed by translating to the host's centre. Y positions are BASELINES,
 * not glyph boxes.
 */

import type { TextAnchor, TextFontFamily, TextMode, TextStyleDefaults } from '@/shared/types/bin';
import {
  applyTextCase,
  autoTrackingEm,
  snapToTypeScale,
  splitTextLines,
  TEXT_MAX_LINES,
} from '@/shared/types/bin';

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

/**
 * Apply the stencil-font auto-swap for through-cut mode. The user's font pick
 * is honoured for engrave and emboss; through-cut always uses
 * `allerta-stencil` so glyph counters survive as connected islands.
 */
export function resolveEffectiveFont(font: TextFontFamily, mode: TextMode): TextFontFamily {
  return mode === 'through-cut' ? 'allerta-stencil' : font;
}

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

/**
 * SVG path data for a planned caption, in the plan's own frame (mm, +Y up,
 * origin at the host centre).
 *
 * Built per glyph from the same positions the builder extrudes, so a specimen
 * that looks wrong is evidence the plan is wrong, not that the preview drew it
 * differently. Callers flip Y themselves; SVG's own axis points down and the
 * flip belongs with the viewport, not the geometry.
 */
export function planToPathData(plan: TypeBlockPlan, measurer: TypeMeasurer): string {
  const parts: string[] = [];
  for (const line of plan.lines) {
    for (const glyph of line.glyphs) {
      if (glyph.char.trim() === '') continue;
      const commands = measurer.outline(glyph.char, plan.font);
      if (!commands) continue;
      const s = line.fontSize;
      const ox = line.x + glyph.x;
      const oy = line.baselineY;
      const px = (v: number): string => (ox + v * s).toFixed(4);
      const py = (v: number): string => (oy + v * s).toFixed(4);
      for (const cmd of commands) {
        if (cmd.type === 'M' && cmd.x !== undefined && cmd.y !== undefined) {
          parts.push(`M${px(cmd.x)} ${py(cmd.y)}`);
        } else if (cmd.type === 'L' && cmd.x !== undefined && cmd.y !== undefined) {
          parts.push(`L${px(cmd.x)} ${py(cmd.y)}`);
        } else if (
          cmd.type === 'Q' &&
          cmd.x !== undefined &&
          cmd.y !== undefined &&
          cmd.x1 !== undefined &&
          cmd.y1 !== undefined
        ) {
          parts.push(`Q${px(cmd.x1)} ${py(cmd.y1)} ${px(cmd.x)} ${py(cmd.y)}`);
        } else if (
          cmd.type === 'C' &&
          cmd.x !== undefined &&
          cmd.y !== undefined &&
          cmd.x1 !== undefined &&
          cmd.y1 !== undefined &&
          cmd.x2 !== undefined &&
          cmd.y2 !== undefined
        ) {
          parts.push(
            `C${px(cmd.x1)} ${py(cmd.y1)} ${px(cmd.x2)} ${py(cmd.y2)} ${px(cmd.x)} ${py(cmd.y)}`
          );
        } else if (cmd.type === 'Z') {
          parts.push('Z');
        }
      }
    }
  }
  return parts.join(' ');
}

/**
 * Optical margin allowances, in em, by the character sitting against the
 * margin. Round and pointed glyphs read as inset when their ink is flush,
 * because so little of it reaches the edge; punctuation reads as a hole.
 * Nudging them out is what makes a column of flush-left captions look like a
 * straight edge. A seeded table is how typesetting engines start, and it beats
 * the alternative of pretending the ink box is the optical edge.
 */
const ROUND_CHARS = new Set('OQCGSoceszaduqpbg0356689');
const POINTED_CHARS = new Set('AVWXYvwxy47');
const HANGING_CHARS = new Set('.,;:\'"`-–—‘’“”');
const ROUND_OVERSHOOT_EM = 0.012;
const POINTED_OVERSHOOT_EM = 0.016;
const HANGING_OVERSHOOT_EM = 0.05;

function opticalOvershootEm(char: string | undefined): number {
  if (char === undefined) return 0;
  if (HANGING_CHARS.has(char)) return HANGING_OVERSHOOT_EM;
  if (ROUND_CHARS.has(char)) return ROUND_OVERSHOOT_EM;
  if (POINTED_CHARS.has(char)) return POINTED_OVERSHOOT_EM;
  return 0;
}

/** One glyph's pen offset from the start of its line, in mm. */
export interface TypeGlyph {
  readonly char: string;
  readonly x: number;
}

export interface TypeLineRun {
  readonly text: string;
  readonly fontSize: number;
  /** Absolute letter-spacing added between glyphs, in mm. */
  readonly trackingMm: number;
  /** Pen origin for the line, in the host frame. */
  readonly x: number;
  /** Baseline height in the host frame. */
  readonly baselineY: number;
  /** Total advance including tracking, in mm. */
  readonly advance: number;
  /** Ink box of the placed line, in the host frame. */
  readonly inkMinX: number;
  readonly inkMaxX: number;
  readonly glyphs: readonly TypeGlyph[];
}

export interface TypeBlockPlan {
  /** Effective family after the through-cut stencil swap. */
  readonly font: TextFontFamily;
  readonly lines: readonly TypeLineRun[];
  /** Size of the first line. Later lines carry `lineScale` of it. */
  readonly fontSize: number;
  /** Ink bounds of the whole block in the host frame, for pattern clipping. */
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  /** A fixed size could not be honoured and the block was reduced to fit. */
  readonly shrunk: boolean;
  /** A single authored line was broken to fit. */
  readonly wrapped: boolean;
}

/** The rectangle a caption is placed inside, centred on the host frame origin. */
export interface TypeHostBox {
  readonly width: number;
  readonly depth: number;
}

export interface TypePlanOptions {
  readonly text: string;
  readonly style: TextStyleDefaults & { readonly fontSizeOverride?: number };
  readonly host: TypeHostBox;
  /**
   * A size resolved across a group (a row of tabs, the surfaces of one design).
   * Wins over auto-fit and over `fixedSize`, but is still subject to the shrink
   * cascade: a member that cannot hold the shared size gets its own.
   */
  readonly sharedSizeMm?: number;
  /**
   * Allow breaking a single authored line to fit. Off for hosts whose caption
   * is a fixed-format field (a plate caption beside an icon) where a second
   * line has nowhere to go.
   */
  readonly allowWrap?: boolean;
  /** Defaults to `field`. See {@link TypeHostKind}. */
  readonly hostKind?: TypeHostKind;
}

interface Candidate {
  readonly lines: readonly string[];
  readonly wrapped: boolean;
}

/** Greedy word wrap at `maxAdvance`, capped at the caption's line budget. */
function wrapLine(
  text: string,
  measurer: TypeMeasurer,
  family: TextFontFamily,
  fontSize: number,
  trackingEm: number,
  maxAdvance: number,
  maxLines: number
): string[] | null {
  const words = text.split(/\s+/u).filter((w) => w !== '');
  if (words.length < 2) return null;
  const advanceOf = (s: string): number => {
    const run = measurer.run(s, family);
    if (!run) return Infinity;
    return run.advance * fontSize + trackingEm * fontSize * Math.max(0, run.chars.length - 1);
  };
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (advanceOf(candidate) <= maxAdvance || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      if (lines.length >= maxLines) return null;
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  return lines.length > 1 && lines.length <= maxLines ? lines : null;
}

interface MeasuredLine {
  readonly text: string;
  readonly fontSize: number;
  readonly trackingMm: number;
  readonly advance: number;
  readonly inkMinX: number;
  readonly inkMaxX: number;
  readonly capTop: number;
  readonly inkBottom: number;
  readonly glyphs: readonly TypeGlyph[];
}

interface BlockMetrics {
  readonly width: number;
  readonly height: number;
  /** Space kept below the last baseline, the datum the bottom anchor sits on. */
  readonly bottomReserve: number;
  readonly lines: readonly MeasuredLine[];
}

/**
 * Measure a candidate block at a candidate size.
 *
 * The vertical box is the CAP band, not the run's own ink and not the font's
 * line box. Ink makes a size that varies with which letters were typed, so
 * `ACE` and `ace` render at different heights and their baselines cannot agree;
 * the line box is only about half inked by an all-caps run, so it throws away
 * the host. The cap band is stable per font and size, and is widened only where
 * the actual ink exceeds it (accents above the cap line, descenders below), so
 * nothing is ever clipped.
 */
function measureBlock(
  candidate: Candidate,
  primarySize: number,
  style: TextStyleDefaults,
  measurer: TypeMeasurer,
  family: TextFontFamily
): BlockMetrics | null {
  const vertical = measurer.vertical(family);
  if (!vertical) return null;

  const measured: MeasuredLine[] = [];
  let width = 0;
  for (let i = 0; i < candidate.lines.length; i++) {
    const text = candidate.lines[i];
    // `lineScale` applies to authored lines only. A wrapped line is the same
    // phrase continuing, so scaling it would read as an accident.
    const fontSize = i === 0 || candidate.wrapped ? primarySize : primarySize * style.lineScale;
    const run = measurer.run(text, family);
    if (!run) return null;
    const trackingEm = style.tracking + (style.autoTracking ? autoTrackingEm(fontSize) : 0);
    const trackingMm = trackingEm * fontSize;
    const gaps = Math.max(0, run.chars.length - 1);
    const advance = run.advance * fontSize + trackingMm * gaps;

    let pen = 0;
    const glyphs: TypeGlyph[] = [];
    for (let g = 0; g < run.chars.length; g++) {
      glyphs.push({ char: run.chars[g], x: pen });
      pen += run.advances[g] * fontSize + trackingMm;
    }

    measured.push({
      text,
      fontSize,
      trackingMm,
      advance,
      inkMinX: run.inkMinX * fontSize,
      inkMaxX: run.inkMaxX * fontSize + trackingMm * gaps,
      capTop: Math.max(vertical.capHeight * fontSize, run.inkMaxY * fontSize),
      inkBottom: Math.min(0, run.inkMinY * fontSize),
      glyphs,
    });
    width = Math.max(width, advance);
  }

  // Height spans the first line's cap top down to the last line's DATUM floor,
  // which is the font's descender and not this string's ink.
  //
  // Budgeting the ink instead is what let a caption with no descenders fit on
  // paper and then overflow once placed: the bottom anchor reserves the font
  // descender so every caption shares a baseline, so the fit has to reserve it
  // too. A string whose ink drops past the font descender (some tails do) takes
  // the deeper of the two, or the fit would under-budget the other way.
  const last = measured[measured.length - 1];
  const bottomReserve = Math.max(-vertical.descender * last.fontSize, -last.inkBottom);
  let height = measured[0].capTop + bottomReserve;
  for (let i = 1; i < measured.length; i++) {
    height +=
      measured[i].capTop + style.lineGap * Math.max(measured[i - 1].fontSize, measured[i].fontSize);
  }
  return { width, height, bottomReserve, lines: measured };
}

/**
 * What kind of surface the caption sits on, which changes what its anchor can
 * sensibly mean.
 *
 * A `field` is large enough that placement is a real design choice: a bin wall
 * or a lid top, where anchoring low reads as sitting on the object's own
 * baseline. A `plaque` IS the caption's frame, sized to it: a label tab or a
 * swappable plate. Flushing a plaque's caption left still reads as a set, but
 * pushing it to the bottom of its own plaque just looks like a mistake, so the
 * vertical zone collapses to centred there. One anchor field, two hosts, no
 * second knob for the user to keep in sync.
 */
export type TypeHostKind = 'field' | 'plaque';

/** Horizontal and vertical zone a nine-point anchor selects. */
function anchorZones(
  anchor: TextAnchor,
  hostKind: TypeHostKind
): { h: 'start' | 'center' | 'end'; v: 'start' | 'center' | 'end' } {
  const h =
    anchor.endsWith('-left') || anchor === 'left'
      ? 'start'
      : anchor.endsWith('-right') || anchor === 'right'
        ? 'end'
        : 'center';
  if (hostKind === 'plaque') return { h, v: 'center' };
  const v = anchor.startsWith('top') ? 'end' : anchor.startsWith('bottom') ? 'start' : 'center';
  return { h, v };
}

/** Most of a host's smaller dimension the margin may consume, per side. */
const MAX_MARGIN_FRACTION = 0.25;

const SIZE_SEARCH_STEPS = 16;
const SIZE_SEARCH_EPSILON = 0.01;

/** Largest size at or below `hi` whose block fits, or null when even `lo` overflows. */
function searchSize(
  candidate: Candidate,
  style: TextStyleDefaults,
  measurer: TypeMeasurer,
  family: TextFontFamily,
  availW: number,
  availD: number,
  lo: number,
  hi: number
): number | null {
  const fits = (size: number): boolean => {
    const m = measureBlock(candidate, size, style, measurer, family);
    return m !== null && m.width <= availW && m.height <= availD;
  };
  if (!fits(lo)) return null;
  if (fits(hi)) return hi;
  let low = lo;
  let high = hi;
  for (let i = 0; i < SIZE_SEARCH_STEPS && high - low > SIZE_SEARCH_EPSILON; i++) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return low;
}

/**
 * Resolve a caption into placed glyph runs, or `null` when it cannot be
 * rendered at all (no text, font unavailable, or the legibility floor exceeds
 * the host). Returning `null` rather than a degenerate plan preserves the
 * established silent-skip convention for undersized features.
 */
export function planTypeBlock(
  options: TypePlanOptions,
  measurer: TypeMeasurer
): TypeBlockPlan | null {
  const { style, host } = options;
  const family = resolveEffectiveFont(style.font, style.mode);
  const cased = applyTextCase(options.text, style.textCase);
  const authored = splitTextLines(cased).slice(0, TEXT_MAX_LINES);
  if (authored.length === 0) return null;

  // `margin` is one design-wide number, but the hosts it has to serve span a
  // 100mm wall and an 8mm label tab. A 3mm inset that reads as a considered
  // datum on the wall would eat three quarters of the tab, so it is capped
  // against the host it is actually being applied to. The cap only ever fires
  // where honouring the margin would have shrunk the caption to nothing, so a
  // set of walls still shares its datum exactly.
  const margin = Math.min(style.margin, Math.min(host.width, host.depth) * MAX_MARGIN_FRACTION);
  const availW = host.width - 2 * margin;
  const availD = host.depth - 2 * margin;
  if (availW <= 0 || availD <= 0) return null;

  const vertical = measurer.vertical(family);
  if (!vertical) return null;

  const plain: Candidate = { lines: authored, wrapped: false };
  const allowWrap = options.allowWrap !== false && authored.length === 1;

  // Wrapping is tried at the size we WANT, before any shrinking: breaking a
  // line is what buys back the width that would otherwise force a smaller size,
  // so trying it after the shrink would never fire.
  const wrappedAt = (size: number): Candidate | null => {
    if (!allowWrap) return null;
    const trackingEm = style.tracking + (style.autoTracking ? autoTrackingEm(size) : 0);
    const lines = wrapLine(authored[0], measurer, family, size, trackingEm, availW, TEXT_MAX_LINES);
    return lines ? { lines, wrapped: true } : null;
  };
  const fitsAt = (candidate: Candidate, size: number): boolean => {
    const m = measureBlock(candidate, size, style, measurer, family);
    return m !== null && m.width <= availW && m.height <= availD;
  };

  let candidate = plain;
  let fontSize: number;
  let shrunk = false;

  const wanted = options.sharedSizeMm ?? (style.sizeMode === 'fixed' ? style.fixedSize : null);
  if (wanted !== null) {
    if (fitsAt(plain, wanted)) {
      fontSize = wanted;
    } else {
      const wrappedCandidate = wrappedAt(wanted);
      if (wrappedCandidate && fitsAt(wrappedCandidate, wanted)) {
        candidate = wrappedCandidate;
        fontSize = wanted;
      } else {
        const target = wrappedCandidate ?? plain;
        const found = searchSize(
          target,
          style,
          measurer,
          family,
          availW,
          availD,
          style.minFontSize,
          wanted
        );
        if (found === null) return null;
        candidate = target;
        fontSize = found;
        shrunk = true;
      }
    }
  } else {
    const ceiling = Math.max(style.minFontSize, style.maxFontSize);
    let found = searchSize(
      plain,
      style,
      measurer,
      family,
      availW,
      availD,
      style.minFontSize,
      ceiling
    );
    // Wrapping only helps auto-fit when width is the binding constraint, which
    // it is exactly when a wrapped block fits larger than the flat one.
    const wrappedCandidate = wrappedAt(found ?? style.minFontSize);
    if (wrappedCandidate) {
      const wrappedFound = searchSize(
        wrappedCandidate,
        style,
        measurer,
        family,
        availW,
        availD,
        style.minFontSize,
        ceiling
      );
      if (wrappedFound !== null && (found === null || wrappedFound > found)) {
        candidate = wrappedCandidate;
        found = wrappedFound;
      }
    }
    if (found === null) return null;
    fontSize = found;
    if (style.snapToScale) fontSize = snapToTypeScale(fontSize, style.minFontSize);
    if (style.fontSizeOverride !== undefined) {
      fontSize = Math.min(fontSize, Math.max(style.minFontSize, style.fontSizeOverride));
    }
  }

  const metrics = measureBlock(candidate, fontSize, style, measurer, family);
  if (!metrics) return null;

  const { h, v } = anchorZones(style.anchor, options.hostKind ?? 'field');
  const halfW = host.width / 2;
  const halfD = host.depth / 2;

  // Vertical: the datum is the BASELINE, derived from font metrics rather than
  // from this string's ink, so two captions in the same font and size share a
  // baseline whether or not either happens to have a descender. A descender is
  // allowed to hang into the margin, which is what the margin is for.
  // Distance from the last baseline up to the first. Recovered from the block
  // height rather than re-summed, so the two can never disagree.
  const baselineStack = metrics.height - metrics.lines[0].capTop - metrics.bottomReserve;
  let firstBaseline: number;
  if (v === 'end') {
    firstBaseline = halfD - margin - metrics.lines[0].capTop;
  } else if (v === 'start') {
    // The datum is the font's descender, never this string's ink: reserving the
    // measured drop instead would sit a caption with no descenders lower than
    // its neighbour that has one, which is the misalignment the datum exists to
    // remove. `measureBlock` budgets the SAME reserve, so a block that fitted
    // cannot then be pushed past the far edge by being anchored against it.
    firstBaseline = -halfD + margin + metrics.bottomReserve + baselineStack;
  } else {
    firstBaseline = metrics.height / 2 - metrics.lines[0].capTop;
  }
  firstBaseline += style.offset.y;

  const lines: TypeLineRun[] = [];
  let baseline = firstBaseline;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < metrics.lines.length; i++) {
    const line = metrics.lines[i];
    if (i > 0) {
      baseline -=
        line.capTop + style.lineGap * Math.max(metrics.lines[i - 1].fontSize, line.fontSize);
    }

    // Horizontal: align the INK, not the advance box. Side bearings are not
    // part of the letterform, so centring or flushing the advance box leaves a
    // caption looking off by whatever asymmetry its first and last glyphs
    // happen to have.
    const firstChar = line.glyphs[0]?.char;
    const lastChar = line.glyphs[line.glyphs.length - 1]?.char;
    let x: number;
    if (h === 'start') {
      x = -halfW + margin - line.inkMinX - opticalOvershootEm(firstChar) * line.fontSize;
    } else if (h === 'end') {
      x = halfW - margin - line.inkMaxX + opticalOvershootEm(lastChar) * line.fontSize;
    } else {
      x = -(line.inkMinX + line.inkMaxX) / 2;
    }
    x += style.offset.x;

    lines.push({
      text: line.text,
      fontSize: line.fontSize,
      trackingMm: line.trackingMm,
      x,
      baselineY: baseline,
      advance: line.advance,
      inkMinX: x + line.inkMinX,
      inkMaxX: x + line.inkMaxX,
      glyphs: line.glyphs,
    });

    minX = Math.min(minX, x + line.inkMinX);
    maxX = Math.max(maxX, x + line.inkMaxX);
    minY = Math.min(minY, baseline + line.inkBottom);
    maxY = Math.max(maxY, baseline + line.capTop);
  }

  return {
    font: family,
    lines,
    fontSize,
    minX,
    maxX,
    minY,
    maxY,
    shrunk,
    wrapped: candidate.wrapped,
  };
}

/**
 * Narrowest printed stem across a plan, in mm. `null` when the font is
 * unavailable. Compared against {@link MIN_PRINTABLE_STEM_MM} by the guard;
 * kept here so the panel warning and the worker report the same number.
 */
export function planMinStemMm(plan: TypeBlockPlan, measurer: TypeMeasurer): number | null {
  let narrowest = Infinity;
  for (const line of plan.lines) {
    const stem = measurer.stem(line.text, plan.font);
    if (stem === null) continue;
    narrowest = Math.min(narrowest, stem * line.fontSize);
  }
  return Number.isFinite(narrowest) ? narrowest : null;
}

/**
 * Stem width below which an FDM slicer stops resolving the wall between two
 * glyph edges and the letterform prints as a blob. Two nominal extrusion widths
 * at a 0.4mm nozzle.
 */
export const MIN_PRINTABLE_STEM_MM = 0.8;
