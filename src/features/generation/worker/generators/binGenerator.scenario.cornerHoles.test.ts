/**
 * Corner-only attachment holes, probed on the exported mesh.
 *
 * Each hole site is checked for its pocket ceiling: a ring of vertices at the
 * hole radius, `magnetDepth` above the underside. Run against the export mesh
 * because the preview draft leaves the underside undrilled.
 *
 *   pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.cornerHoles
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, assertWatertight } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BaseConfig, BinParams } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';
import type { MeshData } from '@/features/generation/bridge/types';
import { forEachCell } from './cellDecomposition';
import { cellHostsAttachmentHoles, magnetPositionsForCell } from './baseplateMagnets';

const PITCH = 42;
const MAGNET_RADIUS = DEFAULT_BIN_PARAMS.base.magnetDiameter / 2;
const CEILING = DEFAULT_BIN_PARAMS.base.magnetDepth;

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

function makeParams(base: Partial<BaseConfig>, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 3,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', ...base },
    ...extra,
  };
}

function sites(width: number, depth: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  forEachCell(
    width,
    depth,
    (cell) => {
      if (!cellHostsAttachmentHoles(cell, MAGNET_RADIUS, PITCH, PITCH)) return;
      out.push(...magnetPositionsForCell(cell, MAGNET_RADIUS, PITCH, PITCH));
    },
    { gridUnitMm: PITCH }
  );
  return out;
}

function drilledSites(mesh: MeshData, candidates: Array<[number, number]>): string[] {
  let minZ = Infinity;
  for (let i = 2; i < mesh.vertices.length; i += 3) minZ = Math.min(minZ, mesh.vertices[i]);
  const ceilingZ = minZ + CEILING;
  return candidates
    .filter(([x, y]) => {
      let ring = 0;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        if (Math.abs(mesh.vertices[i + 2] - ceilingZ) > 0.02) continue;
        const r = Math.hypot(mesh.vertices[i] - x, mesh.vertices[i + 1] - y);
        if (Math.abs(r - MAGNET_RADIUS) < 0.15) ring++;
      }
      return ring >= 6;
    })
    .map(([x, y]) => `${x},${y}`)
    .sort();
}

/**
 * Centre of every pocket ceiling in the mesh, measured rather than matched
 * against candidates. Each pair of ceiling-height vertices votes for the two
 * centres of a hole-radius circle through both; a ring's pairs all agree on
 * its centre, while the foot's own outline at that height scatters its votes.
 * The draft kernel draws a ring in ~20 vertices, so this holds on every
 * kernel.
 */
function holeCentres(mesh: MeshData): string[] {
  let minZ = Infinity;
  for (let i = 2; i < mesh.vertices.length; i += 3) minZ = Math.min(minZ, mesh.vertices[i]);
  const ceilingZ = minZ + CEILING;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    if (Math.abs(mesh.vertices[i + 2] - ceilingZ) > 0.02) continue;
    points.push([mesh.vertices[i], mesh.vertices[i + 1]]);
  }
  const bin = (v: number): number => Math.round(v * 20) / 20;
  const votes = new Map<string, { x: number; y: number; n: number }>();
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[j];
      const d = Math.hypot(bx - ax, by - ay);
      if (d < 0.2 || d > 2 * MAGNET_RADIUS - 0.01) continue;
      const h = Math.sqrt(MAGNET_RADIUS ** 2 - (d / 2) ** 2);
      for (const side of [-1, 1]) {
        const x = bin((ax + bx) / 2 - (side * h * (by - ay)) / d);
        const y = bin((ay + by) / 2 + (side * h * (bx - ax)) / d);
        const key = `${x},${y}`;
        const vote = votes.get(key) ?? { x, y, n: 0 };
        vote.n++;
        votes.set(key, vote);
      }
    }
  }
  // A pocket ceiling is a whole circle; an arc of the foot's outline that
  // happens to match the radius only covers part of one.
  const wholeRing = (cx: number, cy: number): boolean => {
    const sectors = new Set<number>();
    for (const [x, y] of points) {
      if (Math.abs(Math.hypot(x - cx, y - cy) - MAGNET_RADIUS) > 0.05) continue;
      sectors.add(Math.floor(((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI)) * 8) % 8);
    }
    return sectors.size === 8;
  };
  const accepted: Array<{ x: number; y: number }> = [];
  for (const v of [...votes.values()].sort((a, b) => b.n - a.n)) {
    if (v.n < 15) break;
    if (accepted.some((a) => Math.hypot(a.x - v.x, a.y - v.y) < 1)) continue;
    if (wholeRing(v.x, v.y)) accepted.push(v);
  }
  const round = (v: number): number => Math.round(v * 10) / 10 + 0;
  return accepted.map((a) => `${round(a.x)},${round(a.y)}`).sort();
}

const OUTER_3x2 = ['-55,-34', '-55,34', '55,-34', '55,34'];

