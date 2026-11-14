import { describe, expect, it } from 'vitest';
import { dropCollapsedTriangles } from './collapsedTriangles';

type Corner = readonly [number, number, number];

function stl(triangles: readonly (readonly [Corner, Corner, Corner])[]): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triangles.length, true);
  triangles.forEach((corners, t) => {
    corners.forEach((corner, k) => {
      corner.forEach((value, axis) => {
        view.setFloat32(84 + t * 50 + 12 + k * 12 + axis * 4, value, true);
      });
    });
  });
  return buffer;
}

const real = (z: number): readonly [Corner, Corner, Corner] => [
  [0, 0, z],
  [1, 0, z],
  [0, 1, z],
];
const collapsed: readonly [Corner, Corner, Corner] = [
  [2, 2, 2],
  [2, 2, 2],
  [3, 2, 2],
];

describe('dropCollapsedTriangles', () => {
  it('returns an STL with nothing to drop untouched', () => {
    const input = stl([real(0), real(1)]);
    const result = dropCollapsedTriangles(input);
    expect(result.data).toBe(input);
    expect(result.dropped).toBe(0);
  });

  it('drops a triangle whose corners coincide and keeps the rest in order', () => {
    const result = dropCollapsedTriangles(stl([real(0), collapsed, real(1)]));
    const view = new DataView(result.data);
    expect(result.dropped).toBe(1);
    expect(view.getUint32(80, true)).toBe(2);
    expect(result.data.byteLength).toBe(84 + 2 * 50);
    expect(view.getFloat32(84 + 50 + 12 + 8, true)).toBe(1);
  });

  it('shifts face groups so colours stay on their own faces', () => {
    const groups = [
      { start: 0, count: 6, tag: 1 },
      { start: 6, count: 6, tag: 2 },
    ];
    const result = dropCollapsedTriangles(stl([real(0), collapsed, real(1), real(2)]), groups);
    expect(result.faceGroups).toEqual([
      { start: 0, count: 3, tag: 1 },
      { start: 3, count: 6, tag: 2 },
    ]);
  });

  it('leaves a mesh of nothing but collapsed triangles as it was, rather than empty', () => {
    const input = stl([collapsed, collapsed]);
    const result = dropCollapsedTriangles(input);
    expect(result.data).toBe(input);
    expect(result.dropped).toBe(0);
  });

  it('drops a face group left with no triangles', () => {
    const groups = [
      { start: 0, count: 3, tag: 1 },
      { start: 3, count: 3, tag: 2 },
    ];
    const result = dropCollapsedTriangles(stl([real(0), collapsed]), groups);
    expect(result.faceGroups).toEqual([{ start: 0, count: 3, tag: 1 }]);
  });
});
