import { describe, it, expect } from 'vitest';
import { creaseEdges } from './creaseEdges';

/** Count line segments (each segment = 2 points = 6 floats). */
const segCount = (out: Float32Array): number => out.length / 6;

describe('creaseEdges', () => {
  it('returns empty for empty input', () => {
    const out = creaseEdges({ vertices: new Float32Array(0), triangles: new Uint32Array(0) });
    expect(out.length).toBe(0);
  });

  it('emits only boundary edges for a flat (coplanar) quad', () => {
    // Two coplanar triangles sharing the diagonal. The diagonal is coplanar
    // (no crease) → not emitted; the 4 outer edges are naked boundaries.
    const vertices = new Float32Array([
      0,
      0,
      0, // 0
      1,
      0,
      0, // 1
      1,
      1,
      0, // 2
      0,
      1,
      0, // 3
    ]);
    const triangles = new Uint32Array([0, 1, 2, 0, 2, 3]);
    const out = creaseEdges({ vertices, triangles });
    expect(segCount(out)).toBe(4); // 4 boundary edges, shared diagonal suppressed
  });

  it('emits the ridge of a 90° fold (above threshold)', () => {
    // Two triangles meeting at a 90° fold along the shared edge (0,0,0)-(1,0,0).
    const vertices = new Float32Array([
      0,
      0,
      0, // 0  shared
      1,
      0,
      0, // 1  shared
      0,
      1,
      0, // 2  triangle A (in XY plane)
      0,
      0,
      1, // 3  triangle B (in XZ plane)
    ]);
    const triangles = new Uint32Array([0, 1, 2, 0, 1, 3]);
    const out = creaseEdges({ vertices, triangles });
    // 1 ridge crease + 4 naked boundary edges = 5 segments.
    expect(segCount(out)).toBe(5);
  });

  it('does NOT emit a shared edge folded below the threshold', () => {
    // ~15° fold (< 35°): represents a curve facet that must stay smooth.
    const angle = (15 * Math.PI) / 180;
    const vertices = new Float32Array([
      0,
      0,
      0, // 0 shared
      1,
      0,
      0, // 1 shared
      0,
      1,
      0, // 2 triangle A (flat)
      0,
      Math.cos(angle),
      Math.sin(angle), // 3 triangle B tilted 15°
    ]);
    const triangles = new Uint32Array([0, 1, 2, 0, 1, 3]);
    const out = creaseEdges({ vertices, triangles });
    // Only the 4 boundary edges; the sub-threshold fold is suppressed.
    expect(segCount(out)).toBe(4);
  });

  it('detects creases across SPLIT (duplicated-position) vertices', () => {
    // Manifold may give each triangle its own vertex copies. The shared 90°
    // ridge must still be found by position-welding, not index identity.
    const vertices = new Float32Array([
      // Triangle A: indices 0,1,2
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      // Triangle B: indices 3,4,5 — re-uses positions of 0 and 1 as 3 and 4
      0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
    const triangles = new Uint32Array([0, 1, 2, 3, 4, 5]);
    const out = creaseEdges({ vertices, triangles });
    // After welding, the (0,0,0)-(1,0,0) edge is shared at 90° → 1 ridge,
    // plus 4 boundary edges = 5.
    expect(segCount(out)).toBe(5);
  });

  it('produces finite coordinates only', () => {
    const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const triangles = new Uint32Array([0, 1, 2, 0, 1, 3]);
    const out = creaseEdges({ vertices, triangles });
    for (const n of out) expect(Number.isFinite(n)).toBe(true);
  });

  it('emits exactly 12 edges for a unit cube', () => {
    // 8 corners, 12 triangles (2 per face). Each true cube edge is shared by
    // two perpendicular faces (90°) → 12 creases; face diagonals are coplanar.
    const v = new Float32Array([
      0,
      0,
      0, // 0
      1,
      0,
      0, // 1
      1,
      1,
      0, // 2
      0,
      1,
      0, // 3
      0,
      0,
      1, // 4
      1,
      0,
      1, // 5
      1,
      1,
      1, // 6
      0,
      1,
      1, // 7
    ]);
    const t = new Uint32Array([
      0,
      2,
      1,
      0,
      3,
      2, // bottom (z=0)
      4,
      5,
      6,
      4,
      6,
      7, // top (z=1)
      0,
      1,
      5,
      0,
      5,
      4, // front (y=0)
      1,
      2,
      6,
      1,
      6,
      5, // right (x=1)
      2,
      3,
      7,
      2,
      7,
      6, // back (y=1)
      3,
      0,
      4,
      3,
      4,
      7, // left (x=0)
    ]);
    const out = creaseEdges({ vertices: v, triangles: t });
    expect(segCount(out)).toBe(12);
  });
});
