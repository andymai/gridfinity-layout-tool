import { describe, expect, it } from 'vitest';
import type { Drawer, DrawerOutline } from '@/core/types';
import { gridUnits } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import {
  drawerFrameOutline,
  drawerFrameShift,
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
