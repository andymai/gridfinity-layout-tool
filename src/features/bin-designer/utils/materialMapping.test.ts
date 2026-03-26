import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import { buildTriangleMaterialIndices } from './materialMapping';
import type { FeatureColorConfig } from '../types/featureColors';
import type { FaceGroupData } from '@/shared/types/generation';

describe('buildTriangleMaterialIndices', () => {
  it('returns null when all zones use the same color', () => {
    const featureColors: FeatureColorConfig = {
      body: '#ffffff',
      lip: '#ffffff',
      labelTab: '#ffffff',
    };
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 9, tag: FeatureTag.BASE }];

    expect(buildTriangleMaterialIndices(faceGroups, featureColors, 3)).toBeNull();
  });

  it('maps face groups to correct material indices with two colors', () => {
    const featureColors: FeatureColorConfig = {
      body: '#ffffff',
      lip: '#0000ff',
      labelTab: '#ffffff',
    };

    // 6 triangles: 3 body (BASE), 3 lip (LIP)
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 9, tag: FeatureTag.BASE },
      { start: 9, count: 9, tag: FeatureTag.LIP },
    ];

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, 6);

    expect(result).not.toBeNull();
    expect(result?.materials).toHaveLength(2);
    expect(result?.materials[0].color).toBe('#ffffff');
    expect(result?.materials[1].color).toBe('#0000ff');
    expect(result?.triangleMaterialIndices).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it('maps face groups with three distinct colors', () => {
    const featureColors: FeatureColorConfig = {
      body: '#ffffff',
      lip: '#0000ff',
      labelTab: '#00ff00',
    };

    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 6, tag: FeatureTag.BASE },
      { start: 6, count: 3, tag: FeatureTag.LIP },
      { start: 9, count: 3, tag: FeatureTag.LABEL_TAB },
    ];

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, 4);

    expect(result).not.toBeNull();
    expect(result?.materials).toHaveLength(3);
    expect(result?.triangleMaterialIndices).toEqual([0, 0, 1, 2]);
  });

  it('maps untagged triangles to body material', () => {
    const featureColors: FeatureColorConfig = {
      body: '#ffffff',
      lip: '#0000ff',
      labelTab: '#ffffff',
    };

    const faceGroups: FaceGroupData[] = [{ start: 0, count: 3, tag: FeatureTag.LIP }];

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, 3);

    expect(result).not.toBeNull();
    expect(result?.triangleMaterialIndices).toEqual([1, 0, 0]);
  });
});
