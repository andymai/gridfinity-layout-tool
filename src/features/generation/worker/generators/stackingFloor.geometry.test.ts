// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_TRAY_BOTTOM, retentionMagnetInset } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin, type GenerateBinFn } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import {
  assertWatertight,
  assertNoDegenerateTriangles,
  boundingBox,
  verticalSolidSpans,
} from './__kernel-tests__/meshAssertions';
import { deriveDimensions } from './pipeline/context';
import { resolveTrayBottomInputs } from './trayBottomInputs';
import { retentionSeatPlanes } from './retentionMagnetGeometry';
import { baseFloorZ } from '@/features/bin-designer/utils/binDimensions';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isOk } from '@/core/result';

let generateBin: GenerateBinFn;
beforeAll(async () => {
  await initBrepjs();
  generateBin = getGenerateBin();
}, 30_000);

function paramsFor(depth = 2) {
  const p = buildParams({ width: 6, depth: 5, height: 12 });
  return {
    ...p,
    lid: {
      ...p.lid,
      enabled: true,
      attachment: 'magnetic' as const,
      retentionMagnet: { diameter: 6, depth, edgeMagnets: 0 },
    },
    base: {
      ...p.base,
      style: 'lid' as const,
      trayBottom: {
        ...DEFAULT_TRAY_BOTTOM,
        floorAtBed: true,
        attachment: 'magnetic' as const,
      },
    },
  };
}

describe('stacking body', () => {
  it.each([
    [0.8, 2],
    [1.2, 2],
    [2.6, 2.6],
  ])(
    'uses the ordinary floor minimum with %s mm walls (%s mm floor)',
    (wallThickness, expectedFloor) => {
      const p = { ...paramsFor(), width: 2, depth: 2, wallThickness };
      const mesh = generateBin(p, undefined, true);
      const [floor] = verticalSolidSpans(mesh, 0.3, 0.7);
      expect(floor[0]).toBeCloseTo(0, 4);
      expect(floor[1]).toBeCloseTo(expectedFloor, 4);
    }
  );
  it('exports the bed-supported solid as STL and STEP', async () => {
    const { exportBin } = await import('./binExporter');
    const p = paramsFor();
    const stl = await exportBin(p, 'stl');
    const parsed = parseSTLBinary(stl.data);
    expect(isOk(parsed)).toBe(true);
    if (!isOk(parsed)) throw new Error('STL did not parse');
    expect(boundingBox(parsed.value.vertices).minZ).toBeCloseTo(0, 4);
    const step = await exportBin(p, 'step');
    expect(new TextDecoder().decode(step.data)).toContain('ISO-10303-21');
  });
  it.each([2, 6])('prints its floor on the bed with %s mm deep corner magnets', (depth) => {
    const p = paramsFor(depth);
    const mesh = generateBin(p, undefined, true);
    assertWatertight(mesh, 'stacking body');
    assertNoDegenerateTriangles(mesh, 'stacking body');
    expect(boundingBox(mesh.vertices).minZ).toBeCloseTo(0, 4);
    const dim = deriveDimensions(p, true);
    expect(baseFloorZ(p.base, p.heightUnitMm, p.lid)).toBeCloseTo(dim.baseOffsetZ, 6);
    // An interior-grid sweep catches an accidentally retained lattice, holes,
    // or a raised floor even when the bounding box alone looks correct.
    for (const x of [-80.3, -40.3, 0.3, 40.3, 80.3]) {
      for (const y of [-60.7, -20.7, 20.7, 60.7]) {
        const spans = verticalSolidSpans(mesh, x, y);
        expect(spans).toHaveLength(1);
        expect(spans[0][0]).toBeCloseTo(0, 4);
        expect(spans[0][1]).toBeCloseTo(dim.floorThickness, 4);
      }
    }
    const inset = retentionMagnetInset(6);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const spans = verticalSolidSpans(mesh, sx * (126 - inset) + 0.1, sy * (105 - inset) + 0.1);
        expect(spans[0][0]).toBeCloseTo(depth, 3);
      }
    // Both parts use the same joint; verify the stack's bottom magnets land
    // one seat gap above the receiving bin's top magnets.
    const input = resolveTrayBottomInputs(p);
    const lift = dim.lipTopZ - input.anchorZ - dim.baseOffsetZ;
    const { binFaceZ } = retentionSeatPlanes(p, dim.lipTopZ);
    expect(lift - binFaceZ).toBeCloseTo(0.2, 5);
    for (let x = -124.3; x < 125; x += 3.1) {
      for (const y of [-102.7, -98.1, -94.9, 0.7, 94.9, 98.1, 102.7]) {
        const spans = verticalSolidSpans(mesh, x, y);
        for (const [a, b] of spans)
          for (const [c, d] of spans) {
            expect(Math.min(b, d + lift) - Math.max(a, c + lift)).toBeLessThanOrEqual(0.01);
          }
      }
    }
  });

  it('supports a divider down to the bed', () => {
    const p = paramsFor();
    const divided = { ...p, compartments: { ...p.compartments, cols: 2, rows: 1, cells: [0, 1] } };
    const mesh = generateBin(divided, undefined, true);
    assertWatertight(mesh, 'stacking divider');
    const spans = verticalSolidSpans(mesh, 0.1, 15.7);
    expect(spans[0][0]).toBeCloseTo(0, 4);
    expect(spans[0][1]).toBeGreaterThan(70);
  });

  it('supports merged compartments without keeping a raised central floor', () => {
    const p = paramsFor();
    const mesh = generateBin(
      {
        ...p,
        compartments: {
          ...p.compartments,
          cols: 2,
          rows: 2,
          cells: [0, 0, 0, 1],
        },
      },
      undefined,
      true
    );
    assertWatertight(mesh, 'merged stacking compartments');
    const floor = verticalSolidSpans(mesh, -30.1, -20.7);
    expect(floor[0][0]).toBeCloseTo(0, 4);
    expect(floor[0][1]).toBeCloseTo(deriveDimensions(p, true).floorThickness, 4);
  });

  it('prints a continuous floor with magnets off, including small and fractional bins', () => {
    for (const [width, depth] of [
      [1, 1],
      [1.5, 2],
      [6, 5],
    ]) {
      const p = paramsFor();
      const plain = {
        ...p,
        width,
        depth,
        lid: { ...p.lid, enabled: false },
        base: {
          ...p.base,
          trayBottom: { ...p.base.trayBottom, attachment: 'friction' as const },
        },
      };
      const mesh = generateBin(plain, undefined, true);
      assertWatertight(mesh, 'plain stacking floor');
      const floor = verticalSolidSpans(mesh, 0.3, 0.7);
      expect(floor[0][0]).toBeCloseTo(0, 4);
      expect(floor[0][1]).toBeCloseTo(deriveDimensions(plain, true).floorThickness, 4);
    }
  });
});
