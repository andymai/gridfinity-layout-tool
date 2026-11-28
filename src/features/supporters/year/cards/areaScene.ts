import type { CardCopy } from '../components/YearCardView/cardCopy';
import { mix } from '../look/color';
import {
  BEAT,
  clamp01,
  easeInOut,
  easeOut,
  hash,
  onGrid,
  springContact,
  springX,
} from '../look/motion';
import { PALETTES } from '../look/palettes';
import { rect, roundRect } from './paint';
import {
  CARD_H,
  CARD_W,
  GAP_T,
  GAP_V,
  blockBottom,
  footer,
  textBlock,
  type Scene,
  type SceneInput,
} from './scene';

const N = 28;
const CELL = 34;
const FX = 64;
const FY = 196;
const SIZE = N * CELL;
/** The first view shows the bottom-left corner at this zoom. */
const S0 = 4;
const SNAP = 2 * BEAT;
const ZOOM_FROM = 2.5 * BEAT;
const ZOOM_TO = 4 * BEAT;

/** Each colour owns a four-row band, bottom up, with its own bin size: [w, h, colour]. */
const BANDS: readonly (readonly [number, number, string])[] = [
  [4, 2, '#D0105F'],
  [2, 2, '#FF6A1F'],
  [2, 1, '#FFB81C'],
  [1, 2, '#FFE135'],
  [1, 1, '#2EE6A8'],
  [2, 1, '#9ADCFF'],
  [1, 1, '#B49CFF'],
];

interface FieldBin {
  readonly band: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly c0: number;
  readonly r0: number;
  readonly fill: string;
  readonly floor: string;
  readonly lip: string;
}

interface PileBin {
  readonly bin: FieldBin;
  readonly dx: number;
  readonly dy: number;
  readonly rotate: number;
  readonly contact: number;
  readonly fall: number;
}

function buildField(): { readonly bins: FieldBin[]; readonly pile: PileBin[] } {
  const bins: FieldBin[] = [];
  BANDS.forEach(([w, h, fill], band) => {
    for (let r = 0; r < 4 / h; r++) {
      for (let c = 0; c < N / w; c++) {
        const r0 = 4 * band + r * h;
        bins.push({
          band,
          w,
          h,
          x: c * w * CELL,
          y: (N - r0 - h) * CELL,
          c0: c * w,
          r0,
          fill,
          floor: mix(fill, '#000000', 0.22),
          lip: mix(fill, '#000000', 0.38),
        });
      }
    }
  });
  const visibleCols = (CARD_W - FX) / S0 / CELL;
  const visibleRows = (FY + SIZE) / S0 / CELL;
  const extras = new Map<number, number>();
  const chosen: FieldBin[] = [];
  bins.forEach((bin, index) => {
    const visible = bin.c0 < visibleCols && bin.r0 < visibleRows;
    const taken = extras.get(bin.band) ?? 0;
    const extra = !visible && bin.band >= 2 && bin.c0 < 12 && taken < 3 && hash(index, 3) < 0.45;
    if (extra) extras.set(bin.band, taken + 1);
    if (visible || extra) chosen.push(bin);
  });
  chosen.sort((a, b) => b.w * b.h - a.w * a.h || hash(a.x, a.y) - hash(b.x, b.y));
  const viewWidth = (CARD_W - FX) / S0;
  const viewTop = SIZE - (FY + SIZE) / S0;
  const pile = chosen.map((bin, index) => {
    const u = index / chosen.length;
    const cx = viewWidth * (0.16 + 0.68 * hash(index, 7));
    const fromBottom = 10 + 125 * u * (0.55 + 0.45 * hash(index, 9));
    return {
      bin,
      dx: cx - (bin.x + (bin.w * CELL) / 2),
      dy: SIZE - fromBottom - (bin.y + (bin.h * CELL) / 2),
      rotate: (hash(index, 11) - 0.5) * 70,
      contact: onGrid(0.5 * BEAT + BEAT * u, BEAT / 12),
      fall: SIZE - fromBottom - viewTop + 60,
    };
  });
  return { bins, pile };
}

