import { describe, it, expect } from 'vitest';
import { polygonOutlinePoints } from './cutoutOutline';
import type { Cutout } from '@/features/bin-designer/types';

function hexCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'polygon',
    x: 10,
    y: 20,
    width: 18,
    depth: 16,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    sides: 6,
    ...overrides,
  };
}

describe('polygonOutlinePoints', () => {
  it('returns one absolute point per side, centered on the cutout box', () => {
    const pts = polygonOutlinePoints(hexCutout());
    expect(pts).toHaveLength(6);
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    // Regular polygon centroid sits at the box center (x+w/2, y+d/2).
    expect(cx).toBeCloseTo(10 + 18 / 2, 4);
    expect(cy).toBeCloseTo(20 + 16 / 2, 4);
  });

  it('spans exactly the cutout bounding box', () => {
    const pts = polygonOutlinePoints(hexCutout());
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(18, 4);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(16, 4);
  });

  it('respects the side count', () => {
    expect(polygonOutlinePoints(hexCutout({ sides: 8 }))).toHaveLength(8);
    expect(polygonOutlinePoints(hexCutout({ sides: 3 }))).toHaveLength(3);
  });

  it('defaults to a hexagon when sides is missing', () => {
    expect(polygonOutlinePoints(hexCutout({ sides: undefined }))).toHaveLength(6);
  });
});
