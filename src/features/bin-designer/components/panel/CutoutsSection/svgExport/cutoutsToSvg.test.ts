import { describe, expect, it } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { isOk } from '@/core/result';
import { parseSvgString } from '../svgImport/svgParser';
import { flattenPath } from '../pathGeometryBezier';
import { cutoutsToSvg } from './cutoutsToSvg';

const baseCutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: overrides.id ?? 'c1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

const corner = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

/** An L: asymmetric under both flips and rotation, so a mirrored export shows up. */
const L_POINTS: PathPoint[] = [
  corner(0, 0),
  corner(30, 0),
  corner(30, 10),
  corner(10, 10),
  corner(10, 25),
  corner(0, 25),
];

const pathCutout = (points: PathPoint[], overrides: Partial<Cutout> = {}): Cutout =>
  baseCutout({ shape: 'path', path: points, width: 30, depth: 25, ...overrides });

/** Re-import an exported document and return the first spec's flattened outline. */
function roundTrip(svg: string): { x: number; y: number }[] {
  const parsed = parseSvgString(svg);
  expect(isOk(parsed)).toBe(true);
  if (!isOk(parsed)) throw new Error('unreachable');
  const spec = parsed.value[0];
  expect(spec.path).toBeDefined();
  return flattenPath(spec.path ?? []);
}

