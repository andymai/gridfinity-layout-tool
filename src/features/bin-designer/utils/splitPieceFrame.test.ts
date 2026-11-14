import { describe, it, expect } from 'vitest';
import type { SplitPieceMeshEntry } from '../types';
import { splitPieceCenterMm, splitPieceInBinFrame } from './splitPieceFrame';

function entry(overrides: Partial<SplitPieceMeshEntry> = {}): SplitPieceMeshEntry {
  return {
    label: 'A1',
    col: 1,
    row: 1,
    widthUnits: 2,
    depthUnits: 3,
    offsetX: 0,
    offsetY: 0,
    mesh: {
      vertices: new Float32Array([1, 2, 3, -1, -2, 5]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 0]),
      edgeVertices: new Float32Array([0, 0, 0]),
    },
    ...overrides,
  };
}

// 4x6 bin on a 42mm grid: the outer footprint is 167.5 x 251.5mm.
const BIN = { width: 4, depth: 6, gridUnitMm: 42 };

describe('splitPieceCenterMm', () => {
  it('places the front-left piece left of and in front of the bin center', () => {
    const c = splitPieceCenterMm(entry(), BIN);
    expect(c.x).toBeCloseTo(42 - 83.75, 6);
    expect(c.y).toBeCloseTo(63 - 125.75, 6);
  });

  it('reads the Y pitch for a non-square grid', () => {
    const c = splitPieceCenterMm(entry({ offsetY: 3 }), { ...BIN, gridUnitMmY: 21 });
    // Footprint depth is 6 x 21 - 0.5 = 125.5; the piece spans Y 63..126.
    expect(c.y).toBeCloseTo(63 + 31.5 - 62.75, 6);
  });
});

describe('splitPieceInBinFrame', () => {
  it('shifts vertices and edges by the piece center and keeps Z', () => {
    const e = entry();
    const { x, y } = splitPieceCenterMm(e, BIN);
    const m = splitPieceInBinFrame(e, BIN);
    expect(Array.from(m.vertices ?? [])).toEqual(
      [1 + x, 2 + y, 3, -1 + x, -2 + y, 5].map((v) => Math.fround(v))
    );
    expect(Array.from(m.edgeVertices ?? [])).toEqual([x, y, 0].map((v) => Math.fround(v)));
    expect(m.indices).toBe(e.mesh.indices);
    expect(m.normals).toBe(e.mesh.normals);
  });

  it('leaves the stored entry untouched', () => {
    const e = entry();
    splitPieceInBinFrame(e, BIN);
    expect(Array.from(e.mesh.vertices ?? [])).toEqual([1, 2, 3, -1, -2, 5]);
  });

  it('passes face groups through and reports none as null', () => {
    const groups = [{ start: 0, count: 3, tag: 4 }];
    expect(
      splitPieceInBinFrame(entry({ mesh: { ...entry().mesh, faceGroups: groups } }), BIN).faceGroups
    ).toBe(groups);
    expect(splitPieceInBinFrame(entry(), BIN).faceGroups).toBeNull();
  });
});
