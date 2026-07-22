import { describe, expect, it } from 'vitest';
import type { DrawerOutline } from '@/core/types';
import { isRectilinearOutline, padRectilinearOutline } from './padOutline';
import { polylineSignedArea } from './drawerOutlineGeometry';

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

describe('isRectilinearOutline', () => {
  it('accepts axis-aligned loops', () => {
    expect(isRectilinearOutline(rect(100, 80))).toBe(true);
    expect(isRectilinearOutline(lShape)).toBe(true);
  });

  it('rejects arcs and diagonals', () => {
    expect(
      isRectilinearOutline({
        vertices: [
          { x: 0, y: 0, bulge: 0.4 },
          { x: 100, y: 0 },
          { x: 100, y: 80 },
          { x: 0, y: 80 },
        ],
      })
    ).toBe(false);
    expect(
      isRectilinearOutline({
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 20 },
          { x: 100, y: 80 },
          { x: 0, y: 80 },
        ],
      })
    ).toBe(false);
  });
});

describe('padRectilinearOutline', () => {
  it('returns the same reference at zero padding', () => {
    expect(padRectilinearOutline(lShape, { left: 0, right: 0, front: 0, back: 0 })).toBe(lShape);
  });

  it('grows a rectangle to the padded extent, grid offset by left/front', () => {
    const padded = padRectilinearOutline(rect(420, 336), { left: 1, right: 2, front: 3, back: 4 });
    expect(padded?.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 423, y: 0 },
      { x: 423, y: 343 },
      { x: 0, y: 343 },
    ]);
  });

  it('offsets every edge of a concave shape, including notch walls', () => {
    const padded = padRectilinearOutline(lShape, { left: 1, right: 2, front: 3, back: 4 });
    expect(padded?.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 423, y: 0 },
      { x: 423, y: 175 },
      { x: 171, y: 175 },
      { x: 171, y: 343 },
      { x: 0, y: 343 },
    ]);
  });

  it('spans exactly totalW x totalD', () => {
    const padded = padRectilinearOutline(lShape, { left: 5, right: 5, front: 5, back: 5 });
    const xs = padded?.vertices.map((v) => v.x) ?? [];
    const ys = padded?.vertices.map((v) => v.y) ?? [];
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(420 + 10);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(336 + 10);
  });

  it('keeps the loop CCW and simple under symmetric padding', () => {
    const padded = padRectilinearOutline(lShape, { left: 3, right: 3, front: 3, back: 3 });
    expect(padded).not.toBeNull();
    expect(polylineSignedArea(padded!.vertices)).toBeGreaterThan(0);
  });

  it('drops authoring metadata (geometry changed)', () => {
    const shaped: DrawerOutline = { ...rect(100, 80), authoring: { kind: 'cells' } };
    const padded = padRectilinearOutline(shaped, { left: 2, right: 2, front: 2, back: 2 });
    expect(padded?.authoring).toBeUndefined();
  });

  it('returns null for non-rectilinear outlines', () => {
    const arced: DrawerOutline = {
      vertices: [
        { x: 0, y: 0, bulge: 0.4 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
        { x: 0, y: 80 },
      ],
    };
    expect(padRectilinearOutline(arced, { left: 2, right: 2, front: 2, back: 2 })).toBeNull();
  });

  it('returns null when padding collapses a slot', () => {
    // U-shape with a top-center slot of width 100 (x in [100,200]). Its two
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
    expect(padRectilinearOutline(uShape, { left: 60, right: 60, front: 0, back: 0 })).toBeNull();
    // A gentle padding that stays within the slot still composes.
    expect(
      padRectilinearOutline(uShape, { left: 10, right: 10, front: 5, back: 5 })
    ).not.toBeNull();
  });

  it('rejects negative padding', () => {
    expect(
      padRectilinearOutline(rect(100, 80), { left: -1, right: 0, front: 0, back: 0 })
    ).toBeNull();
  });
});
