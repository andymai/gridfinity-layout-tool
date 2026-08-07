import { describe, it, expect } from 'vitest';
import { TrianglePatternCalculator, createTriangleCalculator } from './trianglePattern';

describe('TrianglePatternCalculator', () => {
  it('rejects invalid construction', () => {
    expect(() => new TrianglePatternCalculator(0)).toThrow('radius must be positive');
  });

  it('describes a 3-sided polygon with per-center flip (no baked rotation)', () => {
    const calc = new TrianglePatternCalculator(2);
    expect(calc.getShapeDescriptor()).toEqual({ kind: 'polygon', radius: 2, sides: 3 });
    expect(calc.getPatternType()).toBe('triangle');
  });

  it('alternates apex-up / apex-down across the field', () => {
    const calc = new TrianglePatternCalculator(2);
    const centers = calc.calculateCenters({ fillW: 50, fillH: 50 });
    expect(centers.length).toBeGreaterThan(1);
    const rotations = new Set(centers.map((c) => c.rotation));
    // Both orientations present → apex-up (0°) / apex-down (180°) checkerboard.
    expect(rotations.has(0)).toBe(true);
    expect(rotations.has(180)).toBe(true);
  });

  it('tiles interlocked with a uniform web and no overlaps', () => {
    const R = 4;
    const web = 0.8;
    const calc = new TrianglePatternCalculator(R, web);
    const centers = calc.calculateCenters({ fillW: 80, fillH: 28 });
    expect(centers.length).toBeGreaterThan(10);

    const verts = (c: { x: number; y: number; rotation?: number }) => {
      const rot = ((c.rotation ?? 0) * Math.PI) / 180;
      return [0, 1, 2].map((i) => {
        const a = Math.PI / 2 + rot + (i * 2 * Math.PI) / 3;
        return [c.x + R * Math.cos(a), c.y + R * Math.sin(a)] as const;
      });
    };
    const side = (
      a: readonly [number, number],
      b: readonly [number, number],
      p: readonly [number, number]
    ) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const inside = (p: readonly [number, number], v: (readonly [number, number])[]) => {
      const d = [side(v[0], v[1], p), side(v[1], v[2], p), side(v[2], v[0], p)];
      return !(d.some((x) => x < 0) && d.some((x) => x > 0));
    };
    const segDist = (
      a: readonly [number, number],
      b: readonly [number, number],
      c: readonly [number, number],
      d: readonly [number, number]
    ) => {
      const clamp = (t: number) => Math.max(0, Math.min(1, t));
      const d1 = [b[0] - a[0], b[1] - a[1]];
      const d2 = [d[0] - c[0], d[1] - c[1]];
      const r = [c[0] - a[0], c[1] - a[1]];
      const A = d1[0] * d1[0] + d1[1] * d1[1];
      const B = d1[0] * d2[0] + d1[1] * d2[1];
      const C = d2[0] * d2[0] + d2[1] * d2[1];
      const D = d1[0] * r[0] + d1[1] * r[1];
      const E = d2[0] * r[0] + d2[1] * r[1];
      let best = Infinity;
      const cands: (readonly [number, number])[] = [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
        [clamp(D / A), 0],
        [clamp((D + B) / A), 1],
        [0, clamp(-E / C)],
        [1, clamp((B - E) / C)],
      ];
      for (const [sT, tT] of cands) {
        const px = a[0] + sT * d1[0] - c[0] - tT * d2[0];
        const py = a[1] + sT * d1[1] - c[1] - tT * d2[1];
        best = Math.min(best, Math.hypot(px, py));
      }
      return best;
    };

    let minGap = Infinity;
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        if (Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y) > 3 * R) continue;
        const vi = verts(centers[i]);
        const vj = verts(centers[j]);
        expect(vj.some((pt) => inside(pt, vi)) || vi.some((pt) => inside(pt, vj))).toBe(false);
        let g = Infinity;
        for (let a = 0; a < 3; a++) {
          for (let b = 0; b < 3; b++) {
            g = Math.min(g, segDist(vi[a], vi[(a + 1) % 3], vj[b], vj[(b + 1) % 3]));
          }
        }
        minGap = Math.min(minGap, g);
      }
    }
    // Nearest neighbours are separated by exactly the design web.
    expect(minGap).toBeCloseTo(web, 6);
  });

  it('returns no centers when the fill area is too small', () => {
    expect(new TrianglePatternCalculator(4).calculateCenters({ fillW: 3, fillH: 3 })).toEqual([]);
  });
});

describe('createTriangleCalculator', () => {
  it('scales radius with the scale slider', () => {
    expect(createTriangleCalculator(5, 0.2).getShapeRadius()).toBeLessThan(
      createTriangleCalculator(5, 0.9).getShapeRadius()
    );
  });
});
