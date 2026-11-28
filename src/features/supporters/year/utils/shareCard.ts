import { CARD_H, CARD_W, MARGIN, type Scene, type TextBlock } from '../cards/scene';
import {
  THUMB_SIZE,
  TIMES_SCALE,
  drawTinted,
  fillTimes,
  lineBaseline,
  paintBinGlyph,
  roundRect,
} from '../cards/paint';
import { TEXT, familyFor } from '../look/fonts';
import { applyTracking, cssFont, roleFont } from '../look/typeset';

export const SHARE_WIDTH = CARD_W;
export const SHARE_HEIGHT = CARD_H;
/** Long after every spring on any card has come to rest. */
const SETTLED_T = 1000;

export interface ShareTheme {
  /** "Your 2026", in the space the player's controls take on screen. */
  readonly kicker: string;
  readonly locale: string;
  /** The thank-you card's two buttons, drawn as keys. */
  readonly keys: readonly [string, string];
}

export interface ShareImages {
  /** The card's own 3D canvas, or the design thumbnail, already loaded. */
  readonly model?: CanvasImageSource;
}

function imageSize(image: CanvasImageSource): { width: number; height: number } {
  const width = 'width' in image ? Number(image.width) : 0;
  const height = 'height' in image ? Number(image.height) : 0;
  return { width, height };
}

function drawText(ctx: CanvasRenderingContext2D, block: TextBlock): void {
  const font = cssFont(block.font);
  ctx.font = font;
  applyTracking(ctx, block.font);
  ctx.fillStyle = block.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const timesFont = cssFont({
    family: familyFor(TEXT, 'en'),
    weight: 600,
    size: block.font.size * TIMES_SCALE,
    lineHeight: 1,
  });
  block.lines.forEach((line, index) => {
    ctx.font = font;
    const top = block.y + index * block.font.lineHeight;
    const baseline = lineBaseline(
      ctx.measureText(line),
      top,
      block.font.lineHeight,
      block.font.size
    );
    if (block.times && line.includes('×'))
      fillTimes(ctx, line, block.x, baseline, font, timesFont, block.font.size);
    else ctx.fillText(line, block.x, baseline);
  });
}

const KEY_LOOKS = [
  { face: '#D4FF38', ink: '#121A5C', lip: '#EBFF9A', wall: '#8FB314' },
  { face: '#4A55F0', ink: '#FFFFFF', lip: '#6E78FF', wall: '#161E8C' },
] as const;

function drawKeys(
  ctx: CanvasRenderingContext2D,
  top: number,
  labels: readonly string[],
  locale: string
): void {
  const font = cssFont({ ...roleFont('line', locale), family: familyFor(TEXT, locale) });
  labels.forEach((label, index) => {
    const look = KEY_LOOKS[index] ?? KEY_LOOKS[0];
    const y = top + index * 170;
    roundRect(ctx, MARGIN, y + 12, 960, 128, 30, look.wall);
    roundRect(ctx, MARGIN, y, 960, 128, 30, look.face);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(MARGIN, y, 960, 128, 30);
    ctx.clip();
    ctx.fillStyle = look.lip;
    ctx.fillRect(MARGIN, y, 960, 7);
    ctx.restore();
    ctx.font = font;
    ctx.fillStyle = look.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, CARD_W / 2, y + 64, 880);
  });
  ctx.textAlign = 'left';
}

/** The card's settled frame, the way it stands on screen once every entrance has landed. */
export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  theme: ShareTheme,
  images: ShareImages
): void {
  ctx.fillStyle = scene.colours.bg;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  ctx.save();
  scene.draw({ ctx, t: SETTLED_T, reduced: false, resolution: 1 });
  ctx.restore();

  const model = scene.model;
  // With no 3D canvas and no thumbnail, the card shows the drawn bin, and so does the image.
  if (model && !images.model) paintBinGlyph(ctx, model, model.look.tint, model.look.edge);
  if (model && images.model) {
    const { width, height } = imageSize(images.model);
    const isCanvas =
      typeof HTMLCanvasElement !== 'undefined' && images.model instanceof HTMLCanvasElement;
    if (isCanvas && width > 0 && height > 0) {
      // The copied 3D canvas already has the slot's shape.
      ctx.drawImage(images.model, model.x, model.y, model.w, model.h);
    } else {
      // A thumbnail stands in the slot tinted, as it does on screen.
      const size = THUMB_SIZE;
      drawTinted(
        ctx,
        images.model,
        model.x + (model.w - size) / 2,
        model.y + (model.h - size) / 2,
        size,
        size,
        model.look.tint
      );
    }
  }

  for (const block of scene.texts) drawText(ctx, block);
  applyTracking(ctx, { family: '', weight: 400, size: 0, lineHeight: 0 });
  if (scene.keys) drawKeys(ctx, scene.keys.y, theme.keys, theme.locale);

  const label = roleFont('label', theme.locale);
  ctx.font = cssFont({ ...label, weight: 600 });
  ctx.fillStyle = scene.colours.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(theme.kicker, MARGIN, 104);
}
