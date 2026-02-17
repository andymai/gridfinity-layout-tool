import { describe, it, expect } from 'vitest';
import {
  decomposeCells,
  decomposeHalfCells,
  toIndexedMeshData,
  SIZE,
  CLEARANCE,
  SOCKET_HEIGHT,
  LIP_HEIGHT,
  LIP_TAPER_WIDTH,
} from './generatorTypes';
import type { CellInfo } from './generatorTypes';
import { forEachCell } from './generatorTypes';

describe('decomposeCells', () => {
  it('decomposes 2.0 into [1, 1]', () => {
    expect(decomposeCells(2.0)).toEqual([1, 1]);
  });

  it('decomposes 1.5 into [1, 0.5]', () => {
    expect(decomposeCells(1.5)).toEqual([1, 0.5]);
  });

  it('decomposes 0.5 into [0.5]', () => {
    expect(decomposeCells(0.5)).toEqual([0.5]);
  });

  it('decomposes 3.0 into [1, 1, 1]', () => {
    expect(decomposeCells(3.0)).toEqual([1, 1, 1]);
  });

  it('decomposes 1.0 into [1]', () => {
    expect(decomposeCells(1.0)).toEqual([1]);
  });
});

describe('decomposeHalfCells', () => {
  it('decomposes 2.0 into [0.5, 0.5, 0.5, 0.5]', () => {
    expect(decomposeHalfCells(2.0)).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('decomposes 1.5 into [0.5, 0.5, 0.5]', () => {
    expect(decomposeHalfCells(1.5)).toEqual([0.5, 0.5, 0.5]);
  });

  it('decomposes 0.5 into [0.5]', () => {
    expect(decomposeHalfCells(0.5)).toEqual([0.5]);
  });

  it('decomposes 1.0 into [0.5, 0.5]', () => {
    expect(decomposeHalfCells(1.0)).toEqual([0.5, 0.5]);
  });
});

describe('forEachCell', () => {
  it('iterates over a 2x2 grid with 4 full cells', () => {
    const cells: CellInfo[] = [];
    forEachCell(2, 2, (cell) => cells.push(cell));

    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(cell.widthUnits).toBe(1);
      expect(cell.depthUnits).toBe(1);
    }
  });

  it('iterates over a 1.5x1 grid with 2 cells (1 full + 1 half)', () => {
    const cells: CellInfo[] = [];
    forEachCell(1.5, 1, (cell) => cells.push(cell));

    expect(cells).toHaveLength(2);
    expect(cells[0].widthUnits).toBe(1);
    expect(cells[1].widthUnits).toBe(0.5);
  });

  it('iterates over a 1x1 grid in half-sockets mode with 4 cells', () => {
    const cells: CellInfo[] = [];
    forEachCell(1, 1, (cell) => cells.push(cell), true);

    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(cell.widthUnits).toBe(0.5);
      expect(cell.depthUnits).toBe(0.5);
    }
  });

  it('computes cell centers relative to bin center', () => {
    const cells: CellInfo[] = [];
    forEachCell(2, 1, (cell) => cells.push(cell));

    // 2x1 grid: two full cells side by side
    // Total width = 2 * 42 = 84mm, each cell center offset from bin center
    expect(cells).toHaveLength(2);
    expect(cells[0].centerX).toBe(-SIZE / 2);
    expect(cells[1].centerX).toBe(SIZE / 2);
    expect(cells[0].centerY).toBe(0);
    expect(cells[1].centerY).toBe(0);
  });

  it('handles 0.5x0.5 grid with single half-cell', () => {
    const cells: CellInfo[] = [];
    forEachCell(0.5, 0.5, (cell) => cells.push(cell));

    expect(cells).toHaveLength(1);
    expect(cells[0].widthUnits).toBe(0.5);
    expect(cells[0].depthUnits).toBe(0.5);
    expect(cells[0].centerX).toBe(0);
    expect(cells[0].centerY).toBe(0);
  });
});