/** Shoelace area of a closed polyline. */
function area(points: readonly { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function extent(points: readonly { x: number; y: number }[]): { w: number; h: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

describe('cutoutsToSvg', () => {
  it('declares physical millimetres over a matching viewBox', () => {
    const svg = cutoutsToSvg([pathCutout(L_POINTS)]);
    expect(svg).toContain('width="30mm"');
    expect(svg).toContain('height="25mm"');
    expect(svg).toContain('viewBox="0 0 30 25"');
  });

  it('returns null when nothing in the selection can be outlined', () => {
    expect(cutoutsToSvg([])).toBeNull();
    expect(cutoutsToSvg([baseCutout({ shape: 'text' })])).toBeNull();
    expect(cutoutsToSvg([baseCutout({ width: 0, depth: 0 })])).toBeNull();
    expect(cutoutsToSvg([pathCutout([corner(0, 0), corner(1, 1)])])).toBeNull();
  });

  it('writes one element per cutout', () => {
    const svg = cutoutsToSvg([
      baseCutout({ id: 'a' }),
      baseCutout({ id: 'b', shape: 'circle', x: 20 }),
      pathCutout(L_POINTS, { id: 'c', x: 40 }),
    ]);
    expect(svg?.match(/<(rect|ellipse|path) /g)).toHaveLength(3);
  });

  it('writes unrotated primitives as shapes, not sampled polygons', () => {
    const svg = cutoutsToSvg([
      baseCutout({ id: 'a', shape: 'circle' }),
      baseCutout({ id: 'b', x: 20, cornerRadius: 2 }),
    ]);
    expect(svg).toContain('<ellipse ');
    expect(svg).toContain('<rect ');
    expect(svg).toContain('rx="2"');
    expect(svg).not.toContain('<path ');
  });

  it('samples a rotated primitive, which the importer could not read back as one', () => {
    const svg = cutoutsToSvg([baseCutout({ shape: 'circle', rotation: 30 })]);
    expect(svg).toContain('<path ');
    expect(svg).not.toContain('<ellipse ');
  });
});

describe('cutoutsToSvg — round trip through the importer', () => {
  it('returns a path cutout at its original size and orientation', () => {
    const svg = cutoutsToSvg([pathCutout(L_POINTS)]);
    expect(svg).not.toBeNull();
    const flat = roundTrip(svg ?? '');

    expect(extent(flat).w).toBeCloseTo(30, 3);
    expect(extent(flat).h).toBeCloseTo(25, 3);
    expect(area(flat)).toBeCloseTo(area(L_POINTS), 3);

    // Y-up is preserved, not mirrored: the L's long edge is at the bottom, so
    // the widest span sits at min-Y. A flipped export would put it at max-Y.
    const minY = Math.min(...flat.map((p) => p.y));
    const bottomSpan = flat.filter((p) => Math.abs(p.y - minY) < 1e-6);
    expect(extent(bottomSpan).w).toBeCloseTo(30, 3);
  });

  it('keeps bezier handles rather than flattening them to anchors', () => {
    // A quarter-circle bulge: the curve bows well outside the anchor chord.
    const k = 0.5523;
    const curved: PathPoint[] = [
      { x: 0, y: 0, handleIn: null, handleOut: null, symmetric: false },
      { x: 20, y: 0, handleIn: null, handleOut: { dx: 0, dy: 20 * k }, symmetric: false },
      { x: 0, y: 20, handleIn: { dx: 20 * k, dy: 0 }, handleOut: null, symmetric: false },
    ];
    const svg = cutoutsToSvg([pathCutout(curved, { width: 20, depth: 20 })]);
    expect(svg).toContain('C');

    const flat = roundTrip(svg ?? '');
    // A quarter disc is π/4 of its bounding square; the chord would give half.
    expect(area(flat)).toBeCloseTo((Math.PI / 4) * 400, 0);
  });

  it('keeps the closing curve of a fully curved path', () => {
    // Four cubic segments approximating a circle — the last one closes the loop.
    const k = 0.5523;
    const r = 10;
    // Handles are tangential: at (r,0) the circle runs vertically.
    const circle: PathPoint[] = [
      {
        x: r,
        y: 0,
        handleIn: { dx: 0, dy: -r * k },
        handleOut: { dx: 0, dy: r * k },
        symmetric: true,
      },
      {
        x: 0,
        y: r,
        handleIn: { dx: r * k, dy: 0 },
        handleOut: { dx: -r * k, dy: 0 },
        symmetric: true,
      },
      {
        x: -r,
        y: 0,
        handleIn: { dx: 0, dy: r * k },
        handleOut: { dx: 0, dy: -r * k },
        symmetric: true,
      },
      {
        x: 0,
        y: -r,
        handleIn: { dx: -r * k, dy: 0 },
        handleOut: { dx: r * k, dy: 0 },
        symmetric: true,
      },
    ];
    const svg = cutoutsToSvg([pathCutout(circle, { width: 2 * r, depth: 2 * r })]);

    const parsed = parseSvgString(svg ?? '');
    expect(isOk(parsed)).toBe(true);
    if (!isOk(parsed)) return;
    const returned = parsed.value[0].path ?? [];

    // SVG restates the start anchor to close a curve, so its incoming handle
    // arrives on a duplicate the importer drops. Losing it here straightens the
    // final quadrant into a chord.
    expect(returned[0].handleIn).not.toBeNull();

    // Compared against the same flattening, not the ideal circle: at the 0.1mm
    // tolerance an inscribed 12-gon is already 4% under πr².
    expect(area(flattenPath(returned))).toBeCloseTo(area(flattenPath(circle)), 3);
  });

  it('bakes rotation into the exported outline', () => {
    const svg = cutoutsToSvg([pathCutout(L_POINTS, { rotation: 90 })]);
    const flat = roundTrip(svg ?? '');

    // The L turns a quarter-turn, so the footprint swaps axes but keeps its area.
    expect(extent(flat).w).toBeCloseTo(25, 3);
    expect(extent(flat).h).toBeCloseTo(30, 3);
    expect(area(flat)).toBeCloseTo(area(L_POINTS), 3);
  });

  it('returns a circle as a circle, at the same size and place', () => {
    const svg = cutoutsToSvg([
      baseCutout({ id: 'a', shape: 'circle', x: 0, y: 0, width: 20, depth: 12 }),
      // A second shape so the circle is not the whole viewBox — its offset has
      // to survive the flip too, not just its size.
      baseCutout({ id: 'b', x: 30, y: 8, width: 10, depth: 10 }),
    ]);
    const parsed = parseSvgString(svg ?? '');
    expect(isOk(parsed)).toBe(true);
    if (!isOk(parsed)) return;

    const circle = parsed.value.find((s) => s.shape === 'circle');
    expect(circle).toBeDefined();
    expect(circle?.width).toBeCloseTo(20, 3);
    expect(circle?.depth).toBeCloseTo(12, 3);
    expect(circle?.x).toBeCloseTo(0, 3);
    expect(circle?.y).toBeCloseTo(0, 3);
  });

  it('returns a rounded rectangle as a rectangle, keeping its corner radius', () => {
    const svg = cutoutsToSvg([baseCutout({ width: 30, depth: 20, cornerRadius: 3 })]);
    const parsed = parseSvgString(svg ?? '');
    expect(isOk(parsed)).toBe(true);
    if (!isOk(parsed)) return;

    const spec = parsed.value[0];
    expect(spec.shape).toBe('rectangle');
    expect(spec.width).toBeCloseTo(30, 3);
    expect(spec.depth).toBeCloseTo(20, 3);
    expect(spec.cornerRadius).toBeCloseTo(3, 3);
  });

  it('preserves the relative placement of several cutouts', () => {
    const svg = cutoutsToSvg([
      baseCutout({ id: 'a', x: 0, y: 0, width: 10, depth: 10 }),
      baseCutout({ id: 'b', x: 40, y: 30, width: 10, depth: 10 }),
    ]);
    expect(svg).toContain('viewBox="0 0 50 40"');

    const parsed = parseSvgString(svg ?? '');
    expect(isOk(parsed)).toBe(true);
    if (!isOk(parsed)) return;

    const [first, second] = [...parsed.value].sort((p, q) => p.x - q.x);
    expect(second.x - first.x).toBeCloseTo(40, 3);
    expect(second.y - first.y).toBeCloseTo(30, 3);
  });
});
