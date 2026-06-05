// @vitest-environment node
/**
 * Robustness tests for bin splitting across parameter permutations.
 *
 * The separate-lip splitting strategy (body + lip split independently, then
 * fused per-piece) was introduced to work around an OCCT bug where intersecting
 * the fused bin+lip solid crashes at non-default wall thicknesses. These tests
 * verify the fix works across the parameter dimensions that affect BREP
 * topology: wall thickness, base style, stacking lip, connector config, plus
 * the original crash regressions.
 *
 * Cut-topology robustness (interior features, size extremes, split-axis
 * variations) lives in the sibling binGenerator.scenario.split-robustness-
 * topology.test.ts so the two halves run on parallel Vitest workers.
 *
 * Each test validates:
 * 1. Correct piece count
 * 2. No NaN/Infinity in vertex data
 * 3. Non-degenerate geometry (vertices > 100)
 * 4. Bounding box within expected dimensions
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { initBrepjs, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';
import { boundingBox, assertValidSplit } from './__kernel-tests__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

// ─── Constants ──────────────────────────────────────────────────────────────

const CONNECTORS: SplitConnectorConfig = DEFAULT_SPLIT_CONNECTOR_CONFIG;
const NO_CONNECTORS: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

// ─── Wall Thickness Permutations ────────────────────────────────────────────

describe('split robustness: wall thickness permutations', () => {
  // Test every discrete wall thickness option to ensure the floor scarf lap
  // works correctly across all wall thicknesses without crashing.
  const wallThicknesses = [0.4, 0.8, 1.2, 1.6, 2.0, 2.4];

  for (const wt of wallThicknesses) {
    it(`splits 6×2×3 bin at ${wt}mm wall thickness with connectors`, () => {
      const generateSplitPreview = getGenerateSplitPreview();
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 6,
        depth: 2,
        height: 3,
        wallThickness: wt,
      };

      const result = generateSplitPreview(params, [0], [], CONNECTORS);
      assertValidSplit(result, 2, params, `wt=${wt}mm`);
    }, 60000);
  }
});

// ─── Base Style Permutations ────────────────────────────────────────────────

describe('split robustness: base style permutations', () => {
  const baseStyles: Array<{ style: BinParams['base']['style']; label: string }> = [
    { style: 'standard', label: 'standard sockets' },
    { style: 'flat', label: 'flat base (no sockets)' },
    { style: 'magnet', label: 'magnet holes' },
    { style: 'magnet_and_screw', label: 'magnet + screw holes' },
  ];

  for (const { style, label } of baseStyles) {
    it(`splits 6×2×3 ${label} bin with lip and connectors`, () => {
      const generateSplitPreview = getGenerateSplitPreview();
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 6,
        depth: 2,
        height: 3,
        base: { ...DEFAULT_BIN_PARAMS.base, style, stackingLip: true },
      };

      const result = generateSplitPreview(params, [0], [], CONNECTORS);
      assertValidSplit(result, 2, params, label);
    }, 60000);

    it(`splits 6×2×3 ${label} bin without lip`, () => {
      const generateSplitPreview = getGenerateSplitPreview();
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 6,
        depth: 2,
        height: 3,
        base: { ...DEFAULT_BIN_PARAMS.base, style, stackingLip: false },
      };

      const result = generateSplitPreview(params, [0], [], CONNECTORS);
      assertValidSplit(result, 2, params, `${label} no-lip`);
    }, 60000);
  }
});

// ─── Lip + Thick Wall Combinations ──────────────────────────────────────────

describe('split robustness: lip + wall thickness combinations', () => {
  // The original crash was lip + 1.6mm. Test lip with thicker wall options
  // to ensure floor scarf lap works alongside the stacking lip.
  const thickWalls = [1.6, 1.8, 2.0, 2.4];

  for (const wt of thickWalls) {
    it(`flat base + lip + ${wt}mm walls (the crash scenario)`, () => {
      const generateSplitPreview = getGenerateSplitPreview();
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 6,
        depth: 2,
        height: 3,
        wallThickness: wt,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: true },
      };

      const result = generateSplitPreview(params, [0], [], CONNECTORS);
      assertValidSplit(result, 2, params, `flat+lip+${wt}mm`);
    }, 60000);

    it(`magnet base + lip + ${wt}mm walls`, () => {
      const generateSplitPreview = getGenerateSplitPreview();
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 6,
        depth: 2,
        height: 3,
        wallThickness: wt,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: true },
      };

      const result = generateSplitPreview(params, [0], [], CONNECTORS);
      assertValidSplit(result, 2, params, `magnet+lip+${wt}mm`);
    }, 60000);
  }
});

// ─── Connector Config Variations ────────────────────────────────────────────

describe('split robustness: connector configuration', () => {
  it('zero clearance connectors at 1.6mm walls', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
      wallThickness: 1.6,
    };

    const config: SplitConnectorConfig = {
      ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
      clearance: 0,
    };

    const result = generateSplitPreview(params, [0], [], config);
    assertValidSplit(result, 2, params, 'zero clearance');
  }, 60000);

  it('deep protrusion (4.0mm) connectors at 2.0mm walls', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
      wallThickness: 2.0,
    };

    const config: SplitConnectorConfig = {
      ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
      tongueThickness: 3.0,
      tongueProtrusion: 4.0,
    };

    const result = generateSplitPreview(params, [0], [], config);
    assertValidSplit(result, 2, params, 'deep protrusion');
  }, 60000);

  it('disabled connectors still produce valid split at 2.4mm walls', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
      wallThickness: 2.4,
    };

    const result = generateSplitPreview(params, [0], [], NO_CONNECTORS);
    assertValidSplit(result, 2, params, 'disabled connectors 2.4mm');
  }, 60000);
});

// ─── Regression: The Original Crash Parameters ──────────────────────────────

describe('split robustness: regression tests', () => {
  it('7×3×3 at 1.6mm walls (original crash reproduction)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 7,
      depth: 3,
      height: 3,
      wallThickness: 1.6,
    };

    // Both with and without connectors
    const withConn = generateSplitPreview(params, [0], [], CONNECTORS);
    assertValidSplit(withConn, 2, params, '7×3 1.6mm + connectors');

    const withoutConn = generateSplitPreview(params, [0], [], NO_CONNECTORS);
    assertValidSplit(withoutConn, 2, params, '7×3 1.6mm no connectors');

    // With connectors should have more geometry (ridge/scarf protrusions)
    const vertsWith = withConn.pieces.reduce((s, p) => s + p.vertices.length, 0);
    const vertsWithout = withoutConn.pieces.reduce((s, p) => s + p.vertices.length, 0);
    expect(vertsWith).toBeGreaterThan(vertsWithout);
  }, 90000);

  it('lip fused pieces have correct Z extent', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
      wallThickness: 1.6,
    };

    const result = generateSplitPreview(params, [0], [], NO_CONNECTORS);
    assertValidSplit(result, 2, params, 'lip Z extent');

    const wallTopZ = params.height * GRIDFINITY.HEIGHT_UNIT;
    const lipHeight = GRIDFINITY.LIP_HEIGHT;

    for (const piece of result.pieces) {
      const bb = boundingBox(piece.vertices);
      // Piece should extend above wall top (lip adds ~4.4mm)
      expect(bb.maxZ, `piece ${piece.label} should have lip`).toBeGreaterThan(wallTopZ + 1);
      expect(bb.maxZ, `piece ${piece.label} lip too tall`).toBeLessThan(wallTopZ + lipHeight + 1);
    }
  }, 60000);
});
