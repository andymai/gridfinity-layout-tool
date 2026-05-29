import { describe, it, expect } from 'vitest';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import { computeSegmentSpan, overlayLineGeom } from './dividerOverlayGeom';

const vSpan = {
  axis: 'vertical' as const,
  axisCoord: 1,
  spanStart: 0,
  spanEnd: 1,
  parallelDim: 1,
  perpDim: 2,
};

describe('overlayLineGeom', () => {
  it('places a straight vertical divider at the column boundary midpoint', () => {
    const g = overlayLineGeom(vSpan, 0, 0, 80, 40);
    expect(g.x1).toBe(50);
    expect(g.x2).toBe(50);
    expect(g.cx).toBe(50);
    expect(g.cy).toBe(50);
  });

  it('splays the endpoints by the perpendicular offset fraction', () => {
    // ±8mm of an 80mm interior = ±10% of the overlay width.
    const g = overlayLineGeom(vSpan, 8, -8, 80, 40);
    expect(g.x1).toBeCloseTo(60, 5); // bottom (offsetStart)
    expect(g.x2).toBeCloseTo(40, 5); // top (offsetEnd)
    expect(g.cx).toBeCloseTo(50, 5);
  });

  it('projects a horizontal divider offset along the depth axis', () => {
    const hSpan = {
      axis: 'horizontal' as const,
      axisCoord: 1,
      spanStart: 0,
      spanEnd: 2,
      parallelDim: 2,
      perpDim: 2,
    };
    // +Y offset moves the wall visually up (smaller top-down y).
    const g = overlayLineGeom(hSpan, 4, 4, 80, 40);
    expect(g.y1).toBeCloseTo(50 - 10, 5);
    expect(g.y2).toBeCloseTo(50 - 10, 5);
  });
});

describe('computeSegmentSpan', () => {
  const grid = (cols: number, rows: number): CompartmentConfig => ({
    cols,
    rows,
    thickness: 1.2,
    cells: Array.from({ length: cols * rows }, (_, i) => i),
  });

  it('finds the shared run for adjacent compartments', () => {
    const span = computeSegmentSpan(grid(2, 1), {
      compartmentA: 0,
      compartmentB: 1,
      axis: 'vertical',
      offsetStart: 0,
      offsetEnd: 0,
    });
    expect(span).toMatchObject({ axis: 'vertical', axisCoord: 1, spanStart: 0, spanEnd: 1 });
  });

  it('returns null for non-adjacent (diagonal) compartments', () => {
    const span = computeSegmentSpan(grid(2, 2), {
      compartmentA: 0,
      compartmentB: 3,
      axis: 'vertical',
      offsetStart: 0,
      offsetEnd: 0,
    });
    expect(span).toBeNull();
  });
});
