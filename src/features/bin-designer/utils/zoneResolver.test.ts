import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import { resolveTriangleZone } from './zoneResolver';

function makeIndexedTriangle(
  x0: number,
  y0: number
): {
  vertices: Float32Array;
  indices: Uint32Array;
} {
  // Single triangle, centroid at (x0, y0)
  const vertices = new Float32Array([x0 - 1, y0 - 1, 0, x0 + 1, y0 - 1, 0, x0, y0 + 1, 0]);
  const indices = new Uint32Array([0, 1, 2]);
  return { vertices, indices };
}

describe('resolveTriangleZone', () => {
  it('returns body when triangle is outside every face group', () => {
    const { vertices, indices } = makeIndexedTriangle(0, 0);
    expect(resolveTriangleZone(0, [], vertices, indices)).toBe('body');
  });

  it('maps non-LIP feature tags through featureTagToColorZone', () => {
    const cases: ReadonlyArray<{ tag: number; expected: string }> = [
      { tag: FeatureTag.SCOOP, expected: 'scoop' },
      { tag: FeatureTag.DIVIDER, expected: 'dividers' },
      { tag: FeatureTag.LABEL_TAB, expected: 'labelTab' },
      { tag: FeatureTag.SOCKET, expected: 'base' },
      { tag: FeatureTag.BASE, expected: 'body' },
      { tag: FeatureTag.UNKNOWN, expected: 'body' },
    ];

    for (const { tag, expected } of cases) {
      const { vertices, indices } = makeIndexedTriangle(0, 0);
      const groups: FaceGroupData[] = [{ start: 0, count: 3, tag }];
      expect(resolveTriangleZone(0, groups, vertices, indices)).toBe(expected);
    }
  });

  it('classifies LIP triangles into the four corners by centroid quadrant', () => {
    // Four lip triangles at the four quadrants of a centered bbox.
    const cx = 10;
    const cy = 10;
    const offsets: ReadonlyArray<{ dx: number; dy: number; expected: string }> = [
      { dx: -3, dy: -3, expected: 'lip:frontLeft' },
      { dx: 3, dy: -3, expected: 'lip:frontRight' },
      { dx: 3, dy: 3, expected: 'lip:backRight' },
      { dx: -3, dy: 3, expected: 'lip:backLeft' },
    ];

    const allVerts: number[] = [];
    const allIndices: number[] = [];
    const groups: FaceGroupData[] = [];
    let triCursor = 0;
    for (const { dx, dy } of offsets) {
      // Tight triangle so its centroid stays well inside one quadrant
      allVerts.push(cx + dx - 0.1, cy + dy - 0.1, 0);
      allVerts.push(cx + dx + 0.1, cy + dy - 0.1, 0);
      allVerts.push(cx + dx, cy + dy + 0.1, 0);
      const base = triCursor * 3;
      allIndices.push(base, base + 1, base + 2);
      groups.push({ start: triCursor * 3, count: 3, tag: FeatureTag.LIP });
      triCursor += 1;
    }

    const vertices = new Float32Array(allVerts);
    const indices = new Uint32Array(allIndices);
    offsets.forEach(({ expected }, i) => {
      expect(resolveTriangleZone(i, groups, vertices, indices)).toBe(expected);
    });
  });

  it('falls back to body for LIP when no lip bbox can be computed', () => {
    // A LIP group whose triangle has degenerate centroid count? Impossible
    // by construction here — instead, simulate a hit on a triangle in a
    // group OUTSIDE the face-group list (defensive path).
    const { vertices, indices } = makeIndexedTriangle(0, 0);
    const groups: FaceGroupData[] = [{ start: 6, count: 3, tag: FeatureTag.LIP }];
    // Hit triangle 0 → index offset 0, outside the group at [6, 9)
    expect(resolveTriangleZone(0, groups, vertices, indices)).toBe('body');
  });
});
