import { describe, it, expect } from 'vitest';
import { scaleParsedSpec } from './svgScaleSpec';
import type { ParsedCutoutSpec } from './types';

const baseRect: ParsedCutoutSpec = {
  shape: 'rectangle',
  x: 10,
  y: 20,
  width: 30,
  depth: 40,
  cornerRadius: 2,
  rotation: 0,
};

describe('scaleParsedSpec', () => {
  it('returns identity when scale is 1', () => {
    const out = scaleParsedSpec(baseRect, 1);
    expect(out).toBe(baseRect);
  });

  it('scales position, size, and corner radius', () => {
    const out = scaleParsedSpec(baseRect, 0.5);
    expect(out).toEqual({
      shape: 'rectangle',
      x: 5,
      y: 10,
      width: 15,
      depth: 20,
      cornerRadius: 1,
      rotation: 0,
    });
  });

  it('preserves rotation (rotation is unitless)', () => {
    const out = scaleParsedSpec({ ...baseRect, rotation: 45 }, 2);
    expect(out.rotation).toBe(45);
  });

  it('scales path point coordinates and handle deltas', () => {
    const spec: ParsedCutoutSpec = {
      shape: 'path',
      x: 10,
      y: 10,
      width: 20,
      depth: 20,
      cornerRadius: 0,
      rotation: 0,
      path: [
        { x: 10, y: 10, handleIn: null, handleOut: { dx: 4, dy: 0 }, symmetric: false },
        { x: 30, y: 30, handleIn: { dx: -4, dy: 0 }, handleOut: null, symmetric: false },
      ],
    };
    const out = scaleParsedSpec(spec, 0.25);
    expect(out.path).toEqual([
      { x: 2.5, y: 2.5, handleIn: null, handleOut: { dx: 1, dy: 0 }, symmetric: false },
      { x: 7.5, y: 7.5, handleIn: { dx: -1, dy: 0 }, handleOut: null, symmetric: false },
    ]);
  });
});
