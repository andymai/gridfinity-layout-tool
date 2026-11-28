import type { LayoutPreview } from '@/core/types';
import type { CardCopy } from '../components/YearCardView/cardCopy';
import { assignShadeSteps, categoryShades, type CategoryShade } from '../look/categoryShades';
import { BEAT, clamp01, easeOut, onGrid, springX } from '../look/motion';
import { PALETTES } from '../look/palettes';
import { splitAroundValue } from '../look/splitCopy';
import { formatSize } from '../utils/yearFormat';
import { cachedLayer, roundRect, topBin } from './paint';
import {
  CONTENT_TOP,
  CONTENT_W,
  GAP_T,
  GAP_V,
  MARGIN,
  TEXT_FLOOR,
  blockBottom,
  blockHeight,
  footer,
  textBlock,
  type Scene,
  type SceneInput,
  type TextBlock,
} from './scene';

const GRID_MM = 42;
const FRAME = 14;
const FRONT = 114;
const MAX_HEIGHT = 800;

export interface PlanBin {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly d: number;
  readonly group: string;
}

export interface DrawerFit {
  /** px per grid unit. */
  readonly unit: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** The largest scale at which the whole drawer fits the box, centred across. */
export function fitDrawer(
  width: number,
  depth: number,
  maxWidth: number,
  maxHeight: number
): DrawerFit {
  const w = Math.max(0.5, width);
  const d = Math.max(0.5, depth);
  const unit = Math.min(maxWidth / w, maxHeight / d);
  return { unit, left: MARGIN + (CONTENT_W - w * unit) / 2, width: w * unit, height: d * unit };
}

/**
 * The drawer's bins from the library preview, which already merges every
 * layer and leaves the stash out, cut to the drawer's rectangle (a custom
 * shape draws as its rectangle).
 */
export function planBins(preview: LayoutPreview): PlanBin[] {
  const width = Number(preview.drawerWidth);
  const depth = Number(preview.drawerDepth);
  const bins: PlanBin[] = [];
  for (const bin of preview.binMap ?? []) {
    const x0 = Math.max(0, Number(bin.x));
    const y0 = Math.max(0, Number(bin.y));
    const x1 = Math.min(width, Number(bin.x) + Number(bin.w));
    const y1 = Math.min(depth, Number(bin.y) + Number(bin.d));
    if (!(x1 > x0 && y1 > y0)) continue;
    bins.push({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, group: bin.c });
  }
  return bins;
}

/** Front row first; within a row, left to right on the triplet grid. */
export function binStarts(bins: readonly PlanBin[], width: number): number[] {
  const rows = [...new Set(bins.map((bin) => bin.y))].sort((a, b) => a - b);
  const rowOf = new Map(rows.map((y, index) => [y, index]));
  const span = Math.max(1, rows.length - 1);
  return bins.map((bin) => {
    const row = rowOf.get(bin.y) ?? 0;
    const across = (bin.x + bin.w / 2) / Math.max(0.5, width);
    const rowStart = BEAT * (1 + (2.5 * row) / span);
    return onGrid(rowStart + 0.36 * (1 - (1 - across) * (1 - across)), BEAT / 12);
  });
}

function shadeFor(shades: readonly CategoryShade[], step: number): CategoryShade {
  return shades[step % shades.length] ?? shades[0];
}

interface Piece {
  readonly key: string;
  readonly role: 'title' | 'line';
  readonly text: string;
  readonly enter: number;
  readonly reduce: number;
  readonly rise: number;
}

interface Placed {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly shade: CategoryShade;
  readonly start: number;
  readonly group: number;
}

/** The user's biggest drawer filling front to back, each bin in its category's shade. */
export function drawerScene(input: SceneInput, copy: CardCopy): Scene | null {
  const drawer = input.stats.biggestDrawer;
  if (!drawer) return null;
  const P = PALETTES.biggest;
  const preview = input.drawerPreview;
  const width = preview ? Number(preview.drawerWidth) : drawer.widthMm / GRID_MM;
  const depth = preview ? Number(preview.drawerDepth) : drawer.depthMm / GRID_MM;
  const title = textBlock(input, {
    key: 'title',
    role: 'title',
    text: copy.title,
    y: CONTENT_TOP,
    color: P.ink,
    enter: 0,
  });

  const line = copy.lines[0] ?? '';
  const size = formatSize(input.locale, drawer.widthMm, drawer.depthMm, input.unit);
  const split = splitAroundValue(line, size);
  const pieces: readonly Piece[] = split
    ? [
        {
          key: 'before',
          role: 'line' as const,
          text: split.before,
          enter: 5 * BEAT,
          reduce: 4 * BEAT,
          rise: 24,
        },
        {
          key: 'value',
          role: 'title' as const,
          text: split.value,
          enter: 4.5 * BEAT,
          reduce: 3.5 * BEAT,
          rise: 36,
        },
        {
          key: 'after',
          role: 'line' as const,
          text: split.after,
          enter: 5 * BEAT,
          reduce: 4 * BEAT,
          rise: 24,
        },
      ].filter((piece) => piece.text !== '')
    : [{ key: 'line', role: 'line', text: line, enter: 4.5 * BEAT, reduce: 3.5 * BEAT, rise: 36 }];
  const setPieces = (top: number): TextBlock[] => {
    const blocks: TextBlock[] = [];
    let y = top;
    for (const piece of pieces) {
      const block = textBlock(input, {
        key: piece.key,
        role: piece.role,
        text: piece.text,
        y: blocks.length ? y + GAP_T : y,
        color: P.ink,
        enter: piece.enter,
        reduceEnter: piece.reduce,
        rise: piece.rise,
        maxLines: 2,
        times: piece.role === 'title',
      });
      blocks.push(block);
      y = blockBottom(block);
    }
    return blocks;
  };
  const textHeight =
    setPieces(0).reduce((sum, block) => sum + blockHeight(block), 0) + GAP_T * (pieces.length - 1);
  const top = blockBottom(title) + GAP_V + FRAME;
  const room = Math.min(MAX_HEIGHT, TEXT_FLOOR - top - FRONT - GAP_V - textHeight);
  const fit = fitDrawer(width, depth, CONTENT_W, Math.max(120, room));
  const blocks = setPieces(top + fit.height + FRONT + GAP_V);

  const bins = preview ? planBins(preview) : [];
  const steps = assignShadeSteps(bins);
  const shades = categoryShades(P.bin, P.bg);
  const starts = binStarts(bins, width);
  const gap = Math.min(1.75, fit.unit * 0.042);
  const rows = [...new Set(bins.map((bin) => bin.y))].length;
  const rowRank = new Map(
    [...new Set(bins.map((bin) => bin.y))].sort((a, b) => a - b).map((y, index) => [y, index])
  );
  const placed: Placed[] = bins.map((bin, index) => ({
    x: fit.left + bin.x * fit.unit + gap,
    y: top + fit.height - (bin.y + bin.d) * fit.unit + gap,
    w: bin.w * fit.unit - 2 * gap,
    h: bin.d * fit.unit - 2 * gap,
    shade: shadeFor(shades, steps.get(bin.group) ?? 0),
    start: starts[index] ?? BEAT,
    group: Math.min(2, Math.floor((3 * (rowRank.get(bin.y) ?? 0)) / Math.max(1, rows))),
  }));
  const last = Math.max(BEAT, ...placed.map((bin) => bin.start));

  const frontWidth = fit.width + 2 * FRAME + 16;
  const rail = fit.left - FRAME - 8;
  const radius = Math.min(7, fit.unit * 0.17);
  const furniture = cachedLayer(
    rail,
    top - FRAME,
    frontWidth,
    fit.height + FRAME + FRONT + 4,
    (ctx) => {
      roundRect(
        ctx,
        fit.left - FRAME,
        top - FRAME,
        fit.width + 2 * FRAME,
        fit.height + FRAME,
        [14, 14, 0, 0],
        P.frame
      );
      ctx.fillStyle = P.tray;
      ctx.fillRect(fit.left, top, fit.width, fit.height);
      const inset = fit.unit * 0.096;
      ctx.save();
      ctx.beginPath();
      ctx.rect(fit.left, top, fit.width, fit.height);
      ctx.clip();
      for (let r = 0; r < Math.ceil(depth); r++) {
        for (let c = 0; c < Math.ceil(width); c++) {
          roundRect(
            ctx,
            fit.left + c * fit.unit + inset,
            top + fit.height - (r + 1) * fit.unit + inset,
            fit.unit - 2 * inset,
            fit.unit - 2 * inset,
            fit.unit * 0.17,
            P.socket
          );
        }
      }
      ctx.restore();
      roundRect(ctx, rail, top + fit.height - 4, frontWidth, 22, 6, P.frame);
      roundRect(ctx, rail, top + fit.height + 18, frontWidth, 96, [4, 4, 14, 14], P.front);
      const handle = Math.min(260, frontWidth * 0.4);
      roundRect(
        ctx,
        rail + frontWidth / 2 - handle / 2,
        top + fit.height + 50,
        handle,
        30,
        15,
        P.frame
      );
    }
  );
  const motion = (bin: Placed, t: number, reduced: boolean): { o: number; xs: number } => {
    if (reduced) return { o: easeOut(clamp01((t - (1 + bin.group) * BEAT) / 0.2)), xs: 0 };
    const tt = t - bin.start;
    return { o: clamp01(tt / 0.04), xs: springX(tt, 0.55, 0.18) };
  };
  return {
    kind: 'biggest',
    colours: P,
    texts: [title, ...blocks, footer(input, P.ink)],
    still: last + 1,
    draw: ({ ctx, t, reduced, resolution }) => {
      furniture(ctx, resolution);
      // Shadows first, all of them, so no shadow falls across a bin already down.
      for (const bin of placed) {
        const { o, xs } = motion(bin, t, reduced);
        if (o <= 0.001) continue;
        const lift = Math.max(0, xs);
        ctx.save();
        ctx.globalAlpha = o * (1 - 0.55 * lift);
        ctx.translate(bin.x + bin.w / 2 + 3 + 6 * lift, bin.y + bin.h / 2 + 4 + 18 * lift);
        ctx.scale(1 + 0.04 * lift, 1 + 0.04 * lift);
        roundRect(ctx, -bin.w / 2, -bin.h / 2, bin.w, bin.h, radius, P.trayShade);
        ctx.restore();
      }
      for (const bin of placed) {
        const { o, xs } = motion(bin, t, reduced);
        if (o <= 0.001) continue;
        const cx = bin.x + bin.w / 2;
        const cy = bin.y + bin.h / 2;
        ctx.save();
        ctx.globalAlpha = o;
        ctx.translate(cx, cy - 16 * xs);
        ctx.scale(1 + 0.16 * xs, 1 + 0.16 * xs);
        ctx.translate(-cx, -cy);
        topBin(ctx, bin.x, bin.y, bin.w, bin.h, fit.unit, bin.shade);
        ctx.restore();
      }
    },
  };
}
