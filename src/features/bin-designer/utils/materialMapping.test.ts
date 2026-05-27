import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import { buildTriangleMaterialIndices } from './materialMapping';
import { ZONE_ORDER } from '../types/featureColors';
import type { ColorZone, FeatureColorConfig } from '../types/featureColors';
import type { FaceGroupData } from '@/shared/types/generation';

const SINGLE = '#d4d8dc';
const allZones: ReadonlySet<ColorZone> = new Set(ZONE_ORDER);

/** Build a featureColors config that's single-color by default; pass overrides to differentiate zones. */
function colors(overrides: Partial<FeatureColorConfig> = {}): FeatureColorConfig {
  return {
    enabled: false,
    body: SINGLE,
    lip: { frontLeft: SINGLE, frontRight: SINGLE, backRight: SINGLE, backLeft: SINGLE },
    labelTab: SINGLE,
    base: SINGLE,
    scoop: SINGLE,
    dividers: SINGLE,
    text: SINGLE,
    lid: SINGLE,
    ...overrides,
  };
}

/** Build a degenerate triangle (all 3 verts at the same XY); centroid = (x, y, 0). */
function tri(x: number, y: number): number[] {
  return [x, y, 0, x, y, 0, x, y, 0];
}

describe('buildTriangleMaterialIndices', () => {
  it('returns null when all zones use the same color', () => {
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 9, tag: FeatureTag.BASE }];
    const vertices = new Float32Array([...tri(0, 0), ...tri(1, 0), ...tri(0, 1)]);
    expect(buildTriangleMaterialIndices(faceGroups, colors(), 3, vertices, allZones)).toBeNull();
  });

  it('maps non-lip face groups to their zone color', () => {
    // labelTab (green) vs body (white)
    const featureColors = colors({ labelTab: '#00ff00' });
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 9, tag: FeatureTag.BASE },
      { start: 9, count: 9, tag: FeatureTag.LABEL_TAB },
    ];
    const vertices = new Float32Array([
      ...tri(0, 0),
      ...tri(1, 0),
      ...tri(0, 1),
      ...tri(2, 2),
      ...tri(3, 3),
      ...tri(4, 4),
    ]);

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, 6, vertices, allZones);

    expect(result).not.toBeNull();
    expect(result?.materials.map((m) => m.color)).toEqual([SINGLE, '#00ff00']);
    expect(result?.triangleMaterialIndices).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it('splits LIP triangles into four corner zones by centroid quadrant', () => {
    // Four lip-corner colors: distinct hexes
    const featureColors = colors({
      lip: {
        frontLeft: '#ff0000',
        frontRight: '#00ff00',
        backRight: '#0000ff',
        backLeft: '#ffffff',
      },
    });
    // Four LIP triangles, one in each quadrant of bbox [0..100] × [0..100]
    const vertices = new Float32Array([
      ...tri(10, 10), // front-left (low x, low y)
      ...tri(90, 10), // front-right (high x, low y)
      ...tri(90, 90), // back-right
      ...tri(10, 90), // back-left
    ]);
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 12, tag: FeatureTag.LIP }];

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, 4, vertices, allZones);

    expect(result).not.toBeNull();
    // Materials: body, then 4 distinct corner colors. resolveColorMapping
    // walks lip:fL, lip:fR, lip:bR, lip:bL — so indices 1..4 line up with
    // that order.
    const idxFor = (hex: string) => result!.materials.findIndex((m) => m.color === hex);
    expect(result?.triangleMaterialIndices).toEqual([
      idxFor('#ff0000'),
      idxFor('#00ff00'),
      idxFor('#0000ff'),
      idxFor('#ffffff'),
    ]);
  });

  it('maps SOCKET → base, SCOOP → scoop, DIVIDER → dividers', () => {
    const featureColors = colors({
      base: '#aa0000',
      scoop: '#00aa00',
      dividers: '#0000aa',
    });
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 3, tag: FeatureTag.SOCKET },
      { start: 3, count: 3, tag: FeatureTag.SCOOP },
      { start: 6, count: 3, tag: FeatureTag.DIVIDER },
    ];
    const vertices = new Float32Array([...tri(0, 0), ...tri(1, 1), ...tri(2, 2)]);

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, 3, vertices, allZones);

    expect(result).not.toBeNull();
    const idxFor = (hex: string) => result!.materials.findIndex((m) => m.color === hex);
    expect(result?.triangleMaterialIndices).toEqual([
      idxFor('#aa0000'),
      idxFor('#00aa00'),
      idxFor('#0000aa'),
    ]);
  });
});
