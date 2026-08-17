import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import type { LidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
import { cutoutFitsInLidWindow, lidWindowOffset } from './lidWindowFit';

function cutout(over: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c',
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
    ...over,
  };
}

const corner = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: true,
});

function window(over: Partial<LidCutoutWindow> = {}): LidCutoutWindow {
  return {
    spanW: 100,
    spanD: 100,
    offsetX: 0,
    offsetY: 0,
    cornerRadius: 0,
    keepouts: [],
    ...over,
  };
}

describe('cutoutFitsInLidWindow', () => {
  it('accepts a shape inside a plain window and rejects one past its edge', () => {
    const w = window();
    expect(cutoutFitsInLidWindow(cutout({ x: 40, y: 40 }), w)).toBe(true);
    expect(cutoutFitsInLidWindow(cutout({ x: 95, y: 40 }), w)).toBe(false);
  });

  it('rejects a shape lying over a magnet boss', () => {
    // The worker subtracts the boss from every hole it cuts, so a slot drawn
    // across one comes out of the printer with a disc-shaped island in it.
    const w = window({ keepouts: [{ x: 50, y: 50, r: 6 }] });
    expect(cutoutFitsInLidWindow(cutout({ x: 45, y: 45 }), w)).toBe(false);
    expect(cutoutFitsInLidWindow(cutout({ x: 5, y: 5 }), w)).toBe(true);
  });

  it('rejects a shape that merely clips the edge of a boss', () => {
    // Overlap of ~1mm. A box-vs-box test would catch this one too; the point is
    // that a partial bite is still an island in the printed slot.
    const w = window({ keepouts: [{ x: 50, y: 50, r: 6 }] });
    expect(cutoutFitsInLidWindow(cutout({ x: 35, y: 45, width: 10, depth: 10 }), w)).toBe(false);
  });

  it('rejects a shape poking out of a rounded corner', () => {
    // Sits inside the plain 100x100 extent, so only the rounded outline can
    // reject it: the corner arc has retreated 20mm here.
    const w = window({ cornerRadius: 20 });
    expect(cutoutFitsInLidWindow(cutout({ x: 0, y: 0, width: 6, depth: 6 }), w)).toBe(false);
  });

  it('accepts a shape that genuinely fits inside a rounded corner', () => {
    // The over-flag this test exists to prevent: a bounding-box test against the
    // rounded window rejects anything in the corner band, and an over-flag with
    // a one-click clamp attached moves a shape the user placed deliberately.
    const w = window({ cornerRadius: 20 });
    // Corner arc centre is (20,20) r=20, so a 4mm box at (14,14) is well inside.
    expect(cutoutFitsInLidWindow(cutout({ x: 14, y: 14, width: 4, depth: 4 }), w)).toBe(true);
  });

  it('tests a circle by its silhouette, not its box', () => {
    const w = window({ cornerRadius: 20 });
    // A circle whose BOX pokes past the corner arc but whose disc does not.
    expect(
      cutoutFitsInLidWindow(cutout({ shape: 'circle', x: 5, y: 5, width: 14, depth: 14 }), w)
    ).toBe(true);
  });
});

describe('lidWindowOffset', () => {
  it('brings a shape past the edge back inside', () => {
    const w = window();
    const stray = cutout({ x: 96, y: 40 });

    const offset = lidWindowOffset([stray], w);

    expect(offset).not.toBeNull();
    expect(cutoutFitsInLidWindow({ ...stray, x: stray.x + (offset?.dx ?? 0) }, w)).toBe(true);
  });

  it('moves a shape off a boss by the shortest axis that clears it', () => {
    const w = window({ keepouts: [{ x: 50, y: 50, r: 6 }] });
    // Overlaps the boss on its left side, so the shortest clear is a nudge left.
    const over = cutout({ x: 42, y: 45, width: 10, depth: 10 });

    const offset = lidWindowOffset([over], w);

    expect(offset).not.toBeNull();
    const moved = { ...over, x: over.x + (offset?.dx ?? 0), y: over.y + (offset?.dy ?? 0) };
    expect(cutoutFitsInLidWindow(moved, w)).toBe(true);
    expect(offset?.dx).toBeLessThan(0);
  });

  it('returns null when nothing can be moved anywhere valid', () => {
    // A shape as wide as the window with a boss dead centre: no translation
    // clears it, so it stays flagged for the user rather than being false-fixed.
    const w = window({ spanW: 30, spanD: 30, keepouts: [{ x: 15, y: 15, r: 10 }] });
    const wide = cutout({ x: 0, y: 0, width: 30, depth: 30 });

    expect(lidWindowOffset([wide], w)).toBeNull();
  });

  it('moves a path cutout by translating its vertices, not just its origin', () => {
    // A path's silhouette is absolute points, so an offset that only bumped
    // `x`/`y` would report a fit while leaving the outline where it was.
    const w = window({ keepouts: [{ x: 50, y: 50, r: 8 }] });
    const path = cutout({
      shape: 'path',
      x: 44,
      y: 44,
      width: 12,
      depth: 12,
      path: [corner(44, 44), corner(56, 44), corner(56, 56), corner(44, 56)],
    });

    const offset = lidWindowOffset([path], w);

    expect(offset).not.toBeNull();
    const dx = offset?.dx ?? 0;
    const dy = offset?.dy ?? 0;
    const moved: Cutout = {
      ...path,
      x: path.x + dx,
      y: path.y + dy,
      path: path.path?.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    };
    expect(cutoutFitsInLidWindow(moved, w)).toBe(true);
  });
});
