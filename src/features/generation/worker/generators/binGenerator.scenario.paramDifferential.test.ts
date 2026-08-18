// @vitest-environment node
/**
 * Dead-control differentials — a geometry-affecting parameter must actually
 * change the exported geometry.
 *
 * The scenario + export-integrity suites prove each bin is VALID (watertight,
 * manifold, right size) but never that changing a control changes the output. A
 * param wired to the UI but dropped before the generator — or omitted from a
 * cache key so two values collide — produces a bin that is valid and frozen. It
 * shipped as (connector tolerance had zero effect: −0.3 and +0.3 exported
 * byte-identical STLs) and (half-grid produced the same output as grid).
 * `baseplateGenerator.scenario.fit-offset` pins one such param; this is the bin
 * side.
 *
 * Signal: signed mesh volume from the WATERTIGHT export (the preview mesh isn't
 * watertight — base socket rides unfused — so its volume is unreliable; the
 * export is the honest measure, same as the fit-offset test). A dimensional
 * param like wall thickness leaves the outer bounding box and triangle count
 * unchanged, so bbox/tri-count differentials would miss it — volume is what moves.
 *
 * `setLastSolid(null)` before every export is load-bearing: `exportBin`'s
 * last-solid cache is PARAM-BLIND (see the export-integrity test), so without the
 * reset the second value re-exports the first solid and every differential goes
 * vacuously green — the exact collision class this test guards against.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { stlSolidVolume } from './__kernel-tests__/meshAssertions';
import { exportBin } from './binExporter';
import { setLastSolid } from './shapeCache';

/** Export a bin to STL and measure its solid volume. Forces a fresh solid. */
async function exportVolume(params: BinParams): Promise<number> {
  setLastSolid(null); // defeat the param-blind last-solid cache — see file header
  const result = await exportBin(params, 'stl');
  const parsed = parseSTLBinary(result.data);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  return stlSolidVolume(parsed.value.vertices);
}

const BASE: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 1,
  height: 3,
};

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('bin parameter differentials (dead-control guard)', () => {
  it('wall thickness changes the solid volume (thicker wall = more material)', async () => {
    const thin = await exportVolume({ ...BASE, wallThickness: 0.8 });
    const thick = await exportVolume({ ...BASE, wallThickness: 2.0 });
    // Outer footprint is fixed by the grid, so a thicker wall adds material and
    // must strictly increase the enclosed solid volume. A no-op param leaves
    // these equal.
    expect(thick).toBeGreaterThan(thin + 100);
  }, 60_000);

  it('scoop radius changes the geometry (a larger ramp removes more material)', async () => {
    const scooped = (radius: number): BinParams => ({
      ...BASE,
      scoop: { ...BASE.scoop, enabled: true, radius },
    });
    const small = await exportVolume(scooped(3));
    const large = await exportVolume(scooped(12));
    // The scoop is a concave ramp carved into the interior; a larger radius
    // carves away more, so the volumes must differ meaningfully.
    expect(Math.abs(small - large)).toBeGreaterThan(50);
  }, 60_000);

  it('a grouped Repeat master still cuts every instance', async () => {
    // The editor, the fit-test card and the estimate all count instances
    // whatever the group state, so the exported bin must too — a grouped
    // master collapsed to one pocket ships a board missing every derived
    // cutout while every other layer promises them.
    const board: BinParams = {
      ...BASE,
      style: 'solid',
      base: { ...BASE.base, solid: true, stackingLip: false },
    };
    const grouped = (withArray: boolean): BinParams => ({
      ...board,
      cutouts: [
        {
          id: 'master',
          shape: 'rectangle' as const,
          x: 6,
          y: 6,
          width: 10,
          depth: 10,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g1',
          groupOp: 'union' as const,
          ...(withArray
            ? {
                array: {
                  mode: 'grid' as const,
                  cols: 3,
                  rows: 1,
                  pitchX: 22,
                  pitchY: 22,
                  count: 1,
                  radius: 10,
                  startAngle: 0,
                  rotateToCenter: false,
                },
              }
            : {}),
        },
        {
          id: 'partner',
          shape: 'rectangle' as const,
          x: 6,
          y: 24,
          width: 10,
          depth: 10,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g1',
          groupOp: 'union' as const,
        },
      ],
    });
    const single = await exportVolume(grouped(false));
    const repeated = await exportVolume(grouped(true));
    // Two extra 10x10x5 instances: ~1000mm3 of extra removal, minus nothing —
    // the instances sit on clear board. Well above any tessellation noise.
    expect(single - repeated).toBeGreaterThan(800);
  }, 120_000);

  it('divider thickness changes the solid volume (thicker divider = more material)', async () => {
    const withDivider = (thickness: number): BinParams => ({
      ...BASE,
      compartments: { cols: 2, rows: 1, thickness, cells: [0, 1] },
    });
    const thin = await exportVolume(withDivider(0.8));
    const thick = await exportVolume(withDivider(2.4));
    expect(thick).toBeGreaterThan(thin + 100);
  }, 60_000);
});
