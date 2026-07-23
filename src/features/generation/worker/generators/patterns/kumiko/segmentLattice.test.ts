import { describe, it, expect } from 'vitest';
import {
  quantizeColumns,
  clipSegmentToBand,
  generateKumikoLattice,
  KUMIKO_STRUT_WIDTH,
} from './segmentLattice';
import { MITSUKUDE_DEF } from './mitsukude';
import type { KumikoSegment } from './types';

// 1x1 bin-ish band: perimeter ≈ 160mm, band height 20mm.
const BAND = { perimeter: 160, bandHeight: 20 };

const EPS = 1e-6;

describe('quantizeColumns', () => {
  it('returns an even column count whose pitch closes the perimeter exactly', () => {
    for (const target of [6, 8, 9, 11, 14]) {
      const { columns, columnPitch, cellSize } = quantizeColumns(BAND.perimeter, target);
      expect(columns % 2).toBe(0);
      expect(columns * columnPitch).toBeCloseTo(BAND.perimeter, 9);
      expect(cellSize).toBeCloseTo((2 * columnPitch) / Math.sqrt(3), 9);
    }
  });

  it('clamps to a minimum of 4 columns on tiny perimeters', () => {
    expect(quantizeColumns(10, 20).columns).toBe(4);
  });

  it('caps the column count on huge perimeters', () => {
    expect(quantizeColumns(10_000, 1).columns).toBeLessThanOrEqual(120);
  });
});

describe('clipSegmentToBand', () => {
  it('keeps a fully inside segment unchanged', () => {
    const seg: KumikoSegment = { a: [1, 1], b: [5, 5] };
    expect(clipSegmentToBand(seg, 10, 10)).toEqual(seg);
  });

  it('clips a crossing segment at the boundary', () => {
    const clipped = clipSegmentToBand({ a: [-5, 5], b: [5, 5] }, 10, 10);
    expect(clipped).not.toBeNull();
    expect(clipped?.a[0]).toBeCloseTo(0, 9);
    expect(clipped?.b[0]).toBeCloseTo(5, 9);
  });

  it('drops segments entirely outside the band', () => {
    expect(clipSegmentToBand({ a: [-5, -5], b: [-1, -1] }, 10, 10)).toBeNull();
  });

  it('drops degenerate slivers shorter than the epsilon', () => {
    expect(clipSegmentToBand({ a: [-1, 5], b: [0.01, 5] }, 10, 10)).toBeNull();
  });

  it('preserves per-segment width overrides through clipping', () => {
    const clipped = clipSegmentToBand({ a: [-5, 5], b: [5, 5], width: 2.5 }, 10, 10);
    expect(clipped?.width).toBe(2.5);
  });
});

describe('generateKumikoLattice (mitsukude)', () => {
  const lattice = generateKumikoLattice(MITSUKUDE_DEF, BAND, 9);

  it('keeps every segment within the band', () => {
    for (const { a, b } of lattice.segments) {
      for (const [u, z] of [a, b]) {
        expect(u).toBeGreaterThanOrEqual(-EPS);
        expect(u).toBeLessThanOrEqual(BAND.perimeter + EPS);
        expect(z).toBeGreaterThanOrEqual(-EPS);
        expect(z).toBeLessThanOrEqual(BAND.bandHeight + EPS);
      }
    }
  });

  it('emits no degenerate segments', () => {
    for (const { a, b } of lattice.segments) {
      expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeGreaterThan(0.04);
    }
  });

  it('emits one vertical strut per quantized column', () => {
    const verticals = lattice.segments.filter(({ a, b }) => Math.abs(a[0] - b[0]) < EPS);
    expect(verticals.length).toBe(Math.round(BAND.perimeter / lattice.columnPitch));
    for (const v of verticals) {
      expect(v.a[1]).toBeCloseTo(0, 9);
      expect(v.b[1]).toBeCloseTo(BAND.bandHeight, 9);
    }
  });

  it('closes the wrap: diagonal crossings at u=0 and u=P coincide', () => {
    const seamCrossings = (atU: number): number[] =>
      lattice.segments
        .filter(({ a, b }) => Math.abs(a[0] - b[0]) > EPS)
        .flatMap(({ a, b }) => {
          const hits: number[] = [];
          if (Math.abs(a[0] - atU) < EPS) hits.push(a[1]);
          if (Math.abs(b[0] - atU) < EPS) hits.push(b[1]);
          return hits;
        })
        .sort((x, y) => x - y);

    const atZero = seamCrossings(0);
    const atP = seamCrossings(BAND.perimeter);
    // Interior crossings (not clipped at the band top/bottom) must pair up
    // exactly so every diagonal continues seamlessly across the seam.
    const interior = (zs: number[]): number[] =>
      zs.filter((z) => z > EPS && z < BAND.bandHeight - EPS);
    expect(interior(atZero).length).toBeGreaterThan(0);
    expect(interior(atZero).length).toBe(interior(atP).length);
    interior(atZero).forEach((z, i) => {
      expect(z).toBeCloseTo(interior(atP)[i], 6);
    });
  });

  it('places diagonals through the vertex grid (triple points on columns)', () => {
    // Rising and falling diagonals must intersect vertical struts at the same
    // z values — sample the column at u = 2·pitch.
    const u = 2 * lattice.columnPitch;
    const diagonalZsAt = (rising: boolean): number[] =>
      lattice.segments
        .filter(({ a, b }) => {
          const slope = (b[1] - a[1]) / (b[0] - a[0] || Infinity);
          return rising ? slope > EPS : slope < -EPS;
        })
        .filter(({ a, b }) => a[0] <= u + EPS && b[0] >= u - EPS)
        .map(({ a, b }) => a[1] + ((u - a[0]) * (b[1] - a[1])) / (b[0] - a[0]))
        .filter((z) => z > EPS && z < BAND.bandHeight - EPS)
        .sort((x, y) => x - y);

    const rising = diagonalZsAt(true);
    const falling = diagonalZsAt(false);
    expect(rising.length).toBeGreaterThan(0);
    // Every interior rising crossing on a column coincides with a falling one.
    for (const z of rising) {
      expect(falling.some((fz) => Math.abs(fz - z) < 1e-6)).toBe(true);
    }
  });

  it('reports the fixed printable strut width', () => {
    expect(lattice.strutWidth).toBe(KUMIKO_STRUT_WIDTH);
  });
});
