import type { CardCopy } from '../components/YearCardView/cardCopy';
import { mix, toyShade } from '../look/color';
import { BEAT, REST, dropPose, fadeAt, squash, type DropSpec } from '../look/motion';
import { PALETTES } from '../look/palettes';
import { spools } from '../utils/yearFormat';
import { rect, roundRect } from './paint';
import {
  CONTENT_TOP,
  GAP_V,
  MARGIN,
  bandScale,
  blockBottom,
  footer,
  scaledBand,
  stackHeight,
  textBlock,
  type Scene,
  type SceneInput,
} from './scene';

/** Two rows of five fill the bin. */
export const MAX_SPOOLS = 10;
const PER_ROW = 5;
const SPOOL_W = 160;
const SPOOL_H = 340;
const FLANGE = 24;
const PITCH = 166;
const TOP = 120;
const FACE = 330;
const FOOT = 24;
const BIN_W = 960;
/** The back row stands further in, higher on screen. */
const BACK = TOP - 94;
const COLOURS = [
  '#D0105F',
  '#9ADCFF',
  '#D4FF38',
  '#2EE6A8',
  '#B49CFF',
  '#2733E0',
  '#FF8AD0',
  '#F4F4F4',
  '#007A7A',
  '#FFB81C',
];

export interface SpoolSpot {
  /** 0 is the back row. */
  readonly row: number;
  readonly slot: number;
  readonly x: number;
}

/** Spools in two rows, back first, each row centred in the bin. */
export function spoolSpots(count: number): SpoolSpot[] {
  const n = Math.max(1, Math.min(MAX_SPOOLS, Math.round(count)));
  const back = n > PER_ROW ? Math.floor(n / 2) : 0;
  const rows = back > 0 ? [back, n - back] : [0, n];
  return rows.flatMap((inRow, row) => {
    const offset = ((PER_ROW - inRow) * PITCH) / 2;
    return Array.from({ length: inRow }, (_, slot) => ({
      row,
      slot,
      x: 68 + offset + slot * PITCH + (row === 0 ? 8 : -8),
    }));
  });
}

/** Spools dropped into one big bin, a row per beat. */
export function filamentScene(input: SceneInput, copy: CardCopy): Scene | null {
  const filament = input.stats.filament;
  if (!filament) return null;
  const P = PALETTES.filament;
  const title = textBlock(input, {
    key: 'title',
    role: 'title',
    text: copy.title,
    y: CONTENT_TOP,
    color: P.ink,
    enter: 0,
  });
  const binTop = blockBottom(title) + GAP_V + 24 + SPOOL_H - BACK;
  const c = toyShade(P.bin);
  const spots = spoolSpots(spools(filament.grams)).map((spot) => {
    const y = (spot.row === 0 ? BACK : TOP + 4) - SPOOL_H;
    const colour = COLOURS[(spot.row * PER_ROW + spot.slot) % COLOURS.length] ?? COLOURS[0];
    const drop: DropSpec = {
      contact: (1 + spot.row) * BEAT + spot.slot * (BEAT / 12),
      height: binTop + y + SPOOL_H + 200,
      bounce: 0.25,
      squash: 0.05,
    };
    return { ...spot, y, colour, drop };
  });
  const rows = new Set(spots.map((spot) => spot.row));
  const l1Probe = textBlock(input, {
    key: 'line0',
    role: 'line',
    text: copy.lines[0] ?? '',
    y: 0,
    color: P.ink,
    enter: 2.5 * BEAT,
    reduceEnter: 2 * BEAT,
  });
  const l2Probe = textBlock(input, {
    key: 'line1',
    role: 'line',
    text: copy.lines[1] ?? '',
    y: 0,
    color: P.ink,
    enter: 3 * BEAT,
    reduceEnter: 2.5 * BEAT,
  });
  const bandTop = blockBottom(title) + GAP_V;
  const natural = binTop + TOP + FACE + FOOT - bandTop;
  const scale = bandScale(bandTop, natural, GAP_V + stackHeight([l1Probe, l2Probe]));
  const l1 = { ...l1Probe, y: bandTop + natural * scale + GAP_V };
  const l2 = { ...l2Probe, y: blockBottom(l1) };
  const x0 = MARGIN;
  return {
    kind: 'filament',
    colours: P,
    texts: [title, l1, l2, footer(input, P.ink)],
    still: 2 * BEAT + 5 * (BEAT / 12) + 1.2,
    draw: scaledBand(bandTop, scale, ({ ctx, t, reduced }) => {
      const s = reduced
        ? 0
        : (rows.has(0) ? squash(t - BEAT - 2 * (BEAT / 12), 0.016) : 0) +
          squash(t - 2 * BEAT - 2 * (BEAT / 12), 0.02);
      const pivotX = x0 + BIN_W / 2;
      const pivotY = binTop + TOP + FACE + FOOT;
      ctx.save();
      ctx.translate(pivotX, pivotY);
      ctx.scale(1 + s * 0.3, 1 - s);
      ctx.translate(-pivotX, -pivotY);
      roundRect(ctx, x0 + 40, binTop, BIN_W - 80, TOP + 6, [30, 30, 0, 0], c.hi);
      roundRect(ctx, x0 + 70, binTop + 18, BIN_W - 140, TOP - 18, 16, c.lo);
      for (const spot of spots) {
        const pose = reduced ? { ...REST, opacity: fadeAt(t, BEAT) } : dropPose(t, spot.drop);
        const sx = x0 + spot.x;
        const sy = binTop + spot.y;
        ctx.save();
        ctx.globalAlpha *= pose.opacity;
        ctx.translate(sx + SPOOL_W / 2, sy + SPOOL_H + pose.y);
        ctx.scale(pose.scaleX, pose.scaleY);
        ctx.translate(-(sx + SPOOL_W / 2), -(sy + SPOOL_H));
        if (pose.opacity > 0.001) paintSpool(ctx, sx, sy, spot.colour, P.ink);
        ctx.restore();
      }
      rect(ctx, x0 + 40, binTop + TOP - 20, BIN_W - 80, 26, c.hi);
      roundRect(ctx, x0 + 40, binTop + TOP, BIN_W - 80, FACE, [6, 6, 4, 4], c.face);
      rect(ctx, x0 + 40, binTop + TOP, BIN_W - 80, 22, c.hi);
      roundRect(ctx, x0 + 90, binTop + TOP + FACE, BIN_W - 180, FOOT, [0, 0, 12, 12], c.lo);
      ctx.restore();
    }),
  };
}

function paintSpool(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colour: string,
  flange: string
): void {
  const coreX = x + FLANGE - 4;
  const coreW = SPOOL_W - 2 * FLANGE + 8;
  const dark = mix(colour, '#000000', 0.16);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(coreX, y + 16, coreW, SPOOL_H - 32, 8);
  ctx.clip();
  rect(ctx, coreX, y + 16, coreW, SPOOL_H - 32, colour);
  for (let sx = coreX + 11; sx < coreX + coreW; sx += 14)
    rect(ctx, sx, y + 16, 3, SPOOL_H - 32, dark);
  rect(ctx, coreX, y + 16, coreW, 14, mix(colour, '#FFFFFF', 0.35));
  ctx.restore();
  roundRect(ctx, x, y, FLANGE, SPOOL_H, 11, flange);
  roundRect(ctx, x + SPOOL_W - FLANGE, y, FLANGE, SPOOL_H, 11, flange);
}
