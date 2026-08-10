import { describe, it, expect } from 'vitest';
import { findQuadBlobs, quadArea, quadCenter, type BlobScanOptions } from './latticeBlobs';
import type { ImageDataLike, Point } from './types';

const W = 300;
const H = 240;

const SCAN: BlobScanOptions = {
  minAreaFraction: 0.002,
  maxAreaFraction: 0.2,
  minQuadFitness: 0.7,
  minQuadFill: 0.7,
  maxEdgeRatio: 1.7,
  dark: true,
};

interface Shape {
  readonly poly: readonly Point[];
  readonly value: number;
}

function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
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

function render(shapes: readonly Shape[], background: number): ImageDataLike {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = background;
      for (const shape of shapes) {
        if (pointInPolygon({ x, y }, shape.poly)) {
          v = shape.value;
          break;
        }
      }
      const o = (y * W + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

const square = (cx: number, cy: number, size: number): Point[] => {
  const h = size / 2;
  return [
    { x: cx - h, y: cy - h },
    { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h },
    { x: cx - h, y: cy + h },
  ];
};

function gray(image: ImageDataLike): Uint8Array {
  const out = new Uint8Array(image.width * image.height);
  for (let i = 0; i < out.length; i++) out[i] = image.data[i * 4];
  return out;
}

describe('findQuadBlobs', () => {
  it('finds dark squares and locates their centres', () => {
    const image = render(
      [
        { poly: square(80, 70, 40), value: 20 },
        { poly: square(210, 160, 40), value: 20 },
      ],
      240
    );
    const blobs = findQuadBlobs(gray(image), W, H, 128, SCAN);
    expect(blobs).toHaveLength(2);
    // Within a pixel: the contour follows pixel centres, so a square spanning
    // 60..100 traces 60..99 and centres half a pixel low.
    const centres = blobs.map((b) => b.center).sort((a, b) => a.x - b.x);
    expect(Math.abs(centres[0].x - 80)).toBeLessThan(1);
    expect(Math.abs(centres[0].y - 70)).toBeLessThan(1);
    expect(Math.abs(centres[1].x - 210)).toBeLessThan(1);
  });

  // The polarity is the caller's to declare: a sheet knows its markers are
  // printed black, and a baseplate tries both because lighting decides.
  it('finds bright squares when asked for the other polarity', () => {
    const image = render([{ poly: square(150, 120, 50), value: 240 }], 30);
    expect(findQuadBlobs(gray(image), W, H, 128, SCAN)).toHaveLength(0);
    expect(findQuadBlobs(gray(image), W, H, 128, { ...SCAN, dark: false })).toHaveLength(1);
  });

  it('rejects shapes that are not square-ish', () => {
    const image = render(
      [
        // A long bar and an L — both compact enough to survive the area band.
        { poly: square(90, 60, 40).map((p) => ({ x: p.x * 1.8 - 40, y: p.y })), value: 20 },
        {
          poly: [
            { x: 180, y: 140 },
            { x: 240, y: 140 },
            { x: 240, y: 160 },
            { x: 200, y: 160 },
            { x: 200, y: 200 },
            { x: 180, y: 200 },
          ],
          value: 20,
        },
      ],
      240
    );
    expect(findQuadBlobs(gray(image), W, H, 128, SCAN)).toHaveLength(0);
  });

  it("ignores blobs outside the caller's area band", () => {
    const image = render(
      [
        { poly: square(60, 60, 6), value: 20 },
        { poly: square(200, 140, 200), value: 20 },
      ],
      240
    );
    expect(findQuadBlobs(gray(image), W, H, 128, SCAN)).toHaveLength(0);
  });
});

describe('quad helpers', () => {
  const q = square(10, 20, 8) as unknown as readonly [Point, Point, Point, Point];

  it('measures area regardless of winding', () => {
    expect(quadArea(q)).toBeCloseTo(64, 9);
    const reversed = [...q].reverse() as unknown as readonly [Point, Point, Point, Point];
    expect(quadArea(reversed)).toBeCloseTo(64, 9);
  });

  it('averages the corners for the centre', () => {
    expect(quadCenter(q)).toEqual({ x: 10, y: 20 });
  });
});
