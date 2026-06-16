import { describe, it, expect } from 'vitest';
import { solveHomography, applyHomography, rectifyPoints, type Homography } from './perspective';
import type { Point } from './types';

// A forward homography (mm → image) with a real perspective component (h6/h7),
// i.e. genuine keystone distortion, not just an affine scale.
const FORWARD: Homography = [10, 0.4, 50, -0.3, 10, 60, 0.002, 0.0015, 1];

// ISO-7810 card corners in mm — the real-world reference rectangle.
const CARD: [Point, Point, Point, Point] = [
  { x: 0, y: 0 },
  { x: 85.6, y: 0 },
  { x: 85.6, y: 53.98 },
  { x: 0, y: 53.98 },
];

function warpAll(points: readonly Point[], h: Homography): Point[] {
  return points.map((p) => applyHomography(h, p));
}

function expectClose(a: Point, b: Point): void {
  expect(a.x).toBeCloseTo(b.x, 4);
  expect(a.y).toBeCloseTo(b.y, 4);
}

describe('applyHomography', () => {
  it('leaves points unchanged under the identity', () => {
    const identity: Homography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    expect(applyHomography(identity, { x: 7, y: -3 })).toEqual({ x: 7, y: -3 });
  });
});

describe('solveHomography', () => {
  it('recovers the exact mapping for the four fitted corners', () => {
    const cardInImage = warpAll(CARD, FORWARD) as [Point, Point, Point, Point];
    const h = solveHomography(cardInImage, CARD);
    expect(h).not.toBeNull();
    if (!h) return;
    CARD.forEach((corner, i) => expectClose(applyHomography(h, cardInImage[i]), corner));
  });

  it('rectifies points that were NOT used to fit it (the real proof)', () => {
    // The reference (card) defines the homography...
    const cardInImage = warpAll(CARD, FORWARD) as [Point, Point, Point, Point];
    const h = solveHomography(cardInImage, CARD);
    expect(h).not.toBeNull();
    if (!h) return;

    // ...and a completely separate outline (the "tool") rectifies correctly.
    const toolMm: Point[] = [
      { x: 20, y: 12 },
      { x: 64, y: 18 },
      { x: 58, y: 44 },
      { x: 26, y: 39 },
      { x: 41, y: 30 },
    ];
    const toolInImage = warpAll(toolMm, FORWARD);
    const recovered = rectifyPoints(toolInImage, h);

    recovered.forEach((p, i) => expectClose(p, toolMm[i]));
  });

  it('removes keystone: a warped square comes back square and to scale', () => {
    const squareMm: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ];
    const cardInImage = warpAll(CARD, FORWARD) as [Point, Point, Point, Point];
    const h = solveHomography(cardInImage, CARD);
    if (!h) throw new Error('fixture failed');

    const recovered = rectifyPoints(warpAll(squareMm, FORWARD), h);
    // Opposite sides equal, adjacent sides equal → it's a 40mm square again.
    const side = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
    expect(side(recovered[0], recovered[1])).toBeCloseTo(40, 3);
    expect(side(recovered[1], recovered[2])).toBeCloseTo(40, 3);
    expect(side(recovered[2], recovered[3])).toBeCloseTo(40, 3);
    expect(side(recovered[3], recovered[0])).toBeCloseTo(40, 3);
  });

  it('returns null for degenerate (collinear) correspondences', () => {
    const collinear: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(solveHomography(collinear, CARD)).toBeNull();
  });
});
