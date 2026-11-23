// @vitest-environment node
/**
 * Scenario tests for detached margin rail geometry.
 *
 * Verifies each fill mode (solid / over-tile / half-grid) and rail role meshes
 * to a non-degenerate solid: positive triangle count, all-finite vertices, and
 * a bounding box matching the planned rail footprint (length × band × height).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { computeBaseplateTiling } from '@/features/baseplate/utils/splitPlanner';
import type { MarginPiece } from '@/features/baseplate/types/tiling';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { gridUnits } from '@/core/types';
import { PLATE_PROFILE_HEIGHT, MAGNET_FLOOR } from './generatorTypes';

let generateMargin: (
  p: ResolvedBaseplateParams,
  m: MarginPiece,
  forExport: boolean
) => MeshDataLike;

interface MeshDataLike {
  vertices: ArrayLike<number>;
  triangleCount: number;
}

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./baseplateMargin');
  generateMargin = mod.generateMargin;
}, 30000);

const base = (o: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
  width: 4,
  depth: 3,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2,
  paddingLeft: 10,
  paddingRight: 10,
  paddingFront: 10,
  paddingBack: 10,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  detachMargins: true,
  ...o,
});

function bbox(verts: ArrayLike<number>) {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < verts.length; i += 3) {
    const x = verts[i],
      y = verts[i + 1],
      z = verts[i + 2];
    expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { dx: maxX - minX, dy: maxY - minY, minZ, maxZ };
}

function railOf(params: ResolvedBaseplateParams, side: MarginPiece['side']): MarginPiece {
  const m = computeBaseplateTiling(params, 256).margins.find((r) => r.side === side);
  if (!m) throw new Error(`no ${side} rail`);
  return m;
}

/**
 * Radius of the arc at a rail's front-left outer corner: the arc meets the
 * front edge at x = minX + r, and that end is always a mesh vertex.
 */
function frontLeftRadius(verts: ArrayLike<number>): number {
  let minX = Infinity;
  let minY = Infinity;
  for (let i = 0; i < verts.length; i += 3) {
    minX = Math.min(minX, verts[i]);
    minY = Math.min(minY, verts[i + 1]);
  }
  let nearest = Infinity;
  for (let i = 0; i < verts.length; i += 3) {
    if (Math.abs(verts[i + 1] - minY) < 1e-3) nearest = Math.min(nearest, verts[i] - minX);
  }
  return nearest;
}

describe('margin rail corner radius', () => {
  it('gives a front rail the plate radius when it is under the band', () => {
    const params = base({
      paddingLeft: 12,
      paddingRight: 12,
      paddingFront: 12,
      paddingBack: 12,
      cornerRadius: 10,
    });
    const md = generateMargin(params, railOf(params, 'front'), false);
    expect(frontLeftRadius(md.vertices)).toBeCloseTo(10, 0);
  });

  it('rounds a short split rail whose corner needs more than half its length', () => {
    // A leading half column makes the first front rail 21 mm long.
    const params = base({
      width: 4.5,
      fractionalEdgeX: 'start',
      splitOverride: { cols: [gridUnits(0.5), gridUnits(4)], rows: [gridUnits(3)] },
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 12,
      paddingBack: 0,
      cornerRadius: 11,
    });
    const rail = computeBaseplateTiling(params, 256).margins.find(
      (m) => m.side === 'front' && m.col === 0
    );
    if (!rail) throw new Error('no first front rail');
    expect(rail.lengthMm).toBeCloseTo(21, 1);
    expect(rail.ownedCorners).toEqual(['bl']);
    const md = generateMargin(params, rail, false);
    expect(frontLeftRadius(md.vertices)).toBeCloseTo(11, 0);
  });

  it('gives a narrow side rail that owns the corner the same radius', () => {
    // No front or back rail, so the left rail reaches the corners and owns them.
    const params = base({
      paddingLeft: 12,
      paddingRight: 12,
      paddingFront: 0,
      paddingBack: 0,
      cornerRadius: 10,
    });
    const left = railOf(params, 'left');
    expect(left.ownedCorners).toContain('bl');
    const md = generateMargin(params, left, false);
    expect(md.triangleCount).toBeGreaterThan(0);
    expect(frontLeftRadius(md.vertices)).toBeCloseTo(10, 0);
  });
});

describe('margin rail geometry', () => {
  it.each([
    ['solid', {}],
    ['over-tile', { overTile: true }],
    ['half-grid', { overTile: true, overTileHalfGrid: true }],
  ] as const)('meshes a long front rail (%s)', (_label, fill) => {
    const params = base(fill);
    const front = railOf(params, 'front');
    const md = generateMargin(params, front, false);
    expect(md.triangleCount).toBeGreaterThan(0);
    expect(md.vertices.length).toBeGreaterThan(0);
    const b = bbox(md.vertices);
    // length spans the full width incl. left+right padding; band = front padding
    expect(b.dx).toBeCloseTo(front.lengthMm, 0);
    expect(b.dy).toBeCloseTo(front.bandThicknessMm, 0);
    expect(b.minZ).toBeCloseTo(0, 1);
    expect(b.maxZ).toBeCloseTo(PLATE_PROFILE_HEIGHT, 1);
  });

  it('meshes a short rail oriented along its long axis', () => {
    const params = base();
    const left = railOf(params, 'left');
    const md = generateMargin(params, left, false);
    expect(md.triangleCount).toBeGreaterThan(0);
    const b = bbox(md.vertices);
    expect(b.dx).toBeCloseTo(left.bandThicknessMm, 0); // band runs across X
    expect(b.dy).toBeCloseTo(left.lengthMm, 0); // length runs along Y
  });

  it('rail is taller when magnets add a floor', () => {
    const params = base({ magnetHoles: true });
    const front = railOf(params, 'front');
    const md = generateMargin(params, front, false);
    const b = bbox(md.vertices);
    // Assert the full height span (bottom at 0), not just the top.
    expect(b.minZ).toBeCloseTo(0, 1);
    expect(b.maxZ - b.minZ).toBeCloseTo(
      PLATE_PROFILE_HEIGHT + MAGNET_FLOOR + params.magnetDepth,
      1
    );
  });
});
