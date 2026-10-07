import { describe, it, expect } from 'vitest';
import { pathCutoutSections } from './pathCutoutOutline';
import type { Pt } from './polygonOffset';

const square: Pt[] = [
  { x: -10, y: -10 },
  { x: 10, y: -10 },
  { x: 10, y: 10 },
  { x: -10, y: 10 },
];

/** A 30×25 L whose inner corner is a quarter circle of `radius`, in 12 chords. */
function roundedL(radius: number): Pt[] {
  const arc = Array.from({ length: 13 }, (_, k) => {
    const a = -Math.PI / 2 - (k / 12) * (Math.PI / 2);
    return { x: 10 + radius + radius * Math.cos(a), y: 8 + radius + radius * Math.sin(a) };
  });
  return [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 8 },
    ...arc,
    { x: 10, y: 25 },
    { x: 0, y: 25 },
  ];
}

const area = (p: readonly Pt[]): number =>
  Math.abs(
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a.x * b.y - b.x * a.y;
    }, 0) / 2
  );

function distanceToOutline(q: Pt, poly: readonly Pt[]): number {
  let best = Infinity;
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(a.x + t * dx - q.x, a.y + t * dy - q.y));
  });
  return best;
}

describe('pathCutoutSections', () => {
  it('offsets the base by the clearance and the rim by the chamfer as well', () => {
    const sections = pathCutoutSections(square, 0.5, 0.8);
    expect(sections?.base).toHaveLength(4);
    expect(sections?.rim).toHaveLength(4);
    expect(area(sections?.base ?? [])).toBeCloseTo(21 * 21, 9);
    expect(area(sections?.rim ?? [])).toBeCloseTo(22.6 * 22.6, 9);
  });

  it('uses one outline for both sections without a chamfer', () => {
    const sections = pathCutoutSections(square, 0.5, 0);
    expect(sections?.rim).toBe(sections?.base);
  });

  it('never flares the rim inward of the base at a notch too tight for either', () => {
    const outline = roundedL(0.5);
    const sections = pathCutoutSections(outline, 0.7, 0.8);
    expect(sections?.base).toHaveLength(sections?.rim.length ?? -1);
    sections?.base.forEach((b, i) => {
      const r = sections.rim[i];
      expect(distanceToOutline(r, outline)).toBeGreaterThanOrEqual(
        distanceToOutline(b, outline) - 1e-9
      );
    });
  });

  it('gives up on an outline it cannot thin to its point budget without crossing', () => {
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i < 300; i++) {
      left.push({ x: 0, y: i * 0.1 }, { x: 0.9, y: i * 0.1 + 0.05 });
      right.push({ x: 1, y: i * 0.1 + 0.05 }, { x: 0.1, y: i * 0.1 + 0.1 });
    }
    const zipper = [...left, { x: 0, y: 30 }, ...right.reverse()];
    expect(pathCutoutSections(zipper, 0.5, 0)).toBeNull();
  });
});
