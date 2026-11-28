import type { CardCopy } from '../components/YearCardView/cardCopy';
import {
  BEAT,
  clamp01,
  easeInOut,
  easeOut,
  fadeAt,
  springContact,
  springX,
  squash,
} from '../look/motion';
import { PALETTES } from '../look/palettes';
import { sentences, splitAtLabel } from '../look/splitCopy';
import { formatDuration } from '../utils/yearFormat';
import { ellipse } from './paint';
import {
  CARD_W,
  CONTENT_TOP,
  GAP_K,
  GAP_T,
  TEXT_FLOOR,
  blockBottom,
  blockHeight,
  footer,
  stackHeight,
  textBlock,
  type ModelSlot,
  type Scene,
  type SceneInput,
  type TextBlock,
} from './scene';

/** The print starts at beat 1.5 and lays its layers over three beats. */
export const PRINT_START = 1.5 * BEAT;
export const PRINT_SPAN = 3 * BEAT;
/** Degrees per second of turn: slow enough to read the shape. */
const TURN = 16;
const PRINT_TURN = 10;
const PRINT_END_ANGLE = -32;
const DROP_END_ANGLE = -38;
const CONTACT = 3 * BEAT;
const DROP_SD = 0.75;
const DROP_SB = 0.3;
const DROP_HEIGHT = 1150;

export interface ModelPose {
  readonly opacity: number;
  /** CSS transform for the canvas. */
  readonly transform: string;
  /** Degrees about the vertical axis. */
  readonly angle: number;
  /** Story seconds for the print effect; null draws the part whole. */
  readonly printTime: number | null;
}

/** The model's pose at `t`, a pure function of the card's clock. */
export function modelPose(slot: ModelSlot, t: number, reduced: boolean): ModelPose {
  if (slot.kind === 'print') {
    if (reduced) {
      return {
        opacity: fadeAt(t, PRINT_START, 0.45),
        transform: 'none',
        angle: PRINT_END_ANGLE,
        printTime: null,
      };
    }
    // This card turns the other way, and slower, so the long side faces the camera while it prints.
    return {
      opacity: 1,
      transform: 'none',
      angle: PRINT_END_ANGLE + PRINT_TURN * (slot.end - t),
      printTime: t,
    };
  }
  if (reduced) {
    return {
      opacity: fadeAt(t, BEAT, 0.45),
      transform: 'none',
      angle: DROP_END_ANGLE,
      printTime: null,
    };
  }
  const { first, period } = springContact(DROP_SD, DROP_SB);
  const tt = t - (CONTACT - first);
  const height = DROP_HEIGHT * Math.abs(springX(tt, DROP_SD, DROP_SB));
  const tilt = -9 * springX(tt, 0.85, 0.25);
  const s = squash(t - CONTACT, 0.07) + squash(t - CONTACT - period, 0.02);
  return {
    opacity: tt > 0 ? 1 : 0,
    transform: `translateY(${(-height).toFixed(2)}px) rotate(${tilt.toFixed(2)}deg) scale(${(1 + s * 0.5).toFixed(4)}, ${(1 - s).toFixed(4)})`,
    angle: DROP_END_ANGLE - TURN * (slot.end - t),
    printTime: null,
  };
}

function dropShadow(t: number, reduced: boolean): { opacity: number; scale: number } {
  if (reduced) return { opacity: fadeAt(t, BEAT, 0.45), scale: 1 };
  const { first } = springContact(DROP_SD, DROP_SB);
  const height = DROP_HEIGHT * Math.abs(springX(t - (CONTACT - first), DROP_SD, DROP_SB));
  // Anticipation: the shadow gathers on the floor for two beats before the bin is in frame.
  const gather = easeInOut(clamp01((t - BEAT) / (CONTACT - BEAT)));
  const hop = t > CONTACT ? 1 - Math.min(1, height / 300) : 1;
  const near = gather * hop;
  return { opacity: near, scale: 0.3 + 0.7 * near };
}

/** The 3D slot's height: its full size, or what the text under it leaves. */
function modelHeight(top: number, full: number, textBelow: number): number {
  return Math.max(full * 0.6, Math.min(full, TEXT_FLOOR - top - 8 - textBelow));
}

/** A kicker over a title, from one string with a colon before its value. */
function kickerAndTitle(
  input: SceneInput,
  text: string,
  value: string,
  ink: string,
  titleEnter: number,
  titleReduce: number
): TextBlock[] {
  const split = splitAtLabel(text, value);
  if (!split) {
    return [
      textBlock(input, {
        key: 'title',
        role: 'title',
        text,
        y: CONTENT_TOP,
        color: ink,
        enter: 0,
        maxLines: 3,
      }),
    ];
  }
  const kicker = textBlock(input, {
    key: 'kicker',
    role: 'line',
    text: split.label,
    y: CONTENT_TOP,
    color: ink,
    enter: 0,
    maxLines: 2,
  });
  const title = textBlock(input, {
    key: 'title',
    role: 'title',
    text: split.rest,
    y: blockBottom(kicker) + GAP_K,
    color: ink,
    enter: titleEnter,
    reduceEnter: titleReduce,
    rise: 40,
    maxLines: 2,
  });
  return [kicker, title];
}

