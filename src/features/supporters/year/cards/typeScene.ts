import type { CardCopy } from '../components/YearCardView/cardCopy';
import { DISPLAY_TIGHT, familyFor } from '../look/fonts';
import { BEAT, clamp01, easeOut, onGrid } from '../look/motion';
import { PALETTES } from '../look/palettes';
import { sentences } from '../look/splitCopy';
import { cssFont, fitSize, wrapBalanced, type FontSpec, type Measure } from '../look/typeset';
import { lineBaseline, roundRect } from './paint';
import {
  CONTENT_TOP,
  CONTENT_W,
  GAP_K,
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

const LAYERS = 24;
const PRINT_START = 2 * BEAT;
const PRINT_SPAN = 3 * BEAT;
const MAX_SIZE = 420;
const BLOCK_MAX = 920;
const SHEET_W = 1020;

export interface NameBlock {
  readonly lines: readonly string[];
  readonly font: FontSpec;
  /** Height of the printed block, a whole number of layers. */
  readonly height: number;
  /** Height the lines fill, at the bottom of the block. */
  readonly inked: number;
  readonly layer: number;
}

/**
 * The type's name one word to a line, as large as the longest word allows
 * within the room; a name without spaces wraps into balanced lines instead.
 */
export function setName(name: string, locale: string, measure: Measure, room: number): NameBlock {
  const base: FontSpec = {
    family: familyFor(DISPLAY_TIGHT, locale),
    weight: 900,
    size: 200,
    lineHeight: 200,
  };
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lines =
    words.length > 1 && words.length <= 4
      ? words
      : wrapBalanced(name.trim(), CONTENT_W, base, measure, locale);
  const byWidth = Math.min(
    ...lines.map((line) => fitSize(line, CONTENT_W, base, measure, MAX_SIZE))
  );
  const size = Math.max(40, Math.min(byWidth, Math.min(BLOCK_MAX, room) / (lines.length + 0.1)));
  const inked = Math.ceil(size * lines.length + size * 0.1);
  const layer = Math.ceil(inked / LAYERS);
  return { lines, font: { ...base, size, lineHeight: size }, height: layer * LAYERS, inked, layer };
}

interface Sheets {
  readonly ridged: HTMLCanvasElement;
  readonly hot: HTMLCanvasElement;
}

function paintSheet(
  block: NameBlock,
  resolution: number,
  fill: (ctx: CanvasRenderingContext2D) => string | CanvasPattern
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(SHEET_W * resolution);
  canvas.height = Math.ceil(block.height * resolution);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(resolution, resolution);
  ctx.font = cssFont(block.font);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = fill(ctx);
  const offset = block.height - block.inked;
  block.lines.forEach((line, index) => {
    const top = offset + index * block.font.size;
    ctx.fillText(
      line,
      0,
      lineBaseline(ctx.measureText(line), top, block.font.size, block.font.size)
    );
  });
  return canvas;
}

/** Per-layer ink, so a layer full of letters takes longer than a thin one. */
function inkWeights(block: NameBlock): number[] {
  const sheet = paintSheet(block, 1, () => '#000000');
  const ctx = sheet?.getContext('2d');
  if (!sheet || !ctx) return Array.from({ length: LAYERS }, () => 1);
  const data = ctx.getImageData(0, 0, sheet.width, sheet.height).data;
  const weights = Array.from({ length: LAYERS }, () => 0);
  for (let y = 0; y < sheet.height; y++) {
    const layer = LAYERS - 1 - Math.min(LAYERS - 1, Math.floor(y / block.layer));
    let sum = 0;
    for (let x = 0; x < sheet.width; x++) sum += data[(y * sheet.width + x) * 4 + 3] ?? 0;
    weights[layer] = (weights[layer] ?? 0) + sum;
  }
  return weights;
}

export function layerTimes(weights: readonly number[]): number[] {
  const max = Math.max(0, ...weights) || 1;
  const scaled = weights.map((weight) => 0.3 + weight / max);
  const total = scaled.reduce((sum, weight) => sum + weight, 0);
  const starts: number[] = [];
  let acc = 0;
  for (const weight of scaled) {
    starts.push(onGrid(PRINT_START + (PRINT_SPAN * acc) / total, BEAT / 16));
    acc += weight;
  }
  return starts;
}

/** The type's name prints bottom-up in layers that land white-hot and cool. */
export function typeScene(input: SceneInput, copy: CardCopy, name: string): Scene {
  const P = PALETTES.type;
  const kicker = textBlock(input, {
    key: 'kicker',
    role: 'line',
    text: copy.kicker ?? '',
    y: CONTENT_TOP,
    color: P.ink,
    enter: 0,
  });
  const top = blockBottom(kicker) + GAP_K;
  const parts = sentences(copy.title, input.locale);
  const timings: readonly [number, number, number][] = [
    [5.5 * BEAT, 2.5 * BEAT, 28],
    [6.5 * BEAT, 3 * BEAT, 24],
  ];
  const below = (start: number): TextBlock[] => {
    const blocks: TextBlock[] = [];
    let y = start;
    parts.forEach((part, index) => {
      const [enter, reduceEnter, rise] = timings[Math.min(1, index)] ?? [
        5.5 * BEAT,
        2.5 * BEAT,
        28,
      ];
      const block = textBlock(input, {
        key: `line${index}`,
        role: 'line',
        text: part,
        y,
        color: P.ink,
        enter,
        reduceEnter,
        rise,
        maxLines: 2,
      });
      blocks.push(block);
      y = blockBottom(block);
    });
    const reason = copy.lines[0];
    if (reason) {
      blocks.push(
        textBlock(input, {
          key: 'reason',
          role: 'small',
          text: reason,
          y: y + GAP_T,
          color: P.ink,
          enter: 7 * BEAT,
          reduceEnter: 3.5 * BEAT,
          rise: 20,
        })
      );
    }
    return blocks;
  };
  const textHeight = below(0).reduce((sum, block) => sum + blockHeight(block), 0) + GAP_T;
  const block = setName(
    name,
    input.locale,
    input.measure,
    TEXT_FLOOR - top - 22 - GAP_V - textHeight
  );
  const texts = [kicker, ...below(top + block.height + 22 + GAP_V), footer(input, P.ink)];
  const offset = block.height - block.inked;
  const lineOf = (y: number): number =>
    Math.min(
      block.lines.length - 1,
      Math.max(0, Math.floor((y - top - offset + block.layer / 2) / block.font.size))
    );

  let weights: number[] | null = null;
  let starts: number[] = [];
  let sheets: Sheets | null = null;
  let sheetsAt = 0;
  return {
    kind: 'type',
    colours: P,
    texts,
    still: PRINT_START + PRINT_SPAN + 0.6,
    draw: ({ ctx, t, reduced, resolution }) => {
      roundRect(ctx, MARGIN, top + block.height + 8, CONTENT_W, 14, 7, P.bed);
      if (!weights) {
        weights = inkWeights(block);
        starts = layerTimes(weights);
      }
      if (!sheets || sheetsAt !== resolution) {
        const ridged = paintSheet(block, resolution, (sheet) => {
          const ridge = document.createElement('canvas');
          ridge.width = 1;
          ridge.height = Math.max(1, Math.round(block.layer * resolution));
          const rc = ridge.getContext('2d');
          if (!rc) return P.vis;
          const gradient = rc.createLinearGradient(0, 0, 0, ridge.height);
          gradient.addColorStop(0, P.visHi);
          gradient.addColorStop(0.3, P.vis);
          gradient.addColorStop(0.72, P.vis);
          gradient.addColorStop(1, P.visLo);
          rc.fillStyle = gradient;
          rc.fillRect(0, 0, 1, ridge.height);
          const pattern = sheet.createPattern(ridge, 'repeat');
          if (!pattern) return P.vis;
          // The sheet is scaled to card px; the ridge is drawn in device px.
          pattern.setTransform(new DOMMatrix().scale(1 / resolution, 1 / resolution));
          return pattern;
        });
        const hot = paintSheet(block, resolution, () => P.hot);
        if (!ridged || !hot) return;
        sheets = { ridged, hot };
        sheetsAt = resolution;
      }
      for (let k = 0; k < LAYERS; k++) {
        const y = top + block.height - (k + 1) * block.layer;
        const sy = (y - top) * resolution;
        const sh = block.layer * resolution;
        const sw = SHEET_W * resolution;
        if (reduced) {
          const at = (1 + (block.lines.length - 1 - lineOf(y)) * 0.5) * BEAT;
          const opacity = easeOut(clamp01((t - at) / 0.35));
          if (opacity <= 0.001) continue;
          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.drawImage(sheets.ridged, 0, sy, sw, sh, MARGIN, y, SHEET_W, block.layer);
          ctx.restore();
          continue;
        }
        const tt = t - (starts[k] ?? 0);
        if (tt < 0) continue;
        const dy = -7 * (1 - easeOut(clamp01(tt / 0.16)));
        // Only the white copy fades in; the layer sits under it once the white is opaque.
        if (tt >= 0.02)
          ctx.drawImage(sheets.ridged, 0, sy, sw, sh, MARGIN, y + dy, SHEET_W, block.layer);
        const heat = clamp01(tt / 0.02) * (1 - easeOut(clamp01((tt - 0.06) / 0.4)));
        if (heat > 0.001) {
          ctx.save();
          ctx.globalAlpha = heat;
          ctx.drawImage(sheets.hot, 0, sy, sw, sh, MARGIN, y + dy, SHEET_W, block.layer);
          ctx.restore();
        }
      }
    },
  };
}
