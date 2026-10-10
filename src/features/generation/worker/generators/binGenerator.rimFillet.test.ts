// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { generateBin, exportBin } from './binGenerator';
import { analyze } from './__kernel-tests__/exportIntegrityRunner';
import { clearAllCaches } from './shapeCache';
import { verticalSolidSpans, assertStructurallyValid } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

beforeAll(initBrepjs, 60_000);

function params(radius = 0.4, enabled = true, wall = 2): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 3,
    height: 6,
    wallThickness: wall,
    base: {
      ...DEFAULT_BIN_PARAMS.base,
      stackingLip: false,
      rimFillet: enabled,
      rimFilletRadius: radius,
    },
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
  };
}

describe('plain top rim fillet', () => {
  it.each([0.4, 0.9, 1.29])(
    'rounds divider edges while preserving height with radius %s',
    async (radius) => {
      const p = params(radius, true, 2.6);
      const divided = {
        ...p,
        compartments: { ...p.compartments, cols: 2, rows: 2, cells: [0, 1, 2, 3] },
      };
      const result = await exportBin(divided, 'stl');
      const stats = analyze(result.data, 'rounded divided bin');
      expect(stats.boundaryEdges).toBe(0);
      expect(stats.nonManifoldEdges).toBe(0);
      const mesh = generateBin(divided, undefined, true);
      const x = divided.compartments.thickness / 2 - 0.05;
      expect(verticalSolidSpans(mesh, x, 10).at(-1)?.[1]).toBeLessThan(41.9);
      expect(verticalSolidSpans(mesh, 0, 10).at(-1)?.[1]).toBeCloseTo(42, 2);
    }
  );
  it('rounds the inner and outer edges without changing height or the lower wall', () => {
    clearAllCaches();
    const sharp = generateBin(params(0.4, false), undefined, true);
    const rounded = generateBin(params(), undefined, true);
    assertStructurallyValid(rounded);
    for (const x of [41.75 - 0.05, 39.75 + 0.05]) {
      const before = verticalSolidSpans(sharp, x, 0)[0];
      const after = verticalSolidSpans(rounded, x, 0)[0];
      expect(after[0]).toBeCloseTo(before[0], 2);
      expect(after[1]).toBeLessThan(before[1] - 0.1);
    }
    expect(verticalSolidSpans(rounded, 40.75, 0)[0][1]).toBeCloseTo(42, 2);
  });

  it('changes the actual curve with radius, including cache hits', () => {
    const small = generateBin(params(0.2), undefined, true);
    const large = generateBin(params(0.8), undefined, true);
    expect(verticalSolidSpans(large, 41.7, 0)[0][1]).toBeLessThan(
      verticalSolidSpans(small, 41.7, 0)[0][1] - 0.2
    );
  });
});
