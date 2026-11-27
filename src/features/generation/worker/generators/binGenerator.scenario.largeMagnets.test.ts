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
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, assertWatertight } from './__kernel-tests__/meshAssertions';
import { holeCentres, outboardWallMm } from './__kernel-tests__/holeProbes';
import { DEFAULT_BIN_PARAMS, DESIGNER_CONSTRAINTS } from '@/shared/constants/bin';
import type { BaseConfig, BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { FOOT_HOLE_MIN_WALL_MM } from '@/shared/printSettings/gridfinityGeometry';

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

/** The thinnest flank beside any hole, probed outward on both axes. */
function thinnestWall(mesh: MeshData, holes: string[], width: number): number {
  let thinnest = Infinity;
  for (const site of holes) {
    const [x, y] = parse(site);
    const footX = Math.round(x / PITCH + (width - 1) / 2) * PITCH - ((width - 1) / 2) * PITCH;
    const outX: 1 | -1 = x >= footX ? 1 : -1;
    const outY: 1 | -1 = y >= 0 ? 1 : -1;
    thinnest = Math.min(
      thinnest,
      outboardWallMm(mesh, [x, y], PROBE_Z, 'x', outX),
      outboardWallMm(mesh, [x, y], PROBE_Z, 'y', outY)
    );
  }
  return thinnest;
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
