import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import { fitLabelLines } from '../utils/labelText';

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Render a supporter name to a CanvasTexture using the *system* font (no font
 * file, CSP-safe) so it can be mapped onto a bin's top face like a printed
 * label. Returns null where 2D canvas is unavailable (jsdom tests).
 */
export function createLabelTexture(name: string, color: string): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const SIZE = 256;
  canvas.width = SIZE;
  canvas.height = SIZE;

  const lines = fitLabelLines(name);
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${lines.length > 1 ? 42 : 50}px ${FONT_STACK}`;

  const lineHeight = 52;
  const startY = SIZE / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, SIZE / 2, startY + i * lineHeight, SIZE * 0.84));

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.anisotropy = 4;
  return texture;
}
