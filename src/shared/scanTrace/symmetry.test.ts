import { describe, it, expect } from 'vitest';
import { mirrorSymmetry, symmetrizeIfRegular } from './symmetry';
import type { Point } from './types';

// A vertically-elongated outline symmetric about x = 50, optionally perturbed on
// the left side by `noise` to make it slightly lopsided.
function symmetricBlob(noise = 0): Point[] {
  const cx = 50;
  const ys = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const widths = [10, 18, 24, 28, 30, 28, 24, 18, 10];
  const pts: Point[] = [];
  ys.forEach((y, i) => pts.push({ x: cx + widths[i], y }));
  for (let i = ys.length - 1; i >= 0; i--) {
    pts.push({ x: cx - widths[i] - (i === 3 ? noise : 0), y: ys[i] });
  }
  return pts;
}

// An irregular 8-gon with no mirror axis (≥8 points so it passes the length
// guard and is rejected by the symmetry SCORE, not the guard).
const ASYMMETRIC: Point[] = [
  { x: 10, y: 12 },
  { x: 52, y: 6 },
  { x: 92, y: 22 },
  { x: 96, y: 52 },
  { x: 72, y: 60 },
  { x: 58, y: 92 },
  { x: 28, y: 84 },
  { x: 13, y: 54 },
];

function reflectionScore(pts: readonly Point[]): number {
  return mirrorSymmetry(pts).score;
}

describe('mirrorSymmetry', () => {
  it('scores a symmetric outline near 1', () => {
    expect(reflectionScore(symmetricBlob(0))).toBeGreaterThan(0.95);
  });

  it('scores an asymmetric outline well below the gate', () => {
    expect(reflectionScore(ASYMMETRIC)).toBeLessThan(0.9);
  });
});

describe('symmetrizeIfRegular', () => {
  it('cleans up a slightly-lopsided symmetric outline', () => {
    const noisy = symmetricBlob(8);
    const before = reflectionScore(noisy);
    const after = reflectionScore(symmetrizeIfRegular(noisy));
    expect(before).toBeGreaterThan(0.9); // still reads as symmetric → gate passes
    expect(after).toBeGreaterThan(before); // …and gets more symmetric
    expect(after).toBeGreaterThan(0.98);
  });

  it('leaves a genuinely asymmetric outline untouched', () => {
    const out = symmetrizeIfRegular(ASYMMETRIC);
    expect(out).toEqual(ASYMMETRIC);
  });
});
