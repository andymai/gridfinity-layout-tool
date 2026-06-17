import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import { traceScene } from './traceScene';
import type { ImageDataLike, Point } from './types';

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
