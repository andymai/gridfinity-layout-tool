import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import { buildTriangleMaterialIndices } from './materialMapping';
import { ZONE_ORDER, makeUniformLipCells } from '../types/featureColors';
import type { ColorZone, FeatureColorConfig, LipColorConfig } from '../types/featureColors';
import type { FaceGroupData } from '@/shared/types/generation';

const SINGLE = '#d4d8dc';
const allZones: ReadonlySet<ColorZone> = new Set(ZONE_ORDER);

function lip(
  cells: Record<string, string> = {},
  corners: 1 | 2 | 4 = 1,
  bands: 1 | 2 | 4 = 1
): LipColorConfig {
  return { corners, bands, cells: { ...makeUniformLipCells(SINGLE), ...cells } };
}

function colors(overrides: Partial<FeatureColorConfig> = {}): FeatureColorConfig {
  return {
    enabled: false,
    body: SINGLE,
    lip: lip(),
    labelTab: SINGLE,
    base: SINGLE,
    scoop: SINGLE,
    dividers: SINGLE,
    text: SINGLE,
    lid: SINGLE,
    ...overrides,
  };
}

/** Tiny (non-degenerate) triangle centered at (x, y, 0). */
function tri(x: number, y: number): number[] {
  return [x - 0.1, y - 0.1, 0, x + 0.1, y - 0.1, 0, x, y + 0.1, 0];
}

describe('buildTriangleMaterialIndices', () => {
  it('returns null when all zones use the same color', () => {
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 9, tag: FeatureTag.BASE }];
    const vertices = new Float32Array([...tri(0, 0), ...tri(1, 0), ...tri(0, 1)]);
    expect(buildTriangleMaterialIndices(faceGroups, colors(), 3, vertices, allZones)).toBeNull();
  });

  it('maps non-lip face groups to their zone color (no geometry override)', () => {
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
    expect(result?.vertices).toBeUndefined();
    expect(result?.config.materials.map((m) => m.color)).toEqual([SINGLE, '#00ff00']);
    expect(result?.config.triangleMaterialIndices).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it('splits a 4-corner lip and returns replacement geometry + normals', () => {
    const featureColors = colors({
      lip: lip(
        {
          'lip:frontLeft:0': '#ff0000',
          'lip:frontRight:0': '#00ff00',
          'lip:backRight:0': '#0000ff',
          'lip:backLeft:0': '#ffffff',
        },
        4,
        1
      ),
    });
    const vertices = new Float32Array([
      ...tri(10, 10), // front-left
      ...tri(90, 10), // front-right
      ...tri(90, 90), // back-right
      ...tri(10, 90), // back-left
    ]);
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 12, tag: FeatureTag.LIP }];

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, 4, vertices, allZones);
    expect(result).not.toBeNull();
    // Split path → replacement geometry with matching-length normals.
    expect(result?.vertices).toBeInstanceOf(Float32Array);
    expect(result?.normals?.length).toBe(result?.vertices?.length);
    const idxFor = (hex: string) => result!.config.materials.findIndex((m) => m.color === hex);
    expect(result?.config.triangleMaterialIndices).toEqual([
      idxFor('#ff0000'),
      idxFor('#00ff00'),
      idxFor('#0000ff'),
      idxFor('#ffffff'),
    ]);
  });

  it('maps SOCKET → base, SCOOP → scoop, DIVIDER → dividers', () => {
    const featureColors = colors({ base: '#aa0000', scoop: '#00aa00', dividers: '#0000aa' });
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 3, tag: FeatureTag.SOCKET },
      { start: 3, count: 3, tag: FeatureTag.SCOOP },
      { start: 6, count: 3, tag: FeatureTag.DIVIDER },
    ];
    const vertices = new Float32Array([...tri(0, 0), ...tri(1, 1), ...tri(2, 2)]);

    const result = buildTriangleMaterialIndices(faceGroups, featureColors, 3, vertices, allZones);
    expect(result).not.toBeNull();
    const idxFor = (hex: string) => result!.config.materials.findIndex((m) => m.color === hex);
    expect(result?.config.triangleMaterialIndices).toEqual([
      idxFor('#aa0000'),
      idxFor('#00aa00'),
      idxFor('#0000aa'),
    ]);
  });
});
