// @vitest-environment node
/**
 * The mesh-based STL fallback must produce a valid, parseable binary STL from
 * a real generated solid — this is the path the single-piece exporter falls
 * back to when OCCT's `StlAPI.Write` rejects an otherwise-meshable topology
 * (production `STL_EXPORT_FAILED` failures, #1760 / #1850 family).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from '../__kernel-tests__/wasmInit';
import { getLastSolid, clearAllCaches } from '../shapeCache';
import { EXPORT_ANGULAR_TOLERANCE, EXPORT_TOLERANCE } from './tolerances';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { hasNoNaNOrInfinity } from '../__kernel-tests__/meshAssertions';
import { isOk } from '@/core/result';
import { exportSolidMeshToStl } from './stlMeshFallback';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

beforeEach(() => clearAllCaches());

function scoopBin(w: number, d: number, h: number): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: w,
    depth: d,
    height: h,
    compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
    scoop: { enabled: true, radius: 'auto' },
  };
}

describe('exportSolidMeshToStl', () => {
  it('writes a valid binary STL from a real generated solid', () => {
    const generateBin = getGenerateBin();
    generateBin(scoopBin(2, 3, 6), undefined, true);
    const solid = getLastSolid();
    expect(solid, 'generateBin should populate the cached solid').not.toBeNull();
    if (!solid) throw new Error('unreachable');

    const data = exportSolidMeshToStl(
      solid,
      'fallback-test',
      EXPORT_TOLERANCE,
      EXPORT_ANGULAR_TOLERANCE
    );

    const parsed = parseSTLBinary(data);
    expect(isOk(parsed), 'fallback STL should parse').toBe(true);
    if (!isOk(parsed)) throw new Error('unreachable');
    const { vertices } = parsed.value;
    expect(vertices.length, 'STL should contain triangles').toBeGreaterThan(0);
    expect(vertices.length % 9, 'vertices must form whole triangles').toBe(0);
    expect(hasNoNaNOrInfinity(vertices), 'STL vertices must be finite').toBe(true);
  });

  it('writes triangles matching the meshed solid, not OCCT, so it succeeds whenever the preview does', () => {
    const generateBin = getGenerateBin();
    generateBin(scoopBin(3, 5, 9), undefined, true);
    const solid = getLastSolid();
    if (!solid) throw new Error('generateBin should populate the cached solid');

    const data = exportSolidMeshToStl(
      solid,
      'fallback-tall',
      EXPORT_TOLERANCE,
      EXPORT_ANGULAR_TOLERANCE
    );
    const parsed = parseSTLBinary(data);
    expect(isOk(parsed)).toBe(true);
    if (!isOk(parsed)) throw new Error('unreachable');
    expect(parsed.value.vertices.length / 9).toBeGreaterThan(100);
  });
});
