import { describe, it, expect } from 'vitest';
import { specToCutout, DEFAULT_CUT_DEPTH } from './specToCutout';
import type { ParsedCutoutSpec } from './types';

describe('specToCutout', () => {
  const mockIdFactory = (() => {
    let counter = 0;
    return () => `test-id-${++counter}`;
  })();

  const defaultOptions = {
    cutDepth: DEFAULT_CUT_DEPTH,
    idFactory: mockIdFactory,
  };

  it('hydrates a rectangle spec with correct fields', () => {
    const spec: ParsedCutoutSpec = {
      shape: 'rectangle',
      x: 10,
      y: 20,
      width: 30,
      depth: 40,
      cornerRadius: 3,
      rotation: 0,
    };

    const cutout = specToCutout(spec, defaultOptions);

    expect(cutout.shape).toBe('rectangle');
    expect(cutout.x).toBe(10);
    expect(cutout.y).toBe(20);
    expect(cutout.width).toBe(30);
    expect(cutout.depth).toBe(40);
    expect(cutout.cornerRadius).toBe(3);
    expect(cutout.cutDepth).toBe(DEFAULT_CUT_DEPTH);
    expect(cutout.label).toBe('');
    expect(cutout.groupId).toBeNull();
    expect(cutout.id).toBeDefined();
    expect(cutout.path).toBeUndefined();
  });

  it('hydrates a circle spec', () => {
    const spec: ParsedCutoutSpec = {
      shape: 'circle',
      x: 5,
      y: 5,
      width: 40,
      depth: 40,
      cornerRadius: 0,
      rotation: 0,
    };

    const cutout = specToCutout(spec, defaultOptions);

    expect(cutout.shape).toBe('circle');
    expect(cutout.width).toBe(40);
    expect(cutout.depth).toBe(40);
  });

  it('hydrates a path spec with PathPoints', () => {
    const spec: ParsedCutoutSpec = {
      shape: 'path',
      x: 0,
      y: 0,
      width: 50,
      depth: 50,
      cornerRadius: 0,
      rotation: 0,
      path: [
        { x: 0, y: 0, handleIn: null, handleOut: null, symmetric: false },
        { x: 50, y: 0, handleIn: null, handleOut: null, symmetric: false },
        { x: 25, y: 50, handleIn: null, handleOut: null, symmetric: false },
      ],
    };

    const cutout = specToCutout(spec, defaultOptions);

    expect(cutout.shape).toBe('path');
    expect(cutout.path).toHaveLength(3);
  });

  it('applies custom cutDepth from options', () => {
    const spec: ParsedCutoutSpec = {
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 10,
      depth: 10,
      cornerRadius: 0,
      rotation: 0,
    };

    const cutout = specToCutout(spec, { cutDepth: 12, idFactory: mockIdFactory });

    expect(cutout.cutDepth).toBe(12);
  });

  it('uses the provided id factory', () => {
    let called = false;
    const spec: ParsedCutoutSpec = {
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 10,
      depth: 10,
      cornerRadius: 0,
      rotation: 0,
    };

    const cutout = specToCutout(spec, {
      cutDepth: 5,
      idFactory: () => {
        called = true;
        return 'custom-id';
      },
    });

    expect(called).toBe(true);
    expect(cutout.id).toBe('custom-id');
  });
});
