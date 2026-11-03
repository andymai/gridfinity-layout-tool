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

  it('flags a piece lying in another tool’s hole', () => {
    const ring = (x: number, y: number) => box(10, 10, 89, 89)(x, y) && !box(25, 25, 74, 74)(x, y);
    const inner = box(40, 40, 59, 59);
    const blobs = findToolBlobs(
      maskOf(100, 100, (x, y) => ring(x, y) || inner(x, y)),
      16
    );
    expect(blobs.map((b) => [b.areaPx, b.inHole])).toEqual([
      [80 * 80 - 50 * 50, false],
      [20 * 20, true],
    ]);
  });

  it('flags a solid piece inside a thin ring that holds fewer pixels', () => {
    const ring = (x: number, y: number) => box(10, 10, 89, 89)(x, y) && !box(15, 15, 84, 84)(x, y);
    const inner = box(20, 20, 79, 79);
    const blobs = findToolBlobs(
      maskOf(100, 100, (x, y) => ring(x, y) || inner(x, y)),
      16
    );
    expect(blobs.find((b) => !b.inHole)?.areaPx).toBe(80 * 80 - 70 * 70);
    expect(blobs.find((b) => b.inHole)?.areaPx).toBe(60 * 60);
  });

  it('traces the hole a ring encloses', () => {
    const ring = (x: number, y: number) => box(10, 10, 89, 89)(x, y) && !box(25, 25, 74, 74)(x, y);
    const [blob] = findToolBlobs(maskOf(100, 100, ring), 16);
    expect(blob.holes).toHaveLength(1);
    const xs = blob.holes[0].map((p) => p.x);
    const ys = blob.holes[0].map((p) => p.y);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([
      25, 74, 25, 74,
    ]);
  });

  it('does not take a notch open to the frame, or a speck of a hole, for a hole', () => {
    // A U open at the top runs to the frame's edge; a 1px gap is a speck.
    const u = (x: number, y: number) =>
      box(10, 0, 89, 89)(x, y) && !box(30, 0, 69, 60)(x, y) && !(x === 20 && y === 80);
    const [blob] = findToolBlobs(maskOf(100, 100, u), 16);
    expect(blob.holes).toEqual([]);
  });

  // Holes are 4-connected: two pixels touching only at a corner do not leak.
  it('keeps a hole closed by a ring that meets itself only diagonally', () => {
    const ring = (x: number, y: number) =>
      (box(10, 10, 49, 49)(x, y) && !box(15, 15, 44, 44)(x, y)) ||
      (x === 45 && y === 30) ||
      (x === 46 && y === 31);
    const leaky = (x: number, y: number) =>
      ring(x, y) && !(x >= 45 && x <= 49 && y === 30) && !(x >= 45 && x <= 49 && y === 31);
    const [blob] = findToolBlobs(
      maskOf(60, 60, (x, y) => leaky(x, y) || (x === 45 && y === 30) || (x === 46 && y === 31)),
      16
    );
    expect(blob.holes).toHaveLength(1);
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

  it('lands on a ring, not in its hole', () => {
    const outer = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ];
    const hole = [
      { x: 8, y: 8 },
      { x: 32, y: 8 },
      { x: 32, y: 32 },
      { x: 8, y: 32 },
    ];
    const seed = interiorSeed(outer, 100, 100, [hole]);
    const p = { x: seed.x * 100, y: seed.y * 100 };
    expect(pointInPolygon(p, outer) && !pointInPolygon(p, hole)).toBe(true);
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