function paintBin(ctx: CanvasRenderingContext2D, bin: FieldBin): void {
  const w = bin.w * CELL - 4;
  const h = bin.h * CELL - 4;
  roundRect(ctx, bin.x + 2, bin.y + 2, w, h, Math.min(9, 5 + bin.w + bin.h), bin.fill);
  roundRect(ctx, bin.x + 6, bin.y + 9, w - 8, h - 11, 3, bin.floor);
  rect(ctx, bin.x + 7, bin.y + 9, w - 10, 3, bin.lip);
}

/** A jumbled pile snaps into colour bands, then the view pulls back to show the scale. */
export function areaScene(input: SceneInput, copy: CardCopy): Scene {
  const P = PALETTES.area;
  const { bins, pile } = buildField();
  const inPile = new Set(pile.map((each) => each.bin));
  const still = buildStill(bins, inPile);
  const title = textBlock(input, {
    key: 'title',
    role: 'title',
    text: copy.title,
    y: FY + SIZE + GAP_V,
    color: P.ink,
    enter: 4 * BEAT,
    reduceEnter: 2 * BEAT,
  });
  const line = textBlock(input, {
    key: 'line',
    role: 'line',
    text: copy.lines[0] ?? '',
    y: blockBottom(title) + GAP_T,
    color: P.ink,
    enter: 4.5 * BEAT,
    reduceEnter: 2.5 * BEAT,
  });
  const SD = 0.5;
  const SB = 0.25;
  const { first } = springContact(SD, SB);
  return {
    kind: 'area',
    colours: P,
    texts: [title, line, footer(input, P.ink)],
    still: ZOOM_TO + 0.2,
    draw: ({ ctx, t, reduced }) => {
      const scale = reduced
        ? 1
        : Math.pow(S0, 1 - easeInOut(clamp01((t - ZOOM_FROM) / (ZOOM_TO - ZOOM_FROM))));
      ctx.save();
      if (reduced) ctx.globalAlpha = easeOut(clamp01((t - BEAT) / 0.45));
      ctx.translate(FX, FY + SIZE);
      ctx.scale(scale, scale);
      ctx.translate(0, -SIZE);
      // Only what the card can show: the field reaches far past it at the first zoom.
      const right = (CARD_W - FX) / scale;
      const top = SIZE - (FY + SIZE) / scale;
      const bottom = SIZE + (CARD_H - FY - SIZE) / scale;
      still(ctx, right, top, bottom);
      for (const each of pile) {
        const { bin } = each;
        let dx = 0;
        let dy = 0;
        let rotate = 0;
        if (!reduced) {
          const fall = each.fall * Math.abs(springX(t - (each.contact - first), SD, SB));
          const snap = springX(t - SNAP, 0.55, 0.22);
          dx = each.dx * snap;
          dy = (each.dy - fall) * snap;
          rotate = each.rotate * snap;
        }
        const cx = bin.x + (bin.w * CELL) / 2;
        const cy = bin.y + (bin.h * CELL) / 2;
        ctx.save();
        ctx.translate(cx + dx, cy + dy);
        ctx.rotate((rotate * Math.PI) / 180);
        ctx.translate(-cx, -cy);
        paintBin(ctx, bin);
        ctx.restore();
      }
      ctx.restore();
    },
  };
}

/** The empty sockets and the bins already in place, culled to the visible part of the field. */
function buildStill(
  bins: readonly FieldBin[],
  inPile: ReadonlySet<FieldBin>
): (ctx: CanvasRenderingContext2D, right: number, top: number, bottom: number) => void {
  const settled = bins.filter((bin) => !inPile.has(bin));
  return (ctx, right, top, bottom) => {
    const socket = PALETTES.area.socket;
    const r0 = Math.max(0, Math.floor(top / CELL));
    const r1 = Math.min(N, Math.ceil(bottom / CELL));
    const c1 = Math.min(N, Math.ceil(right / CELL));
    for (let r = r0; r < r1; r++) {
      for (let c = 0; c < c1; c++)
        roundRect(ctx, c * CELL + 3, r * CELL + 3, CELL - 6, CELL - 6, 6, socket);
    }
    for (const bin of settled) {
      if (bin.x > right || bin.y > bottom || bin.y + bin.h * CELL < top) continue;
      paintBin(ctx, bin);
    }
  };
}
