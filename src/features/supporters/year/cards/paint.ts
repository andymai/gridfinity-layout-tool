import type { BinShade } from '../look/color';
import type { Pose } from '../look/motion';
import type { CategoryShade } from '../look/categoryShades';

type Ctx = CanvasRenderingContext2D;
type Radii = number | readonly [number, number, number, number];

/**
 * A region that never moves, painted once per resolution and then copied, so
 * a big socket grid costs one image draw a frame.
 */
export function cachedLayer(
  x: number,
  y: number,
  w: number,
  h: number,
  paint: (ctx: Ctx) => void
): (ctx: Ctx, resolution: number) => void {
  let canvas: HTMLCanvasElement | null = null;
  let painted = 0;
  return (ctx, resolution) => {
    if (typeof document === 'undefined' || w <= 0 || h <= 0) {
      paint(ctx);
      return;
    }
    if (!canvas || painted !== resolution) {
      canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(w * resolution));
      canvas.height = Math.max(1, Math.ceil(h * resolution));
      const layer = canvas.getContext('2d');
      if (!layer) {
        canvas = null;
        paint(ctx);
        return;
      }
      layer.scale(resolution, resolution);
      layer.translate(-x, -y);
      paint(layer);
      painted = resolution;
    }
    ctx.drawImage(canvas, x, y, w, h);
  };
}

export interface GlyphPart {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly r: number;
  /** Drawn in the card's tint or its ink. */
  readonly colour: 'tint' | 'edge';
  readonly opacity: number;
}

/** A drawn bin on a 120-unit square, for a design with no mesh and no thumbnail. */
export const BIN_GLYPH: readonly GlyphPart[] = [
  { x: 14, y: 20, w: 92, h: 22, r: 8, colour: 'tint', opacity: 0.7 },
  { x: 22, y: 25, w: 76, h: 12, r: 4, colour: 'edge', opacity: 0.35 },
  { x: 14, y: 36, w: 92, h: 64, r: 5, colour: 'tint', opacity: 1 },
  { x: 22, y: 100, w: 76, h: 10, r: 3, colour: 'edge', opacity: 0.5 },
];

/** The drawn bin's square is this share of its box's shorter side. */
export const GLYPH_SHARE = 0.6;

/** The drawn bin centred in a box, at the share of the box the page gives it. */
export function paintBinGlyph(
  ctx: Ctx,
  box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  tint: string,
  edge: string
): void {
  const size = Math.min(box.w, box.h) * GLYPH_SHARE;
  const k = size / 120;
  const left = box.x + (box.w - size) / 2;
  const top = box.y + (box.h - size) / 2;
  ctx.save();
  for (const part of BIN_GLYPH) {
    ctx.globalAlpha = part.opacity;
    roundRect(
      ctx,
      left + part.x * k,
      top + part.y * k,
      part.w * k,
      part.h * k,
      part.r * k,
      part.colour === 'tint' ? tint : edge
    );
  }
  ctx.restore();
}

/** A thumbnail standing in for a 3D bin is this many card px square. */
export const THUMB_SIZE = 660;

/**
 * An image fitted into a box and multiplied by a tint, its own alpha kept: a
 * grey thumbnail comes out in the card's colour with its shading intact.
 */
