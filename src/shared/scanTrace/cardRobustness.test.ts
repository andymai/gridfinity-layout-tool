import { describe, it, expect } from 'vitest';
import { detectCardQuad } from './cardDetect';
import type { ImageDataLike, Point } from './types';

type Rgb = readonly [number, number, number];

function inPoly(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/**
 * Render a card (200×126 ≈ ISO aspect) of color `card` on a `bg` field, with
 * optional in-plane rotation (deg) and a bottom-left corner bite (fraction of
 * the card removed, to mimic a desaturated logo dropping out of the mask).
 */
function scene(card: Rgb, bg: Rgb, rotDeg = 0, bite = 0): ImageDataLike {
  const W = 320;
  const H = 240;
  const cx = W / 2;
  const cy = H / 2;
  const hw = 100;
  const hh = 63;
  const r = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const corner = (dx: number, dy: number): Point => ({
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  });
  const cardPoly = [corner(-hw, -hh), corner(hw, -hh), corner(hw, hh), corner(-hw, hh)];
  const bitePoly = bite
    ? [corner(-hw, hh), corner(-hw + 2 * hw * bite, hh), corner(-hw, hh - 2 * hh * bite)]
    : null;

  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const onCard = inPoly({ x, y }, cardPoly) && !(bitePoly && inPoly({ x, y }, bitePoly));
      const c = onCard ? card : bg;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

// Color/background pairs spanning the separation axes the detector must handle.
const WOOD: Rgb = [150, 110, 60]; // warm saturated
const COOL: Rgb = [60, 110, 150]; // cool saturated
const GRAY_DARK: Rgb = [45, 45, 45];
const GRAY_LIGHT: Rgb = [150, 150, 150];
const SILVER: Rgb = [150, 150, 150]; // neutral, ~wood luma
const BLUE: Rgb = [50, 90, 180];
const WHITE: Rgb = [235, 235, 235];
const BLACK: Rgb = [25, 25, 25];

describe('card detection robustness matrix', () => {
  const cases: Array<{ name: string; img: ImageDataLike }> = [
    { name: 'neutral card / warm-saturated bg (chroma)', img: scene(SILVER, WOOD) },
    { name: 'neutral card / cool-saturated bg (chroma)', img: scene(SILVER, COOL) },
    { name: 'saturated card / dark-neutral bg', img: scene(BLUE, GRAY_DARK) },
    { name: 'dark card / light-neutral bg (luma)', img: scene(BLACK, GRAY_LIGHT) },
    { name: 'light card / dark-neutral bg (luma)', img: scene(WHITE, GRAY_DARK) },
    { name: 'neutral card / warm bg, rotated 18°', img: scene(SILVER, WOOD, 18) },
    { name: 'saturated card / dark bg, rotated 25°', img: scene(BLUE, GRAY_DARK, 25) },
    { name: 'neutral card / warm bg, eroded corner (rescue)', img: scene(SILVER, WOOD, 0, 0.45) },
    {
      name: 'saturated card / dark bg, eroded corner (rescue)',
      img: scene(BLUE, GRAY_DARK, 0, 0.45),
    },
  ];

  it.each(cases)('detects: $name', ({ img }) => {
    expect(detectCardQuad(img)).not.toBeNull();
  });
});
