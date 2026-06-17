import { describe, it, expect } from 'vitest';
import {
  detectCardQuad,
  findBestCardComponent,
  cardPerspectiveSkew,
  STEEP_CARD_SKEW,
} from './cardDetect';
import { buildMask } from './mask';
import { labelComponents } from './components';
import { rectifyPoints } from './perspective';
import type { ImageDataLike, Point } from './types';

// A tilted pinhole camera over the world z=0 plane — the geometry the detector
// (and its aspect check) assumes. Principal point at the image centre.
const F = 600;
const CXP = 180;
const CYP = 130;
const DIST = 520;
const camera = makeCamera(0.32, 0.2);

function makeCamera(tiltX: number, tiltY: number) {
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

const project = (pts: Point[]): Point[] => pts.map((p) => camera(p.x, p.y));

// Landscape ISO card centred at the origin; L-shaped tool (25 × 45 mm) beside
// it; a square decoy to test that aspect rejects non-cards.
const CARD_MM: Point[] = [
  { x: -42.8, y: -26.99 },
  { x: 42.8, y: -26.99 },
  { x: 42.8, y: 26.99 },
  { x: -42.8, y: 26.99 },
];
const TOOL_MM: Point[] = [
  { x: 60, y: -22 },
  { x: 85, y: -22 },
  { x: 85, y: -7 },
  { x: 70, y: -7 },
  { x: 70, y: 23 },
  { x: 60, y: 23 },
];
const SQUARE_MM: Point[] = [
  { x: 60, y: -20 },
  { x: 100, y: -20 },
  { x: 100, y: 20 },
  { x: 60, y: 20 },
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

function render(
  layers: Array<{ poly: Point[]; value: number }>,
  width = 360,
  height = 260
): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      let v = 15;
      for (const layer of layers) {
        if (pointInPolygon({ x, y }, layer.poly)) {
          v = layer.value;
          break;
        }
      }
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

type Rgb = readonly [number, number, number];

/** Like `render`, but each layer carries an RGB color over a colored background. */
function renderRgb(
  layers: Array<{ poly: Point[]; rgb: Rgb }>,
  background: Rgb,
  width = 360,
  height = 260
): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      let rgb = background;
      for (const layer of layers) {
        if (pointInPolygon({ x, y }, layer.poly)) {
          rgb = layer.rgb;
          break;
        }
      }
      data[o] = rgb[0];
      data[o + 1] = rgb[1];
      data[o + 2] = rgb[2];
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

describe('detectCardQuad (end-to-end, pinhole projection)', () => {
  it('finds the card and rectifies the tool to true millimetres', () => {
    const image = render([
      { poly: project(CARD_MM), value: 235 },
      { poly: project(TOOL_MM), value: 150 },
    ]);

    const detection = detectCardQuad(image);
    expect(detection).not.toBeNull();
    if (!detection) return;
    expect(detection.fitness).toBeGreaterThan(0.9);

    const toolImg = project(TOOL_MM);
    const out = bbox(rectifyPoints(toolImg, detection.homography));
    expect(Math.abs(out.w - 25)).toBeLessThan(2.5);
    expect(Math.abs(out.h - 45)).toBeLessThan(2.5);
  });

  it('rejects a square: aspect check keeps a non-card quad from being the reference', () => {
    // Only a square in frame — its aspect (~1.0) fails the card check.
    const image = render([{ poly: project(SQUARE_MM), value: 150 }]);
    expect(detectCardQuad(image)).toBeNull();
  });

  it('picks the card, not a square decoy, when both are present', () => {
    const image = render([
      { poly: project(CARD_MM), value: 235 },
      { poly: project(SQUARE_MM), value: 150 },
    ]);
    const detection = detectCardQuad(image);
    expect(detection).not.toBeNull();
    if (!detection) return;
    // The chosen corners match the projected card, not the square.
    const card = project(CARD_MM);
    detection.corners.forEach((c) => {
      const nearCard = card.some((e) => Math.hypot(c.x - e.x, c.y - e.y) < 4);
      expect(nearCard).toBe(true);
    });
  });
});

describe('detectCardQuad on a color-neutral card (the silver-card-on-wood case)', () => {
  // A brushed-metal card on warm wood: near-identical *luminance* (so a grayscale
  // threshold can't separate them) but very different *chroma*. Both ~116 luma;
  // wood is saturated (chroma 90), the card is neutral (chroma 0).
  const WOOD: Rgb = [150, 110, 60];
  const CARD: Rgb = [116, 116, 116];

  it('luma alone cannot find the card (regression guard)', () => {
    const image = renderRgb([{ poly: project(CARD_MM), rgb: CARD }], WOOD);
    const labeled = labelComponents(buildMask(image)); // default channel: luma
    expect(findBestCardComponent(labeled, image.width, image.height)).toBeNull();
  });

  it('the chroma sweep recovers the card and rectifies the tool to true mm', () => {
    const image = renderRgb(
      [
        { poly: project(CARD_MM), rgb: CARD },
        { poly: project(TOOL_MM), rgb: [40, 40, 40] },
      ],
      WOOD
    );

    const detection = detectCardQuad(image);
    expect(detection).not.toBeNull();
    if (!detection) return;
    expect(detection.fitness).toBeGreaterThan(0.9);

    const out = bbox(rectifyPoints(project(TOOL_MM), detection.homography));
    expect(Math.abs(out.w - 25)).toBeLessThan(2.5);
    expect(Math.abs(out.h - 45)).toBeLessThan(2.5);
  });
});

describe('cardPerspectiveSkew', () => {
  const rect = (tl: Point, tr: Point, br: Point, bl: Point): [Point, Point, Point, Point] => [
    tl,
    tr,
    br,
    bl,
  ];

  it('is ~0 for a fronto-parallel rectangle', () => {
    const flat = rect({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 });
    expect(cardPerspectiveSkew(flat)).toBeCloseTo(0, 6);
  });

  it('ignores in-plane rotation (opposite edges stay equal)', () => {
    // The flat rectangle rotated 30° about the origin.
    const rotated = rect(
      { x: 0, y: 0 },
      { x: 86.6, y: 50 },
      { x: 56.6, y: 101.96 },
      { x: -30, y: 51.96 }
    );
    expect(cardPerspectiveSkew(rotated)).toBeLessThan(0.01);
  });

  it('flags a keystoned quad as steep', () => {
    // Top edge (60) much shorter than bottom (100) — a tilted shot.
    const keystoned = rect({ x: 20, y: 0 }, { x: 80, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 });
    const skew = cardPerspectiveSkew(keystoned);
    expect(skew).toBeCloseTo(0.4, 5);
    expect(skew).toBeGreaterThan(STEEP_CARD_SKEW);
  });
});