describe('toIndexedMeshData', () => {
  it('converts mesh data to MeshData format', () => {
    const meshInput = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      triangles: new Uint32Array([0, 1, 2]),
    };

    const result = toIndexedMeshData(meshInput);

    expect(result.vertices).toEqual(meshInput.vertices);
    expect(result.normals).toEqual(meshInput.normals);
    expect(result.indices).toEqual(meshInput.triangles);
    expect(result.triangleCount).toBe(1);
  });

  it('skips normals when requested', () => {
    const meshInput = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      triangles: new Uint32Array([0, 1, 2]),
    };

    const result = toIndexedMeshData(meshInput, true);

    expect(result.normals.length).toBe(0);
    expect(result.vertices.length).toBe(9);
  });

  it('reuses Float32Array inputs without copying', () => {
    const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const triangles = new Uint32Array([0, 1, 2]);

    const result = toIndexedMeshData({ vertices, normals, triangles });

    expect(result.vertices).toBe(vertices);
    expect(result.normals).toBe(normals);
    expect(result.indices).toBe(triangles);
  });

  it('copies plain arrays to typed arrays', () => {
    const meshInput = {
      vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      triangles: [0, 1, 2],
    };

    const result = toIndexedMeshData(meshInput);

    expect(result.vertices).toBeInstanceOf(Float32Array);
    expect(result.normals).toBeInstanceOf(Float32Array);
    expect(result.indices).toBeInstanceOf(Uint32Array);
    expect(result.triangleCount).toBe(1);
  });

  it('returns empty edgeVertices when none provided', () => {
    const meshInput = {
      vertices: new Float32Array([0, 0, 0]),
      normals: new Float32Array([0, 0, 1]),
      triangles: new Uint32Array([0]),
    };

    const result = toIndexedMeshData(meshInput);
    expect(result.edgeVertices).toBeInstanceOf(Float32Array);
    expect(result.edgeVertices.length).toBe(0);
  });

  it('passes through Float32Array edgeVertices without copying', () => {
    const meshInput = {
      vertices: new Float32Array([0, 0, 0]),
      normals: new Float32Array([0, 0, 1]),
      triangles: new Uint32Array([0]),
    };
    const edges = new Float32Array([0, 0, 0, 1, 1, 1]);

    const result = toIndexedMeshData(meshInput, false, edges);
    expect(result.edgeVertices).toBe(edges);
  });

  it('converts plain array edgeVertices to Float32Array', () => {
    const meshInput = {
      vertices: new Float32Array([0, 0, 0]),
      normals: new Float32Array([0, 0, 1]),
      triangles: new Uint32Array([0]),
    };

    const result = toIndexedMeshData(meshInput, false, [0, 0, 0, 1, 1, 1]);
    expect(result.edgeVertices).toBeInstanceOf(Float32Array);
    expect(result.edgeVertices.length).toBe(6);
  });
});

describe('toIndexedMeshData faceGroups', () => {
  it('passes through faceGroups mapped via originToTag', () => {
    const meshResult = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      triangles: new Uint32Array([0, 1, 2]),
      faceGroups: [{ start: 0, count: 3, faceId: 1, origin: 42 }],
    };
    const originToTag = new Map([[42, 2]]); // origin 42 → SCOOP (2)
    const result = toIndexedMeshData(meshResult, false, undefined, originToTag);
    expect(result.faceGroups).toEqual([{ start: 0, count: 3, tag: 2 }]);
  });

  it('uses UNKNOWN tag when originToTag is undefined', () => {
    const meshResult = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      triangles: new Uint32Array([0, 1, 2]),
      faceGroups: [{ start: 0, count: 3, faceId: 1, origin: 99 }],
    };
    const result = toIndexedMeshData(meshResult, false, undefined, undefined);
    expect(result.faceGroups).toEqual([{ start: 0, count: 3, tag: 255 }]);
  });

  it('returns undefined faceGroups when mesh has no faceGroups', () => {
    const meshResult = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      triangles: new Uint32Array([0, 1, 2]),
    };
    const result = toIndexedMeshData(meshResult);
    expect(result.faceGroups).toBeUndefined();
  });
});

describe('constants', () => {
  it('SIZE matches Gridfinity grid size', () => {
    expect(SIZE).toBe(42);
  });

  it('CLEARANCE matches Gridfinity tolerance', () => {
    expect(CLEARANCE).toBe(0.5);
  });

  it('SOCKET_HEIGHT is 5mm', () => {
    expect(SOCKET_HEIGHT).toBe(5);
  });

  it('LIP_HEIGHT is 4.4mm total', () => {
    expect(LIP_HEIGHT).toBeCloseTo(4.4, 1);
  });

  it('LIP_TAPER_WIDTH is 2.6mm', () => {
    expect(LIP_TAPER_WIDTH).toBeCloseTo(2.6, 1);
  });
});
