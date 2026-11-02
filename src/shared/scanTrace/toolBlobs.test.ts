import { describe, it, expect } from 'vitest';
import { findToolBlobs, interiorSeed, pointInPolygon } from './toolBlobs';
import type { Mask, Point } from './types';

function maskOf(width: number, height: number, inside: (x: number, y: number) => boolean): Mask {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = inside(x, y) ? 1 : 0;
  }
  return { width, height, data };
}

const box = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) =>
  x >= x0 && x <= x1 && y >= y0 && y <= y1;

describe('findToolBlobs', () => {
  it('returns every tool, largest first', () => {
    const small = box(10, 10, 29, 29);
    const large = box(50, 10, 99, 59);
    const blobs = findToolBlobs(
      maskOf(120, 80, (x, y) => small(x, y) || large(x, y)),
      16
    );
    expect(blobs.map((b) => b.areaPx)).toEqual([2500, 400]);
  });

  it('drops specks under 1% of the largest tool', () => {
    const tool = box(10, 10, 109, 109);
    const speck = box(115, 115, 117, 117);
    const blobs = findToolBlobs(
      maskOf(120, 120, (x, y) => tool(x, y) || speck(x, y)),
      1
    );
    expect(blobs).toHaveLength(1);
  });

  it('drops a piece lying inside another tool’s outline', () => {
    const ring = (x: number, y: number) => box(10, 10, 89, 89)(x, y) && !box(25, 25, 74, 74)(x, y);
    const inner = box(40, 40, 59, 59);
    const blobs = findToolBlobs(
      maskOf(100, 100, (x, y) => ring(x, y) || inner(x, y)),
      16
    );
    expect(blobs).toHaveLength(1);
    expect(blobs[0].areaPx).toBe(80 * 80 - 50 * 50);
  });

  it('drops a solid piece inside a thin ring that holds fewer pixels', () => {
    const ring = (x: number, y: number) => box(10, 10, 89, 89)(x, y) && !box(15, 15, 84, 84)(x, y);
    const inner = box(20, 20, 79, 79);
    const blobs = findToolBlobs(
      maskOf(100, 100, (x, y) => ring(x, y) || inner(x, y)),
      16
    );
    expect(blobs).toHaveLength(1);
    expect(blobs[0].areaPx).toBe(80 * 80 - 70 * 70);
  });

  it('traces each piece at its place in the frame', () => {
    const piece = box(30, 40, 59, 49);
    const [blob] = findToolBlobs(maskOf(100, 80, piece), 16);
    const xs = blob.contour.map((p) => p.x);
    const ys = blob.contour.map((p) => p.y);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([
      30, 59, 40, 49,
    ]);
  });

  it('finds nothing in an empty mask', () => {
    expect(
      findToolBlobs(
        maskOf(20, 20, () => false),
        1
      )
    ).toEqual([]);
  });
});

describe('interiorSeed', () => {
  it('lands inside an L whose centroid is outside it', () => {
    const L: Point[] = [
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: 80 },
      { x: 90, y: 80 },
      { x: 90, y: 100 },
      { x: 10, y: 100 },
    ];
    const seed = interiorSeed(L, 100, 120);
    expect(pointInPolygon({ x: seed.x * 100, y: seed.y * 120 }, L)).toBe(true);
  });

  it('picks the middle of a plain box', () => {
    const seed = interiorSeed(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
        { x: 0, y: 40 },
      ],
      100,
      100
    );
    expect(seed.x).toBeCloseTo(0.2, 1);
    expect(seed.y).toBeCloseTo(0.2, 1);
  });
});
