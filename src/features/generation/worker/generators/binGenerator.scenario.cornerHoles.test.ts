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
import { holeCentres as probeHoleCentres, outboardWallMm } from './__kernel-tests__/holeProbes';
import { DEFAULT_BIN_PARAMS, DESIGNER_CONSTRAINTS } from '@/shared/constants/bin';
import type { BaseConfig, BinParams } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';
import type { MeshData } from '@/features/generation/bridge/types';
import { forEachCell } from './cellDecomposition';
import {
  MAGNET_EDGE_CLEARANCE,
  cellHostsAttachmentHoles,
  magnetPositionsForCell,
} from './baseplateMagnets';

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

/** Pocket ceiling centres for a hole of `radius` at the default magnet depth. */
function holeCentres(mesh: MeshData, radius = MAGNET_RADIUS): string[] {
  return probeHoleCentres(mesh, radius, CEILING);
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

    describe('when the corner hole would not keep its wall', () => {
      // The foot's flat underside ends CLEARANCE/2 + FOOT_INSET_BOT inside the
      // cell, so a hole 8mm from the bin's edge keeps 4.8mm minus its mouth
      // radius there. Below the printable wall, the half foot keeps its own
      // centred hole.
      const cases: Array<[string, Partial<BaseConfig>]> = [
        ['the largest magnet', { magnetDiameter: DESIGNER_CONSTRAINTS.MAX_MAGNET_DIAMETER }],
        ['a chamfered default magnet', { magnetChamfer: true }],
      ];

      it.each(cases)(
        'keeps a printable wall beyond the half foot hole with %s',
        (_, base) => {
          const radius = (base.magnetDiameter ?? DEFAULT_BIN_PARAMS.base.magnetDiameter) / 2;
          const mesh = generateBin(
            makeParams({ cornerHolesOnly: true, ...base }, { width: 1.5, depth: 1 }),
            undefined,
            true
          );
          const holes = holeCentres(mesh, radius);
          // The half foot spans x = 10.5..31.5 on the bin's +X side.
          const halfFoot = holes
            .map((site) => site.split(',').map(Number) as [number, number])
            .filter(([x]) => x > PITCH / 4);
          expect(halfFoot).toHaveLength(2);
          for (const hole of halfFoot) {
            expect(outboardWallMm(mesh, hole, 0.05)).toBeGreaterThanOrEqual(MAGNET_EDGE_CLEARANCE);
          }
          // A 10mm hole is too wide for any spec corner, so every foot pulls its
          // holes 0.6mm in off the flank; the chamfered 6.5mm hole keeps its own.
          expect(holes).toEqual(
            radius === 5
              ? ['-22.9,-12.4', '-22.9,12.4', '21,-12.4', '21,12.4']
              : ['-23.5,-13', '-23.5,13', '21,-13', '21,13']
          );
          assertStructurallyValid(mesh);
          assertWatertight(mesh);
        },
        120_000
      );
    });

    it('moves the half foot hole when the screw is wider than the chamfered magnet mouth', () => {
      // The 6mm screw bore swallows the 4mm magnet and its chamfer, so the
      // bore is the mouth that has to keep its wall on the half foot.
      const screwRadius = 3;
      const mesh = generateBin(
        makeParams(
          {
            style: 'magnet_and_screw',
            magnetDiameter: 4,
            screwDiameter: 2 * screwRadius,
            magnetChamfer: true,
            cornerHolesOnly: true,
          },
          { width: 1.5, depth: 1 }
        ),
        undefined,
        true
      );
      const holes = probeHoleCentres(mesh, screwRadius, 0);
      expect(holes).toEqual(CORNERS_1_5x1);
      for (const hole of holes.map((site) => site.split(',').map(Number) as [number, number])) {
        if (hole[0] > 0) {
          expect(outboardWallMm(mesh, hole, 0.05)).toBeGreaterThanOrEqual(MAGNET_EDGE_CLEARANCE);
        }
      }
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
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
