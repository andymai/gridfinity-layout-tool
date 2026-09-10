import { describe, it, expect } from 'vitest';
import { safeSectionRect, capSectionRadius } from './generatorConstants';

/**
 * The invariant both helpers exist for: brepjs sketches each corner arc tangent
 * to the side before it, so a radius AT half the shorter side leaves that side
 * zero-length and `drawRoundedRectangle` throws instead of clamping. Measured
 * threshold is exactly 0.5, at every scale.
 */
function expectBuildable(width: number, depth: number, radius: number): void {
  expect(radius).toBeLessThan(Math.min(width, depth) / 2);
}

describe('safeSectionRect', () => {
  it('leaves a full-size section untouched', () => {
    expect(safeSectionRect(42, 42, 4)).toEqual({ width: 42, depth: 42, radius: 4 });
  });

  it('caps the radius against the size that survived its own floor', () => {
    // The #4218 shape: a 1mm-pitch cell at the deepest taper inset drives width
    // and radius to the same 0.1mm floor, which is radius == width.
    const r = safeSectionRect(1 + 0.1 - 2 * 2.95, 1 + 0.1 - 2 * 2.95, 0.4 - 2.95);
    expect(r.width).toBe(0.1);
    expect(r.depth).toBe(0.1);
    expectBuildable(r.width, r.depth, r.radius);
  });

  it('keeps the radius positive so every loft section carries the same curve count', () => {
    for (const size of [0.01, 0.1, 1, 42]) {
      const r = safeSectionRect(size, size, -10);
      expect(r.radius).toBeGreaterThan(0);
      expectBuildable(r.width, r.depth, r.radius);
    }
  });

  it('caps against the shorter side of a non-square section', () => {
    const r = safeSectionRect(40, 0.2, 4);
    expect(r.depth).toBe(0.2);
    expectBuildable(r.width, r.depth, r.radius);
  });

  it('stays buildable across the designer grid-pitch range at every taper inset', () => {
    // Pitches down to DESIGNER_GRID_UNIT_MM_MIN against the socket profile's
    // three insets — the sweep that used to throw from 6.5mm down.
    for (const pitch of [1, 2, 3, 4, 6, 6.5, 7, 12, 42, 200]) {
      for (const inset of [0, 2.15, 2.95]) {
        const cell = pitch - 0.5;
        const r = safeSectionRect(cell - 2 * inset, cell - 2 * inset, 4 - inset);
        expectBuildable(r.width, r.depth, r.radius);
      }
    }
  });
});

describe('capSectionRadius', () => {
  it('leaves a radius that already fits alone', () => {
    expect(capSectionRadius(42, 42, 3.75)).toBe(3.75);
  });

  it('preserves a caller-chosen zero rather than imposing a floor', () => {
    // A wall thicker than BOX_CORNER_RADIUS squares off the cavity corner, and
    // an extruded footprint has no loft partner whose curve count it must match.
    expect(capSectionRadius(10, 10, 0)).toBe(0);
  });

  it('caps a fixed radius against a footprint smaller than twice it', () => {
    // 3 cells at a 2mm pitch: a 5.5mm body against the fixed 3.75mm box radius.
    expectBuildable(5.5, 5.5, capSectionRadius(5.5, 5.5, 3.75));
  });
});
