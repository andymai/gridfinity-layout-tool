import { describe, it, expect } from 'vitest';
import {
  solveHomography,
  solveHomographyLeastSquares,
  homographyRmsError,
  applyHomography,
  rectifyPoints,
  type Homography,
  type PointPair,
} from './perspective';
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

// A calibration-sheet-like lattice of marker corners in mm, spanning the whole
// scanned area rather than one small card.
const PITCH = 42;
const HALF_MARKER = 7;
function latticeCorners(cols: number, rows: number): Point[] {
  const pts: Point[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (col !== 0 && col !== cols - 1 && row !== 0 && row !== rows - 1) continue;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        pts.push({ x: col * PITCH + sx * HALF_MARKER, y: row * PITCH + sy * HALF_MARKER });
      }
    }
  }
  return pts;
}

/** Deterministic ±`amount` jitter — reproducible corner-detection error. */
function jitterer(amount: number, seed = 12345) {
  let state = seed;
  const next = (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return (state / 4294967296) * 2 - 1;
  };
  return (p: Point): Point => ({ x: p.x + next() * amount, y: p.y + next() * amount });
}

describe('solveHomographyLeastSquares', () => {
  it('reproduces the exact solve when the correspondences are noise-free', () => {
    const mm = latticeCorners(5, 6);
    const pairs: PointPair[] = mm.map((p) => ({ src: applyHomography(FORWARD, p), dst: p }));
    const h = solveHomographyLeastSquares(pairs);
    expect(h).not.toBeNull();
    if (!h) return;

    mm.forEach((p, i) => expectClose(applyHomography(h, pairs[i].src), p));
    expect(homographyRmsError(h, pairs)).toBeLessThan(1e-6);
  });

  it('needs at least four correspondences', () => {
    const mm = latticeCorners(5, 6).slice(0, 3);
    expect(solveHomographyLeastSquares(mm.map((p) => ({ src: p, dst: p })))).toBeNull();
  });

  it('returns null when the points carry no spread', () => {
    const same: PointPair[] = Array.from({ length: 8 }, () => ({
      src: { x: 5, y: 5 },
      dst: { x: 1, y: 1 },
    }));
    expect(solveHomographyLeastSquares(same)).toBeNull();
  });

  // The reason the calibration sheet exists: four points fit ANY corner error
  // exactly, so it lands in the map and gets amplified across the frame. Many
  // points cannot, so the error averages down instead.
  it('beats an exact four-point solve when the corners are noisy', () => {
    const mm = latticeCorners(5, 6);
    const jitter = jitterer(1.5);
    const observed = mm.map((p) => jitter(applyHomography(FORWARD, p)));

    const leastSquares = solveHomographyLeastSquares(
      mm.map((p, i) => ({ src: observed[i], dst: p }))
    );
    // The four-point alternative sees the same photo: the four outermost
    // corners of the same lattice, observed with the same error. Marker (0,0)
    // occupies points 0-3 and the last row starts at point 52, so these are the
    // extreme TL / TR / BR / BL of the whole sheet.
    const cornerIdx = [0, 17, 70, 55];
    const pick = <T>(from: readonly T[]): [T, T, T, T] => [
      from[cornerIdx[0]],
      from[cornerIdx[1]],
      from[cornerIdx[2]],
      from[cornerIdx[3]],
    ];
    const exact = solveHomography(pick(observed), pick(mm));
    expect(leastSquares).not.toBeNull();
    expect(exact).not.toBeNull();
    if (!leastSquares || !exact) return;

    // Score both on a tool outline neither was fitted to, in the sheet's middle.
    const toolMm: Point[] = [
      { x: 60, y: 60 },
      { x: 120, y: 65 },
      { x: 118, y: 150 },
      { x: 58, y: 145 },
    ];
    const toolInImage = toolMm.map((p) => applyHomography(FORWARD, p));
    const worstError = (h: Homography): number =>
      Math.max(
        ...toolInImage.map((p, i) => {
          const got = applyHomography(h, p);
          return Math.hypot(got.x - toolMm[i].x, got.y - toolMm[i].y);
        })
      );

    // Not merely better — the noise averages down, so it more than halves.
    expect(worstError(leastSquares)).toBeLessThan(worstError(exact) / 2);
    expect(worstError(leastSquares)).toBeLessThan(0.2);
  });

  it('reports its own disagreement in destination units', () => {
    const mm = latticeCorners(5, 6);
    const jitter = jitterer(2, 999);
    const pairs: PointPair[] = mm.map((p) => ({
      src: jitter(applyHomography(FORWARD, p)),
      dst: p,
    }));
    const h = solveHomographyLeastSquares(pairs);
    expect(h).not.toBeNull();
    if (!h) return;
    const rms = homographyRmsError(h, pairs);
    expect(rms).toBeGreaterThan(0);
    expect(rms).toBeLessThan(1);
  });
});
