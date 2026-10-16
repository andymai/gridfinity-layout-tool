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
import type { TypeMeasurer } from './typeMeasurer';
export { createTypeMeasurer } from './typeMeasurer';
export type { GlyphFont, GetGlyphFont, OutlineCommand, TypeMeasurer } from './typeMeasurer';

/**
 * Apply the stencil-font auto-swap for through-cut mode. The user's font pick
 * is honoured for engrave and emboss; through-cut always uses
 * `allerta-stencil` so glyph counters survive as connected islands.
 */
export function resolveEffectiveFont(font: TextFontFamily, mode: TextMode): TextFontFamily {
  return mode === 'through-cut' ? 'allerta-stencil' : font;
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
