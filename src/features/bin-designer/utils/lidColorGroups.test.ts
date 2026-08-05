import { describe, it, expect } from 'vitest';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { makeUniformLipCells } from '@/features/bin-designer/types/featureColors';
import { FeatureTag } from '@/shared/types/generation';
import { buildLidColorGroups } from './lidColorGroups';

/** One flat triangle per XY quadrant, so each centroid is unambiguous. */
const QUADS: [number, number, number][] = [
  [-10, -10, 0],
  [10, -10, 1],
  [10, 10, 2],
  [-10, 10, 3],
];

const vertices = new Float32Array(QUADS.length * 9);
QUADS.forEach(([x, y, z], t) => {
  for (let c = 0; c < 3; c++) {
    vertices[t * 9 + c * 3] = x;
    vertices[t * 9 + c * 3 + 1] = y;
    vertices[t * 9 + c * 3 + 2] = z;
  }
});
const indices = new Uint32Array(QUADS.length * 3).map((_, i) => i);
const lipGroups = [{ start: 0, count: QUADS.length * 3, tag: FeatureTag.LID_LIP }];

function colors(overrides: Record<string, string>) {
  const cells = makeUniformLipCells('#111111');
  Object.assign(cells, overrides);
  return {
    ...DEFAULT_FEATURE_COLOR_CONFIG,
    enabled: true,
    lid: '#111111',
    lidLip: { corners: 4 as const, bands: 1 as const, cells },
  };
}

describe('buildLidColorGroups', () => {
  it('gives each quadrant its own material slot', () => {
    const result = buildLidColorGroups(
      lipGroups,
      vertices,
      indices,
      colors({
        'lip:frontLeft:0': '#ff0000',
        'lip:frontRight:0': '#00ff00',
        'lip:backRight:0': '#0000ff',
        'lip:backLeft:0': '#ffff00',
      })
    );
    expect(result).not.toBeNull();
    // Five slots, not four: index 0 is always the lid colour (the shell's), and
    // the four quadrants follow. Here every triangle happens to be lip, so slot
    // 0 goes unused — harmless, and it keeps the mixed shell+lip case correct.
    expect(result?.colors).toHaveLength(5);
    expect(result?.colors[0]).toBe('#111111');
    expect(new Set(result?.groups.map((g) => g.materialIndex)).size).toBe(4);
  });

  // Same fast path the caller relies on: nothing to show means keep the single
  // material rather than allocating a group per triangle.
  it('returns null when every cell already matches the lid colour', () => {
    expect(buildLidColorGroups(lipGroups, vertices, indices, colors({}))).toBeNull();
  });

  it('returns null when no grid is stored', () => {
    const noGrid = { ...DEFAULT_FEATURE_COLOR_CONFIG, enabled: true, lid: '#111111' };
    expect(buildLidColorGroups(lipGroups, vertices, indices, noGrid)).toBeNull();
  });

  // A flat-topped lid builds no LID_LIP geometry, so there is nothing to
  // classify against and the lid must stay uniform rather than mispaint.
  it('returns null when the lid carries no lip geometry', () => {
    const bodyOnly = [{ start: 0, count: QUADS.length * 3, tag: FeatureTag.LID_BODY }];
    expect(
      buildLidColorGroups(bodyOnly, vertices, indices, colors({ 'lip:frontLeft:0': '#ff0000' }))
    ).toBeNull();
  });

  it('covers every triangle exactly once', () => {
    const result = buildLidColorGroups(
      lipGroups,
      vertices,
      indices,
      colors({ 'lip:frontLeft:0': '#ff0000' })
    );
    const covered = result?.groups.reduce((n, g) => n + g.count, 0);
    expect(covered).toBe(indices.length);
  });
});
