import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import { traceSceneSegmented, computeAutoSeed } from './traceScene';
import type { ImageDataLike, Mask, Point } from './types';

// Same tilted-pinhole projection as traceScene.test.ts so the rendered card is
// a realistic perspective quad the classical card detector can lock onto.
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

const WIDTH = 360;
const HEIGHT = 260;

/** Image with a bright card for scale; the tool is supplied by the model mask. */
function renderWithCard(): ImageDataLike {
  const cardImg = project(CARD_MM);
  const toolImg = project(TOOL_MM);
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const o = (y * WIDTH + x) * 4;
      const here = { x, y };
      const v = pointInPolygon(here, cardImg) ? 235 : pointInPolygon(here, toolImg) ? 150 : 15;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width: WIDTH, height: HEIGHT, data };
}

/** A clean tool mask plus a stray speck the largest-component pass must drop. */
function toolMaskWithSpeck(): Mask {
  const toolImg = project(TOOL_MM);
  const data = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (pointInPolygon({ x, y }, toolImg)) data[y * WIDTH + x] = 1;
    }
  }
  // 3×3 speck far from the tool.
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) data[(10 + dy) * WIDTH + (10 + dx)] = 1;
  }
  return { width: WIDTH, height: HEIGHT, data };
}

function bbox(points: readonly Point[]): { w: number; h: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

describe('traceSceneSegmented', () => {
  it('traces the supplied tool mask and rectifies to mm via the card', () => {
    // clearance/smoothing off so the assertion measures card-scale accuracy.
    const result = traceSceneSegmented(renderWithCard(), toolMaskWithSpeck(), {
      clearanceMm: 0,
      smooth: false,
    });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.units).toBe('mm');
    expect(result.value.card).not.toBeNull();
    // Speck dropped → bbox matches the 25 × 45 mm tool, not the whole frame.
    const out = bbox(result.value.outputPoints);
    expect(Math.abs(out.w - 25)).toBeLessThan(2.5);
    expect(Math.abs(out.h - 45)).toBeLessThan(2.5);
  });

  it('errors when the model mask is empty', () => {
    const empty: Mask = { width: WIDTH, height: HEIGHT, data: new Uint8Array(WIDTH * HEIGHT) };
    const result = traceSceneSegmented(renderWithCard(), empty);
    expect(isOk(result)).toBe(false);
  });

  it('bakes a fit clearance that enlarges the outline when a card is present', () => {
    const tight = traceSceneSegmented(renderWithCard(), toolMaskWithSpeck(), {
      clearanceMm: 0,
      smooth: false,
    });
    const loose = traceSceneSegmented(renderWithCard(), toolMaskWithSpeck(), {
      clearanceMm: 1,
      smooth: false,
    });
    expect(isOk(tight) && isOk(loose)).toBe(true);
    if (!isOk(tight) || !isOk(loose)) return;
    // ~1mm clearance grows each side → bbox wider and taller than the exact trace.
    expect(bbox(loose.value.outputPoints).w).toBeGreaterThan(bbox(tight.value.outputPoints).w);
    expect(bbox(loose.value.outputPoints).h).toBeGreaterThan(bbox(tight.value.outputPoints).h);
  });
});

describe('computeAutoSeed', () => {
  it('lands inside the tool, not on the card', () => {
    const seed = computeAutoSeed(renderWithCard());
    const px = { x: seed.x * WIDTH, y: seed.y * HEIGHT };
    expect(pointInPolygon(px, project(TOOL_MM))).toBe(true);
    expect(pointInPolygon(px, project(CARD_MM))).toBe(false);
  });

  it('falls back to the image center for a blank image', () => {
    const blank: ImageDataLike = {
      width: WIDTH,
      height: HEIGHT,
      data: new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(0),
    };
    const seed = computeAutoSeed(blank);
    expect(seed).toEqual({ x: 0.5, y: 0.5 });
  });
});
