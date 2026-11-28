import type { CardCopy } from '../components/YearCardView/cardCopy';
import {
  BEAT,
  REST,
  clamp01,
  easeOut,
  onGrid,
  springContact,
  springX,
  squash,
  type Pose,
} from '../look/motion';
import { PALETTES } from '../look/palettes';
import { sentences } from '../look/splitCopy';
import { formatCount } from '../utils/yearFormat';
import { buildDigits, GLYPH_ROWS, type DigitLayout } from './digitGlyphs';
import { glyphBin, posed, roundRect } from './paint';
import {
  CONTENT_W,
  GAP_T,
  GAP_V,
  MARGIN,
  TEXT_FLOOR,
  blockHeight,
  footer,
  textBlock,
  type Scene,
  type SceneInput,
  type TextBlock,
} from './scene';

/** The tuned cell: a glyph bin 53 px wide. Longer numbers shrink to fit the width. */
const CELL_MAX = 53;
/** The glyphs stand on this line whatever their size, so the title never moves. */
const FLOOR = 420 + GLYPH_ROWS * CELL_MAX;
/** Glyphs never reach above this, however long the text under them runs. */
const GLYPH_TOP_MIN = 300;
const LID = 16;
const ABOVE = 90;
const BOUNCE = 0.22;
/** Rows land from beat 1 to beat 4, closer together as the stack rises. */
const FIRST = BEAT;
const LAST = 4 * BEAT;

export interface DigitPlacement extends DigitLayout {
  readonly cell: number;
  readonly left: number;
  readonly top: number;
}

/** The count's digits at the largest cell that fits the card's width. */
export function placeDigits(text: string, floor = FLOOR): DigitPlacement {
  const layout = buildDigits(text);
  const cell = Math.min(
    CELL_MAX,
    CONTENT_W / Math.max(1, layout.cols),
    (floor - GLYPH_TOP_MIN) / GLYPH_ROWS
  );
  return {
    ...layout,
    cell,
    left: MARGIN + (CONTENT_W - layout.cols * cell) / 2,
    top: floor - GLYPH_ROWS * cell,
  };
}

function rowContact(fromBottom: number, glyph: number): number {
  const rise = Math.pow(fromBottom / (GLYPH_ROWS - 1), 0.8);
  return onGrid(FIRST + (LAST - FIRST) * rise, BEAT / 12) + Math.min(glyph, 6) * (BEAT / 24);
}

interface Drop {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly fall: number;
  readonly contact: number;
  readonly rest: number;
  readonly lift: number;
  readonly group: number;
}

function dropPoseAt(t: number, drop: Drop, reduced: boolean): Pose {
  if (reduced) {
    const opacity = easeOut(clamp01((t - (1 + drop.group * 0.5) * BEAT) / 0.2));
    return { ...REST, opacity, y: -drop.lift, rotate: drop.rest };
  }
  const duration = 0.55 * Math.sqrt(drop.fall / 170);
  const { first, period } = springContact(duration, BOUNCE);
  const elapsed = t - (drop.contact - first);
  const s = squash(t - drop.contact, 0.09) + squash(t - drop.contact - period, 0.025);
  return {
    opacity: elapsed > 0 ? 1 : 0,
    x: 0,
    y: -drop.fall * Math.abs(springX(elapsed, duration, BOUNCE)) - drop.lift,
    rotate: drop.rest,
    scaleX: 1 + s * 0.5,
    scaleY: 1 - s,
  };
}

/** The title and its sentences, the second landing a beat after the first. */
function binWords(input: SceneInput, copy: CardCopy, ink: string): TextBlock[] {
  const title = textBlock(input, {
    key: 'title',
    role: 'title',
    text: copy.title,
    y: 0,
    color: ink,
    enter: 4 * BEAT,
    reduceEnter: 3 * BEAT,
    rise: 40,
  });
  const timings: readonly [number, number, number][] = [
    [4 * BEAT, 3.5 * BEAT, 36],
    [5 * BEAT, 4.5 * BEAT, 22],
  ];
  const lines = sentences(copy.lines[0] ?? '', input.locale).map((part, index) => {
    const [enter, reduceEnter, rise] = timings[Math.min(index, 1)] ?? [4 * BEAT, 3.5 * BEAT, 36];
    return textBlock(input, {
      key: `line${index}`,
      role: 'line',
      text: part,
      y: 0,
      color: ink,
      enter: enter + Math.max(0, index - 1) * 0.5 * BEAT,
      reduceEnter,
      rise,
      maxLines: 2,
    });
  });
  return [title, ...lines];
}

/** The bin count built from bins, the last one landing crooked. */
export function binsScene(input: SceneInput, copy: CardCopy): Scene {
  const P = PALETTES.bins;
  const words = binWords(input, copy, P.ink);
  const textHeight = words.reduce((sum, block) => sum + blockHeight(block), 0) + GAP_T;
  const floor = Math.min(FLOOR, TEXT_FLOOR - textHeight - 15 - GAP_V);
  const place = placeDigits(formatCount(input.locale, input.stats.binsPlaced), floor);
  const k = place.cell / CELL_MAX;
  const lid = LID * k;
  const drops: Drop[] = place.cells.map(({ r, c, glyph }) => {
    const fromBottom = GLYPH_ROWS - 1 - r;
    const y = place.top + r * place.cell - lid;
    return {
      x: place.left + c * place.cell,
      y,
      r,
      fall: y + ABOVE,
      contact: rowContact(fromBottom, glyph),
      rest: 0,
      lift: 0,
      group: Math.min(3, Math.floor(fromBottom / 3.5)),
    };
  });
  if (place.stray) {
    const { r, c, glyph } = place.stray;
    const y = place.top + r * place.cell - lid;
    drops.push({
      x: place.left + c * place.cell,
      y,
      r,
      fall: y + ABOVE,
      contact: rowContact(GLYPH_ROWS - 1 - r, glyph),
      rest: -6,
      lift: (place.cell / 2) * Math.sin((6 * Math.PI) / 180),
      group: 0,
    });
  }
  // Upper rows overlap the lids of the rows below, so the bottom row draws first.
  drops.sort((a, b) => b.r - a.r);
  const colours = { face: P.bin, hi: P.binHi, lo: P.binLo };
  const texts: TextBlock[] = [];
  let y = floor + 15 + GAP_V;
  for (const [index, block] of words.entries()) {
    texts.push({ ...block, y });
    y += blockHeight(block) + (index === 0 ? GAP_T : 0);
  }
  texts.push(footer(input, P.ink));
  const plateWidth = Math.max(place.cols * place.cell, place.cell * 4);
  return {
    kind: 'bins',
    colours: P,
    texts,
    still: LAST + 7 * (BEAT / 24) + 1.2,
    draw: ({ ctx, t, reduced }) => {
      roundRect(ctx, place.left, floor - 3, plateWidth, 18, 4, P.plate);
      for (const drop of drops) {
        const pose = dropPoseAt(t, drop, reduced);
        posed(ctx, pose, drop.x + place.cell / 2, drop.y + 69 * k, () =>
          glyphBin(ctx, drop.x, drop.y, k, colours)
        );
      }
    },
  };
}
