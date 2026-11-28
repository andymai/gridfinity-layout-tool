import type { CardCopy } from '../components/YearCardView/cardCopy';
import { toyShade } from '../look/color';
import { DISPLAY, familyFor } from '../look/fonts';
import { BEAT, REST, dropPose, fadeAt, onGrid } from '../look/motion';
import { PALETTES } from '../look/palettes';
import { sentences } from '../look/splitCopy';
import { DISPLAY_TRACKING, fitSize, type FontSpec } from '../look/typeset';
import { frontBin, posed, roundRect } from './paint';
import {
  CONTENT_TOP,
  CONTENT_W,
  GAP_T,
  GAP_V,
  MARGIN,
  bandScale,
  blockBottom,
  footer,
  paragraphsBlock,
  scaledBand,
  stackHeight,
  textBlock,
  type Scene,
  type SceneInput,
} from './scene';

/** The tallest stack is this many bins; a bigger month counts several items to a bin. */
export const MAX_STACK = 19;
const PITCH = 34;
const COLUMN = 80;
const BIN_W = 70;
const CHART_H = (MAX_STACK - 1) * PITCH + 10 + 28 + 6;
const PALE = { face: '#FFD6EE', hi: '#FFF0F8', lo: '#E37BB8' };

export interface MonthStacks {
  readonly stacks: readonly number[];
  /** Px from one bin to the next in a stack. */
  readonly pitch: number;
}

/**
 * Bins per month. One bin is one item while the busiest month fits the
 * chart; past that, bins scale so the busiest stack is the full height. A
 * small year gets taller bins, so its chart still fills the card.
 */
export function monthStacks(counts: readonly number[]): MonthStacks {
  const max = Math.max(0, ...counts);
  const tallest = Math.max(1, Math.min(MAX_STACK, max));
  const stacks = counts.map((count) =>
    count <= 0 ? 0 : Math.max(1, Math.round((count / Math.max(1, max)) * tallest))
  );
  const pitch = Math.min(PITCH * 3, ((MAX_STACK - 1) * PITCH) / Math.max(1, tallest - 1));
  return { stacks, pitch: tallest === 1 ? PITCH * 3 : pitch };
}

/** A year of stacked bins; the busiest month keeps going after the rest have stopped. */
export function monthScene(input: SceneInput, copy: CardCopy): Scene | null {
  const busiest = input.stats.busiestMonth;
  if (!busiest) return null;
  const P = PALETTES.month;
  const label = textBlock(input, {
    key: 'kicker',
    role: 'line',
    text: copy.kicker ?? '',
    y: CONTENT_TOP,
    color: P.ink,
    enter: 0,
  });
  const base = blockBottom(label) + GAP_V + CHART_H;
  const { stacks, pitch } = monthStacks(input.stats.monthCounts);
  const k = pitch / PITCH;
  const foot = Math.round(6 * Math.sqrt(k));
  const top = Math.round(10 * Math.sqrt(k));
  const face = pitch - foot;
  const tallest = Math.max(1, ...stacks);
  const hot = toyShade(P.month);
  const bins = stacks.flatMap((count, month) =>
    Array.from({ length: count }, (_, r) => {
      const y = base - foot - face - top - r * pitch;
      const rise = tallest > 1 ? r / (tallest - 1) : 0;
      return {
        x: 65 + month * COLUMN,
        y,
        shade: month === busiest.month ? hot : PALE,
        drop: {
          contact:
            onGrid(BEAT * (1 + 3 * Math.pow(rise, 0.9)), BEAT / 12) + (month % 3) * (BEAT / 24),
          height: y + 160,
          bounce: 0.22,
          squash: 0.08,
        },
      };
    })
  );
  // Each stack draws bottom up, so a bin's lid tucks under the one above.
  bins.sort((a, b) => b.y - a.y);
  const display: FontSpec = {
    tracking: DISPLAY_TRACKING,
    family: familyFor(DISPLAY, input.locale),
    weight: 900,
    size: 100,
    lineHeight: 86,
  };
  const size = fitSize(copy.title, CONTENT_W, display, input.measure, 330);
  const wordProbe = textBlock(input, {
    key: 'title',
    role: 'title',
    text: copy.title,
    y: 0,
    color: P.month,
    enter: 4.5 * BEAT,
    reduceEnter: 2 * BEAT,
    rise: 44,
    maxLines: 1,
    font: { ...display, size, lineHeight: size * 0.86 },
  });
  const lineProbe = paragraphsBlock(input, {
    key: 'line',
    role: 'line',
    text: '',
    paragraphs: sentences(copy.lines[0] ?? '', input.locale),
    y: 0,
    color: P.ink,
    enter: 5 * BEAT,
    reduceEnter: 2.5 * BEAT,
  });
  const bandTop = blockBottom(label) + GAP_V;
  const natural = base + 12 - bandTop;
  const scale = bandScale(bandTop, natural, GAP_V + stackHeight([wordProbe, lineProbe], GAP_T));
  const word = { ...wordProbe, y: bandTop + natural * scale + GAP_V };
  const line = { ...lineProbe, y: blockBottom(word) + GAP_T };
  return {
    kind: 'month',
    colours: P,
    texts: [label, word, line, footer(input, P.ink)],
    still: 4 * BEAT + 3 * (BEAT / 24) + 1.2,
    draw: scaledBand(bandTop, scale, ({ ctx, t, reduced }) => {
      roundRect(ctx, MARGIN, base - 2, CONTENT_W, 14, 5, P.plate);
      for (const bin of bins) {
        const pose = reduced ? { ...REST, opacity: fadeAt(t, BEAT) } : dropPose(t, bin.drop);
        posed(ctx, pose, bin.x + BIN_W / 2, bin.y + top + face + foot, () =>
          frontBin(ctx, bin.x, bin.y, { w: BIN_W, face, top, foot }, bin.shade)
        );
      }
    }),
  };
}