describe('corner-only attachment holes', () => {
  let generateBin: ReturnType<typeof getGenerateBin>;
  beforeAll(() => {
    generateBin = getGenerateBin();
  });

  it('drills every foot when off', () => {
    const all = sites(3, 2);
    const mesh = generateBin(makeParams({}), undefined, true);
    expect(drilledSites(mesh, all)).toHaveLength(all.length);
  }, 120_000);

  it('drills only the four outer corners of a rectangular bin', () => {
    const mesh = generateBin(makeParams({ cornerHolesOnly: true }), undefined, true);
    expect(drilledSites(mesh, sites(3, 2))).toEqual(OUTER_3x2);
  }, 120_000);

  it('keeps only the corner pads and pockets on a lightweight base', () => {
    const mesh = generateBin(
      makeParams({ cornerHolesOnly: true, lightweight: true }),
      undefined,
      true
    );
    expect(drilledSites(mesh, sites(3, 2))).toEqual(OUTER_3x2);
  }, 120_000);

  it('drills the corners of the split cells under an underside relief', () => {
    // 2x2 at half-unit resolution with only the top-right half-unit removed:
    // the lightweight base splits that cell into three half cells. The two
    // on the bin's edge drill 8mm from it, in line with the full corners, so
    // the holes between them on that edge drop out.
    const notch: CellMask = { cols: 4, rows: 4, cells: [...Array<1>(15).fill(1), 0] };
    const mesh = generateBin(
      makeParams(
        { cornerHolesOnly: true, lightweight: true, lightweightMode: 'underside' },
        { width: 2, depth: 2, cellMask: notch }
      ),
      undefined,
      true
    );
    expect(holeCentres(mesh)).toEqual(['-34,-34', '-34,34', '10.5,34', '34,-34', '34,10.5'].sort());
  }, 120_000);

  describe('on a bin that ends on a half unit', () => {
    // A full foot drills its corner hole 8mm in from each cell edge, so a
    // corner hole sits 8mm from the bin's edge on every side.
    const CORNERS_1_5x1 = ['-23.5,-13', '-23.5,13', '23.5,-13', '23.5,13'];
    const CORNERS_2_5x2_5 = ['-44.5,-44.5', '-44.5,44.5', '44.5,-44.5', '44.5,44.5'];

    it.each([
      ['a socketed', {}],
      ['a lightweight', { lightweight: true }],
    ] as const)(
      'keeps the corners of a 1.5x1 bin 8mm from each edge on %s base',
      (_, base) => {
        const mesh = generateBin(
          makeParams({ cornerHolesOnly: true, ...base }, { width: 1.5, depth: 1 }),
          undefined,
          true
        );
        expect(holeCentres(mesh)).toEqual(CORNERS_1_5x1);
        assertStructurallyValid(mesh);
        assertWatertight(mesh);
      },
      120_000
    );

    it.each([
      ['a socketed', {}],
      ['a lightweight', { lightweight: true }],
    ] as const)(
      'keeps the corners of a 2.5x2.5 bin 8mm from each edge on %s base',
      (_, base) => {
        const mesh = generateBin(
          makeParams({ cornerHolesOnly: true, ...base }, { width: 2.5, depth: 2.5 }),
          undefined,
          true
        );
        expect(holeCentres(mesh)).toEqual(CORNERS_2_5x2_5);
        assertStructurallyValid(mesh);
        assertWatertight(mesh);
      },
      120_000
    );

    it('keeps the corners symmetric with the half foot on the leading edge', () => {
      const mesh = generateBin(
        makeParams({ cornerHolesOnly: true }, { width: 1.5, depth: 1, fractionalEdgeX: 'start' }),
        undefined,
        true
      );
      expect(holeCentres(mesh)).toEqual(CORNERS_1_5x1);
    }, 120_000);

    it('drills the same corners in the preview', () => {
      const mesh = generateBin(
        makeParams({ cornerHolesOnly: true }, { width: 1.5, depth: 1 }),
        undefined,
        false
      );
      expect(holeCentres(mesh)).toEqual(CORNERS_1_5x1);
    }, 120_000);

    it('still centres the half foot holes when every foot is drilled', () => {
      // A baseplate's half pocket and a lid's half cell centre their magnets
      // too, so the every-foot pattern keeps them centred.
      const mesh = generateBin(makeParams({}, { width: 1.5, depth: 1 }), undefined, true);
      expect(holeCentres(mesh)).toEqual(
        ['-23.5,-13', '-23.5,13', '2.5,-13', '2.5,13', '21,-13', '21,13'].sort()
      );
    }, 120_000);
  });

  it("drills an L-shaped bin's five convex corners", () => {
    // 2x2 at half-unit resolution, bottom row first, top-right unit removed.
    const lShape: CellMask = {
      cols: 4,
      rows: 4,
      cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0],
    };
    const mesh = generateBin(
      makeParams({ cornerHolesOnly: true }, { width: 2, depth: 2, cellMask: lShape }),
      undefined,
      true
    );
    expect(drilledSites(mesh, sites(2, 2))).toEqual(
      ['-34,-34', '-34,34', '-8,34', '34,-34', '34,-8'].sort()
    );
  }, 120_000);
});
