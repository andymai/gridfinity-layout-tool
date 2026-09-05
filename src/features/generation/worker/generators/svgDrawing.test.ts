// @vitest-environment node
/**
 * The SVG path -> brepjs Drawing bridge. Covers the properties the icon
 * catalog depends on: the full path grammar parses, arcs stay analytic rather
 * than faceted, both arc flags pick the arc the browser would draw, Y is
 * flipped from SVG's convention, and unparseable input yields null instead of
 * throwing inside the worker.
 *
 * The arc cases are stated as enclosed area against a closed form, because
 * that is the only measure the failure they guard against moves: the four
 * candidate arcs through one pair of endpoints share a radius, and two of them
 * share a bounding box as well.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume } from 'brepjs';
import { isOk } from '@/core/result';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { sketch } from './meshUtils';
import { drawingFromSvgPath } from './svgDrawing';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

/** Enclosed area, measured as the volume of a 1mm extrusion. */
const areaOf = (pathD: string): number => {
  const drawing = drawingFromSvgPath(pathD);
  if (!drawing) throw new Error('import failed');
  const solid = sketch(drawing, 'XY', 0).extrude(1);
  try {
    const r = measureVolume(solid);
    if (!isOk(r)) throw new Error('measureVolume failed');
    return r.value;
  } finally {
    solid.delete();
  }
};

describe('drawingFromSvgPath', () => {
  it('parses a closed polygon at exact area', () => {
    expect(areaOf('M 0 0 L 20 0 L 20 20 L 0 20 Z')).toBeCloseTo(400, 9);
  });

  it('keeps arcs analytic rather than faceting them', () => {
    // A polyline approximation lands short of pi*r^2 by far more than this.
    expect(areaOf('M 0 -5 A 5 5 0 0 1 0 5 A 5 5 0 0 1 0 -5 Z')).toBeCloseTo(Math.PI * 25, 9);
  });

  /**
   * Circular segment cut off by a chord `2 * halfChord` long, on radius `r`.
   * The minor arc plus that chord encloses exactly this.
   */
  const segmentArea = (r: number, halfChord: number): number => {
    const theta = 2 * Math.asin(halfChord / r);
    return ((r * r) / 2) * (theta - Math.sin(theta));
  };

  it('takes the long way round when the large-arc flag is set', () => {
    // Endpoints (3, +/-4) on a radius-5 circle. The minor arc encloses the
    // segment; the large one encloses everything else.
    const minor = segmentArea(5, 4);
    expect(areaOf('M 3 -4 A 5 5 0 0 1 3 4 Z')).toBeCloseTo(minor, 6);
    expect(areaOf('M 3 -4 A 5 5 0 1 1 3 4 Z')).toBeCloseTo(Math.PI * 25 - minor, 6);
  });

  it('takes the long way round on a relative arc too', () => {
    expect(areaOf('M 3 -4 a 5 5 0 1 1 0 8 Z')).toBeCloseTo(Math.PI * 25 - segmentArea(5, 4), 6);
  });

  it('puts the arc on the side the sweep flag asks for', () => {
    // A 6x8 box with its top edge replaced by an arc. Sweep 1 bows the arc into
    // the box and sweep 0 bows it out, so the same radius lands 2x the segment
    // apart. Both were the outward answer before the flags were honoured.
    const bulge = segmentArea(5, 3);
    expect(areaOf('M 0 0 A 5 5 0 0 1 6 0 L 6 -8 L 0 -8 Z')).toBeCloseTo(48 - bulge, 6);
    expect(areaOf('M 0 0 A 5 5 0 0 0 6 0 L 6 -8 L 0 -8 Z')).toBeCloseTo(48 + bulge, 6);
  });

  it('parses cubic and quadratic segments', () => {
    const drawing = drawingFromSvgPath('M 0 0 C 5 10 15 10 20 0 Q 10 -8 0 0 Z');
    expect(drawing).not.toBeNull();
    expect(drawing?.boundingBox.width).toBeCloseTo(20, 6);
  });

  it('flips Y so SVG-authored paths land the right way up', () => {
    // Source spans y 0..10 downward; brepjs is Y-up, so it must arrive at -10..0.
    const drawing = drawingFromSvgPath('M 0 0 L 10 0 L 10 10 L 0 10 Z');
    const box = drawing?.boundingBox;
    expect(box?.center[1]).toBeCloseTo(-5, 6);
  });

  it('preserves an arbitrary authoring frame, leaving scale to the caller', () => {
    const small = drawingFromSvgPath('M 0 0 L 24 0 L 24 24 L 0 24 Z');
    expect(small?.boundingBox.width).toBeCloseTo(24, 6);
  });

  it('reads an arc whose flags are written without separators', () => {
    // What a path optimiser emits: the two single-digit flags run together, and
    // the endpoint's sign is its own separator.
    expect(areaOf('M 3 -4 A5 5 0 11 3 4 Z')).toBeCloseTo(Math.PI * 25 - segmentArea(5, 4), 6);
    expect(areaOf('M 3 -4a5 5 0 110 8Z')).toBeCloseTo(Math.PI * 25 - segmentArea(5, 4), 6);
  });

  it('keeps an elliptical arc elliptical', () => {
    // Half an ellipse closed by its own major axis: half of pi*a*b, to within
    // the cubic fit's own error. Collapsing the radii to one would land 67%
    // high or 40% low depending on which of the two won, and the bounding box
    // says which shape it is rather than only how big.
    const half = (Math.PI * 5 * 3) / 2;
    const path = 'M -5 0 A 5 3 0 0 1 5 0 Z';
    expect(Math.abs(areaOf(path) - half) / half).toBeLessThan(1e-3);
    expect(drawingFromSvgPath(path)?.boundingBox.height).toBeCloseTo(3, 3);
    expect(drawingFromSvgPath(path)?.boundingBox.width).toBeCloseTo(10, 3);
  });

  it('rejects a path it can only read part of', () => {
    // Junk inside an argument run used to be skipped, which turned a typo into
    // geometry rather than a missing icon.
    expect(drawingFromSvgPath('M 0 0 L 1O 20 Z')).toBeNull();
    expect(drawingFromSvgPath('M 0 0 L 10 20 30 Z')).toBeNull();
    expect(drawingFromSvgPath('M 0 0 L 10 10 Z 1 2')).toBeNull();
    expect(drawingFromSvgPath('M 0 0 L 10 10 A 5 5 0 3 1 0 0 Z')).toBeNull();
    expect(drawingFromSvgPath('M 0 0 L 10 10 L Z')).toBeNull();
  });

  it('returns null instead of throwing on unusable input', () => {
    expect(drawingFromSvgPath('')).toBeNull();
    expect(drawingFromSvgPath('   ')).toBeNull();
    expect(drawingFromSvgPath('not a path')).toBeNull();
    expect(drawingFromSvgPath('<svg><path d="M 0 0"/></svg>')).toBeNull();
  });
});
