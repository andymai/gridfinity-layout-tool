import { describe, it, expect } from 'vitest';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import {
  LID_KEEPOUT_BELOW_CEILING_MM,
  LID_KEEPOUT_CLEARANCE,
  lidKeepoutRing,
  railInboardReachMm,
} from './lidKeepout';

/** A stock 2x2 bin: outer half 41.75, inner half 40.55 at the 1.2mm wall. */
const INNER = 81.1;

describe('railInboardReachMm', () => {
  it('is 3.35mm at the default wall', () => {
    expect(railInboardReachMm(1.2)).toBeCloseTo(3.35, 6);
  });

  it('shrinks as the wall thickens, because the lid stays put', () => {
    // The lid's footprint is fixed by the bin's OUTER size, so a thicker wall
    // moves the cavity in toward the rail rather than the rail out.
    expect(railInboardReachMm(2.4)).toBeCloseTo(railInboardReachMm(1.2) - 1.2, 6);
  });
});

describe('lidKeepoutRing', () => {
  const ring = lidKeepoutRing(INNER, INNER, 1.2);

  it('starts at the lip’s inner face on the ring’s own top plane', () => {
    // The lip reaches deepest at the wall top, which is where the ring's top
    // sits: 1.4mm into the cavity at the default wall, not the 0.7mm it holds
    // a small taper higher up. Taking the shallower plane puts the cutter over
    // the lip's angled support and shears it into a 90° overhang (#4146).
    expect(ring.outerHalfX).toBeCloseTo(INNER / 2 - 1.4, 6);
    expect(ring.outerHalfX).toBeCloseTo(
      INNER / 2 + 1.2 - (GRIDFINITY_SPEC.LIP_SMALL_TAPER + GRIDFINITY_SPEC.LIP_BIG_TAPER),
      6
    );
  });

  it('reaches past the rail’s deepest point by one clearance', () => {
    // Stated from the ring's own outer boundary rather than a repeated
    // constant: the width absorbs the lip inset, so the INNER edge lands on
    // the rail's reach whatever plane the outer boundary is taken on. That
    // invariant is why correcting the outer boundary cannot give up clearance.
    const innerEdgeFromWall = INNER / 2 - (ring.outerHalfX - ring.width);
    expect(innerEdgeFromWall).toBeCloseTo(railInboardReachMm(1.2) + LID_KEEPOUT_CLEARANCE, 6);
  });

  it('is deep enough for the rail band plus a clearance', () => {
    expect(ring.depthBelowWallTop).toBeCloseTo(3.05 + LID_KEEPOUT_CLEARANCE, 6);
  });

  it('measures the label datum from the ceiling, a lip taper below the rim', () => {
    expect(LID_KEEPOUT_BELOW_CEILING_MM).toBeCloseTo(
      ring.depthBelowWallTop - GRIDFINITY_SPEC.LIP_SMALL_TAPER,
      6
    );
  });

  it('follows a non-square footprint on each axis', () => {
    const oblong = lidKeepoutRing(81.1, 123.1, 1.2);
    expect(oblong.outerHalfY - oblong.outerHalfX).toBeCloseTo((123.1 - 81.1) / 2, 6);
    expect(oblong.width).toBeCloseTo(ring.width, 6);
  });

  it('leaves an interior on any bin big enough to have compartments', () => {
    // A 1x1 is the smallest footprint the designer offers; the ring must not
    // swallow its whole mouth.
    const smallest = lidKeepoutRing(39.1, 39.1, 1.2);
    expect(smallest.outerHalfX - smallest.width).toBeGreaterThan(10);
  });
});
