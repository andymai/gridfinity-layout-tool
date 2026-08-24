import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { buildCutoutGhostPositions } from './ghostCutoutGeometry';

const cutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'rectangle',
  x: 10,
  y: 10,
  width: 20,
  depth: 10,
  cutDepth: 8,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

interface Pt {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const points = (positions: number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    out.push({ x: positions[i], y: positions[i + 1], z: positions[i + 2] });
  }
  return out;
};

const SURFACE = 40;

describe('buildCutoutGhostPositions', () => {
  it('outlines a sharp rectangle at the surface and at its cut depth', () => {
    const pts = points(buildCutoutGhostPositions([cutout()], 0, 0, SURFACE));
    expect(pts.length).toBeGreaterThan(0);
    const zs = new Set(pts.map((p) => p.z));
    expect(zs).toEqual(new Set([SURFACE, SURFACE - 8]));
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(10);
    expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(30);
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(10);
    expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(20);
  });

  it('rounds the outline for a corner radius instead of drawing the sharp box', () => {
    const pts = points(buildCutoutGhostPositions([cutout({ cornerRadius: 4 })], 0, 0, SURFACE));
    // The sharp corner (10,10) is replaced by an arc that stays r*(1-cos45)
    // inside it; no sampled point may sit on the box corner itself.
    const atCorner = pts.some((p) => Math.abs(p.x - 10) < 1e-6 && Math.abs(p.y - 10) < 1e-6);
    expect(atCorner).toBe(false);
    // Arc midpoints still reach the straight edges' tangent lines.
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(10);
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(10);
  });

  it('draws a slot with fully rounded ends', () => {
    const pts = points(buildCutoutGhostPositions([cutout({ shape: 'slot' })], 0, 0, SURFACE));
    const atCorner = pts.some((p) => Math.abs(p.x - 10) < 1e-6 && Math.abs(p.y - 10) < 1e-6);
    expect(atCorner).toBe(false);
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(10);
    expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(30);
  });

  it('stretches the opening and shifts the floor along the lean', () => {
    const lean = 45;
    const pts = points(
      buildCutoutGhostPositions(
        [cutout({ width: 10, depth: 10, cutDepth: 20, leanDeg: lean })],
        0,
        0,
        SURFACE
      )
    );
    const top = pts.filter((p) => p.z === SURFACE);
    const bottom = pts.filter((p) => p.z !== SURFACE);
    const cy = 15;
    const sin45 = Math.SQRT1_2;

    // Opening: footprint stretched by 1/cos(45°) about the center line.
    expect(Math.max(...top.map((p) => p.y))).toBeCloseTo(cy + 5 * Math.SQRT2);
    expect(Math.min(...top.map((p) => p.y))).toBeCloseTo(cy - 5 * Math.SQRT2);

    // Floor: centered 20·sin(45°) further along +Y, foreshortened to 10·cos(45°).
    const bys = bottom.map((p) => p.y);
    const floorCenter = (Math.min(...bys) + Math.max(...bys)) / 2;
    expect(floorCenter).toBeCloseTo(cy + 20 * sin45);
    expect(Math.max(...bys) - Math.min(...bys)).toBeCloseTo(10 * sin45);

    // Floor plane is tilted: deepest at the near edge, shallowest at the far.
    const bzs = bottom.map((p) => p.z);
    expect(Math.min(...bzs)).toBeCloseTo(SURFACE - 20 * sin45 - 5 * sin45);
    expect(Math.max(...bzs)).toBeCloseTo(SURFACE - 20 * sin45 + 5 * sin45);
  });

  it('carries the lean direction with the plan rotation', () => {
    const pts = points(
      buildCutoutGhostPositions(
        [cutout({ width: 10, depth: 10, cutDepth: 20, leanDeg: 45, rotation: 90 })],
        0,
        0,
        SURFACE
      )
    );
    const top = pts.filter((p) => p.z === SURFACE);
    const bottom = pts.filter((p) => p.z !== SURFACE);
    const centroid = (list: Pt[], axis: 'x' | 'y'): number =>
      list.reduce((sum, p) => sum + p[axis], 0) / list.length;
    // A clockwise 90° turn points the local +Y tilt along world +X.
    expect(centroid(bottom, 'x')).toBeGreaterThan(centroid(top, 'x') + 10);
    expect(centroid(bottom, 'y')).toBeCloseTo(centroid(top, 'y'));
  });

  it('ignores lean on shapes that cannot tilt', () => {
    const pts = points(
      buildCutoutGhostPositions([cutout({ shape: 'mesh', leanDeg: 45 })], 0, 0, SURFACE)
    );
    const zs = new Set(pts.map((p) => p.z));
    expect(zs).toEqual(new Set([SURFACE, SURFACE - 8]));
  });

  it('expands a repeat master into every instance', () => {
    const pts = points(
      buildCutoutGhostPositions(
        [
          cutout({
            width: 10,
            depth: 10,
            array: {
              mode: 'grid',
              cols: 2,
              rows: 1,
              pitchX: 25,
              pitchY: 25,
              count: 2,
              radius: 20,
              startAngle: 0,
              rotateToCenter: false,
            },
          }),
        ],
        0,
        0,
        SURFACE
      )
    );
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(10);
    expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(45);
  });

  it('skips degenerate cutouts the worker would not cut', () => {
    expect(buildCutoutGhostPositions([cutout({ cutDepth: 0 })], 0, 0, SURFACE)).toEqual([]);
    expect(buildCutoutGhostPositions([cutout({ width: 0 })], 0, 0, SURFACE)).toEqual([]);
  });
});
