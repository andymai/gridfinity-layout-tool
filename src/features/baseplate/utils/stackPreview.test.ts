import { describe, it, expect } from 'vitest';
import type { StackPrintParams } from '@/core/types';
import { mm } from '@/core/types';
import { buildStackPreviewMeshes } from './stackPreview';
import { meshBounds, type StackMeshArrays } from './stackPrint';

/** A 10mm-tall plate footprint 0..20 x 0..30 as an indexed mesh (2 triangles). */
function plate(): StackMeshArrays {
  return {
    vertices: new Float32Array([0, 0, 0, 20, 0, 0, 0, 30, 0, 0, 0, 10, 20, 0, 10, 0, 30, 10]),
    normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
    edgeVertices: new Float32Array(0),
  };
}

const airGap: StackPrintParams = { enabled: true, sets: 1, gapMm: mm(0.2), mode: 'airGap' };
const sheet: StackPrintParams = {
  enabled: true,
  sets: 1,
  gapMm: mm(0.2),
  mode: 'sacrificialSheet',
};

describe('buildStackPreviewMeshes', () => {
  it('returns empty geometry for no towers', () => {
    const out = buildStackPreviewMeshes([], airGap, 0);
    expect(out.plates.vertices.length).toBe(0);
    expect(out.sheets).toBeNull();
    expect(out.heightMm).toBe(0);
  });

  it('stacks a single tower of N copies (air gap, no sheets)', () => {
    const out = buildStackPreviewMeshes([{ mesh: plate(), copies: 3 }], airGap, 0);
    // 2 triangles * 3 copies = 6 triangles -> 6 indices * 3 = 18 index entries
    expect(out.plates.indices.length).toBe(18);
    expect(out.sheets).toBeNull();
    // height = 2*(10+0.2)+10 = 30.4
    expect(out.heightMm).toBeCloseTo(30.4, 4);
    const b = meshBounds(out.plates.vertices);
    expect(b.minZ).toBeCloseTo(0, 4);
    expect(b.maxZ).toBeCloseTo(30.4, 4);
  });

  it('adds the separation slider distance to the stride', () => {
    const base = buildStackPreviewMeshes([{ mesh: plate(), copies: 2 }], airGap, 0);
    const exploded = buildStackPreviewMeshes([{ mesh: plate(), copies: 2 }], airGap, 20);
    expect(exploded.heightMm).toBeGreaterThan(base.heightMm + 19);
  });

  it('emits accent sheets between copies in sacrificial mode', () => {
    const out = buildStackPreviewMeshes([{ mesh: plate(), copies: 3 }], sheet, 0);
    expect(out.sheets).not.toBeNull();
    // 2 sheets * 12 triangles = 24 triangles -> 72 index entries
    expect(out.sheets!.indices.length).toBe(72);
  });

  it('lays multiple towers in a centered grid', () => {
    const out = buildStackPreviewMeshes(
      [
        { mesh: plate(), copies: 1 },
        { mesh: plate(), copies: 1 },
      ],
      airGap,
      0
    );
    const b = meshBounds(out.plates.vertices);
    // 2 towers -> 2 cols x 1 row. cellW = 20 + 12 = 32; centered cols at ±16,
    // each 20mm-wide tower spans ±10 -> overall X bounds [-26, 26], width 2*32=64.
    expect(b.minX).toBeCloseTo(-26, 4);
    expect(b.maxX).toBeCloseTo(26, 4);
    expect(out.widthMm).toBeCloseTo(64, 4);
  });
});
