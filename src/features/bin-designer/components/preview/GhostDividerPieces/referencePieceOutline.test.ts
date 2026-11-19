import { describe, expect, it } from 'vitest';
import type { PieceWindow } from '@/shared/utils/dividerPieceWindow';
import { UNBOUNDED_SLACK } from '@/shared/utils/wallCutoutPosition';
import { referencePieceGeometry, windowOutline } from './referencePieceOutline';

const window = (over: Partial<PieceWindow> = {}): PieceWindow => ({
  offset: 5,
  width: 30,
  depth: 12,
  cornerSlack: UNBOUNDED_SLACK,
  radii: { top: 0, bottom: 0 },
  ...over,
});

const span = (ring: readonly (readonly [number, number])[]) => ({
  minX: Math.min(...ring.map(([x]) => x)),
  maxX: Math.max(...ring.map(([x]) => x)),
  minY: Math.min(...ring.map(([, y]) => y)),
});

describe('windowOutline', () => {
  it('draws a square u-shape at its offset, down to its depth', () => {
    const s = span(windowOutline('u-shape', window(), 20));
    expect(s).toEqual({ minX: 5 - 15, maxX: 5 + 15, minY: 20 - 12 });
  });

  it('rounds the floor corners and flares the shoulders without changing the depth', () => {
    const ring = windowOutline('u-shape', window({ radii: { top: 3, bottom: 4 } }), 20);
    const s = span(ring);
    expect(s.minY).toBeCloseTo(8, 6);
    // The round-over widens the opening at the rim.
    expect(s.maxX).toBeGreaterThan(20);
    // No point sits in the square floor corner the fillet removes.
    expect(ring.some(([x, y]) => x > 19.5 && y < 8.5)).toBe(false);
  });

  it('cuts a scoop no deeper than half its width', () => {
    expect(span(windowOutline('scoop', window({ depth: 40 }), 20)).minY).toBeCloseTo(20 - 15, 6);
  });

  it('narrows a funnel toward its floor', () => {
    const ring = windowOutline('funnel', window(), 20);
    const floor = ring.filter(([, y]) => Math.abs(y - 8) < 1e-6).map(([x]) => x);
    expect(Math.max(...floor) - 5).toBeLessThan(15);
  });
});

describe('referencePieceGeometry', () => {
  it('keeps the piece size and opens the window from its top edge', () => {
    const geometry = referencePieceGeometry(100, 40, 1.6, [], window(), 'u-shape');
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    expect(box?.min.toArray().map((v) => +v.toFixed(6))).toEqual([-50, -0.8, -20]);
    expect(box?.max.toArray().map((v) => +v.toFixed(6))).toEqual([50, 0.8, 20]);

    // The window's floor corners sit at its depth below the top edge.
    const pos = geometry.getAttribute('position');
    const at = (x: number, z: number): boolean => {
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getX(i) - x) < 1e-6 && Math.abs(pos.getZ(i) - z) < 1e-6) return true;
      }
      return false;
    };
    expect(at(5 - 15, 20 - 12)).toBe(true);
    expect(at(5 + 15, 20 - 12)).toBe(true);
    geometry.dispose();
  });

  it('cuts top and bottom notches as well as the window', () => {
    const plain = referencePieceGeometry(100, 40, 1.6, [], window(), 'u-shape');
    const notched = referencePieceGeometry(
      100,
      40,
      1.6,
      [
        { offset: -35, width: 2, depth: 21, fromTop: true },
        { offset: 35, width: 2, depth: 21, fromTop: false },
      ],
      window(),
      'u-shape'
    );
    expect(notched.getAttribute('position').count).toBeGreaterThan(
      plain.getAttribute('position').count
    );
    plain.dispose();
    notched.dispose();
  });
});

describe('rounded corners over an interior fillet', () => {
  const points = (geometry: ReturnType<typeof referencePieceGeometry>): [number, number][] => {
    const pos = geometry.getAttribute('position');
    const out: [number, number][] = [];
    for (let i = 0; i < pos.count; i++) out.push([pos.getX(i), pos.getZ(i)]);
    return out;
  };
  const near = (list: [number, number][], px: number, pz: number): boolean =>
    list.some(([x, z]) => Math.abs(x - px) < 1e-4 && Math.abs(z - pz) < 1e-4);

  it('rounds only the named ends, tangent to the end and the bottom edge', () => {
    const r = 3.4;
    const geometry = referencePieceGeometry(100, 40, 1.6, [], null, 'u-shape', {
      radius: r,
      low: true,
      high: false,
    });
    const list = points(geometry);
    // Nothing stands in the low end's square corner, outside the arc. The
    // positions are single precision.
    const cx = -50 + r;
    const cz = -20 + r;
    expect(list.some(([x, z]) => x < cx && z < cz && Math.hypot(x - cx, z - cz) > r + 1e-4)).toBe(
      false
    );
    // The arc meets the end and the bottom edge where it is tangent to them.
    expect(near(list, -50, -20 + r)).toBe(true);
    expect(near(list, -50 + r, -20)).toBe(true);
    // The high end keeps its square corner.
    expect(near(list, 50, -20)).toBe(true);
    geometry.dispose();
  });

  it('keeps a window and rounded corners together', () => {
    const geometry = referencePieceGeometry(100, 40, 1.6, [], window(), 'u-shape', {
      radius: 3.4,
      low: true,
      high: true,
    });
    const list = points(geometry);
    expect(near(list, 50, -20)).toBe(false);
    expect(near(list, 5 - 15, 20 - 12)).toBe(true);
    geometry.dispose();
  });
});
