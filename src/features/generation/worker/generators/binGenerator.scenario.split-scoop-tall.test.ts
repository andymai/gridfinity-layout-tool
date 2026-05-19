// @vitest-environment node
/**
 * Regression test for issue #1760: split STL export fails for scoop + tall
 * walls when the bin is long enough to require splitting.
 *
 * The deterministic repro from the bisection matrix in the issue:
 *   - width 3 or 3.5
 *   - depth 11 (forces a Y split on the 256mm bed: 11*42 = 462mm > 256mm)
 *   - height 9 (tall walls)
 *   - scoop enabled (radius='auto')
 *   - lip either on or off
 *   - single mid-depth cut plane (y=0)
 *
 * Previously threw `[IO] STL_EXPORT_FAILED: Failed to write STL file` from
 * `exportSTL`. Single-piece export with the same scoop+tall combo succeeds;
 * the failure is specific to the boolean-intersected pieces.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs, getExportSplitBin } from './__kernel-tests__/wasmInit';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { boundingBox, hasNoNaNOrInfinity } from './__kernel-tests__/meshAssertions';
import { isOk } from '@/core/result';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

function exportPieceBounds(data: ArrayBuffer) {
  const result = parseSTLBinary(data);
  expect(isOk(result), 'STL parse should succeed').toBe(true);
  if (!isOk(result)) throw new Error('unreachable');
  const { vertices } = result.value;
  expect(hasNoNaNOrInfinity(vertices), 'export vertices have NaN/Infinity').toBe(true);
  return { bb: boundingBox(vertices), triangleCount: vertices.length / 9 };
}

describe('split export: scoop + tall walls (issue #1760)', () => {
  const NO_CONNECTORS = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

  it('exports 3×11×9 scoop bin with no lip and a mid-depth y-cut', async () => {
    const exportSplitBin = getExportSplitBin();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 11,
      height: 9,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      scoop: { enabled: true, radius: 'auto' },
    };

    const exported = await exportSplitBin(params, [], [0], 0.01, 5, NO_CONNECTORS);
    expect(exported.pieces).toHaveLength(2);

    const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
    for (const piece of exported.pieces) {
      const { bb, triangleCount } = exportPieceBounds(piece.data);
      const exportZ = bb.maxZ - bb.minZ;
      expect(
        exportZ,
        `piece ${piece.label}: Z=${exportZ.toFixed(1)}mm should reach full height ${totalHeight.toFixed(1)}mm`
      ).toBeGreaterThan(totalHeight * 0.9);
      expect(
        triangleCount,
        `piece ${piece.label}: should have substantial geometry, got ${triangleCount} triangles`
      ).toBeGreaterThan(100);
    }
  }, 120000);

  it('exports 3×11×9 scoop bin with lip and a mid-depth y-cut', async () => {
    const exportSplitBin = getExportSplitBin();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 11,
      height: 9,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      scoop: { enabled: true, radius: 'auto' },
    };

    const exported = await exportSplitBin(params, [], [0], 0.01, 5, NO_CONNECTORS);
    expect(exported.pieces).toHaveLength(2);

    const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
    for (const piece of exported.pieces) {
      const { bb, triangleCount } = exportPieceBounds(piece.data);
      const exportZ = bb.maxZ - bb.minZ;
      expect(
        exportZ,
        `piece ${piece.label}: Z=${exportZ.toFixed(1)}mm should exceed wall height ${totalHeight.toFixed(1)}mm (with lip)`
      ).toBeGreaterThan(totalHeight);
      expect(
        triangleCount,
        `piece ${piece.label}: should have substantial geometry, got ${triangleCount} triangles`
      ).toBeGreaterThan(100);
    }
  }, 120000);
});
