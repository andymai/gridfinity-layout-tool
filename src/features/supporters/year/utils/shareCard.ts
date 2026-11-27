import type { ShareSpec, ShareVisual } from '../components/YearCardView/shareSpec';
import { wrapText } from './shareText';

export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1920;
const MARGIN = 96;
const TEXT_WIDTH = SHARE_WIDTH - MARGIN * 2;
const VISUAL_TOP = 260;
const VISUAL_SIZE = 800;

export interface ShareTheme {
  readonly accent: string;
  /** The accent lightened for small text. */
  readonly accentText: string;
  readonly appFont: string;
  readonly pixelFont: string;
  readonly kicker: string;
  readonly site: string;
}

export interface ShareImages {
  /** The card's own 3D canvas, or the design thumbnail, already loaded. */
  readonly image?: CanvasImageSource;
}

function background(ctx: CanvasRenderingContext2D, accent: string): void {
  const base = ctx.createLinearGradient(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  base.addColorStop(0, '#16161f');
  base.addColorStop(0.6, '#0d0d14');
  base.addColorStop(1, '#0a0a0f');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  const glow = ctx.createRadialGradient(
    SHARE_WIDTH * 0.85,
    0,
    0,
    SHARE_WIDTH * 0.85,
    0,
    SHARE_HEIGHT * 0.5
  );
  glow.addColorStop(0, `${accent}66`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawGlyph(ctx: CanvasRenderingContext2D, theme: ShareTheme, left: number): void {
  const scale = VISUAL_SIZE / 48;
  const ox = left;
  const oy = VISUAL_TOP + VISUAL_SIZE * 0.1;
  const face = (points: readonly (readonly [number, number])[], fill: string): void => {
    ctx.beginPath();
    points.forEach(([px, py], index) => {
      if (index === 0) ctx.moveTo(ox + px * scale, oy + py * scale);
      else ctx.lineTo(ox + px * scale, oy + py * scale);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 6;
    ctx.stroke();
  };
  face(
    [
      [6, 14],
      [24, 6],
      [42, 14],
      [24, 22],
    ],
    `${theme.accent}40`
  );
  face(
    [
      [6, 14],
      [6, 30],
      [24, 38],
      [24, 22],
    ],
    `${theme.accent}26`
  );
  face(
    [
      [42, 14],
      [42, 30],
      [24, 38],
      [24, 22],
    ],
    `${theme.accent}14`
  );
}

function drawVisual(
  ctx: CanvasRenderingContext2D,
  visual: ShareVisual,
  theme: ShareTheme,
  images: ShareImages
): void {
  const left = (SHARE_WIDTH - VISUAL_SIZE) / 2;
  const centreY = VISUAL_TOP + VISUAL_SIZE / 2;
  switch (visual.kind) {
    case 'big': {
      if (!visual.text) return;
      const font = visual.pixel ? theme.pixelFont : theme.appFont;
      let size = visual.pixel ? 120 : 220;
      ctx.font = `${visual.pixel ? 400 : 700} ${size}px ${font}`;
      while (size > 40 && ctx.measureText(visual.text).width > TEXT_WIDTH) {
        size -= 8;
        ctx.font = `${visual.pixel ? 400 : 700} ${size}px ${font}`;
      }
      ctx.fillStyle = theme.accentText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = `${theme.accent}99`;
      ctx.shadowBlur = 60;
      const lines = visual.pixel
        ? wrapText(visual.text, TEXT_WIDTH, (t) => ctx.measureText(t).width)
        : [visual.text];
      lines.forEach((line, index) => {
        ctx.fillText(
          line,
          SHARE_WIDTH / 2,
          centreY + (index - (lines.length - 1) / 2) * size * 1.5
        );
      });
      ctx.shadowBlur = 0;
      return;
    }
    case 'image':
    case 'canvas': {
      const image = images.image;
      if (!image) {
        drawGlyph(ctx, theme, left);
        return;
      }
      const width = 'width' in image ? Number(image.width) : VISUAL_SIZE;
      const height = 'height' in image ? Number(image.height) : VISUAL_SIZE;
      const scale = Math.min(VISUAL_SIZE / width, VISUAL_SIZE / height);
      const w = width * scale;
      const h = height * scale;
      ctx.save();
      roundRect(ctx, left, VISUAL_TOP, VISUAL_SIZE, VISUAL_SIZE, 48);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fill();
      ctx.clip();
      ctx.drawImage(image, (SHARE_WIDTH - w) / 2, centreY - h / 2, w, h);
      ctx.restore();
      return;
    }
    case 'plan': {
      const { drawerWidth: w, drawerDepth: d, binMap = [] } = visual.preview;
      const scale = Math.min(VISUAL_SIZE / w, VISUAL_SIZE / d);
      const x0 = (SHARE_WIDTH - w * scale) / 2;
      const y0 = centreY - (d * scale) / 2;
      roundRect(ctx, x0, y0, w * scale, d * scale, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 4;
      ctx.stroke();
      binMap.forEach((bin, index) => {
        ctx.globalAlpha = 0.55 + (0.45 * ((index * 37) % 10)) / 10;
        ctx.fillStyle = theme.accent;
        roundRect(
          ctx,
          x0 + (bin.x + 0.06) * scale,
          y0 + (d - bin.y - bin.d + 0.06) * scale,
          Math.max(2, (bin.w - 0.12) * scale),
          Math.max(2, (bin.d - 0.12) * scale),
          8
        );
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      return;
    }
    case 'bars': {
      const max = Math.max(1, ...visual.counts);
      const gap = 16;
      const barWidth = (VISUAL_SIZE - gap * 11) / 12;
      const floor = VISUAL_TOP + VISUAL_SIZE - 80;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = `400 30px ${theme.appFont}`;
      visual.counts.forEach((value, month) => {
        const height = Math.max(12, (value / max) * (VISUAL_SIZE - 160));
        const x = left + month * (barWidth + gap);
        ctx.fillStyle = month === visual.highlight ? theme.accent : 'rgba(255,255,255,0.22)';
        roundRect(ctx, x, floor - height, barWidth, height, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(visual.labels[month] ?? '', x + barWidth / 2, floor + 20);
      });
      return;
    }
    case 'cells': {
      const cols = 8;
      const gap = 18;
      const cell = (VISUAL_SIZE - gap * (cols - 1)) / cols;
      for (let index = 0; index < visual.total; index++) {
        ctx.fillStyle = index < visual.lit ? theme.accent : 'rgba(255,255,255,0.07)';
        roundRect(
          ctx,
          left + (index % cols) * (cell + gap),
          VISUAL_TOP + Math.floor(index / cols) * (cell + gap),
          cell,
          cell,
          14
        );
        ctx.fill();
      }
      return;
    }
    case 'glyph':
      drawGlyph(ctx, theme, left);
      return;
    case 'rows': {
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.font = `400 120px ${theme.pixelFont}`;
      ctx.fillStyle = theme.accentText;
      ctx.fillText(visual.heading, MARGIN, VISUAL_TOP + 140);
      visual.rows.forEach(([label, value], index) => {
        const y = VISUAL_TOP + 340 + index * 150;
        ctx.textAlign = 'left';
        ctx.font = `400 44px ${theme.appFont}`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(label, MARGIN, y);
        ctx.textAlign = 'right';
        ctx.font = `700 60px ${theme.appFont}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(value, SHARE_WIDTH - MARGIN, y);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(MARGIN, y + 36, TEXT_WIDTH, 3);
      });
      return;
    }
  }
}

/** Draws one card at 1080 × 1920: the same layout the card has on screen. */
export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  spec: ShareSpec,
  theme: ShareTheme,
  images: ShareImages
): void {
  background(ctx, theme.accent);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 34px ${theme.pixelFont}`;
  ctx.fillStyle = theme.accentText;
  ctx.fillText(theme.kicker.toUpperCase(), MARGIN, 150);

  drawVisual(ctx, spec.visual, theme, images);

  const measure = (text: string): number => ctx.measureText(text).width;
  ctx.font = `700 84px ${theme.appFont}`;
  const title = spec.title ? wrapText(spec.title, TEXT_WIDTH, measure) : [];
  ctx.font = `400 44px ${theme.appFont}`;
  const lines = spec.lines.flatMap((line) => wrapText(line, TEXT_WIDTH, measure));

  const kickerHeight = spec.kicker ? 70 : 0;
  const blockHeight =
    kickerHeight + title.length * 96 + (lines.length ? 30 : 0) + lines.length * 60;
  let y = 1700 - blockHeight;
  ctx.textAlign = 'left';
  if (spec.kicker) {
    ctx.font = `400 30px ${theme.pixelFont}`;
    ctx.fillStyle = theme.accentText;
    ctx.fillText(spec.kicker.toUpperCase(), MARGIN, y + 30);
    y += kickerHeight;
  }
  ctx.font = `700 84px ${theme.appFont}`;
  ctx.fillStyle = '#ffffff';
  for (const line of title) {
    y += 96;
    ctx.fillText(line, MARGIN, y);
  }
  if (lines.length) y += 30;
  ctx.font = `400 44px ${theme.appFont}`;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  for (const line of lines) {
    y += 60;
    ctx.fillText(line, MARGIN, y);
  }

  ctx.font = `400 34px ${theme.appFont}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(theme.site, MARGIN, SHARE_HEIGHT - 90);
}
