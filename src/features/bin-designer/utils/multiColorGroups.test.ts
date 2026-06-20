import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import {
  buildHitTestZones,
  buildMultiColorGroups,
  hoveredMaterialIndices,
} from './multiColorGroups';
import { LIP_CELL_ZONES, ZONE_ORDER, makeUniformLipCells, zoneIndex } from '../types/featureColors';
import type { ColorZone, FeatureColorConfig, LipColorConfig } from '../types/featureColors';
import type { FaceGroupData } from '@/shared/types/generation';

const SINGLE = '#d4d8dc';

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

const allZones: ReadonlySet<ColorZone> = new Set(ZONE_ORDER);

/** Indexed mesh where triangle `i` is a tiny triangle centered at (x[i], y[i], 0). */
function meshFromCentroids(points: { x: number; y: number }[]) {
  const vertices = new Float32Array(points.length * 9);
  const indices = new Uint32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    const { x, y } = points[i];
    // Tiny triangle so it never straddles a seam plane.
    const tri = [x - 0.1, y - 0.1, 0, x + 0.1, y - 0.1, 0, x, y + 0.1, 0];
    for (let v = 0; v < 9; v++) vertices[i * 9 + v] = tri[v];
    for (let v = 0; v < 3; v++) indices[i * 3 + v] = i * 3 + v;
  }
  return { vertices, indices };
}

describe('buildMultiColorGroups', () => {
  it('returns null when all active zones share the body color', () => {
    const { vertices, indices } = meshFromCentroids([{ x: 0, y: 0 }]);
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 3, tag: FeatureTag.BASE }];
    expect(buildMultiColorGroups(faceGroups, vertices, indices, colors(), allZones)).toBeNull();
  });

  it('places body at material index 0 and one slot per ColorZone (no hex dedup)', () => {
    const { vertices, indices } = meshFromCentroids([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    const c = colors({ labelTab: '#aabbcc' });
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 3, tag: FeatureTag.BASE },
      { start: 3, count: 3, tag: FeatureTag.LABEL_TAB },
    ];
    const result = buildMultiColorGroups(faceGroups, vertices, indices, c, allZones);
    expect(result).not.toBeNull();
    expect(result?.zoneColors).toHaveLength(ZONE_ORDER.length);
    expect(result?.zoneColors[zoneIndex('labelTab')]).toBe('#aabbcc');
    expect(result?.zoneColors[zoneIndex('body')]).toBe(SINGLE);
    // Uniform lip (1×1) → no re-tessellation.
    expect(result?.meshOverride).toBeNull();
  });

  it('splits a 4-corner LIP face group into four cell runs', () => {
    const { vertices, indices } = meshFromCentroids([
      { x: 10, y: 10 }, // front-left
      { x: 90, y: 10 }, // front-right
      { x: 90, y: 90 }, // back-right
      { x: 10, y: 90 }, // back-left
    ]);
    const c = colors({
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
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 12, tag: FeatureTag.LIP }];
    const result = buildMultiColorGroups(faceGroups, vertices, indices, c, allZones);
    expect(result).not.toBeNull();
    // Non-trivial grid re-tessellates the lip → flat geometry override.
    expect(result?.meshOverride).not.toBeNull();
    expect(result?.triZones).toEqual([
      'lip:frontLeft:0',
      'lip:frontRight:0',
      'lip:backRight:0',
      'lip:backLeft:0',
    ]);
    expect(result?.groups).toHaveLength(4);
    expect(result?.groups[0]).toMatchObject({
      start: 0,
      count: 3,
      materialIndex: zoneIndex('lip:frontLeft:0'),
    });
  });

  it('coalesces consecutive same-cell LIP triangles into one group', () => {
    const { vertices, indices } = meshFromCentroids([
      { x: 10, y: 10 },
      { x: 11, y: 11 },
      { x: 12, y: 12 },
      { x: 90, y: 90 },
      { x: 91, y: 91 },
    ]);
    const c = colors({
      lip: lip({ 'lip:frontLeft:0': '#ff0000', 'lip:backRight:0': '#0000ff' }, 4, 1),
    });
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 15, tag: FeatureTag.LIP }];
    const result = buildMultiColorGroups(faceGroups, vertices, indices, c, allZones);
    expect(result?.groups).toHaveLength(2);
    expect(result?.groups[0]).toMatchObject({
      start: 0,
      count: 9,
      materialIndex: zoneIndex('lip:frontLeft:0'),
    });
    expect(result?.groups[1]).toMatchObject({
      start: 9,
      count: 6,
      materialIndex: zoneIndex('lip:backRight:0'),
    });
  });

  it('classifies a uniform lip in place (no override) and fills gaps with body', () => {
    // 6 triangles, only a LABEL_TAB group at index 9 → first 3 fall to body.
    const { vertices, indices } = meshFromCentroids([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 1 },
    ]);
    const c = colors({ labelTab: '#aabbcc' });
    const faceGroups: FaceGroupData[] = [{ start: 9, count: 9, tag: FeatureTag.LABEL_TAB }];
    const result = buildMultiColorGroups(faceGroups, vertices, indices, c, allZones);
    expect(result?.meshOverride).toBeNull();
    expect(result?.groups[0]).toMatchObject({
      start: 0,
      count: 9,
      materialIndex: zoneIndex('body'),
    });
    expect(result?.groups[1]).toMatchObject({
      start: 9,
      count: 9,
      materialIndex: zoneIndex('labelTab'),
    });
  });
});

describe('buildHitTestZones', () => {
  it('resolves a zone per original triangle even when single-color', () => {
    // buildMultiColorGroups returns null here (all one color), but the canvas
    // eyedropper/swap still needs to map a click to a zone to start editing.
    const { vertices, indices } = meshFromCentroids([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 3, tag: FeatureTag.SCOOP },
      { start: 3, count: 3, tag: FeatureTag.LIP },
    ];
    expect(buildMultiColorGroups(faceGroups, vertices, indices, colors(), allZones)).toBeNull();

    const zones = buildHitTestZones(faceGroups, vertices, indices, colors());
    expect(zones).toHaveLength(2);
    expect(zones[0]).toBe('scoop');
    expect(zones[1]).toBe('lip:frontLeft:0');
  });
});

describe('hoveredMaterialIndices', () => {
  it('returns the empty set when nothing is hovered', () => {
    expect(hoveredMaterialIndices(null).size).toBe(0);
  });

  it('lights only the hovered zone slot', () => {
    expect([...hoveredMaterialIndices('scoop')]).toEqual([zoneIndex('scoop')]);
  });

  it('lights all lip cell slots when the lip header is hovered', () => {
    const result = hoveredMaterialIndices('lip');
    expect(result.size).toBe(LIP_CELL_ZONES.length);
    for (const cell of LIP_CELL_ZONES) expect(result.has(zoneIndex(cell))).toBe(true);
  });

  it('targets the hovered zone slot even if its color equals body (no bleed)', () => {
    expect([...hoveredMaterialIndices('dividers')]).toEqual([zoneIndex('dividers')]);
    expect(hoveredMaterialIndices('dividers').has(zoneIndex('body'))).toBe(false);
  });
});
