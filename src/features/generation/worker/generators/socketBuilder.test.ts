// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D } from 'brepjs';
import type * as SocketBuilder from './socketBuilder';
import { initTestKernel } from '@/test/initTestKernel';

type BuildCellSocketFn = (cellW_mm: number, cellD_mm: number) => Shape3D;
type BuildBaseSocketFn = (
  gridW: number,
  gridD: number,
  withMagnet: boolean,
  withScrew: boolean,
  magnetRadius: number,
  magnetDepth: number,
  screwRadius: number,
  forExport?: boolean,
  halfSockets?: boolean
) => Shape3D;

let buildBaseSocket: BuildBaseSocketFn;
let buildSingleCellSocket: BuildCellSocketFn;
let buildSimplifiedCellSocket: BuildCellSocketFn;
let forEachSocketCell: typeof SocketBuilder.forEachSocketCell;

let meshShape: (shape: unknown) => { vertices: ArrayLike<number>; triangles: ArrayLike<number> };

beforeAll(async () => {
  const { mesh: meshFn } = await import('brepjs');
  await initTestKernel();

  const mod = await import('./socketBuilder');
  buildBaseSocket = mod.buildBaseSocket;
  buildSingleCellSocket = mod.buildSingleCellSocket;
  buildSimplifiedCellSocket = mod.buildSimplifiedCellSocket;
  forEachSocketCell = mod.forEachSocketCell;

  meshShape = (shape) => meshFn(shape as never, { tolerance: 1, angularTolerance: 30 });
}, 30000);

describe('forEachSocketCell fractional edge', () => {
  // Collect the emitted cells for a 2.5×1 grid and locate the 0.5u sliver.
  const collect = (edge?: { x: 'start' | 'end'; y: 'start' | 'end' }) => {
    const cells: { widthUnits: number; centerX: number }[] = [];
    forEachSocketCell(2.5, 1, undefined, 42, false, (c) => cells.push(c), edge);
    return cells;
  };
  const halfCellX = (cells: { widthUnits: number; centerX: number }[]) =>
    cells.find((c) => Math.abs(c.widthUnits - 0.5) < 1e-6)?.centerX;

  it('defaults the half foot to the positive (right) side', () => {
    const x = halfCellX(collect());
    expect(x).toBeDefined();
    expect(x as number).toBeGreaterThan(0);
  });

  it('places the half foot on the negative (left) side when edge.x is "start"', () => {
    const x = halfCellX(collect({ x: 'start', y: 'end' }));
    expect(x).toBeDefined();
    expect(x as number).toBeLessThan(0);
  });

  it('emits the same number of cells regardless of edge', () => {
    expect(collect().length).toBe(collect({ x: 'start', y: 'end' }).length);
  });
});

describe('buildSingleCellSocket', () => {
  it('builds a valid solid for a full-size cell', () => {
    const shape = buildSingleCellSocket(41.5, 41.5);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangles.length).toBeGreaterThan(0);
  }, 30000);

  it('builds a valid solid for a half-size cell', () => {
    const shape = buildSingleCellSocket(20.5, 20.5);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangles.length).toBeGreaterThan(0);
  }, 30000);
});

describe('buildSimplifiedCellSocket', () => {
  it('builds a valid solid for a full-size cell', () => {
    const shape = buildSimplifiedCellSocket(41.5, 41.5);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('produces fewer triangles than full socket', () => {
    const full = meshShape(buildSingleCellSocket(41.5, 41.5));
    const simplified = meshShape(buildSimplifiedCellSocket(41.5, 41.5));
    expect(simplified.triangles.length).toBeLessThanOrEqual(full.triangles.length);
  }, 30000);
});

describe('buildBaseSocket', () => {
  it('builds a 1x1 socket grid', () => {
    const shape = buildBaseSocket(1, 1, false, false, 3.1, 2, 1.25, false, false);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangles.length).toBeGreaterThan(0);
  }, 30000);

  it('builds a 2x2 socket grid with magnets', () => {
    const shape = buildBaseSocket(2, 2, true, false, 3.1, 2, 1.25, false, false);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 60000);

  it('builds a 1.5x1 socket grid with mixed cell sizes', () => {
    const shape = buildBaseSocket(1.5, 1, false, false, 3.1, 2, 1.25, false, false);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds a 2x2 socket grid in half-sockets mode', () => {
    const shape = buildBaseSocket(2, 2, false, false, 3.1, 2, 1.25, false, true);
    const result = meshShape(shape);
    expect(result.vertices.length).toBeGreaterThan(0);
  }, 60000);

  it('throws on zero-dimension grid', () => {
    expect(() => buildBaseSocket(0, 0, false, false, 3.1, 2, 1.25, false, false)).toThrow(
      'at least one cell required'
    );
  });
});
