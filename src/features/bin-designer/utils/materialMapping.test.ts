import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import { buildTriangleMaterialIndices } from './materialMapping';
import type { FilamentSlot, FeatureColorConfig } from '../types/featureColors';
import type { FaceGroupData } from '@/shared/types/generation';

const testPalette: FilamentSlot[] = [
  { id: 'slot1', name: 'White', color: '#ffffff' },
  { id: 'slot2', name: 'Blue', color: '#0000ff' },
  { id: 'slot3', name: 'Green', color: '#00ff00' },
  { id: 'slot4', name: 'Red', color: '#ff0000' },
];

describe('buildTriangleMaterialIndices', () => {
  it('returns null when all zones use the same slot', () => {
    const featureColors: FeatureColorConfig = {
      body: 'slot1',
      lip: 'slot1',
      labelTab: 'slot1',
    };
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 9, tag: FeatureTag.BASE }];

    expect(buildTriangleMaterialIndices(faceGroups, featureColors, testPalette, 3)).toBeNull();
  });

  it('maps face groups to correct material indices with two colors', () => {
    const featureColors: FeatureColorConfig = {
      body: 'slot1',
      lip: 'slot2',
      labelTab: 'slot1',
    };

    // 6 triangles: 3 body (BASE), 3 lip (LIP)
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 9, tag: FeatureTag.BASE }, // triangles 0-2
      { start: 9, count: 9, tag: FeatureTag.LIP }, // triangles 3-5
    ];

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, testPalette, 6);

    expect(result).not.toBeNull();
    expect(result!.materials).toHaveLength(2);
    expect(result!.materials[0]).toEqual({ name: 'White', color: '#ffffff' });
    expect(result!.materials[1]).toEqual({ name: 'Blue', color: '#0000ff' });

    // Body triangles → material 0, lip triangles → material 1
    expect(result!.triangleMaterialIndices).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it('maps face groups with three distinct colors', () => {
    const featureColors: FeatureColorConfig = {
      body: 'slot1',
      lip: 'slot2',
      labelTab: 'slot3',
    };

    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 6, tag: FeatureTag.BASE }, // triangles 0-1
      { start: 6, count: 3, tag: FeatureTag.LIP }, // triangle 2
      { start: 9, count: 3, tag: FeatureTag.LABEL_TAB }, // triangle 3
    ];

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, testPalette, 4);

    expect(result).not.toBeNull();
    expect(result!.materials).toHaveLength(3);
    expect(result!.triangleMaterialIndices).toEqual([0, 0, 1, 2]);
  });

  it('maps untagged triangles to body material', () => {
    const featureColors: FeatureColorConfig = {
      body: 'slot1',
      lip: 'slot2',
      labelTab: 'slot1',
    };

    // Only one face group covering triangle 0, but mesh has 3 triangles
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 3, tag: FeatureTag.LIP }];

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, testPalette, 3);

    expect(result).not.toBeNull();
    // Triangle 0 = lip (material 1), triangles 1-2 = untagged → body default (material 0)
    expect(result!.triangleMaterialIndices).toEqual([1, 0, 0]);
  });

  it('handles non-contiguous face groups for the same zone', () => {
    const featureColors: FeatureColorConfig = {
      body: 'slot1',
      lip: 'slot2',
      labelTab: 'slot1',
    };

    // Two separate body groups with a lip group in between
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 3, tag: FeatureTag.BASE }, // triangle 0
      { start: 3, count: 3, tag: FeatureTag.LIP }, // triangle 1
      { start: 6, count: 3, tag: FeatureTag.SCOOP }, // triangle 2 (body zone)
    ];

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, testPalette, 3);

    expect(result).not.toBeNull();
    expect(result!.triangleMaterialIndices).toEqual([0, 1, 0]);
  });
});
