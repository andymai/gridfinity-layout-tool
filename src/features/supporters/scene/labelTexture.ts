import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import { fitLabelLines } from '../utils/labelText';

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Texture aspect matches the label-tab shelf rectangle measured in
// meshMeta.json (0.864 × 0.252 units ≈ 3.42:1) so the tape isn't stretched.
const TAB_TEXTURE_WIDTH = 512;
const TAB_TEXTURE_HEIGHT = 150;

/**
 * Render a supporter name as a printed label-tape strip for the bin's label
 * tab, using the *system* font (no font file, CSP-safe): a rounded cream tape
 * with ink text, transparent outside the tape so the filament shelf shows
 * around it. Returns null where 2D canvas is unavailable (jsdom tests).
 */
export function createTabLabelTexture(
  name: string,
  tape: string,
  ink: string
): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  canvas.width = TAB_TEXTURE_WIDTH;
  canvas.height = TAB_TEXTURE_HEIGHT;
  ctx.clearRect(0, 0, TAB_TEXTURE_WIDTH, TAB_TEXTURE_HEIGHT);

  // Tape strip inset from the shelf edges.
  const inset = 10;
  const radius = 16;
  ctx.fillStyle = tape;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(
      inset,
      inset,
      TAB_TEXTURE_WIDTH - inset * 2,
      TAB_TEXTURE_HEIGHT - inset * 2,
      radius
    );
  } else {
    // Older Safari lacks roundRect; square corners beat a thrown label.
    ctx.rect(inset, inset, TAB_TEXTURE_WIDTH - inset * 2, TAB_TEXTURE_HEIGHT - inset * 2);
  }
  ctx.fill();

  const lines = fitLabelLines(name, 14, 2);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = lines.length > 1 ? 52 : 64;
  ctx.font = `600 ${fontSize}px ${FONT_STACK}`;
  const lineHeight = fontSize + 6;
  const startY = TAB_TEXTURE_HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) =>
    ctx.fillText(line, TAB_TEXTURE_WIDTH / 2, startY + i * lineHeight, TAB_TEXTURE_WIDTH * 0.82)
  );

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.anisotropy = 4;
  return texture;
}