/** The longest print printing bottom-up on a slow turn. */
export function longestScene(input: SceneInput, copy: CardCopy): Scene | null {
  const longest = input.stats.longestPrint;
  if (!longest) return null;
  const P = PALETTES.longest;
  const heads = kickerAndTitle(
    input,
    copy.title,
    formatDuration(input.locale, longest.minutes),
    P.ink,
    BEAT,
    BEAT
  );
  const top = blockBottom(heads[heads.length - 1]) + 20;
  const probe = textBlock(input, {
    key: 'line',
    role: 'line',
    text: copy.lines[0] ?? '',
    y: 0,
    color: P.ink,
    enter: 5 * BEAT,
    reduceEnter: 3 * BEAT,
  });
  const height = modelHeight(top, 720, blockHeight(probe));
  const line = { ...probe, y: top + height + 8 };
  const model: ModelSlot = {
    kind: 'print',
    x: 0,
    y: top,
    w: CARD_W,
    h: height,
    origin: '50% 80%',
    end: input.card.beats * BEAT,
    look: {
      tint: P.tint,
      edge: P.ink,
      edgeOpacity: 0.5,
      sky: '#FFFFFF',
      ground: P.ink,
      rim: P.bg,
      fov: 24,
      elevation: 28,
      fit: 0.72,
    },
  };
  return {
    kind: 'longest',
    colours: P,
    texts: [...heads, line, footer(input, P.ink)],
    model,
    still: PRINT_START + 0.5,
    draw: ({ ctx, t, reduced }) => {
      const o = reduced ? fadeAt(t, PRINT_START, 0.45) : easeOut(clamp01((t - PRINT_START) / 0.3));
      if (o <= 0.001) return;
      ctx.save();
      ctx.globalAlpha = o;
      ellipse(ctx, CARD_W / 2, top + height * 0.6 + 75, 380, 75, P.shadow);
      ctx.restore();
    },
  };
}

/** The most complicated design: its shadow gathers, then it drops, hops and turns. */
export function complicatedScene(input: SceneInput, copy: CardCopy): Scene | null {
  const pick = input.complicated;
  if (!pick) return null;
  const P = PALETTES.complicated;
  const heads = kickerAndTitle(input, copy.title, pick.design.name, P.ink, 3 * BEAT, BEAT);
  const top = blockBottom(heads[heads.length - 1]) + 20;
  const parts = sentences(copy.lines[0] ?? '', input.locale);
  const statText = pick.triangles === null || parts.length < 2 ? null : (parts[0] ?? null);
  const below: TextBlock[] = [];
  if (statText) {
    below.push(
      textBlock(input, {
        key: 'stat',
        role: 'title',
        text: statText,
        y: 0,
        color: P.ink,
        enter: 4.5 * BEAT,
        reduceEnter: 2 * BEAT,
        maxLines: 2,
      })
    );
  }
  below.push(
    textBlock(input, {
      key: 'line',
      role: 'line',
      text: statText ? parts.slice(1).join(' ') : (copy.lines[0] ?? ''),
      y: 0,
      color: P.ink,
      enter: statText ? 5 * BEAT : 4.5 * BEAT,
      reduceEnter: 2.5 * BEAT,
      rise: 24,
    })
  );
  const height = modelHeight(top, 820, stackHeight(below, GAP_T));
  const floor = top + height * 0.73;
  const texts: TextBlock[] = [...heads];
  let y = top + height + 8;
  for (const block of below) {
    texts.push({ ...block, y });
    y += blockHeight(block) + GAP_T;
  }
  texts.push(footer(input, P.ink));
  const model: ModelSlot = {
    kind: 'drop',
    x: 0,
    y: top,
    w: CARD_W,
    h: height,
    origin: '50% 73%',
    end: input.card.beats * BEAT,
    look: {
      tint: P.tint,
      edge: P.ink,
      edgeOpacity: 0.32,
      sky: '#FFF4D6',
      ground: P.ink,
      rim: P.bg,
      fov: 24,
      elevation: 30,
      fit: 0.9,
    },
  };
  return {
    kind: 'complicated',
    colours: P,
    texts,
    model,
    still: CONTACT + 1.6,
    draw: ({ ctx, t, reduced }) => {
      const { opacity, scale } = dropShadow(t, reduced);
      if (opacity <= 0.001) return;
      ctx.save();
      ctx.globalAlpha = opacity;
      ellipse(ctx, CARD_W / 2, floor, 360 * scale, 62 * scale, P.shadow);
      ctx.restore();
    },
  };
}
