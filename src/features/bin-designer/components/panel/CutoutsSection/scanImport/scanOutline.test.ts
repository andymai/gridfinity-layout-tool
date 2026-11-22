import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { flattenPath } from '@/shared/utils/pathGeometryBezier';
import { pointInPolygon } from '@/shared/scanTrace';
import { getRotatedBounds } from '../geometryCore';
import { EDIT_FIT_MM } from '@/shared/outlineCleanup';
import { prepareScanCutouts } from './scanOutline';
import { MIN_MATERIAL_MM } from '../pocketChecks';

type Pt = { readonly x: number; readonly y: number };

const corner = ({ x, y }: Pt): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

/** A trace: dense corner points along each edge, as the phone sends them. */
function dense(ring: readonly Pt[], stepMm = 0.5): Pt[] {
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / stepMm));
    return Array.from({ length: n }, (_, k) => ({
      x: a.x + ((b.x - a.x) * k) / n,
      y: a.y + ((b.y - a.y) * k) / n,
    }));
  });
}

function traced(id: string, ring: readonly Pt[], holes: readonly Pt[][] = []): Cutout {
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  return {
    id,
    shape: 'path',
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...ys) - Math.min(...ys),
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    path: ring.map(corner),
    ...(holes.length > 0 ? { holes: holes.map((h) => h.map(corner)) } : {}),
  };
}

/** A `long` × `short` box centred on (cx, cy), its long side at `deg`. */
function box(cx: number, cy: number, long: number, short: number, deg: number): Pt[] {
  const a = (deg * Math.PI) / 180;
  const u = { x: Math.cos(a), y: Math.sin(a) };
  const n = { x: -u.y, y: u.x };
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([s, t]) => ({
    x: cx + (s * long * u.x) / 2 + (t * short * n.x) / 2,
    y: cy + (s * long * u.y) / 2 + (t * short * n.y) / 2,
  }));
}

const size = (c: Cutout) => {
  const b = getRotatedBounds(c);
  return { w: b.maxX - b.minX, d: b.maxY - b.minY };
};

const centre = (c: Cutout): Pt => {
  const b = getRotatedBounds(c);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
};

const overlaps = (a: Cutout, b: Cutout): boolean => {
  const p = getRotatedBounds(a);
  const q = getRotatedBounds(b);
  return p.minX < q.maxX && q.minX < p.maxX && p.minY < q.maxY && q.minY < p.maxY;
};

describe('prepareScanCutouts', () => {
  it('stores a tool traced at a slant with its own tight box and no turn', () => {
    const [bar] = prepareScanCutouts([traced('bar', dense(box(80, 80, 100, 10, 35)))]);
    expect(bar.rotation).toBe(0);
    expect(size(bar).w).toBeCloseTo(100, 0);
    expect(size(bar).d).toBeCloseTo(10, 0);
    expect(bar.width).toBeCloseTo(100, 0);
    expect(bar.depth).toBeCloseTo(10, 0);
  });

  it('keeps the tool where it was traced', () => {
    const [bar] = prepareScanCutouts([traced('bar', dense(box(80, 60, 100, 10, 35)))]);
    expect(centre(bar).x).toBeCloseTo(80, 1);
    expect(centre(bar).y).toBeCloseTo(60, 1);
  });

  it('fits a traced edge with a few points, inside the fit tolerance', () => {
    const ring = Array.from({ length: 720 }, (_, k) => {
      const a = (k * Math.PI) / 360;
      return { x: 50 + 20 * Math.cos(a), y: 50 + 20 * Math.sin(a) };
    });
    const [disc] = prepareScanCutouts([traced('disc', ring)]);
    const anchors = disc.path?.length ?? 0;
    expect(anchors).toBeGreaterThan(1);
    expect(anchors).toBeLessThan(24);
    const c = centre(disc);
    for (const p of flattenPath(disc.path ?? [])) {
      expect(Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - 20)).toBeLessThan(EDIT_FIT_MM + 0.05);
    }
  });

  it('turns a shape traced in an island with its host, so it stays in the island', () => {
    const ring = box(100, 100, 120, 40, 30);
    const island = box(100, 100, 60, 20, 30);
    const nut = box(100, 100, 12, 12, 10);
    const [host, inner] = prepareScanCutouts([
      traced('wrench', dense(ring), [dense(island)]),
      traced('nut', dense(nut)),
    ]);
    expect(host.id).toBe('wrench');
    expect(host.rotation).toBe(0);
    expect(size(host).w).toBeCloseTo(120, 0);
    const islandRing = flattenPath(host.holes?.[0] ?? []);
    for (const p of flattenPath(inner.path ?? [])) {
      expect(pointInPolygon(p, islandRing)).toBe(true);
    }
  });

  it('packs the turned tools of a batch so none overlaps another', () => {
    const tools = [0, 1, 2].map((k) => traced(`t${k}`, dense(box(60 + k * 30, 80, 140, 12, 50))));
    expect(tools.some((a, i) => tools.some((b, j) => i < j && overlaps(a, b)))).toBe(true);
    const packed = prepareScanCutouts(tools, { packWidth: 160 });
    for (let i = 0; i < packed.length; i++) {
      for (let j = i + 1; j < packed.length; j++) {
        expect(overlaps(packed[i], packed[j])).toBe(false);
      }
      expect(getRotatedBounds(packed[i]).maxX).toBeLessThanOrEqual(160);
    }
  });

  it('spaces packed tools so the plastic between survives their clearance and entry edge', () => {
    const tools = [0, 1].map((k) => traced(`t${k}`, dense(box(60 + k * 20, 80, 140, 12, 50))));
    const finish = (c: Cutout): Cutout => ({ ...c, clearance: 0.4, chamferWidth: 0.8 });
    const [p, q] = prepareScanCutouts(tools, { packWidth: 160, finish });
    expect(p.clearance).toBe(0.4);
    const a = getRotatedBounds(p);
    const b = getRotatedBounds(q);
    const gap = Math.max(b.minX - a.maxX, a.minX - b.maxX, b.minY - a.maxY, a.minY - b.maxY);
    expect(gap).toBeGreaterThanOrEqual(MIN_MATERIAL_MM + 2 * (0.4 + 0.8) - 1e-6);
  });

  it('moves a host and its nested shape as one block when packing', () => {
    const host = traced('ring', dense(box(50, 50, 80, 40, 0)), [dense(box(50, 50, 40, 20, 0))]);
    const nut = traced('nut', dense(box(50, 50, 10, 10, 0)));
    const other = traced('bar', dense(box(150, 150, 60, 8, 0)));
    const before = { x: centre(nut).x - centre(host).x, y: centre(nut).y - centre(host).y };
    const packed = prepareScanCutouts([host, other, nut], { packWidth: 300 });
    const byId = new Map(packed.map((c) => [c.id, c]));
    const ringAfter = byId.get('ring');
    const nutAfter = byId.get('nut');
    if (!ringAfter || !nutAfter) throw new Error('missing cutout');
    expect(centre(nutAfter).x - centre(ringAfter).x).toBeCloseTo(before.x, 1);
    expect(centre(nutAfter).y - centre(ringAfter).y).toBeCloseTo(before.y, 1);
  });

  it('passes a shape that is not a path through as it is', () => {
    const circle: Cutout = {
      ...traced('c', box(10, 10, 5, 5, 0)),
      shape: 'circle',
      path: undefined,
    };
    expect(prepareScanCutouts([circle])).toEqual([circle]);
  });
});
