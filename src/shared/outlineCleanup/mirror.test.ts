import { describe, it, expect } from 'vitest';
import { axisIsUpright, mirrorAxis, mirrorRegion, type MirrorAxis } from './mirror';
import type { Pt } from './runs';

// Lopsided: a 30 x 20 block with a tab on its right side only.
const LOPSIDED: Pt[] = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 8 },
  { x: 36, y: 8 },
  { x: 36, y: 12 },
  { x: 30, y: 12 },
  { x: 30, y: 20 },
  { x: 0, y: 20 },
];

const reflect = (p: Pt, axis: MirrorAxis): Pt => {
  const dx = p.x - axis.origin.x;
  const dy = p.y - axis.origin.y;
  const c = Math.cos(2 * axis.angle);
  const s = Math.sin(2 * axis.angle);
  return { x: axis.origin.x + dx * c + dy * s, y: axis.origin.y + dx * s - dy * c };
};

const nearest = (p: Pt, ring: readonly Pt[]): number => {
  let best = Infinity;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t));
  });
  return best;
};

const symmetricAbout = (ring: readonly Pt[], axis: MirrorAxis, tol: number): boolean =>
  ring.every((p) => nearest(reflect(p, axis), ring) < tol);

const xs = (ring: readonly Pt[]) => ring.map((p) => p.x);

describe('mirrorRegion', () => {
  const upright = mirrorAxis(LOPSIDED, 'vertical');

  it('puts the upright axis through the middle', () => {
    expect(upright.origin).toEqual({ x: 18, y: 10 });
    expect(axisIsUpright(upright)).toBe(true);
    expect(axisIsUpright(mirrorAxis(LOPSIDED, 'horizontal'))).toBe(false);
  });

  it('keeps the right half, tab and all, on both sides', () => {
    const kept = mirrorRegion({ outline: LOPSIDED, holes: [] }, upright, 'high');
    if (!kept) throw new Error('missed');
    expect(symmetricAbout(kept.outline, upright, 1e-6)).toBe(true);
    expect(Math.min(...xs(kept.outline))).toBeCloseTo(0);
    expect(Math.max(...xs(kept.outline))).toBeCloseTo(36);
  });

  it('keeps the left half, without the tab', () => {
    const kept = mirrorRegion({ outline: LOPSIDED, holes: [] }, upright, 'low');
    if (!kept) throw new Error('missed');
    expect(symmetricAbout(kept.outline, upright, 1e-6)).toBe(true);
    expect(Math.max(...xs(kept.outline))).toBeCloseTo(36);
    expect(Math.min(...xs(kept.outline))).toBeCloseTo(0);
    expect(kept.outline.some((p) => p.x > 30 && p.x < 36)).toBe(false);
  });

  it('mirrors an island on the kept side across to the other', () => {
    const island = [
      { x: 22, y: 6 },
      { x: 26, y: 6 },
      { x: 26, y: 14 },
      { x: 22, y: 14 },
    ];
    const kept = mirrorRegion({ outline: LOPSIDED, holes: [island] }, upright, 'high');
    expect(kept?.holes).toHaveLength(2);
  });

  // Keeping the top of a U about its middle leaves its two legs apart.
  it('refuses a half that falls apart rather than dropping part of it', () => {
    const u = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
      { x: 20, y: 30 },
      { x: 20, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 30 },
      { x: 0, y: 30 },
    ];
    expect(mirrorRegion({ outline: u, holes: [] }, mirrorAxis(u, 'horizontal'), 'high')).toBeNull();
  });

  // Averaged with the tabbed side, the plain left wall moves in to about x = 3,
  // across an island beside it: the island joins the wall instead of standing
  // outside the pocket.
  it('cuts the islands from an averaged outline', () => {
    const island = [
      { x: 1, y: 2 },
      { x: 5, y: 2 },
      { x: 5, y: 4 },
      { x: 1, y: 4 },
    ];
    const even = mirrorRegion({ outline: LOPSIDED, holes: [island] }, upright, 'average');
    if (!even) throw new Error('missed');
    expect(even.holes).toEqual([]);
  });

  it('averages the two halves into one even outline', () => {
    const even = mirrorRegion({ outline: LOPSIDED, holes: [] }, upright, 'average');
    if (!even) throw new Error('missed');
    expect(symmetricAbout(even.outline, upright, 0.3)).toBe(true);
  });

  it('finds the mirror line of a tilted symmetric shape', () => {
    const tilt = (20 * Math.PI) / 180;
    const kite = [
      { x: 0, y: -10 },
      { x: 6, y: 0 },
      { x: 0, y: 25 },
      { x: -6, y: 0 },
    ].map((p) => ({
      x: p.x * Math.cos(tilt) - p.y * Math.sin(tilt),
      y: p.x * Math.sin(tilt) + p.y * Math.cos(tilt),
    }));
    const axis = mirrorAxis(kite, 'detected');
    const kept = mirrorRegion({ outline: kite, holes: [] }, axis, 'low');
    if (!kept) throw new Error('missed');
    expect(symmetricAbout(kite, axis, 0.5)).toBe(true);
  });
});
