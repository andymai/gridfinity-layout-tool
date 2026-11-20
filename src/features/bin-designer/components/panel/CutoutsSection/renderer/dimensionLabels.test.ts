import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { dimensionLabelPositions } from './dimensionLabels';

const cutout = (overrides: Partial<Cutout>): Cutout => ({
  id: 'c',
  shape: 'rectangle',
  x: 30,
  y: 10,
  width: 10,
  depth: 60,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

const expectAt = (p: readonly [number, number], x: number, y: number): void => {
  expect(p[0]).toBeCloseTo(x, 9);
  expect(p[1]).toBeCloseTo(y, 9);
};

describe('dimensionLabelPositions', () => {
  it('puts the width below and the depth left of an unturned shape', () => {
    const { width, depth } = dimensionLabelPositions(cutout({}), 2);
    expectAt(width, 35, 8);
    expectAt(depth, 28, 40);
  });

  it('keeps each label beside the edge it measures on a turned shape', () => {
    const { width, depth } = dimensionLabelPositions(cutout({ rotation: 90 }), 2);
    expectAt(width, 3, 40);
    expectAt(depth, 35, 47);
  });
});
