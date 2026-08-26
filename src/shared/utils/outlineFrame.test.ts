import { describe, expect, it } from 'vitest';
import type { Drawer, DrawerOutline } from '@/core/types';
import { gridUnits, mm } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import {
  drawerFrameExtent,
  drawerFrameOutline,
  drawerFrameShift,
  drawerFrameShiftLimits,
  resolveOutlineFrame,
  type OutlineFrameParams,
} from './outlineFrame';

const U = 42;

/** 84×84mm square at (10,10) inside a 4×4 extent — off-lattice by design.
 * The two-cell block registers at 42..126 per axis, so the registration is
 * exactly (+32, +32). */
const OFF_LATTICE: DrawerOutline = {
  vertices: [
    { x: 10, y: 10 },
    { x: 94, y: 10 },
    { x: 94, y: 94 },
    { x: 10, y: 94 },
  ],
};

/** Corner-anchored L filling its 4×4 extent: registration is zero. */
const REGISTERED: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 2 * U },
    { x: 2 * U, y: 2 * U },
    { x: 2 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

function frameParams(overrides: Partial<OutlineFrameParams> = {}): OutlineFrameParams {
  return {
    widthMm: 4 * U,
    depthMm: 4 * U,
    gridUnitMm: U,
    gridUnitMmY: U,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    gridShiftX: 0,
    gridShiftY: 0,
    ...overrides,
  };
}

function frameDrawer(
  outline: DrawerOutline | undefined,
  extra: Partial<Drawer> = {}
): Pick<
  Drawer,
  | 'width'
  | 'depth'
  | 'outline'
  | 'fractionalEdgeX'
  | 'fractionalEdgeY'
  | 'gridShiftX'
  | 'gridShiftY'
> {
  return { width: gridUnits(4), depth: gridUnits(4), outline, ...extra };
}

describe('resolveOutlineFrame', () => {
  it('lattice-registers an off-lattice shape', () => {
    const frame = resolveOutlineFrame(OFF_LATTICE, frameParams());
    expect(frame.shiftX).toBeCloseTo(32, 9);
    expect(frame.shiftY).toBeCloseTo(32, 9);
  });

  it('returns exact zero for a registered shape', () => {
    const frame = resolveOutlineFrame(REGISTERED, frameParams());
    expect(frame.shiftX).toBe(0);
    expect(frame.shiftY).toBe(0);
    expect(frame.outline).toBe(REGISTERED);
  });

  // Now reachable: the perimeter is bounded by the DRAWER, so a grid smaller
  // than the drawer is a supported configuration rather than a stale one to be
  // clipped back. The grid stays put and centres inside the perimeter, and the
  // strip outside it is reported as overhang for the extent-bounded consumers.
  it('centres a smaller grid inside a perimeter that exceeds it', () => {
    const bigger: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * U + 8, y: 0 },
        { x: 4 * U + 8, y: 4 * U + 7 },
        { x: 0, y: 4 * U + 7 },
      ],
    };
    const frame = resolveOutlineFrame(bigger, frameParams());
    expect(frame.shiftX).toBeCloseTo(-4, 9);
    expect(frame.shiftY).toBeCloseTo(-3.5, 9);
    expect(frame.overhang).toEqual({ left: 4, right: 4, front: 3.5, back: 3.5 });
  });

  it('subtracts the manual grid shift from the registration', () => {
    const frame = resolveOutlineFrame(OFF_LATTICE, frameParams({ gridShiftX: 10, gridShiftY: -5 }));
    expect(frame.shiftX).toBeCloseTo(22, 9);
    expect(frame.shiftY).toBeCloseTo(37, 9);
  });

  it('clamps the manual shift to half a pitch per axis', () => {
    const frame = resolveOutlineFrame(
      REGISTERED,
      frameParams({ gridShiftX: 100, gridShiftY: -100 })
    );
    expect(frame.shiftX).toBe(-U / 2);
    expect(frame.shiftY).toBe(U / 2);
  });

  it('keeps padding out of the registration when it would fold the loop', () => {
    // A 16mm slot collapses under 10mm padding (walls cross); the resolver
    // functionally zeroes the padding then, so the lattice frame must be
    // built without it too. Same off-lattice bbox as OFF_LATTICE.
    const slotted: DrawerOutline = {
      vertices: [
        { x: 10, y: 10 },
        { x: 94, y: 10 },
        { x: 94, y: 94 },
        { x: 60, y: 94 },
        { x: 60, y: 50 },
        { x: 44, y: 50 },
        { x: 44, y: 94 },
        { x: 10, y: 94 },
      ],
    };
    const folded = resolveOutlineFrame(
      slotted,
      frameParams({ paddingLeft: 10, paddingRight: 10, paddingFront: 10, paddingBack: 10 })
    );
    expect(folded.paddingOn).toBe(false);
    expect(folded.outline).toBe(slotted);
    expect(folded.shiftX).toBeCloseTo(32, 9);
  });
});

