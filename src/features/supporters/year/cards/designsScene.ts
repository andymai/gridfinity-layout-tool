import type { CardCopy } from '../components/YearCardView/cardCopy';
import { toyShade } from '../look/color';
import { BEAT, clamp01, easeOut, hash, springContact, springX, squash } from '../look/motion';
import { PALETTES } from '../look/palettes';
import { frontBin, rect, roundRect } from './paint';
import {
  CONTENT_W,
  GAP_V,
  MARGIN,
  bandScale,
  blockBottom,
  blockHeight,
  footer,
  scaledBand,
  textBlock,
  type Scene,
  type SceneInput,
} from './scene';

/** Shelf units across: a 1-unit bin is 80 px. */
const UNIT = 80;
const UNITS = CONTENT_W / UNIT;
const SHELVES = 4;
const SHELF_PITCH = 260;
const SETS = ['#FFE135', '#F4F4F4', '#9ADCFF', '#FF8AD0'] as const;
/** Widths in units, in order; 34 designs fill four shelves exactly. */
const WIDTHS = [
  1, 1, 2, 1, 1, 2, 1, 2, 1, 2, 1, 1, 2, 2, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 2, 2, 1, 2, 1,
  2,
];

export interface ShelfBin {
  readonly shelf: number;
  /** Place on its shelf, left to right. */
  readonly index: number;
  /** Units from the shelf's left end. */
  readonly at: number;
  readonly units: number;
}

/** One bin per design, packed left to right onto at most four shelves; the rest do not fit. */
export function packShelves(count: number): ShelfBin[] {
  const bins: ShelfBin[] = [];
  let shelf = 0;
  let at = 0;
  let index = 0;
  for (let i = 0; i < Math.max(0, Math.round(count)); i++) {
    const units = WIDTHS[i % WIDTHS.length] ?? 1;
    if (at + units > UNITS) {
      shelf += 1;
      at = 0;
      index = 0;
    }
    if (shelf >= SHELVES) break;
    bins.push({ shelf, index, at, units });
    at += units;
    index += 1;
  }
  return bins;
}

interface Drawn {
  readonly bin: ShelfBin;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly face: number;
  readonly colour: string;
  readonly lip: boolean;
  readonly compartments: number;
  readonly label: boolean;
}

/** Shelves of designed bins slide in, one shelf per beat. */
export function designsScene(input: SceneInput, copy: CardCopy): Scene {
  const P = PALETTES.designs;
  const title = textBlock(input, {
    key: 'title',
    role: 'title',
    text: copy.title,
    y: 196,
    color: P.ink,
    enter: 0,
  });
  const packed = packShelves(input.stats.designs);
  const shelves = Math.max(1, ...packed.map((bin) => bin.shelf + 1));
  const bandTop = blockBottom(title) + GAP_V;
  const firstShelf = bandTop + 226;
  const shelfY = (k: number): number => firstShelf + k * SHELF_PITCH;
  const drawn: Drawn[] = packed.map((bin) => {
    const h = hash(bin.shelf, bin.index);
    const h2 = hash(bin.index + 7, bin.shelf + 3);
    const face = [96, 136, 176][Math.floor(h * 3)] ?? 136;
    return {
      bin,
      x: MARGIN + 4 + bin.at * UNIT,
      y: shelfY(bin.shelf) - 10 - face - 26,
      w: bin.units * UNIT - 8,
      face,
      colour: SETS[Math.floor(h2 * 4)] ?? SETS[0],
      lip: h2 > 0.2,
      compartments: 1 + Math.floor(hash(bin.shelf * 3, bin.index * 5) * (bin.units === 2 ? 4 : 2)),
      label: hash(bin.index, bin.shelf * 9) > 0.45,
    };
  });
  const probe = textBlock(input, {
    key: 'line',
    role: 'line',
    text: copy.lines[0] ?? '',
    y: 0,
    color: P.ink,
    enter: Math.max(3, shelves) * BEAT,
    reduceEnter: Math.max(2, shelves - 1) * BEAT,
  });
  const natural = shelfY(shelves - 1) + 16 - bandTop;
  const scale = bandScale(bandTop, natural, GAP_V + blockHeight(probe));
  const line = { ...probe, y: bandTop + natural * scale + GAP_V };
  const SD = 0.75;
  const SB = 0.2;
  const { first } = springContact(SD, SB);
  return {
    kind: 'designs',
    colours: P,
    texts: [title, line, footer(input, P.ink)],
    still: (shelves + 1) * BEAT + 1.4,
    draw: scaledBand(bandTop, scale, ({ ctx, t, reduced }) => {
      for (let k = 0; k < shelves; k++)
        roundRect(ctx, MARGIN, shelfY(k) - 2, CONTENT_W, 18, 5, P.shelf);
      for (let k = 0; k < shelves; k++) {
        const contact = (1 + k) * BEAT;
        ctx.save();
        if (reduced) ctx.globalAlpha = easeOut(clamp01((t - contact) / 0.3));
        else ctx.translate(1100 * Math.abs(springX(t - (contact - first), SD, SB)), 0);
        for (const bin of drawn) {
          if (bin.bin.shelf !== k) continue;
          const s = reduced ? 0 : squash(t - contact - bin.bin.index * (BEAT / 24), 0.07);
          const bottom = bin.y + bin.face + 36;
          ctx.save();
          ctx.translate(bin.x, bottom);
          ctx.scale(1 - s * 0.6, 1 + s * 0.3);
          ctx.translate(-bin.x, -bottom);
          paintDesign(ctx, bin);
          ctx.restore();
        }
        ctx.restore();
      }
    }),
  };
}

function paintDesign(ctx: CanvasRenderingContext2D, bin: Drawn): void {
  const shade = toyShade(bin.colour);
  const top = 26;
  frontBin(ctx, bin.x, bin.y, { w: bin.w, face: bin.face, top, foot: 10, lip: bin.lip }, shade);
  const cavX = bin.x + Math.round(bin.w * 0.15);
  const cavW = Math.round(bin.w * 0.7);
  const cavY = bin.y + Math.round(top * 0.24);
  const cavH = Math.round(top * 0.56);
  for (let d = 1; d < bin.compartments; d++) {
    rect(ctx, cavX + (cavW * d) / bin.compartments - 2.5, cavY, 5, cavH, shade.hi);
  }
  if (bin.label) {
    const inset = Math.round(bin.w * 0.06);
    const faceX = bin.x + inset;
    const faceW = bin.w - 2 * inset;
    roundRect(ctx, faceX + faceW * 0.18, bin.y + top + 20, faceW * 0.64, 24, 4, shade.lo);
    roundRect(ctx, faceX + faceW * 0.18 + 3, bin.y + top + 23, faceW * 0.64 - 6, 18, 2, '#FFFFFF');
  }
}
