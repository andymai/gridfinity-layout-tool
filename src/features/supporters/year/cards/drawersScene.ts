import type { CardCopy } from '../components/YearCardView/cardCopy';
import { mix } from '../look/color';
import { BEAT, clamp01, easeOut, springContact, springX, squash } from '../look/motion';
import { PALETTES, toy } from '../look/palettes';
import { roundRect, roundRectPath } from './paint';
import {
  CONTENT_W,
  GAP_V,
  MARGIN,
  TEXT_FLOOR,
  blockBottom,
  blockHeight,
  footer,
  textBlock,
  type Scene,
  type SceneInput,
} from './scene';

/** A chest shows at most this many drawers; more would be slivers. */
export const MAX_DRAWERS = 12;
const PAD = 26;
const GAP = 20;
const FRONT_H = 226;
const OPEN = 62;
const CHEST_MAX = 2 * PAD + 3 * FRONT_H + 2 * GAP;

export interface DrawerSlot {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly row: number;
  readonly col: number;
}

export interface ChestLayout {
  readonly slots: readonly DrawerSlot[];
  readonly height: number;
  readonly rows: number;
}

/**
 * Drawer fronts two across (one for a single drawer), an odd last drawer
 * spanning the chest, fronts sized to fit `maxHeight`.
 */
export function chestLayout(count: number, top: number, maxHeight: number): ChestLayout {
  const shown = Math.max(1, Math.min(MAX_DRAWERS, Math.round(count)));
  const cols = shown === 1 ? 1 : 2;
  const rows = Math.ceil(shown / cols);
  const room = Math.min(CHEST_MAX, maxHeight);
  const h = Math.max(40, Math.min(FRONT_H, (room - 2 * PAD - (rows - 1) * GAP) / rows));
  const half = (CONTENT_W - 2 * PAD - GAP) / 2;
  const slots: DrawerSlot[] = [];
  for (let index = 0; index < shown; index++) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const wide = cols === 1 || (index === shown - 1 && shown % 2 === 1);
    slots.push({
      x: MARGIN + PAD + col * (half + GAP),
      y: top + PAD + row * (h + GAP),
      w: wide ? CONTENT_W - 2 * PAD : half,
      h,
      row,
      col,
    });
  }
  return { slots, height: 2 * PAD + rows * h + (rows - 1) * GAP, rows };
}

/** The beat each row shuts on: one row a beat up to three rows, closer for more. */
export function rowContact(row: number, rows: number): number {
  const step = rows <= 3 ? 1 : Math.max(0.25, Math.round((2.5 / (rows - 1)) * 4) / 4);
  return (1 + row * step) * BEAT;
}

/** A chest of drawers, one row shutting per beat. */
export function drawersScene(input: SceneInput, copy: CardCopy): Scene {
  const P = PALETTES.drawers;
  const title = textBlock(input, {
    key: 'title',
    role: 'title',
    text: copy.title,
    y: 196,
    color: P.ink,
    enter: 0,
  });
  const top = blockBottom(title) + GAP_V;
  const lineText = copy.lines[0] ?? '';
  const probe = textBlock(input, {
    key: 'line',
    role: 'line',
    text: lineText,
    y: 0,
    color: P.ink,
    enter: 0,
  });
  const room = TEXT_FLOOR - blockHeight(probe) - GAP_V - 24 - top;
  const chest = chestLayout(input.stats.drawers, top, room);
  const last = rowContact(chest.rows - 1, chest.rows);
  const line = { ...probe, y: top + chest.height + 24 + GAP_V, enter: Math.max(3 * BEAT, last) };
  const SD = 0.55;
  const SB = 0.22;
  const { first } = springContact(SD, SB);
  const fronts = chest.slots.map((slot) => {
    const k = slot.h / FRONT_H;
    const inner = Math.max(1, Math.floor((slot.w - 18) / 104));
    const bins = Array.from({ length: inner }, (_, b) => toy(slot.row * 5 + slot.col * 3 + b * 2));
    return { slot, k, bins, contact: rowContact(slot.row, chest.rows) + slot.col * (BEAT / 8) };
  });
  return {
    kind: 'drawers',
    colours: P,
    texts: [title, line, footer(input, P.ink)],
    still: last + 1.2,
    draw: ({ ctx, t, reduced }) => {
      roundRect(ctx, MARGIN, top, CONTENT_W, chest.height, 26, P.cab);
      for (const fx of [150, 870])
        roundRect(ctx, fx, top + chest.height - 6, 60, 30, [0, 0, 10, 10], P.cab);
      for (const { slot, k, bins, contact } of fronts) {
        const { x, y, w, h } = slot;
        ctx.save();
        ctx.beginPath();
        roundRectPath(ctx, x, y, w, h, 12);
        ctx.clip();
        ctx.fillStyle = P.inside;
        ctx.fillRect(x, y, w, h);
        bins.forEach((colour, b) => {
          roundRect(ctx, x + 18 + b * 104, y + 14 * k, 92, 40 * k, 9, colour);
          roundRect(ctx, x + 30 + b * 104, y + 22 * k, 68, 22 * k, 5, mix(colour, '#000000', 0.38));
        });
        ctx.restore();
        let open = 0;
        let sx = 1;
        let sy = 1;
        let alpha = 1;
        if (reduced) {
          alpha = easeOut(clamp01((t - (contact - (slot.col * BEAT) / 8)) / 0.3));
        } else {
          const x2 = Math.abs(springX(t - (contact - first), SD, SB));
          const s = squash(t - contact, 0.035);
          open = OPEN * k * x2;
          sx = 1 + 0.05 * x2 + s * 0.4;
          sy = 1 + 0.05 * x2 - s;
        }
        if (alpha <= 0.001) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x + w / 2, y + h + open);
        ctx.scale(sx, sy);
        ctx.translate(-(x + w / 2), -(y + h));
        roundRect(ctx, x, y, w, h, 12, P.front);
        roundRect(ctx, x, y, w, Math.max(6, 12 * k), [12, 12, 0, 0], P.frontHi);
        const hw = 140 * Math.min(1, k * 1.2);
        roundRect(ctx, x + w / 2 - hw / 2, y + 52 * k, hw, 50 * k, 8, P.frontLo);
        roundRect(ctx, x + w / 2 - hw / 2 + 5, y + 52 * k + 5, hw - 10, 50 * k - 10, 4, P.holder);
        const gw = 180 * Math.min(1, k * 1.2);
        roundRect(ctx, x + w / 2 - gw / 2, y + 136 * k, gw, 30 * k, 15 * k, P.cab);
        ctx.restore();
      }
    },
  };
}
