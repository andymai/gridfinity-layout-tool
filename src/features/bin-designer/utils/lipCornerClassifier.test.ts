import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import { classifyLipCorner, computeLipBBoxCenter } from './lipCornerClassifier';
import type { FaceGroupData } from '@/shared/types/generation';

describe('classifyLipCorner', () => {
  const cx = 50;
  const cy = 50;

  it.each([
    [10, 10, 'frontLeft'],
    [90, 10, 'frontRight'],
    [90, 90, 'backRight'],
    [10, 90, 'backLeft'],
  ] as const)('classifies (%d, %d) as %s', (x, y, expected) => {
    expect(classifyLipCorner(x, y, cx, cy)).toBe(expected);
  });

  it('ties exact-centerline centroids to back/right (deterministic split)', () => {
    expect(classifyLipCorner(cx, cy, cx, cy)).toBe('backRight');
    expect(classifyLipCorner(cx, 0, cx, cy)).toBe('frontRight');
    expect(classifyLipCorner(0, cy, cx, cy)).toBe('backLeft');
  });
});

describe('computeLipBBoxCenter', () => {
  it('returns null when no LIP face groups exist', () => {
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 3, tag: FeatureTag.BASE }];
    expect(computeLipBBoxCenter(faceGroups, () => ({ x: 0, y: 0 }))).toBeNull();
  });

  it('centers on the midpoint of LIP centroid extents', () => {
    // 2 lip triangles, centroids at (10, 20) and (90, 60). Center = (50, 40).
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.LIP }];
    const centroids = [
      { x: 10, y: 20 },
      { x: 90, y: 60 },
    ];
    const result = computeLipBBoxCenter(faceGroups, (i) => centroids[i]);
    expect(result).toEqual({ cx: 50, cy: 40 });
  });

  it('ignores non-LIP face groups when computing the lip bbox', () => {
    // A BASE triangle at (1000, 1000) would shift the center if it were
    // counted; the result must reflect only the LIP triangles.
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 3, tag: FeatureTag.BASE },
      { start: 3, count: 3, tag: FeatureTag.LIP },
    ];
    const centroids = [
      { x: 1000, y: 1000 }, // BASE — must be ignored
      { x: 10, y: 20 }, // LIP
    ];
    const result = computeLipBBoxCenter(faceGroups, (i) => centroids[i]);
    expect(result).toEqual({ cx: 10, cy: 20 });
  });
});
