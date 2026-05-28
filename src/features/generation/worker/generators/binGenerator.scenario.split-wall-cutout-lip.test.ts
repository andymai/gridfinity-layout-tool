// @vitest-environment node
/**
 * Scenario tests for wall cutouts on split bins with a stacking lip.
 *
 * Verifies that wall cutouts also remove material from the separately-built
 * stacking lip in split bins. Without the fix, the lip is generated fresh
 * via buildTopShape() and never receives the wall-cutout cuts, so the lip's
 * rim stays intact above each cutout — leaving an unsupported overhang where
 * the wall opening should pass cleanly through the lip too.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { initBrepjs, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const NO_CONNECTORS: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: false,
};

/** Count vertices whose Z lies above the wall top (= inside the lip zone). */
function countLipVertices(vertices: Float32Array, zMin: number): number {
  let count = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    if (vertices[i + 2] >= zMin) count++;
  }
  return count;
}

describe('split bin: wall cutouts must also cut the stacking lip', () => {
  it('lip carries extra cut geometry when front/back wall cutouts are enabled', () => {
    const generateSplitPreview = getGenerateSplitPreview();

    const baseParams: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
    };

    const withCutouts: BinParams = {
      ...baseParams,
      walls: {
        ...baseParams.walls,
        enabled: true,
        front: {
          enabled: true,
          width: 60,
          depth: 60,
          alignment: 'center',
          offset: 0,
          widthMm: null,
        },
        back: {
          enabled: true,
          width: 60,
          depth: 60,
          alignment: 'center',
          offset: 0,
          widthMm: null,
        },
      },
    };

    const cutResult = generateSplitPreview(withCutouts, [0], [], NO_CONNECTORS);
    const flatResult = generateSplitPreview(baseParams, [0], [], NO_CONNECTORS);

    const wallTopZ = baseParams.height * baseParams.heightUnitMm;
    const lipZMin = wallTopZ + 0.1;

    expect(cutResult.pieces).toHaveLength(2);
    expect(flatResult.pieces).toHaveLength(2);

    for (let i = 0; i < cutResult.pieces.length; i++) {
      const cutLip = countLipVertices(cutResult.pieces[i].vertices, lipZMin);
      const flatLip = countLipVertices(flatResult.pieces[i].vertices, lipZMin);
      expect(
        cutLip,
        `piece ${cutResult.pieces[i].label}: expected more lip vertices ` +
          `from wall-cutout cuts (cuts=${cutLip}, flat=${flatLip})`
      ).toBeGreaterThan(flatLip);
    }
  }, 120000);
});
