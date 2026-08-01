import { describe, it, expect } from 'vitest';
import type { OutlineVertex } from '@/core/types';
import { OUTLINE_MAX_VERTICES } from '@/shared/utils/drawerOutline';
import { simplifyLoop } from './simplifyLoop';

/** `n` points sampled around a circle — the shape a flattened curve produces. */
function circle(n: number, r = 200): OutlineVertex[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) };
  });
}

describe('simplifyLoop', () => {
  it('leaves a loop that already fits completely alone', () => {
    const v = circle(20);
    const r = simplifyLoop(v);
    expect(r.vertices).toEqual(v);
    expect(r.removed).toBe(0);
  });

  // validateOutline rejects anything past the ceiling, so a traced or flattened
  // curve would otherwise be unimportable.
  it('brings an oversized loop under the ceiling', () => {
    const r = simplifyLoop(circle(4000));
    expect(r.vertices.length).toBeLessThanOrEqual(OUTLINE_MAX_VERTICES);
    expect(r.removed).toBe(4000 - r.vertices.length);
  });

  it('keeps the shape recognisable rather than collapsing it', () => {
    const r = simplifyLoop(circle(4000, 200));
    const xs = r.vertices.map((v) => v.x);
    const ys = r.vertices.map((v) => v.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(380);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(380);
    expect(r.vertices.length).toBeGreaterThan(8);
  });

  // A bulge describes the segment LEAVING its vertex, so dropping either end of
  // an arc silently re-aims the curve at a different point.
  it('never drops a vertex an arc depends on', () => {
    const v: OutlineVertex[] = [...circle(1000)];
    v[10] = { ...v[10], bulge: 0.5 };
    v[500] = { ...v[500], bulge: -0.3 };
    const r = simplifyLoop(v);
    const survives = (p: OutlineVertex) => r.vertices.some((q) => q.x === p.x && q.y === p.y);
    // Both arc endpoints of each bowed segment must be present.
    expect(survives(v[10])).toBe(true);
    expect(survives(v[11])).toBe(true);
    expect(survives(v[500])).toBe(true);
    expect(survives(v[501])).toBe(true);
    expect(r.vertices.filter((p) => (p.bulge ?? 0) !== 0)).toHaveLength(2);
  });

  it('converges even on a loop that resists thinning at a fine tolerance', () => {
    // Every point matters at 0.05mm, so the tolerance has to escalate.
    const jagged: OutlineVertex[] = Array.from({ length: 2000 }, (_, i) => ({
      x: i * 0.5,
      y: i % 2 === 0 ? 0 : 3,
    }));
    const r = simplifyLoop(jagged);
    expect(r.vertices.length).toBeLessThanOrEqual(OUTLINE_MAX_VERTICES);
  });
});
