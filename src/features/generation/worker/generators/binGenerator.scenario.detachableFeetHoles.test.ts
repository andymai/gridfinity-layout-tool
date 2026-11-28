/**
 * Magnet holes in detachable feet on a grid smaller than the spec pitch,
 * probed on the exported feet.
 *
 * A foot is a section of the integral foot of its cell, so it drills the
 * corners that cell drills: 8mm from the cell's edge, where the baseplate
 * drills its magnet. A cell too small for corners centres its hole, and no
 * foot stands at a cell's centre.
 *
 *   pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.detachableFeetHoles
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D } from 'brepjs';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { holeCentres, outboardWallMm } from './__kernel-tests__/holeProbes';
import { isSolidThrough } from './__kernel-tests__/meshAssertions';
import { footCellCentre, footKind, resolveDetachableFeet } from '@/shared/utils/detachableFeetPlan';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { FOOT_HOLE_MIN_WALL_MM } from '@/shared/printSettings/gridfinityGeometry';

const DEPTH = DEFAULT_BIN_PARAMS.base.magnetDepth;
/** Just above the underside, where the bore comes closest to the flank. */
const PROBE_Z = 0.05;

let buildFeet: (params: BinParams) => Shape3D[] | null;
let meshOf: (shape: Shape3D) => MeshData;

beforeAll(async () => {
  await initBrepjs();
  buildFeet = (await import('./detachableFeetOrchestrator')).buildAssembledFeetSolids;
  const { mesh } = await import('brepjs');
  const { toIndexedMeshData } = await import('./meshUtils');
  meshOf = (shape) => toIndexedMeshData(mesh(shape, { tolerance: 0.01, angularTolerance: 0.1 }));
}, 120_000);

function makeParams(
  gridUnitMm: number,
  magnetDiameter: number,
  extra: Partial<BinParams> = {}
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 1,
    depth: 1,
    height: 3,
    gridUnitMm,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', magnetDiameter, feet: 'detachable' },
    ...extra,
  };
}

interface Drilled {
  readonly holes: string[];
  /** The thinnest solid between a hole and the foot's flank. */
  readonly flank: number;
  /** The thinnest solid between a hole and the foot's inner face. */
  readonly inner: number;
  /** The thinnest solid beside any hole, on either side along either axis. */
  readonly thinnest: number;
}

/** Every hole the exported feet drill, with the solid on each side of it. */
function drilledFeet(params: BinParams): Drilled {
  const feet = buildFeet(params);
  expect(feet).not.toBeNull();
  const holes: string[] = [];
  let flank = Infinity;
  let inner = Infinity;
  let thinnest = Infinity;
  const radius = params.base.magnetDiameter / 2;
  try {
    for (const foot of feet ?? []) {
      const mesh = meshOf(foot);
      for (const site of holeCentres(mesh, radius, DEPTH)) {
        holes.push(site);
        const [x, y] = site.split(',').map(Number) as [number, number];
        for (const [axis, value] of [
          ['x', x],
          ['y', y],
        ] as const) {
          const out: 1 | -1 = value >= 0 ? 1 : -1;
          flank = Math.min(flank, outboardWallMm(mesh, [x, y], PROBE_Z, axis, out));
          inner = Math.min(inner, outboardWallMm(mesh, [x, y], PROBE_Z, axis, out === 1 ? -1 : 1));
          thinnest = Math.min(thinnest, flank, inner);
        }
      }
    }
  } finally {
    for (const foot of feet ?? []) foot.delete();
  }
  return { holes: [...new Set(holes)].sort(), flank, inner, thinnest };
}

describe('detachable feet on a grid smaller than the spec pitch', () => {
  it.each([
    ['a 30mm', 30, 6.5, 7],
    ['a 25mm', 25, 6, 4.5],
  ] as const)(
    'drills %s cell 8mm from its edge, inside the foot',
    (_, pitch, magnetDiameter, offset) => {
      const { holes, flank, inner } = drilledFeet(makeParams(pitch, magnetDiameter));
      expect(holes).toEqual(
        [
          `${-offset},${-offset}`,
          `${-offset},${offset}`,
          `${offset},${-offset}`,
          `${offset},${offset}`,
        ].sort()
      );
      expect(flank).toBeGreaterThanOrEqual(FOOT_HOLE_MIN_WALL_MM);
      // The arm reaches past the far side of the hole by the embed margin.
      expect(inner).toBeGreaterThanOrEqual(1.15);
    },
    120_000
  );

  it('drills no hole where the cell centres it', () => {
    expect(drilledFeet(makeParams(25, 6.5)).holes).toEqual([]);
  }, 120_000);

  it('drills only the end bars of a long bin, not the narrow filler bar between them', () => {
    // The filler bar is only an arm wide, so the corner holes of its cell
    // would open through its faces.
    const params = makeParams(25, 6, { depth: 8 });
    const { holes, thinnest } = drilledFeet(params);
    expect(holes).toEqual(['-4.5,-92', '-4.5,92', '4.5,-92', '4.5,92']);
    expect(thinnest).toBeGreaterThanOrEqual(1.15);

    // A bore that opens through the filler's faces leaves no whole ring for
    // `holeCentres`, so probe the filler's own corners for solid instead.
    const plan = resolveDetachableFeet(params);
    const fillers = plan.placements.flatMap((p, i) => (footKind(p) === 'barCentred' ? [i] : []));
    expect(fillers).toHaveLength(1);
    const feet = buildFeet(params) ?? [];
    try {
      const filler = plan.placements[fillers[0]];
      const centre = footCellCentre(filler);
      const mesh = meshOf(feet[fillers[0]]);
      let minZ = Infinity;
      for (let i = 2; i < mesh.vertices.length; i += 3) minZ = Math.min(minZ, mesh.vertices[i]);
      const corners = (plan.magnet?.positions ?? []).filter(
        ([x, y]) =>
          Math.abs(x - centre.x) < filler.cellW / 2 && Math.abs(y - centre.y) < filler.cellD / 2
      );
      expect(corners).toHaveLength(4);
      for (const [x, y] of corners) {
        expect(isSolidThrough(mesh, x + 0.013, y + 0.013, minZ, minZ + DEPTH)).toBe(true);
      }
    } finally {
      for (const foot of feet) foot.delete();
    }
  }, 120_000);

  it('reaches every hole of a centre-anchored foot on a 30 x 50mm grid', () => {
    // The holes sit 8mm from the 30mm edges and 12mm from the 50mm edges, and
    // the bars of a 1x1 bin run along the 50mm edges.
    const { holes, thinnest } = drilledFeet(
      makeParams(30, 6.5, { gridUnitMmY: 50, magnetAnchor: 'center' })
    );
    expect(holes).toEqual(['-7,-13', '-7,13', '7,-13', '7,13']);
    expect(thinnest).toBeGreaterThanOrEqual(1.15);
  }, 120_000);
});
