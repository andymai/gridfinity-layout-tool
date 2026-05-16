import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import { buildMultiColorGroups, hoveredMaterialIndices } from './multiColorGroups';
import { LIP_CORNERS, ZONE_ORDER, lipCornerZone, zoneIndex } from '../types/featureColors';
import type { ColorZone, FeatureColorConfig } from '../types/featureColors';
import type { FaceGroupData } from '@/shared/types/generation';

const SINGLE = '#d4d8dc';

function colors(overrides: Partial<FeatureColorConfig> = {}): FeatureColorConfig {
  return {
    body: SINGLE,
    lip: { frontLeft: SINGLE, frontRight: SINGLE, backRight: SINGLE, backLeft: SINGLE },
    labelTab: SINGLE,
    base: SINGLE,
    scoop: SINGLE,
    dividers: SINGLE,
    ...overrides,
  };
}

const allZones: ReadonlySet<ColorZone> = new Set(ZONE_ORDER);

/**
 * Build an indexed mesh where triangle `i` has all three vertices at
 * (x[i], y[i], 0). Centroid = (x[i], y[i], 0). Returns
 * { vertices, indices } in the layout expected by buildMultiColorGroups.
 */
function meshFromCentroids(points: { x: number; y: number }[]) {
  const vertices = new Float32Array(points.length * 9);
  const indices = new Uint32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    const { x, y } = points[i];
    for (let v = 0; v < 3; v++) {
      vertices[i * 9 + v * 3 + 0] = x;
      vertices[i * 9 + v * 3 + 1] = y;
      vertices[i * 9 + v * 3 + 2] = 0;
      indices[i * 3 + v] = i * 3 + v;
    }
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
    // labelTab differs; everything else is body. zoneColors[5] (labelTab in
    // ZONE_ORDER) must hold the labelTab hex even though every other slot
    // holds body's hex — that's the "no dedup" guarantee.
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
  });

  it('splits a single LIP face group into four corner runs (one per quadrant)', () => {
    const { vertices, indices } = meshFromCentroids([
      { x: 10, y: 10 }, // front-left
      { x: 90, y: 10 }, // front-right
      { x: 90, y: 90 }, // back-right
      { x: 10, y: 90 }, // back-left
    ]);
    const c = colors({
      lip: {
        frontLeft: '#ff0000',
        frontRight: '#00ff00',
        backRight: '#0000ff',
        backLeft: '#ffffff',
      },
    });
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 12, tag: FeatureTag.LIP }];
    const result = buildMultiColorGroups(faceGroups, vertices, indices, c, allZones);
    expect(result).not.toBeNull();

    // Four 1-triangle (3-index) groups in centroid order.
    expect(result?.groups).toHaveLength(4);
    expect(result?.groups[0]).toMatchObject({
      start: 0,
      count: 3,
      materialIndex: zoneIndex('lip:frontLeft'),
    });
    expect(result?.groups[3]).toMatchObject({
      start: 9,
      count: 3,
      materialIndex: zoneIndex('lip:backLeft'),
    });
  });

  it('coalesces consecutive same-corner LIP triangles into one group', () => {
    // 5 LIP triangles: front-left × 3, then back-right × 2.
    const { vertices, indices } = meshFromCentroids([
      { x: 10, y: 10 },
      { x: 11, y: 11 },
      { x: 12, y: 12 },
      { x: 90, y: 90 },
      { x: 91, y: 91 },
    ]);
    const c = colors({
      lip: { frontLeft: '#ff0000', frontRight: SINGLE, backRight: '#0000ff', backLeft: SINGLE },
    });
    const faceGroups: FaceGroupData[] = [{ start: 0, count: 15, tag: FeatureTag.LIP }];
    const result = buildMultiColorGroups(faceGroups, vertices, indices, c, allZones);
    expect(result).not.toBeNull();
    expect(result?.groups).toHaveLength(2);
    expect(result?.groups[0]).toMatchObject({
      start: 0,
      count: 9, // 3 triangles × 3 indices
      materialIndex: zoneIndex('lip:frontLeft'),
    });
    expect(result?.groups[1]).toMatchObject({
      start: 9,
      count: 6, // 2 triangles × 3 indices
      materialIndex: zoneIndex('lip:backRight'),
    });
  });

  it('skips zero-count face groups without reading vertex data', () => {
    // A zero-count LIP face group must not classify and must not read the
    // (possibly out-of-range) vertex at fg.start. Provide a real LIP group
    // alongside so lipCenter is non-null and the skip path is exercised.
    const { vertices, indices } = meshFromCentroids([{ x: 10, y: 10 }]);
    const faceGroups: FaceGroupData[] = [
      { start: 0, count: 3, tag: FeatureTag.LIP },
      { start: 9999, count: 0, tag: FeatureTag.LIP }, // bogus offset — must be ignored
    ];
    const c = colors({
      lip: { frontLeft: '#ff0000', frontRight: SINGLE, backRight: SINGLE, backLeft: SINGLE },
    });
    expect(() => buildMultiColorGroups(faceGroups, vertices, indices, c, allZones)).not.toThrow();
  });

  it('fills the gap before a face group with body material', () => {
    // Mesh has 6 triangles (18 indices) but the only face group starts at
    // index 9, leaving indices 0..8 unassigned. They must fall back to body.
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
    expect(result?.groups[0]).toMatchObject({
      start: 0,
      count: 9,
      materialIndex: zoneIndex('body'),
    });
  });
});

describe('hoveredMaterialIndices', () => {
  it('returns the empty set when nothing is hovered', () => {
    expect(hoveredMaterialIndices(null).size).toBe(0);
  });

  it('lights only the hovered zone slot', () => {
    expect([...hoveredMaterialIndices('scoop')]).toEqual([zoneIndex('scoop')]);
  });

  it('lights all four lip-corner slots when the lip header is hovered', () => {
    const result = hoveredMaterialIndices('lip');
    expect(result.size).toBe(4);
    for (const corner of LIP_CORNERS) {
      expect(result.has(zoneIndex(lipCornerZone(corner)))).toBe(true);
    }
  });

  it('targets the hovered zone slot even if its color equals body (no bleed)', () => {
    // The whole point of per-zone material slots: hovering 'dividers' must
    // light only the dividers slot, not body, even when they share a hex.
    expect([...hoveredMaterialIndices('dividers')]).toEqual([zoneIndex('dividers')]);
    expect(hoveredMaterialIndices('dividers').has(zoneIndex('body'))).toBe(false);
  });
});
