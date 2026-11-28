/**
 * Magnets wider than the spec corner allows, probed on the exported mesh.
 *
 * A full foot's flat underside ends 17.8mm from its centre and the spec hole
 * sits 13mm out, so a mouth wider than 4.4mm would leave the flank beside it
 * thinner than FOOT_HOLE_MIN_WALL_MM. Those holes move in just far enough;
 * every other hole keeps its spec corner.
 *
 *   pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.largeMagnets
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin, getKernelName } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  columnCrossings,
} from './__kernel-tests__/meshAssertions';
import { holeCentres, outboardWallMm, outerFaceMm } from './__kernel-tests__/holeProbes';
import { DEFAULT_BIN_PARAMS, DESIGNER_CONSTRAINTS } from '@/shared/constants/bin';
import type { BaseConfig, BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import {
  FOOT_HOLE_MIN_WALL_MM,
  FOOT_UNDERSIDE_INSET_MM,
  MAGNET_FLOOR,
} from '@/shared/printSettings/gridfinityGeometry';

const PITCH = 42;
const DEPTH = DEFAULT_BIN_PARAMS.base.magnetDepth;
const LARGEST = DESIGNER_CONSTRAINTS.MAX_MAGNET_DIAMETER;
/** Just above the underside, where the bore comes closest to the flank. */
const PROBE_Z = 0.05;

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

function makeParams(base: Partial<BaseConfig>, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 1,
    depth: 1,
    height: 3,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', ...base },
    ...extra,
  };
}

function parse(site: string): [number, number] {
  const [x, y] = site.split(',').map(Number);
  return [x, y];
}

/** Every hole's spec corner pattern, pulled in by `inset` on each axis. */
function corners(width: number, offset: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < width; i++) {
    const cx = (i - (width - 1) / 2) * PITCH;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const round = (v: number): number => Math.round(v * 10) / 10 + 0;
        out.push(`${round(cx + sx * offset)},${round(sy * offset)}`);
      }
    }
  }
  return out.sort();
}

/** One mesh of several parts, for probes that read a single vertex and index list. */
function mergeMeshes(
  parts: ReadonlyArray<{ readonly vertices: Float32Array; readonly indices: Uint32Array }>
): MeshData {
  const vertexCount = parts.reduce((sum, part) => sum + part.vertices.length, 0);
  const indexCount = parts.reduce((sum, part) => sum + part.indices.length, 0);
  const vertices = new Float32Array(vertexCount);
  const indices = new Uint32Array(indexCount);
  let v = 0;
  let i = 0;
  for (const part of parts) {
    vertices.set(part.vertices, v);
    for (let k = 0; k < part.indices.length; k++) indices[i + k] = part.indices[k] + v / 3;
    v += part.vertices.length;
    i += part.indices.length;
  }
  return { vertices, indices, triangleCount: indexCount / 3 } as MeshData;
}

/** Which way is out from a hole's own foot, on each axis. */
function outward(x: number, y: number, width: number): { x: 1 | -1; y: 1 | -1 } {
  const footX = Math.round(x / PITCH + (width - 1) / 2) * PITCH - ((width - 1) / 2) * PITCH;
  return { x: x >= footX ? 1 : -1, y: y >= 0 ? 1 : -1 };
}

/** The thinnest flank beside any hole, probed outward on both axes. */
function thinnestWall(mesh: MeshData, holes: string[], width: number): number {
  let thinnest = Infinity;
  for (const site of holes) {
    const [x, y] = parse(site);
    const out = outward(x, y, width);
    thinnest = Math.min(
      thinnest,
      outboardWallMm(mesh, [x, y], PROBE_Z, 'x', out.x),
      outboardWallMm(mesh, [x, y], PROBE_Z, 'y', out.y)
    );
  }
  return thinnest;
}

/**
 * How far the solid beside any hole reaches past the same bin's foot without
 * holes, probed outward on both axes through each hole's centre.
 */
function worstBulge(mesh: MeshData, control: MeshData, holes: string[], width: number): number {
  let worst = -Infinity;
  for (const site of holes) {
    const [x, y] = parse(site);
    const out = outward(x, y, width);
    for (const [axis, dir] of [
      ['x', out.x],
      ['y', out.y],
    ] as const) {
      const reach = outerFaceMm(mesh, [x, y], PROBE_Z, axis, dir);
      const foot = outerFaceMm(control, [x, y], PROBE_Z, axis, dir);
      worst = Math.max(worst, (reach - foot) * dir);
    }
  }
  return worst;
}

