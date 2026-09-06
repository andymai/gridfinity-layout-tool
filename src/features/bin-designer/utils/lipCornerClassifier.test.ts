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
import { GRIDFINITY_SPEC, PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';

/** A point-sized triangle: its centroid and every vertex sit at (x, y, z). */
const triAt = (x: number, y: number, z: number): number[] => [x, y, z, x, y, z, x, y, z];

/** The rule under test: one max layer above the wall the lip is fused onto. */
const expectedFloorZ = (peakZ: number): number =>
  peakZ - GRIDFINITY_SPEC.LIP_HEIGHT + PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MAX;

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
  const geom: LipGeom = { cx: 0, cy: 0, minZ: 0, maxZ: 10, floorZ: 0 };

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
    expect(computeLipGeom(faceGroups, () => triAt(0, 0, 0))).toBeNull();
  });

  it('centers on the midpoint of LIP centroid extents and tracks Z range', () => {
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.LIP }];
    const tris = [triAt(10, 20, 2), triAt(90, 60, 8)];
    const geom = computeLipGeom(faceGroups, (i) => tris[i]);
    expect(geom).toMatchObject({ cx: 50, cy: 40, minZ: 2, maxZ: 8 });
  });

  it('ignores non-LIP face groups', () => {
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 3, tag: FeatureTag.BASE },
      { start: 3, count: 3, tag: FeatureTag.LIP },
    ];
    const tris = [triAt(1000, 1000, 1000), triAt(10, 20, 5)];
    expect(computeLipGeom(faceGroups, (i) => tris[i])).toMatchObject({
      cx: 10,
      cy: 20,
      minZ: 5,
      maxZ: 5,
    });
  });

  it('floors the colorable region just above the wall top, not at the support skirt', () => {
    // Real 6u lip extents: peak 46.3, skirt bottom 39.3, wall top 42.
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.LIP }];
    const tris = [triAt(-10, -10, 39.3), triAt(10, 10, 46.3)];
    const geom = computeLipGeom(faceGroups, (i) => tris[i]);
    expect(geom?.floorZ).toBeCloseTo(expectedFloorZ(46.3), 6);
    expect(geom?.floorZ).toBeGreaterThan(42);
  });

  it('reads the peak from vertices, so tessellation cannot drag the floor down', () => {
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.LIP }];
    // The tall triangle's centroid sits well under the apex it reaches.
    const tall = [0, 0, 44.3, 0, 0, 44.3, 0, 0, 46.3];
    const tris = [triAt(0, 0, 39.5), tall];
    const geom = computeLipGeom(faceGroups, (i) => tris[i]);
    expect(geom?.maxZ).toBeCloseTo(44.9667, 3);
    expect(geom?.floorZ).toBeCloseTo(expectedFloorZ(46.3), 6);
  });

  it('never floors past the lip extent when the support skirt is absent', () => {
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.LIP }];
    // A lip built without its angled support starts at its own base plane.
    const tris = [triAt(-10, -10, 45.9), triAt(10, 10, 46.3)];
    const geom = computeLipGeom(faceGroups, (i) => tris[i]);
    expect(geom?.floorZ).toBe(45.9);
  });
});

describe('classifyLipCell below the color floor', () => {
  const geom: LipGeom = { cx: 0, cy: 0, minZ: 39.3, maxZ: 46.3, floorZ: 42.32 };

  it('returns null for the support skirt so it takes the body color', () => {
    expect(classifyLipCell(10, 10, 40, geom, { corners: 4, bands: 4 })).toBeNull();
    expect(classifyLipCell(10, 10, 42.32, geom, { corners: 4, bands: 4 })).toBeNull();
  });

  it('divides the bands over the colorable extent only', () => {
    // 4 bands over [42.32, 46.3] = 0.995mm each.
    expect(classifyLipCell(10, 10, 42.4, geom, { corners: 1, bands: 4 })).toBe('lip:frontLeft:0');
    expect(classifyLipCell(10, 10, 46.3, geom, { corners: 1, bands: 4 })).toBe('lip:frontLeft:3');
  });
});
