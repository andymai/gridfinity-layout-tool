import { describe, expect, it } from 'vitest';
import type { DrawerOutline } from '@/core/types';
import { padOutline } from './padOutline';
import { flattenOutline, outlineSignedArea, polylineSignedArea } from './drawerOutlineGeometry';
import { isSelfIntersecting } from './drawerOutline';

const rect = (w: number, d: number): DrawerOutline => ({
  vertices: [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ],
});

// Concave L: a notch removed from the top-right quadrant.
const lShape: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 420, y: 0 },
    { x: 420, y: 168 },
    { x: 168, y: 168 },
    { x: 168, y: 336 },
    { x: 0, y: 336 },
  ],
};

function bbox(outline: DrawerOutline): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = outline.vertices.map((v) => v.x);
  const ys = outline.vertices.map((v) => v.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

describe('padOutline', () => {
  it('returns the same reference at zero padding', () => {
    expect(padOutline(lShape, { left: 0, right: 0, front: 0, back: 0 })).toBe(lShape);
  });

  it('rejects negative padding', () => {
    expect(padOutline(rect(100, 80), { left: -1, right: 0, front: 0, back: 0 })).toBeNull();
  });

  it('grows a rectangle to the padded extent, grid offset by left/front', () => {
    const padded = padOutline(rect(420, 336), { left: 1, right: 2, front: 3, back: 4 });
    expect(padded?.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 423, y: 0 },
      { x: 423, y: 343 },
      { x: 0, y: 343 },
    ]);
  });

  it('offsets every edge of a concave shape, including notch walls', () => {
    const padded = padOutline(lShape, { left: 1, right: 2, front: 3, back: 4 });
    expect(padded?.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 423, y: 0 },
      { x: 423, y: 175 },
      { x: 171, y: 175 },
      { x: 171, y: 343 },
      { x: 0, y: 343 },
    ]);
  });

  it('spans exactly totalW x totalD for an axis-aligned shape', () => {
    const padded = padOutline(lShape, { left: 5, right: 5, front: 5, back: 5 });
    const b = bbox(padded!);
    expect(b.minX).toBeCloseTo(0, 6);
    expect(b.maxX).toBeCloseTo(420 + 10, 6);
    expect(b.minY).toBeCloseTo(0, 6);
    expect(b.maxY).toBeCloseTo(336 + 10, 6);
  });

  it('keeps the loop CCW and simple under symmetric padding', () => {
    const padded = padOutline(lShape, { left: 3, right: 3, front: 3, back: 3 });
    expect(padded).not.toBeNull();
    expect(polylineSignedArea(padded!.vertices)).toBeGreaterThan(0);
    expect(isSelfIntersecting(padded!.vertices)).toBe(false);
  });

  it('composes padding into an outline with an arc (rounded bottom edge)', () => {
    const arced: DrawerOutline = {
      vertices: [
        { x: 0, y: 0, bulge: 0.5 },
        { x: 200, y: 0 },
        { x: 200, y: 160 },
        { x: 0, y: 160 },
      ],
    };
    const padded = padOutline(arced, { left: 6, right: 6, front: 6, back: 6 });
    expect(padded).not.toBeNull();
    // Padding grows the plate outward, so the padded area exceeds the original.
    expect(outlineSignedArea(padded!)).toBeGreaterThan(outlineSignedArea(arced));
    // The straight top/side edges gain exactly the per-side padding.
    const b = bbox(padded!);
    expect(b.maxX).toBeCloseTo(200 + 12, 3);
    expect(isSelfIntersecting(flattenOutline(padded!))).toBe(false);
  });

  it('composes padding into a shape with a diagonal edge', () => {
    // A pentagon: rectangle with a chamfered top-right corner (one diagonal).
    const pentagon: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 120 },
        { x: 140, y: 160 },
        { x: 0, y: 160 },
      ],
    };
    const padded = padOutline(pentagon, { left: 5, right: 5, front: 5, back: 5 });
    expect(padded).not.toBeNull();
    expect(padded!.vertices).toHaveLength(5);
    expect(outlineSignedArea(padded!)).toBeGreaterThan(outlineSignedArea(pentagon));
    expect(isSelfIntersecting(padded!.vertices)).toBe(false);
    const b = bbox(padded!);
    expect(b.minX).toBeCloseTo(0, 3);
    expect(b.maxX).toBeCloseTo(210, 3);
  });

  it('returns null when padding collapses a slot', () => {
    // U-shape with a top-center slot of width 100 (x in [100,200]); its two
    // walls face each other, so left+right padding > 100 makes them cross.
    const uShape: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 300 },
        { x: 200, y: 300 },
        { x: 200, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 300 },
        { x: 0, y: 300 },
      ],
    };
    expect(padOutline(uShape, { left: 60, right: 60, front: 0, back: 0 })).toBeNull();
    expect(padOutline(uShape, { left: 10, right: 10, front: 5, back: 5 })).not.toBeNull();
  });
});
