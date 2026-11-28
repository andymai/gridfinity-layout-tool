import type { CardCopy } from '../components/YearCardView/cardCopy';
import { DISPLAY, TEXT, familyFor } from '../look/fonts';
import {
  BEAT,
  REST,
  clamp01,
  dropPose,
  easeOut,
  fadeAt,
  springContact,
  springX,
  type DropSpec,
} from '../look/motion';
import { PALETTES } from '../look/palettes';
import { splitAtLabel } from '../look/splitCopy';
import { cssFont, fitSize, type FontSpec } from '../look/typeset';
import { formatFootprint } from '../utils/yearFormat';
import { TIMES_SCALE, ellipse, fillTimesCentred, frontBin, posed, roundRect } from './paint';
import { CARD_W, GAP_V, footer, textBlock, type Scene, type SceneInput } from './scene';

const W = 600;
const FACE = 520;
const TOP = 140;
const FOOT = 44;
const KICKER_Y = 400;
const LABEL_W = 420;
const LABEL_H = 250;
const LABEL_AT = 2 * BEAT;

/** A giant bin in the favourite size lands, then its label is slapped on. */
export function sizeScene(input: SceneInput, copy: CardCopy): Scene | null {
  const favourite = input.stats.favouriteSize;
  if (!favourite) return null;
  const P = PALETTES.size;
  const value = formatFootprint(input.locale, favourite.width, favourite.depth);
  const split = splitAtLabel(copy.title, value);
  const kicker = textBlock(input, {
    key: 'kicker',
    role: 'line',
    text: split && split.rest === value ? split.label : copy.title,
    y: KICKER_Y,
    color: P.ink,
    enter: 0,
    maxLines: 2,
  });
  const y = KICKER_Y + 65 + GAP_V;
  const base = y + TOP + FACE + FOOT;
  const x = CARD_W / 2 - W / 2;
  const line = textBlock(input, {
    key: 'line',
    role: 'line',
    text: copy.lines[0] ?? '',
    y: base + GAP_V,
    color: P.ink,
    enter: 3 * BEAT,
    reduceEnter: 2.5 * BEAT,
  });
  const display: FontSpec = {
    family: familyFor(DISPLAY, input.locale),
    weight: 900,
    size: 200,
    lineHeight: 200,
  };
  const labelFont = { ...display, size: fitSize(value, LABEL_W - 60, display, input.measure, 200) };
  const timesFont = cssFont({
    family: familyFor(TEXT, input.locale),
    weight: 600,
    size: labelFont.size * TIMES_SCALE,
    lineHeight: 1,
  });
  const drop: DropSpec = {
    contact: BEAT,
    height: y + TOP + FACE + 220,
    bounce: 0.3,
    squash: 0.06,
    tilt: -6,
  };
  const duration = 0.55 * Math.sqrt(drop.height / 170);
  const { first } = springContact(duration, 0.3);
  return {
    kind: 'size',
    colours: P,
    texts: [kicker, line, footer(input, P.ink)],
    still: LABEL_AT + 1.4,
    draw: ({ ctx, t, reduced }) => {
      const height = drop.height * Math.abs(springX(t - (BEAT - first), duration, 0.3));
      const falling = t > BEAT - first ? 1 - Math.min(1, height / 900) : 0;
      const near = reduced ? fadeAt(t, BEAT) : falling;
      if (near > 0.001) {
        ctx.save();
        ctx.globalAlpha = near;
        const k = reduced ? 1 : 0.4 + 0.6 * near;
        ellipse(ctx, CARD_W / 2, base, 330 * k, 34 * k, P.floorShadow);
        ctx.restore();
      }
      const pose = reduced ? { ...REST, opacity: fadeAt(t, BEAT) } : dropPose(t, drop);
      posed(ctx, pose, CARD_W / 2, base, () => {
        frontBin(
          ctx,
          x,
          y,
          { w: W, face: FACE, top: TOP, foot: FOOT },
          { face: P.face, hi: P.hi, lo: P.lo }
        );
        const lt = t - LABEL_AT;
        const xs = reduced ? 0 : springX(lt, 0.5, 0.3);
        const opacity = reduced ? easeOut(clamp01((t - LABEL_AT) / 0.3)) : clamp01(lt / 0.05);
        if (opacity <= 0.001) return;
        const cx = CARD_W / 2;
        const cy = y + TOP + 150 + LABEL_H / 2;
        ctx.save();
        ctx.globalAlpha *= opacity;
        ctx.translate(cx, cy);
        ctx.rotate(((-2 - 9 * xs) * Math.PI) / 180);
        ctx.scale(1 + 0.14 * xs, 1 + 0.14 * xs);
        roundRect(ctx, -LABEL_W / 2, -LABEL_H / 2, LABEL_W, LABEL_H, 22, P.label);
        ctx.fillStyle = P.ink;
        fillTimesCentred(ctx, value, 0, 0, cssFont(labelFont), timesFont, labelFont.size);
        ctx.restore();
      });
    },
  };
}
