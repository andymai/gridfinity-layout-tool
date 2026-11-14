import { describe, it, expect } from 'vitest';
import { specToCutout, DEFAULT_CUT_DEPTH } from './specToCutout';
import type { ParsedCutoutSpec } from './types';
import { pathCutoutOutline } from '@/shared/utils/pathCutoutOutline';

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

  it("carries a path spec's islands onto the cutout", () => {
    const at = (x: number, y: number) => ({
      x,
      y,
      handleIn: null,
      handleOut: null,
      symmetric: false,
    });
    const holes = [[at(2, 2), at(4, 2), at(4, 4)]];
    const cutout = specToCutout(
      {
        shape: 'path',
        x: 0,
        y: 0,
        width: 10,
        depth: 10,
        cornerRadius: 0,
        rotation: 0,
        path: [at(0, 0), at(10, 0), at(10, 10)],
        holes,
      },
      defaultOptions
    );
    expect(cutout.holes).toEqual(holes);
  });

  it('cuts the tiny loops a traced path can make out of it, so it is cut to shape', () => {
    const pt = (x: number, y: number) => ({
      x,
      y,
      handleIn: null,
      handleOut: null,
      symmetric: false,
    });
    const spec: ParsedCutoutSpec = {
      shape: 'path',
      x: 0,
      y: 0,
      width: 10,
      depth: 10.3,
      cornerRadius: 0,
      rotation: 0,
      // A curl whose tip, at 10.3, is the outline's highest point.
      path: [
        pt(0, 0),
        pt(10, 0),
        pt(10, 10),
        pt(6, 10),
        pt(4.8, 10),
        pt(5.2, 10.3),
        pt(5, 9.8),
        pt(0, 10),
      ],
    };
    // Left crossing, the builder would cut the outline's bounding box instead.
    expect(pathCutoutOutline({ ...spec, path: spec.path })).toBeNull();
    const cutout = specToCutout(spec, defaultOptions);
    expect(cutout.path).toHaveLength(7);
    expect(pathCutoutOutline(cutout)).not.toBeNull();
    // The box the cutout turns about shrinks with it.
    expect(cutout.depth).toBeCloseTo(10);
  });
});
