import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import { traceScene, traceSceneSegmented, detectCard } from './traceScene';
import type { ImageDataLike, Mask, Point } from './types';

// Tilted pinhole camera over the world z=0 plane (principal point at centre).
const F = 600;
const CXP = 180;
const CYP = 130;
const DIST = 520;

function camera(tiltX: number, tiltY: number) {
  const cxr = Math.cos(tiltX);
  const sxr = Math.sin(tiltX);
  const cyr = Math.cos(tiltY);
  const syr = Math.sin(tiltY);
  const r = [
    [cyr, 0, syr],
    [sxr * syr, cxr, -sxr * cyr],
    [-cxr * syr, sxr, cxr * cyr],
  ];
  return (x: number, y: number): Point => {
    const xc = r[0][0] * x + r[0][1] * y;
    const yc = r[1][0] * x + r[1][1] * y;
    const zc = r[2][0] * x + r[2][1] * y + DIST;
    return { x: (F * xc) / zc + CXP, y: (F * yc) / zc + CYP };
  };
}

const cam = camera(0.32, 0.2);
const project = (pts: Point[]): Point[] => pts.map((p) => cam(p.x, p.y));

const CARD_MM: Point[] = [
  { x: -42.8, y: -26.99 },
  { x: 42.8, y: -26.99 },
  { x: 42.8, y: 26.99 },
  { x: -42.8, y: 26.99 },
];
// L-shaped tool, 25 × 45 mm bounding box.
const TOOL_MM: Point[] = [
  { x: 60, y: -22 },
  { x: 85, y: -22 },
  { x: 85, y: -7 },
  { x: 70, y: -7 },
  { x: 70, y: 23 },
  { x: 60, y: 23 },
];

function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function render(withCard: boolean, width = 360, height = 260): ImageDataLike {
  const cardImg = project(CARD_MM);
  const toolImg = project(TOOL_MM);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const here = { x, y };
      const v =
        withCard && pointInPolygon(here, cardImg) ? 235 : pointInPolygon(here, toolImg) ? 150 : 15;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

function bbox(points: readonly Point[]): { w: number; h: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

describe('traceScene', () => {
  it('rectifies the tool to true millimetres when a card is present', () => {
    // smoothing off so the assertion measures card-scale accuracy.
    const result = traceScene(render(true), { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.units).toBe('mm');
    expect(result.value.card).not.toBeNull();
    expect(bbox(result.value.imagePoints).w).toBeGreaterThan(20);
    const out = bbox(result.value.outputPoints);
    expect(Math.abs(out.w - 25)).toBeLessThan(2.5);
    expect(Math.abs(out.h - 45)).toBeLessThan(2.5);
  });

  it('falls back to pixel units when no card is present', () => {
    const result = traceScene(render(false));
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.units).toBe('px');
    expect(result.value.card).toBeNull();
    expect(result.value.outputPoints).toEqual(result.value.imagePoints);
  });
});

describe('traceSceneSegmented excludes the tool from card detection', () => {
  // Two card-aspect rectangles: the real card (left) and a slightly-larger
  // rectangular tool (right). The tool sits higher, so it labels first and a
  // naive whole-image card search picks IT — the reported failure. The tool
  // mask should keep that from happening.
  const W = 360;
  const H = 260;
  const CARD = { x0: 30, y0: 100, x1: 130, y1: 163 }; // 100×63 ≈ 1.587
  const TOOL = { x0: 210, y0: 80, x1: 330, y1: 168 }; // 120×88 ≈ 1.36

  const inRect = (x: number, y: number, r: typeof CARD): boolean =>
    x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

  function scene(): ImageDataLike {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        const v = inRect(x, y, CARD) ? 235 : inRect(x, y, TOOL) ? 150 : 15;
        data[o] = data[o + 1] = data[o + 2] = v;
        data[o + 3] = 255;
      }
    }
    return { width: W, height: H, data };
  }

  function toolMask(): Mask {
    const data = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) if (inRect(x, y, TOOL)) data[y * W + x] = 1;
    }
    return { width: W, height: H, data };
  }

  const centroidX = (pts: readonly Point[]): number =>
    pts.reduce((s, p) => s + p.x, 0) / pts.length;

  it('a whole-image search picks the wrong rectangle (the tool)', () => {
    const card = detectCard(scene());
    expect(card).not.toBeNull();
    if (!card) return;
    expect(centroidX(card.corners)).toBeGreaterThan(W / 2); // the right-hand tool
  });

  it('excluding the tool mask picks the real card instead', () => {
    const card = detectCard(scene(), {}, toolMask());
    expect(card).not.toBeNull();
    if (!card) return;
    expect(centroidX(card.corners)).toBeLessThan(W / 2); // the left-hand card
  });

  it('rectifies the tool to true mm via the real card', () => {
    const result = traceSceneSegmented(scene(), toolMask(), { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.units).toBe('mm');
    expect(centroidX(result.value.card?.corners ?? [{ x: 0, y: 0 }])).toBeLessThan(W / 2);
  });
});
