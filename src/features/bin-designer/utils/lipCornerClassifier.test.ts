import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import {
  classifyLipBand,
  classifyLipCell,
  classifyLipCorner,
  computeLipGeom,
} from './lipCornerClassifier';
import type { LipGeom } from './lipCornerClassifier';
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

describe('classifyLipBand', () => {
  it('returns 0 for a single band or a zero-height range', () => {
    expect(classifyLipBand(5, 0, 10, 1)).toBe(0);
    expect(classifyLipBand(5, 5, 5, 4)).toBe(0);
  });

  it('splits the Z range into equal slices, bottom = 0', () => {
    expect(classifyLipBand(2, 0, 10, 2)).toBe(0);
    expect(classifyLipBand(7, 0, 10, 2)).toBe(1);
    expect(classifyLipBand(1, 0, 10, 4)).toBe(0);
    expect(classifyLipBand(9, 0, 10, 4)).toBe(3);
  });

  it('clamps a centroid at the top edge into the last band', () => {
    expect(classifyLipBand(10, 0, 10, 4)).toBe(3);
  });
});

describe('classifyLipCell', () => {
  const geom: LipGeom = { cx: 0, cy: 0, minZ: 0, maxZ: 10 };

  it('collapses to a single canonical cell at 1×1', () => {
    expect(classifyLipCell(5, 5, 8, geom, { corners: 1, bands: 1 })).toBe('lip:frontLeft:0');
    expect(classifyLipCell(-5, -5, 1, geom, { corners: 1, bands: 1 })).toBe('lip:frontLeft:0');
  });

  it('folds left/right into front/back at 2 corners', () => {
    expect(classifyLipCell(5, -5, 2, geom, { corners: 2, bands: 1 })).toBe('lip:frontLeft:0');
    expect(classifyLipCell(5, 5, 2, geom, { corners: 2, bands: 1 })).toBe('lip:backLeft:0');
  });

  it('keeps all four corners and bands at 4×2', () => {
    expect(classifyLipCell(5, 5, 8, geom, { corners: 4, bands: 2 })).toBe('lip:backRight:1');
    expect(classifyLipCell(-5, -5, 2, geom, { corners: 4, bands: 2 })).toBe('lip:frontLeft:0');
  });
});

describe('computeLipGeom', () => {
  it('returns null when no LIP face groups exist', () => {
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 3, tag: FeatureTag.BASE }];
    expect(computeLipGeom(faceGroups, () => ({ x: 0, y: 0, z: 0 }))).toBeNull();
  });

  it('centers on the midpoint of LIP centroid extents and tracks Z range', () => {
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.LIP }];
    const centroids = [
      { x: 10, y: 20, z: 2 },
      { x: 90, y: 60, z: 8 },
    ];
    expect(computeLipGeom(faceGroups, (i) => centroids[i])).toEqual({
      cx: 50,
      cy: 40,
      minZ: 2,
      maxZ: 8,
    });
  });

  it('ignores non-LIP face groups', () => {
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 3, tag: FeatureTag.BASE },
      { start: 3, count: 3, tag: FeatureTag.LIP },
    ];
    const centroids = [
      { x: 1000, y: 1000, z: 1000 },
      { x: 10, y: 20, z: 5 },
    ];
    expect(computeLipGeom(faceGroups, (i) => centroids[i])).toEqual({
      cx: 10,
      cy: 20,
      minZ: 5,
      maxZ: 5,
    });
  });
});