describe('drawerFrameShift / drawerFrameOutline', () => {
  it('is zero without an outline and when the plate does not sync', () => {
    expect(drawerFrameShift(frameDrawer(undefined), undefined, U)).toEqual({ x: 0, y: 0 });
    expect(
      drawerFrameShift(
        frameDrawer(OFF_LATTICE),
        { ...DEFAULT_BASEPLATE_PARAMS, syncWithLayout: false },
        U
      )
    ).toEqual({ x: 0, y: 0 });
  });

  it('returns the raw outline reference on a zero shift', () => {
    expect(drawerFrameOutline(frameDrawer(REGISTERED), undefined, U)).toBe(REGISTERED);
  });

  it('memoizes the translated outline per raw outline + shift', () => {
    const a = drawerFrameOutline(frameDrawer(OFF_LATTICE), undefined, U);
    const b = drawerFrameOutline(frameDrawer(OFF_LATTICE), DEFAULT_BASEPLATE_PARAMS, U);
    expect(a).not.toBe(OFF_LATTICE);
    expect(b).toBe(a);
    expect(a?.vertices[0]).toEqual({ x: 42, y: 42 });
  });
});

describe('drawerFrameExtent', () => {
  it('is undefined without an outline and when the plate does not sync', () => {
    expect(drawerFrameExtent(frameDrawer(undefined), undefined, U)).toBeUndefined();
    expect(
      drawerFrameExtent(
        frameDrawer(OFF_LATTICE),
        { ...DEFAULT_BASEPLATE_PARAMS, syncWithLayout: false },
        U
      )
    ).toBeUndefined();
  });

  //. A drawer measured wider than the cells it was given still prints a
  // plate that spans it, because the generator widens its slab by the overhang.
  // Reporting the lattice instead read 882 x 294 for a 931 x 327 plate.
  it('spans a perimeter that exceeds the grid', () => {
    const measured: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 931, y: 0 },
        { x: 931, y: 327 },
        { x: 672, y: 327 },
        { x: 672, y: 189 },
        { x: 273, y: 189 },
        { x: 273, y: 327 },
        { x: 0, y: 327 },
      ],
      authoring: { kind: 'pen' },
    };
    const extent = drawerFrameExtent(
      frameDrawer(measured, { width: gridUnits(21), depth: gridUnits(7) }),
      DEFAULT_BASEPLATE_PARAMS,
      U
    );
    expect(extent).toEqual({ widthMm: 931, depthMm: 327 });
  });

  it('spans a perimeter that falls short of the grid', () => {
    const smaller: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 3 * U, y: 0 },
        { x: 3 * U, y: 3 * U },
        { x: 0, y: 3 * U },
      ],
    };
    expect(drawerFrameExtent(frameDrawer(smaller), DEFAULT_BASEPLATE_PARAMS, U)).toEqual({
      widthMm: 3 * U,
      depthMm: 3 * U,
    });
  });

  it('carries padding, which the perimeter is grown by', () => {
    const extent = drawerFrameExtent(
      frameDrawer(REGISTERED),
      { ...DEFAULT_BASEPLATE_PARAMS, paddingLeft: mm(5), paddingRight: mm(7) },
      U
    );
    expect(extent).toEqual({ widthMm: 4 * U + 12, depthMm: 4 * U });
  });
});

//. A drawer measured larger than its cells gives the lattice real room to
// slide. A flat ±half-pitch bound could not reach the edges once the slack
// exceeded one cell, so corner alignment was unreachable.
describe('manual shift limits', () => {
  /** 931 x 327mm over a 21 x 7 grid: 49mm of X slack against a 42mm pitch. */
  const OVERSIZE: DrawerOutline = {
    vertices: [
      { x: 0, y: 0 },
      { x: 931, y: 0 },
      { x: 931, y: 327 },
      { x: 0, y: 327 },
    ],
  };
  const oversizeDrawer = (): Parameters<typeof drawerFrameShiftLimits>[0] =>
    frameDrawer(OVERSIZE, { width: gridUnits(21), depth: gridUnits(7) });

  it('stays at half a pitch without a shape', () => {
    expect(drawerFrameShiftLimits(frameDrawer(undefined), undefined, U)).toEqual({
      x: U / 2,
      y: U / 2,
    });
  });

  it('stays at half a pitch for a shape that fills its extent', () => {
    expect(drawerFrameShiftLimits(frameDrawer(REGISTERED), DEFAULT_BASEPLATE_PARAMS, U)).toEqual({
      x: U / 2,
      y: U / 2,
    });
  });

  it('opens up to half the slack when the shape overruns the grid', () => {
    // X slack 49 → 24.5 beats half a pitch; Y slack 33 → 16.5 does not.
    expect(drawerFrameShiftLimits(oversizeDrawer(), DEFAULT_BASEPLATE_PARAMS, U)).toEqual({
      x: 24.5,
      y: U / 2,
    });
  });

  it('lets the widened shift reach the edge the old bound fell short of', () => {
    const frame = resolveOutlineFrame(
      OVERSIZE,
      frameParams({ widthMm: 21 * U, depthMm: 7 * U, gridShiftX: -24.5 })
    );
    // Registration centres the lattice at -24.5; cancelling it lands the grid
    // flush against the left edge, with the whole 49mm of slack on the right.
    expect(frame.shiftX).toBe(0);
    expect(frame.overhang.left).toBe(0);
    expect(frame.overhang.right).toBeCloseTo(49, 9);
  });

  it('still clamps a value past the widened limit', () => {
    const frame = resolveOutlineFrame(
      OVERSIZE,
      frameParams({ widthMm: 21 * U, depthMm: 7 * U, gridShiftX: 500 })
    );
    // Clamped to +24.5: registration -24.5 minus 24.5 = -49, the far edge.
    expect(frame.shiftX).toBeCloseTo(-49, 9);
  });
});
