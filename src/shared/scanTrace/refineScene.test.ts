import { describe, it, expect } from 'vitest';
import { coverage, withRefinedShape } from './refineScene';
import type { SceneShape, SceneTrace } from './traceScene';
import type { Point } from './types';

const square = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

const shape = (points: Point[]): SceneShape => ({ imagePoints: points, outputPoints: points });

function sceneOf(...shapes: SceneShape[]): SceneTrace {
  return { shapes, units: 'px', card: null, grid: null, reference: null };
}

describe('coverage', () => {
  it('reads the share of an outline inside another', () => {
    expect(coverage(square(10, 10, 50, 50), square(10, 10, 50, 50))).toBeCloseTo(1, 1);
    expect(coverage(square(10, 10, 50, 50), square(10, 10, 30, 50))).toBeCloseTo(0.5, 1);
    expect(coverage(square(10, 10, 50, 50), square(100, 10, 150, 50))).toBe(0);
  });
});

describe('withRefinedShape', () => {
  const big = shape(square(10, 10, 90, 90));
  const small = shape(square(120, 20, 160, 60));

  it('takes a seeded pass that agrees with the outline it was seeded in', () => {
    const refined = shape(square(12, 12, 88, 88));
    const next = withRefinedShape(sceneOf(big, small), refined, {
      kind: 'seeded',
      index: 0,
    });
    expect(next.shapes).toEqual([refined, small]);
  });

  it('keeps the outline when a seeded pass grabbed far more than the tool', () => {
    const scene = sceneOf(big, small);
    const sheet = shape(square(0, 0, 199, 119));
    const next = withRefinedShape(scene, sheet, {
      kind: 'seeded',
      index: 1,
    });
    expect(next).toBe(scene);
  });

  it('keeps the outline when a seeded pass drew a different object', () => {
    const scene = sceneOf(big, small);
    const next = withRefinedShape(scene, shape(square(10, 10, 90, 90)), {
      kind: 'seeded',
      index: 1,
    });
    expect(next).toBe(scene);
  });

  it('folds in pieces of the same tool the colour pass split apart', () => {
    const left = shape(square(10, 10, 48, 90));
    const right = shape(square(52, 10, 90, 90));
    const whole = shape(square(10, 10, 90, 90));
    const next = withRefinedShape(sceneOf(left, right), whole, {
      kind: 'seeded',
      index: 0,
    });
    expect(next.shapes).toEqual([whole]);
  });

  it('replaces the outline a tap lands in, whatever it agrees with', () => {
    const redrawn = shape(square(115, 15, 175, 75));
    const next = withRefinedShape(sceneOf(big, small), redrawn, {
      kind: 'tapped',
      at: { x: 140, y: 40 },
    });
    expect(next.shapes).toEqual([big, redrawn]);
  });

  it('adds a tool a tap found that the colour pass missed', () => {
    const missed = shape(square(120, 80, 150, 110));
    const next = withRefinedShape(sceneOf(big, small), missed, {
      kind: 'tapped',
      at: { x: 135, y: 95 },
    });
    expect(next.shapes).toEqual([big, small, missed]);
  });
});
