import { describe, it, expect } from 'vitest';
import { pathCutoutCut, pathCutoutOutline, pathCutoutSections } from './pathCutoutOutline';
import type { Pt } from './polygonOffset';

/**
 * A pocket split by a slit between two interleaved combs, 607 points. The
 * lower comb's teeth are too shallow to survive thinning, so it straightens at
 * their tips, through the tips of the upper comb's deeper teeth.
 */
function slitZipper(): Pt[] {
  const teeth = 150;
  const pitch = 3 / teeth;
  const lower: Pt[] = [];
  const upper: Pt[] = [];
  for (let k = 0; k < teeth; k++) {
    lower.push({ x: 3 - k * pitch, y: 0.03 }, { x: 3 - (k + 0.5) * pitch, y: 0 });
    upper.push({ x: k * pitch, y: 0.1 }, { x: (k + 0.5) * pitch, y: 0.003 });
  }
  return [
    { x: 0, y: -5 },
    { x: 3, y: -5 },
    ...lower,
    { x: 0, y: 0.03 },
    ...upper,
    { x: 3, y: 0.1 },
    { x: 3, y: 5 },
    { x: -1, y: 5 },
    { x: -1, y: -5 },
  ];
}

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

  it('gives up on an outline that thinning would make cross itself', () => {
    expect(pathCutoutSections(slitZipper(), 0.5, 0)).toBeNull();
  });
});

describe('pathCutoutCut', () => {
  const corner = (p: Pt) => ({ ...p, handleIn: null, handleOut: null, symmetric: false });
  const asCutout = (points: readonly Pt[]) => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      x,
      y,
      width: Math.max(...xs) - x,
      depth: Math.max(...ys) - y,
      path: points.map(corner),
    };
  };

  it('cuts a path that cannot be offset to its bare outline, not its box', () => {
    const cutout = asCutout(slitZipper());
    const outline = pathCutoutOutline(cutout);
    const cut = pathCutoutCut(cutout, 0.5, 0.8);
    expect(outline).not.toBeNull();
    expect(cut?.base).toEqual(outline);
    expect(cut?.rim).toEqual(outline);
  });

  it('offsets a path that can be', () => {
    expect(area(pathCutoutCut(asCutout(square), 0.5, 0)?.base ?? [])).toBeCloseTo(21 * 21, 9);
  });

  it('has nothing to cut for a degenerate path', () => {
    expect(pathCutoutCut({ ...asCutout(square), path: [] }, 0.5, 0)).toBeNull();
  });
});
