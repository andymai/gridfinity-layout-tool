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
