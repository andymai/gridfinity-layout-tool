import type { CardCopy } from '../components/YearCardView/cardCopy';
import { toyShade } from '../look/color';
import { BEAT, REST, dropPose, fadeAt, hash, onGrid } from '../look/motion';
import { PALETTES, toy } from '../look/palettes';
import { frontBin, posed, roundRect } from './paint';
import {
  CONTENT_TOP,
  GAP_V,
  bandScale,
  blockBottom,
  blockHeight,
  footer,
  scaledBand,
  textBlock,
  type Scene,
  type SceneInput,
} from './scene';

/** One bin per supporter, ten across, five rows at most. */
export const MAX_SUPPORTER_BINS = 50;
const COLS = 10;
const CW = 92;
const FACE = 80;
const TOP = 22;
const FOOT = 8;
const PITCH = FACE + FOOT;
const X0 = 80;
/** Two keys, each 150 px with its wall, 170 apart. */
const KEYS_HEIGHT = 320;

export interface SupporterSpot {
  /** Row from the bottom. */
  readonly r: number;
  readonly c: number;
  /** Left edge in px. */
  readonly x: number;
}

/** Full rows from the bottom up; a short top row sits centred on the one below. */
export function supporterSpots(count: number): SupporterSpot[] {
  const n = Math.max(0, Math.min(MAX_SUPPORTER_BINS, Math.round(count)));
  const spots: SupporterSpot[] = [];
  for (let index = 0; index < n; index++) {
    const r = Math.floor(index / COLS);
    const inRow = Math.min(COLS, n - r * COLS);
    const c = index % COLS;
    spots.push({ r, c, x: X0 + ((COLS - inRow) * CW) / 2 + c * CW });
  }
  return spots;
}

/** A bin for each person who kept the year free, in every colour of the year. */
export function thanksScene(input: SceneInput, copy: CardCopy): Scene {
  const P = PALETTES.thanks;
  const title = textBlock(input, {
    key: 'title',
    role: 'title',
    text: copy.title,
    y: CONTENT_TOP,
    color: P.ink,
    enter: 0,
  });
  const spots = supporterSpots(input.supporterCount);
  const rows = Math.max(1, ...spots.map((spot) => spot.r + 1));
  const base = blockBottom(title) + GAP_V + TOP + FACE + FOOT + (rows - 1) * PITCH;
  const bins = spots.map((spot) => {
    const y = base - FOOT - FACE - TOP - spot.r * PITCH;
    const rise = rows > 1 ? Math.pow(spot.r / (rows - 1), 0.85) : 0;
    return {
      ...spot,
      y,
      shade: toyShade(toy(spot.c * 3 + spot.r * 7)),
      drop: {
        contact:
          onGrid(BEAT * (1 + 2 * rise), BEAT / 12) +
          Math.floor(hash(spot.r, spot.c) * 3) * (BEAT / 24),
        height: y + 200,
        bounce: 0.22,
        squash: 0.08,
      },
    };
  });
  // Upper rows rest on the lower ones, so the bottom row draws first.
  bins.sort((a, b) => a.r - b.r);
  const probe = textBlock(input, {
    key: 'line',
    role: 'line',
    text: copy.lines[0] ?? '',
    y: 0,
    color: P.ink,
    enter: 3 * BEAT,
    reduceEnter: 2 * BEAT,
  });
  const bandTop = blockBottom(title) + GAP_V;
  const natural = base + 15 - bandTop;
  const scale = bandScale(bandTop, natural, GAP_V + blockHeight(probe) + GAP_V + KEYS_HEIGHT);
  const line = { ...probe, y: bandTop + natural * scale + GAP_V };
  return {
    kind: 'thanks',
    colours: P,
    texts: [title, line, footer(input, P.ink)],
    keys: { y: blockBottom(line) + GAP_V, enter: [4 * BEAT, 4.5 * BEAT] },
    still: 3 * BEAT + 3 * (BEAT / 24) + 1.2,
    draw: scaledBand(bandTop, scale, ({ ctx, t, reduced }) => {
      roundRect(ctx, X0, base - 3, COLS * CW, 18, 5, P.plate);
      for (const bin of bins) {
        const pose = reduced ? { ...REST, opacity: fadeAt(t, BEAT) } : dropPose(t, bin.drop);
        posed(ctx, pose, bin.x + CW / 2, bin.y + TOP + FACE + FOOT, () =>
          frontBin(ctx, bin.x, bin.y, { w: CW, face: FACE, top: TOP, foot: FOOT }, bin.shade)
        );
      }
    }),
  };
}
