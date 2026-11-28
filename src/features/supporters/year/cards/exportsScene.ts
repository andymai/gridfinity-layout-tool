import type { CardCopy } from '../components/YearCardView/cardCopy';
import { BEAT, clamp01, easeOut, onGrid, springX } from '../look/motion';
import { PALETTES } from '../look/palettes';
import { sentences } from '../look/splitCopy';
import { roundRect } from './paint';
import {
  CONTENT_TOP,
  GAP_V,
  bandScale,
  blockBottom,
  blockHeight,
  footer,
  scaledBand,
  stackHeight,
  textBlock,
  type Scene,
  type SceneInput,
  type TextBlock,
} from './scene';

/** A full plate is eight by eight. */
export const MAX_PLATE = 64;
const PLATE_X = 120;
const PLATE = 840;
const INNER = 800;

export interface PlateGrid {
  /** Cells across and down. */
  readonly side: number;
  readonly filled: number;
  /** The one that came off as spaghetti, or -1. */
  readonly spaghetti: number;
}

/** The smallest square plate that holds the exports, filled in reading order. */
export function plateGrid(count: number): PlateGrid {
  const filled = Math.max(1, Math.min(MAX_PLATE, Math.round(count)));
  const side = Math.ceil(Math.sqrt(filled));
  return { side, filled, spaghetti: filled >= 3 ? Math.round(0.66 * (filled - 1)) : -1 };
}

/** A build plate of 1×1s; one of them did not print on the first try. */
export function exportsScene(input: SceneInput, copy: CardCopy): Scene {
  const P = PALETTES.exports;
  const title = textBlock(input, {
    key: 'title',
    role: 'title',
    text: copy.title,
    y: CONTENT_TOP,
    color: P.ink,
    enter: 0,
  });
  const top = blockBottom(title) + GAP_V;
  const grid = plateGrid(input.stats.exports);
  const cell = INNER / grid.side;
  const k = cell / 100;
  const cells = Array.from({ length: grid.filled }, (_, index) => {
    const r = Math.floor(index / grid.side);
    const c = index % grid.side;
    const span = Math.max(1, 2 * grid.side - 2);
    return {
      x: PLATE_X + 20 + c * cell + 6 * k,
      y: top + 20 + r * cell + 4 * k,
      start: onGrid(BEAT * (1 + (2 * (r + c)) / span), BEAT / 12),
      spaghetti: index === grid.spaghetti,
    };
  });
  const lines = sentences(copy.lines[0] ?? '', input.locale).map((part, index) =>
    textBlock(input, {
      key: `line${index}`,
      role: 'line',
      text: part,
      y: 0,
      color: P.ink,
      enter: (3 + index) * BEAT,
      reduceEnter: (2 + index * 0.5) * BEAT,
      maxLines: 2,
    })
  );
  const scale = bandScale(top, PLATE + 16, GAP_V + stackHeight(lines));
  const texts: TextBlock[] = [title];
  let y = top + (PLATE + 16) * scale + GAP_V;
  for (const block of lines) {
    texts.push({ ...block, y });
    y += blockHeight(block);
  }
  texts.push(footer(input, P.ink));
  const size = 88 * k;
  return {
    kind: 'exports',
    colours: P,
    texts,
    still: 3 * BEAT + 1,
    draw: scaledBand(top, scale, ({ ctx, t, reduced }) => {
      roundRect(ctx, PLATE_X, top + 16, PLATE, PLATE, 28, P.plateEdge);
      roundRect(ctx, PLATE_X, top, PLATE, PLATE, 28, P.plate);
      for (const bin of cells) {
        let opacity: number;
        let xs = 0;
        if (reduced) opacity = easeOut(clamp01((t - BEAT) / 0.45));
        else {
          xs = springX(t - bin.start, 0.5, 0.2);
          opacity = clamp01((t - bin.start) / 0.04);
        }
        if (opacity <= 0.001) continue;
        const ox = bin.x + size / 2;
        const oy = bin.y + 98 * k * 0.6;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(ox, oy - 14 * xs);
        ctx.scale(1 + 0.14 * xs, 1 + 0.14 * xs);
        ctx.translate(-ox, -oy);
        roundRect(ctx, bin.x, bin.y + 10 * k, size, size, 14 * k, P.wall);
        roundRect(ctx, bin.x, bin.y, size, size, 14 * k, P.bin);
        roundRect(ctx, bin.x + 8 * k, bin.y + 14 * k, 72 * k, 66 * k, 8 * k, P.binLo);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(bin.x + 8 * k, bin.y + 14 * k, 72 * k, 66 * k, 8 * k);
        ctx.clip();
        ctx.fillStyle = P.binShade;
        ctx.fillRect(bin.x + 8 * k, bin.y + 14 * k, 72 * k, 8 * k);
        ctx.restore();
        if (bin.spaghetti) paintSpaghetti(ctx, bin.x, bin.y, k, P.bin);
        ctx.restore();
      }
    }),
  };
}

function paintSpaghetti(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  k: number,
  colour: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke(
    new Path2D('M14 46 C 22 20, 38 70, 46 38 S 70 22, 76 50 S 50 80, 38 62 S 16 72, 22 52')
  );
  ctx.stroke(new Path2D('M24 26 C 42 34, 34 54, 56 52 S 78 66, 66 76'));
  ctx.restore();
}
