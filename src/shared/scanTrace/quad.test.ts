import { describe, it, expect } from 'vitest';
import { contourToQuad, orderCorners, estimateRectAspect } from './quad';
import type { Point } from './types';

// Project a point on the world z=0 plane through a tilted pinhole camera with
// the principal point at the image centre — the geometry estimateRectAspect
// assumes. f, principal point, tilt and distance are arbitrary but realistic.
function makeProjector(tiltX: number, tiltY: number) {
  const f = 800;
  const cx = 400;
  const cy = 400;
  const d = 650;
  const cxr = Math.cos(tiltX);
  const sxr = Math.sin(tiltX);
  const cyr = Math.cos(tiltY);
  const syr = Math.sin(tiltY);
  // R = Rx(tiltX) · Ry(tiltY)
  const r = [
    [cyr, 0, syr],
    [sxr * syr, cxr, -sxr * cyr],
    [-cxr * syr, sxr, cxr * cyr],
  ];
  return {
    cx,
    cy,
    project(x: number, y: number): Point {
      const xc = r[0][0] * x + r[0][1] * y;
      const yc = r[1][0] * x + r[1][1] * y;
      const zc = r[2][0] * x + r[2][1] * y + d;
      return { x: (f * xc) / zc + cx, y: (f * yc) / zc + cy };
    },
  };
}

/** Project a centered w×h rectangle and return its image corners. */
function projectRect(w: number, h: number, tiltX: number, tiltY: number): Point[] {
  const p = makeProjector(tiltX, tiltY);
  return [
    p.project(-w / 2, -h / 2),
    p.project(w / 2, -h / 2),
    p.project(w / 2, h / 2),
    p.project(-w / 2, h / 2),
  ];
}

/** Dense points along a rectangle perimeter. */
function rectPerimeter(w: number, h: number, step = 1): Point[] {
  const pts: Point[] = [];
  for (let x = 0; x <= w; x += step) pts.push({ x, y: 0 });
  for (let y = 0; y <= h; y += step) pts.push({ x: w, y });
  for (let x = w; x >= 0; x -= step) pts.push({ x, y: h });
  for (let y = h; y >= 0; y -= step) pts.push({ x: 0, y });
  return pts;
}

describe('orderCorners', () => {
  it('orders four points clockwise from top-left regardless of input order', () => {
    const tl = { x: 0, y: 0 };
    const tr = { x: 10, y: 0 };
    const br = { x: 10, y: 8 };
    const bl = { x: 0, y: 8 };
    expect(orderCorners([br, tl, bl, tr])).toEqual([tl, tr, br, bl]);
  });
});

describe('contourToQuad', () => {
  it('recovers the corners of a rectangle with high fitness', () => {
    const quad = contourToQuad(rectPerimeter(40, 24));
    expect(quad).not.toBeNull();
    if (!quad) return;
    expect(quad.fitness).toBeGreaterThan(0.95);
    expect(quad.corners[0]).toEqual({ x: 0, y: 0 });
    expect(quad.corners[2]).toEqual({ x: 40, y: 24 });
  });

  it('scores a concave (L-shaped) contour as a poor quad', () => {
    // L outline — a big notch keeps its contour off any 4-corner quad.
    const l: Point[] = [];
    const push = (a: Point, b: Point): void => {
      const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y));
      for (let i = 0; i < n; i++) {
        l.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
      }
    };
    const v = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 12 },
      { x: 14, y: 12 },
      { x: 14, y: 40 },
      { x: 0, y: 40 },
    ];
    for (let i = 0; i < v.length; i++) push(v[i], v[(i + 1) % v.length]);
    const quad = contourToQuad(l);
    expect(quad).not.toBeNull();
    if (!quad) return;
    expect(quad.fitness).toBeLessThan(0.8);
  });
});

describe('estimateRectAspect', () => {
  const recover = (w: number, h: number, tiltX: number, tiltY: number): number | null => {
    const corners = orderCorners(projectRect(w, h, tiltX, tiltY));
    return estimateRectAspect(corners, 400, 400);
  };

  it('recovers a card aspect (~1.586) despite tilt', () => {
    const aspect = recover(85.6, 53.98, 0.35, 0.25);
    expect(aspect).not.toBeNull();
    if (aspect === null) return;
    expect(aspect).toBeCloseTo(1.586, 1);
  });

  it('recovers a square (~1.0) and rejects it as card-shaped', () => {
    const aspect = recover(40, 40, 0.3, -0.2);
    expect(aspect).not.toBeNull();
    if (aspect === null) return;
    expect(aspect).toBeCloseTo(1.0, 1);
    expect(Math.abs(aspect - 1.586)).toBeGreaterThan(0.25);
  });

  it('recovers a 2:1 rectangle', () => {
    const aspect = recover(100, 50, -0.28, 0.22);
    expect(aspect).not.toBeNull();
    if (aspect === null) return;
    expect(aspect).toBeCloseTo(2.0, 1);
  });
});
