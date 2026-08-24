import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { cutoutDepthShortfall } from './cutoutDepthShortfall';

const cutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'rectangle',
  x: 45,
  y: 45,
  width: 10,
  depth: 10,
  cutDepth: 20,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

const SIN45 = Math.SQRT1_2;

describe('cutoutDepthShortfall', () => {
  it('returns null when the full depth fits', () => {
    expect(cutoutDepthShortfall(cutout({ cutDepth: 40 }), 100, 100, 44)).toBeNull();
  });

  it('reports the remaining fill when a stored depth outlives a shrunken bin', () => {
    const result = cutoutDepthShortfall(cutout({ cutDepth: 58 }), 100, 100, 44);
    expect(result).toEqual({ requested: 58, achievable: 44 });
  });

  it('reports the floor clip on a leaned cut', () => {
    const result = cutoutDepthShortfall(cutout({ cutDepth: 54, leanDeg: 45 }), 100, 100, 40);
    // The pocket floor's low edge reaches the bin floor at
    // (fill − (d/2)·sin45) / cos45.
    expect(result?.achievable).toBeCloseTo((40 - 5 * SIN45) / SIN45, 4);
  });

  it('reports the wall clip when the lean slides the floor past the board edge', () => {
    const result = cutoutDepthShortfall(cutout({ y: 80, cutDepth: 30, leanDeg: 45 }), 100, 100, 60);
    // Floor slides +Y: far edge starts at 85 + 5·cos45 and travels D·sin45.
    expect(result?.achievable).toBeCloseTo((100 - (85 + 5 * SIN45)) / SIN45, 4);
  });

  it('follows a negative lean toward the near wall', () => {
    const result = cutoutDepthShortfall(cutout({ y: 5, cutDepth: 30, leanDeg: -45 }), 100, 100, 60);
    expect(result?.achievable).toBeCloseTo((10 - 5 * SIN45) / SIN45, 4);
  });

  it('carries the wall direction with the plan rotation', () => {
    const result = cutoutDepthShortfall(
      cutout({ x: 80, y: 45, cutDepth: 30, leanDeg: 45, rotation: 90 }),
      100,
      100,
      60
    );
    // A clockwise 90° turn points the tilt along world +X toward the far wall.
    expect(result?.achievable).toBeCloseTo((100 - (85 + 5 * SIN45)) / SIN45, 4);
  });

  it('answers for the worst repeat instance, not just the master', () => {
    const master = cutout({
      y: 10,
      cutDepth: 30,
      leanDeg: 45,
      array: {
        mode: 'grid',
        cols: 1,
        rows: 2,
        pitchX: 20,
        pitchY: 70,
        count: 2,
        radius: 20,
        startAngle: 0,
        rotateToCenter: false,
      },
    });
    // The master (y=10) has room; the second instance (y=80) slides its floor
    // into the far wall.
    expect(
      cutoutDepthShortfall(cutout({ y: 10, cutDepth: 30, leanDeg: 45 }), 100, 100, 60)
    ).toBeNull();
    const result = cutoutDepthShortfall(master, 100, 100, 60);
    expect(result?.achievable).toBeCloseTo((100 - (85 + 5 * SIN45)) / SIN45, 4);
  });

  it('leaves an off-board mouth to the off-board warning', () => {
    expect(cutoutDepthShortfall(cutout({ x: -1, cutDepth: 58 }), 100, 100, 44)).toBeNull();
  });

  it('never judges mesh imprints', () => {
    expect(cutoutDepthShortfall(cutout({ shape: 'mesh', cutDepth: 58 }), 100, 100, 44)).toBeNull();
  });

  it('ignores sub-tolerance noise', () => {
    expect(cutoutDepthShortfall(cutout({ cutDepth: 44.05 }), 100, 100, 44)).toBeNull();
  });
});