export function drawTinted(
  ctx: Ctx,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  tint: string
): void {
  const width = 'width' in image ? Number(image.width) : 0;
  const height = 'height' in image ? Number(image.height) : 0;
  if (!(width > 0 && height > 0) || typeof document === 'undefined') return;
  const scale = Math.min(w / width, h / height);
  const dw = width * scale;
  const dh = height * scale;
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.round(dw * ctx.getTransform().a));
  layer.height = Math.max(1, Math.round(dh * ctx.getTransform().d));
  const lc = layer.getContext('2d');
  if (!lc) return;
  lc.drawImage(image, 0, 0, layer.width, layer.height);
  lc.globalCompositeOperation = 'multiply';
  lc.fillStyle = tint;
  lc.fillRect(0, 0, layer.width, layer.height);
  lc.globalCompositeOperation = 'destination-in';
  lc.drawImage(image, 0, 0, layer.width, layer.height);
  ctx.drawImage(layer, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function radiiFor(r: Radii, w: number, h: number): number[] {
  const max = Math.max(0, Math.min(w, h) / 2);
  const list = typeof r === 'number' ? [r, r, r, r] : [...r];
  return list.map((each) => Math.max(0, Math.min(max, each)));
}

/**
 * Adds a rounded rectangle to the current path. Built from arcs because
 * `CanvasRenderingContext2D.roundRect` is missing in Safari 15 and Firefox
 * before 112, which the app still supports.
 */
export function roundRectPath(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: Radii
): void {
  const [tl = 0, tr = 0, br = 0, bl = 0] = radiiFor(r, w, h);
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

export function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: Radii,
  fill: string
): void {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

export function ellipse(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string
): void {
  if (rx <= 0 || ry <= 0) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws `paint` under a pose, scaled and turned about (ox, oy). */
export function posed(ctx: Ctx, pose: Pose, ox: number, oy: number, paint: () => void): void {
  if (pose.opacity <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, pose.opacity);
  ctx.translate(ox + pose.x, oy + pose.y);
  if (pose.rotate) ctx.rotate((pose.rotate * Math.PI) / 180);
  if (pose.scaleX !== 1 || pose.scaleY !== 1) ctx.scale(pose.scaleX, pose.scaleY);
  ctx.translate(-ox, -oy);
  paint();
  ctx.restore();
}

export interface FrontBinSize {
  readonly w: number;
  readonly face: number;
  readonly top: number;
  readonly foot: number;
  readonly lip?: boolean;
}

/**
 * A bin seen from the front and a little above: the open top with its
 * cavity, the face with a lit lip, and the narrower foot.
 */
export function frontBin(ctx: Ctx, x: number, y: number, size: FrontBinSize, c: BinShade): void {
  const { w, face, top, foot } = size;
  const inset = Math.round(w * 0.06);
  const r = Math.max(4, Math.round(w * 0.1));
  const bw = w - 2 * inset;
  const rf = Math.round(r * 0.45);
  const rb = Math.round(r * 0.3);
  roundRect(ctx, x + inset, y, bw, top + 6, [r, r, 0, 0], c.hi);
  roundRect(
    ctx,
    x + Math.round(w * 0.15),
    y + Math.round(top * 0.24),
    Math.round(w * 0.7),
    Math.round(top * 0.56),
    Math.round(r * 0.5),
    c.lo
  );
  roundRect(ctx, x + inset, y + top, bw, face, [rf, rf, rb, rb], c.face);
  if (size.lip !== false) {
    roundRect(ctx, x + inset, y + top, bw, Math.max(5, Math.round(w * 0.12)), [rf, rf, 0, 0], c.hi);
  }
  roundRect(
    ctx,
    x + Math.round(w * 0.13),
    y + top + face,
    Math.round(w * 0.74),
    foot,
    [0, 0, rf, rf],
    c.lo
  );
}

export interface GlyphColours {
  readonly face: string;
  readonly hi: string;
  readonly lo: string;
}

/** The small front-view bin the counts are built from, tuned at 53 px wide; `k` scales it. */
export function glyphBin(ctx: Ctx, x: number, y: number, k: number, c: GlyphColours): void {
  roundRect(ctx, x + 3 * k, y, 47 * k, 20 * k, [6 * k, 6 * k, 0, 0], c.hi);
  roundRect(ctx, x + 8 * k, y + 4 * k, 37 * k, 10 * k, 3 * k, c.lo);
  roundRect(ctx, x + 3 * k, y + 16 * k, 47 * k, 45 * k, [3 * k, 3 * k, 2 * k, 2 * k], c.face);
  roundRect(ctx, x + 3 * k, y + 16 * k, 47 * k, 7 * k, [3 * k, 3 * k, 0, 0], c.hi);
  roundRect(ctx, x + 7 * k, y + 61 * k, 39 * k, 8 * k, [0, 0, 3 * k, 3 * k], c.lo);
}

/**
 * A bin seen straight down: the rim, and the floor under a label shelf that
 * throws a band of shadow. `unit` scales the rim and shelf to the bin's grid.
 */
export function topBin(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  unit: number,
  shade: CategoryShade
): void {
  const r = Math.min(7, unit * 0.17);
  roundRect(ctx, x, y, w, h, r, shade.rim);
  const side = Math.min(5, unit * 0.12);
  const shelf = Math.min(12, unit * 0.29);
  const fw = w - 2 * side;
  const fh = h - shelf - side;
  if (fw < 2 || fh < 2) return;
  const fr = Math.min(4, unit * 0.1);
  roundRect(ctx, x + side, y + shelf, fw, fh, fr, shade.floor);
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, x + side, y + shelf, fw, fh, fr);
  ctx.clip();
  rect(ctx, x + side, y + shelf, fw, Math.min(fh, Math.min(6, unit * 0.14)), shade.shade);
  ctx.restore();
}

/**
 * Where to put the baseline so a line sits centred in its line box, as the
 * page lays it out. Browsers without font-box metrics get a typical split.
 */
export function lineBaseline(
  metrics: TextMetrics,
  top: number,
  lineHeight: number,
  size: number
): number {
  const ascent = Number.isFinite(metrics.fontBoundingBoxAscent)
    ? metrics.fontBoundingBoxAscent
    : size * 0.8;
  const descent = Number.isFinite(metrics.fontBoundingBoxDescent)
    ? metrics.fontBoundingBoxDescent
    : size * 0.2;
  return top + (lineHeight - (ascent + descent)) / 2 + ascent;
}

/** Text centred on its ink, not its em box, so a digit sits square in a block. */
export function fillCentred(ctx: Ctx, text: string, cx: number, cy: number, font: string): void {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text);
  ctx.fillText(text, cx, cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  ctx.textAlign = 'left';
}

/** The × is set at this fraction of the text size, with a tenth of its own size each side. */
export const TIMES_SCALE = 0.74;
const TIMES_GAP = TIMES_SCALE * 0.1;

/** Fills text with each × set smaller and raised, as the page does. */
export function fillTimes(
  ctx: Ctx,
  text: string,
  x: number,
  baseline: number,
  font: string,
  timesFont: string,
  size: number
): number {
  let cursor = x;
  const parts = text.split('×');
  parts.forEach((part, index) => {
    ctx.font = font;
    ctx.fillText(part, cursor, baseline);
    cursor += ctx.measureText(part).width;
    if (index === parts.length - 1) return;
    ctx.font = timesFont;
    cursor += size * TIMES_GAP;
    ctx.fillText('×', cursor, baseline - size * TIMES_GAP);
    cursor += ctx.measureText('×').width + size * TIMES_GAP;
  });
  return cursor - x;
}

export function timesWidth(
  ctx: Ctx,
  text: string,
  font: string,
  timesFont: string,
  size: number
): number {
  let width = 0;
  const parts = text.split('×');
  parts.forEach((part, index) => {
    ctx.font = font;
    width += ctx.measureText(part).width;
    if (index === parts.length - 1) return;
    ctx.font = timesFont;
    width += ctx.measureText('×').width + 2 * size * TIMES_GAP;
  });
  return width;
}

/** One line with small ×s, centred on its ink at (cx, cy). */
export function fillTimesCentred(
  ctx: Ctx,
  text: string,
  cx: number,
  cy: number,
  font: string,
  timesFont: string,
  size: number
): void {
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text.replaceAll('×', ''));
  const width = timesWidth(ctx, text, font, timesFont, size);
  const baseline = cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  fillTimes(ctx, text, cx - width / 2, baseline, font, timesFont, size);
}
