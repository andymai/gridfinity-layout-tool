// @vitest-environment node
/**
 * The SVG path -> brepjs Drawing bridge. Covers the properties the icon
 * catalog depends on: the full path grammar parses, arcs stay analytic rather
 * than faceted, Y is flipped from SVG's convention, and unparseable input
 * yields null instead of throwing inside the worker.
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

  it('returns null instead of throwing on unusable input', () => {
    expect(drawingFromSvgPath('')).toBeNull();
    expect(drawingFromSvgPath('   ')).toBeNull();
    expect(drawingFromSvgPath('not a path')).toBeNull();
    expect(drawingFromSvgPath('<svg><path d="M 0 0"/></svg>')).toBeNull();
  });
});
