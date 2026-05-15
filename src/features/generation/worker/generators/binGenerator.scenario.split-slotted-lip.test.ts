// @vitest-environment node
/**
 * Scenario tests for slotted bins with stacking lip when split (#1652).
 *
 * Verifies that the separately-built lip in split bins gets cut at slot
 * positions, so removable dividers can slide in from the top without being
 * blocked by the lip's inner overhang.
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

/** Count vertices whose Z is at or above the threshold (in the lip zone). */
function countLipVertices(vertices: Float32Array, zMin: number): number {
  let count = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    if (vertices[i + 2] >= zMin) count++;
  }
  return count;
}

describe('slotted bin split with stacking lip (#1652)', () => {
  /**
   * Cutting divider notches through the lip produces new cut faces (one per
   * slot per piece-side), and each cut face contributes additional vertices
   * to the tessellated lip mesh. A slotted+lip+split piece should therefore
   * carry noticeably more lip-zone vertices than the equivalent unslotted
   * (standard style) piece, where the lip remains intact.
   *
   * Without the fix from #1652, the lip in split bins was built fresh and
   * never cut, so slotted and standard pieces would have identical lip
   * geometry and this assertion would fail.
   */
  it('lip cuts add geometry vs unslotted equivalent (X-axis slots)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const baseParams: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
    };
    const slottedParams: BinParams = {
      ...baseParams,
      style: 'slotted',
      slotConfig: {
        x: { enabled: true, pitch: 42 },
        y: { enabled: false, pitch: 42 },
      },
    };

    const slottedResult = generateSplitPreview(slottedParams, [0], [], NO_CONNECTORS);
    const flatResult = generateSplitPreview(baseParams, [0], [], NO_CONNECTORS);

    const wallTopZ = baseParams.height * baseParams.heightUnitMm;
    const lipZMin = wallTopZ + 0.1;

    expect(slottedResult.pieces).toHaveLength(2);
    expect(flatResult.pieces).toHaveLength(2);

    for (let i = 0; i < slottedResult.pieces.length; i++) {
      const slottedLip = countLipVertices(slottedResult.pieces[i].vertices, lipZMin);
      const flatLip = countLipVertices(flatResult.pieces[i].vertices, lipZMin);
      expect(
        slottedLip,
        `piece ${slottedResult.pieces[i].label}: expected more lip vertices ` +
          `from slot cuts (slotted=${slottedLip}, flat=${flatLip})`
      ).toBeGreaterThan(flatLip);
    }
  }, 120000);

  it('lip cuts add geometry on both axes when both slot axes are enabled', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const baseParams: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 6,
      height: 3,
    };
    const slottedParams: BinParams = {
      ...baseParams,
      style: 'slotted',
      slotConfig: {
        x: { enabled: true, pitch: 42 },
        y: { enabled: true, pitch: 42 },
      },
    };

    const slottedResult = generateSplitPreview(slottedParams, [0], [0], NO_CONNECTORS);
    const flatResult = generateSplitPreview(baseParams, [0], [0], NO_CONNECTORS);

    const wallTopZ = baseParams.height * baseParams.heightUnitMm;
    const lipZMin = wallTopZ + 0.1;

    expect(slottedResult.pieces).toHaveLength(4);
    expect(flatResult.pieces).toHaveLength(4);

    for (let i = 0; i < slottedResult.pieces.length; i++) {
      const slottedLip = countLipVertices(slottedResult.pieces[i].vertices, lipZMin);
      const flatLip = countLipVertices(flatResult.pieces[i].vertices, lipZMin);
      expect(
        slottedLip,
        `piece ${slottedResult.pieces[i].label}: expected more lip vertices ` +
          `from slot cuts (slotted=${slottedLip}, flat=${flatLip})`
      ).toBeGreaterThan(flatLip);
    }
  }, 180000);
});

describe('slotted bin split with stacking lip + wall thickness extremes', () => {
  // Regression: at certain wall thicknesses (e.g. 1.6mm) the body+lip fuse
  // could crash. The split fix should remain stable across thicknesses.
  for (const wallThickness of [0.95, 1.6, 2.0]) {
    it(`slotted split with wall thickness ${wallThickness}mm completes without error`, () => {
      const generateSplitPreview = getGenerateSplitPreview();
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 6,
        depth: 2,
        height: 3,
        wallThickness,
        style: 'slotted',
        slotConfig: {
          x: { enabled: true, pitch: 42 },
          y: { enabled: false, pitch: 42 },
        },
      };

      const result = generateSplitPreview(params, [0], [], NO_CONNECTORS);
      expect(result.pieces).toHaveLength(2);
      for (const piece of result.pieces) {
        expect(piece.vertices.length).toBeGreaterThan(100);
      }
    }, 120000);
  }
});
