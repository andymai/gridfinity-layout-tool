import { toyShade } from '../look/color';
import { DISPLAY, familyFor } from '../look/fonts';
import { BEAT, dropPose, fadeAt, REST, type DropSpec } from '../look/motion';
import { PALETTES } from '../look/palettes';
import type { CardCopy } from '../components/YearCardView/cardCopy';
import { cssFont, fitSize, type FontSpec } from '../look/typeset';
import { fillCentred, frontBin, posed, roundRect } from './paint';
import { CONTENT_W, GAP_V, MARGIN, footer, textBlock, type Scene, type SceneInput } from './scene';

const COLOURS = ['#FF8AD0', '#9ADCFF', '#D4FF38', '#FFB81C'] as const;
const GAP = 24;
const FACE = 310;
const TOP = 60;
const FOOT = 20;
const BLOCK_Y = 612;
const BASE = BLOCK_Y + TOP + FACE + FOOT;

/** The year in toy blocks, one landing per beat. */
export function introScene(input: SceneInput, copy: CardCopy): Scene {
  const P = PALETTES.intro;
  const digits = String(input.stats.year).split('');
  const w = (CONTENT_W - (digits.length - 1) * GAP) / digits.length;
  const base: FontSpec = {
    family: familyFor(DISPLAY, input.locale),
    weight: 900,
    size: 262,
    lineHeight: 262,
  };
  const blocks = digits.map((digit, index) => {
    const x = MARGIN + index * (w + GAP);
    const font = { ...base, size: fitSize(digit, w * 0.78, base, input.measure, 262) };
    const drop: DropSpec = {
      contact: (index + 1) * BEAT,
      height: BLOCK_Y + TOP + FACE + 260,
      bounce: 0.25,
      squash: 0.07,
      tilt: index % 2 ? 5 : -5,
    };
    return { digit, x, font, drop, shade: toyShade(COLOURS[index % COLOURS.length] ?? COLOURS[0]) };
  });
  const text = textBlock(input, {
    key: 'line',
    role: 'line',
    text: copy.title,
    y: BASE + 16 + GAP_V,
    color: P.ink,
    enter: 4 * BEAT,
  });
  return {
    kind: 'intro',
    colours: P,
    texts: [text, footer(input, P.ink)],
    still: (digits.length + 2) * BEAT,
    draw: ({ ctx, t, reduced }) => {
      roundRect(ctx, MARGIN, BASE - 4, CONTENT_W, 20, 6, P.plate);
      for (const block of blocks) {
        const pose = reduced
          ? { ...REST, opacity: fadeAt(t, block.drop.contact) }
          : dropPose(t, block.drop);
        posed(ctx, pose, block.x + w / 2, BASE, () => {
          frontBin(ctx, block.x, BLOCK_Y, { w, face: FACE, top: TOP, foot: FOOT }, block.shade);
          ctx.fillStyle = P.digit;
          fillCentred(
            ctx,
            block.digit,
            block.x + w / 2,
            BLOCK_Y + TOP + 26 + (FACE - 26) / 2,
            cssFont(block.font)
          );
        });
      }
    },
  };
}