/**
 * Each pocket ends in a ceiling MAGNET_FLOOR thick. Read from the faces above
 * the pocket, not a parity count: the draft kernel and brepkit can leave a
 * stray face across a pocket's mouth.
 */
function expectCeilings(mesh: MeshData, holes: string[], depth: number): void {
  let minZ = Infinity;
  for (let i = 2; i < mesh.vertices.length; i += 3) minZ = Math.min(minZ, mesh.vertices[i]);
  for (const site of holes) {
    const [x, y] = parse(site);
    const above = columnCrossings(mesh, x + 0.013, y + 0.013)
      .map((z) => z - minZ)
      .filter((z) => z > depth - 0.1);
    expect(above[0]).toBeCloseTo(depth, 2);
    expect(above[1]).toBeCloseTo(depth + MAGNET_FLOOR, 2);
  }
}

describe('magnets wider than the spec corner allows', () => {
  let generateBin: ReturnType<typeof getGenerateBin>;
  beforeAll(() => {
    generateBin = getGenerateBin();
  });

  it.each([
    ['a 1x1 socketed', 1, {}],
    ['a 2x1 socketed', 2, {}],
    ['a 1x1 lightweight', 1, { lightweight: true }],
    ['a 2x1 lightweight', 2, { lightweight: true }],
  ] as const)(
    'pulls every 10mm hole of %s bin in and keeps solid around it',
    (_, width, base) => {
      const mesh = generateBin(
        makeParams({ magnetDiameter: LARGEST, ...base }, { width }),
        undefined,
        true
      );
      const holes = holeCentres(mesh, LARGEST / 2, DEPTH);
      // 21 - 3.2 (underside inset) - 5 (radius) - 0.4 (wall) = 12.4 from each foot's centre.
      expect(holes).toEqual(corners(width, 12.4));
      expect(thinnestWall(mesh, holes, width)).toBeGreaterThanOrEqual(FOOT_HOLE_MIN_WALL_MM);
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
    },
    120_000
  );

  it.each([
    ['a 1x1 lightweight', 1, {}],
    ['a 2x1 lightweight', 2, {}],
    ['a 1x1 underside-relief', 1, { lightweightMode: 'underside' }],
  ] as const)(
    'keeps the pad around every 10mm hole of %s bin inside its foot',
    (_, width, mode) => {
      const lite = { lightweight: true, ...mode };
      const mesh = generateBin(
        makeParams({ magnetDiameter: LARGEST, ...lite }, { width }),
        undefined,
        true
      );
      const control = generateBin(
        makeParams({ style: 'standard', ...lite }, { width }),
        undefined,
        true
      );
      const holes = holeCentres(mesh, LARGEST / 2, DEPTH);
      expect(holes).toEqual(corners(width, 12.4));
      // Tessellation slack only: the pad must end where the foot's own flank does.
      expect(worstBulge(mesh, control, holes, width)).toBeLessThanOrEqual(0.01);
      expect(thinnestWall(mesh, holes, width)).toBeGreaterThanOrEqual(FOOT_HOLE_MIN_WALL_MM);
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
    },
    120_000
  );

  it('keeps the ceiling over a deep 10mm pocket in a low-profile lightweight foot', () => {
    // A 3.8mm pocket is deeper than the 3.65mm low-profile foot, so its pad
    // rises past the foot's top into the floor opening over the cup.
    const depth = 3.8;
    const mesh = generateBin(
      makeParams({
        magnetDiameter: LARGEST,
        magnetDepth: depth,
        lightweight: true,
        lowProfile: true,
      }),
      undefined,
      true
    );
    const control = generateBin(
      makeParams({ style: 'standard', lightweight: true, lowProfile: true }),
      undefined,
      true
    );
    const holes = holeCentres(mesh, LARGEST / 2, depth);
    expect(holes).toEqual(corners(1, 12.4));
    expect(worstBulge(mesh, control, holes, 1)).toBeLessThanOrEqual(0.01);
    expectCeilings(mesh, holes, depth);
    // brepkit leaves a defect beside one pocket of this bin on main too: 16
    // open edges and no wall at all there. The probe reads it as a thin wall.
    if (getKernelName() !== 'brepkit') {
      expect(thinnestWall(mesh, holes, 1)).toBeGreaterThanOrEqual(FOOT_HOLE_MIN_WALL_MM);
    }
    assertStructurallyValid(mesh);
    assertWatertight(mesh);
  }, 120_000);

  it.each([
    ['30 x 30mm', 30, 30, ['-6.4,-6.4', '-6.4,6.4', '6.4,-6.4', '6.4,6.4']],
    ['25 x 42mm', 25, 42, ['0,-12.4', '0,12.4']],
  ] as const)(
    'keeps every pocket of a half-socket lightweight bin on a %s grid whole',
    (_, gridUnitMm, gridUnitMmY, expected) => {
      // The pads sit on the whole cell and the half sockets split it, so a pad
      // can bridge the gap between two half feet. Only the cell's own flank
      // may clip it.
      const grid = { gridUnitMm, gridUnitMmY };
      const lite = { lightweight: true, halfSockets: true };
      const mesh = generateBin(
        makeParams({ magnetDiameter: LARGEST, ...lite }, grid),
        undefined,
        true
      );
      const holes = holeCentres(mesh, LARGEST / 2, DEPTH);
      expect(holes).toEqual([...expected].sort());
      expectCeilings(mesh, holes, DEPTH);
      expect(thinnestWall(mesh, holes, 1)).toBeGreaterThanOrEqual(FOOT_HOLE_MIN_WALL_MM);
      for (const site of holes) {
        const [x, y] = parse(site);
        const out = outward(x, y, 1);
        // A hole between two half feet has no foot of a bin without magnets
        // beside it to compare with, so the bound is the cell's own flank, on
        // the small taper above the underside.
        for (const [axis, dir, pitch] of [
          ['x', out.x, gridUnitMm],
          ['y', out.y, gridUnitMmY],
        ] as const) {
          if (axis === 'x' && x === 0) continue;
          const flank = pitch / 2 - FOOT_UNDERSIDE_INSET_MM + PROBE_Z;
          expect(outerFaceMm(mesh, [x, y], PROBE_Z, axis, dir) * dir).toBeLessThanOrEqual(
            flank + 0.01
          );
        }
        // Toward the cell's centre the pad keeps its whole 1.2mm margin.
        expect(outboardWallMm(mesh, [x, y], PROBE_Z, 'y', out.y === 1 ? -1 : 1)).toBeGreaterThan(
          1.15
        );
        if (x !== 0) {
          expect(outboardWallMm(mesh, [x, y], PROBE_Z, 'x', out.x === 1 ? -1 : 1)).toBeGreaterThan(
            1.15
          );
        }
      }
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
    },
    120_000
  );

  it('pulls a chamfered 8mm hole in by its mouth', () => {
    const mesh = generateBin(
      makeParams({ magnetDiameter: 8, magnetChamfer: true }),
      undefined,
      true
    );
    const holes = holeCentres(mesh, 4, DEPTH);
    expect(holes).toEqual(corners(1, 12.6));
    expect(thinnestWall(mesh, holes, 1)).toBeGreaterThanOrEqual(FOOT_HOLE_MIN_WALL_MM);
  }, 120_000);

  it('leaves an 8mm hole on its spec corner', () => {
    const mesh = generateBin(makeParams({ magnetDiameter: 8 }), undefined, true);
    expect(holeCentres(mesh, 4, DEPTH)).toEqual(corners(1, 13));
  }, 120_000);

  it('pulls a 10mm hole in on an exported detachable foot as well', async () => {
    const { buildAssembledFeetSolids } = await import('./detachableFeetOrchestrator');
    const { mesh } = await import('brepjs');
    const { toIndexedMeshData } = await import('./meshUtils');
    const feet = buildAssembledFeetSolids(
      makeParams({ magnetDiameter: LARGEST, feet: 'detachable' })
    );
    expect(feet).not.toBeNull();
    if (!feet) return;
    try {
      const merged = mergeMeshes(
        feet.map((foot) =>
          toIndexedMeshData(mesh(foot, { tolerance: 0.01, angularTolerance: 0.1 }))
        )
      );
      const holes = holeCentres(merged, LARGEST / 2, DEPTH);
      expect(holes).toEqual(corners(1, 12.4));
      expect(thinnestWall(merged, holes, 1)).toBeGreaterThanOrEqual(FOOT_HOLE_MIN_WALL_MM);
    } finally {
      for (const foot of feet) foot.delete();
    }
  }, 120_000);
});
