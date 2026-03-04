// @vitest-environment node
/**
 * Robustness tests for bin splitting across parameter permutations.
 *
 * The separate-lip splitting strategy (body + lip split independently, then
 * fused per-piece) was introduced to work around an OCCT bug where intersecting
 * the fused bin+lip solid crashes at non-default wall thicknesses. These tests
 * verify the fix works across all parameter dimensions that affect BREP topology:
 *
 * - Wall thickness extremes (0.4mm → 2.4mm)
 * - Base styles (flat, standard, magnet, magnet_and_screw)
 * - Stacking lip on/off with various base styles
 * - Interior features (compartments, scoops, wall cutouts)
 * - Bin size extremes (small, fractional, tall)
 * - Y-axis and dual-axis splits
 * - Slotted style
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
import { initBrepjs, getGenerateSplitPreview } from './__test-infra__/wasmInit';
import { boundingBox, assertValidSplit } from './__test-infra__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

// ─── Constants ──────────────────────────────────────────────────────────────

const SIZE = GRIDFINITY.GRID_SIZE;

const CONNECTORS: SplitConnectorConfig = DEFAULT_SPLIT_CONNECTOR_CONFIG;
const NO_CONNECTORS: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

// ─── Wall Thickness Permutations ────────────────────────────────────────────

describe('split robustness: wall thickness permutations', () => {
  // Test every discrete wall thickness option. The original crash was at 1.6mm
  // where wall tongues first activate. Thicker walls produce wider tongues with
  // different loft geometry. Thinner walls skip tongue features entirely.
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
  // The original crash was lip + 1.6mm. Test lip with all wall thicknesses
  // that activate wall tongues (≥1.4mm where tongueWidth ≥ MIN_FEATURE_WIDTH).
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

// ─── Interior Features During Split ─────────────────────────────────────────

describe('split robustness: interior features', () => {
  it('splits bin with 2×1 compartments (divider crosses cut plane)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
      compartments: { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] },
    };

    const result = generateSplitPreview(params, [0], [], CONNECTORS);
    assertValidSplit(result, 2, params, '2×1 compartments');
  }, 60000);

  it('splits bin with 3×2 compartments', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 8,
      depth: 4,
      height: 3,
      compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5] },
    };

    const result = generateSplitPreview(params, [0], [], CONNECTORS);
    assertValidSplit(result, 2, params, '3×2 compartments');
  }, 60000);

  it('splits bin with scoop enabled', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
      scoop: { enabled: true, radius: 'auto' },
    };

    const result = generateSplitPreview(params, [0], [], CONNECTORS);
    assertValidSplit(result, 2, params, 'scoop');
  }, 60000);

  it('splits bin with wall cutouts on all sides', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 4,
      height: 3,
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { enabled: true, width: 70, depth: 50 },
        back: { enabled: true, width: 70, depth: 50 },
        left: { enabled: true, width: 70, depth: 50 },
        right: { enabled: true, width: 70, depth: 50 },
        interior: { enabled: false, width: 0, depth: 0 },
      },
    };

    const result = generateSplitPreview(params, [0], [], CONNECTORS);
    assertValidSplit(result, 2, params, 'wall cutouts');
  }, 60000);

  it('splits slotted-style bin', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
      style: 'slotted',
    };

    const result = generateSplitPreview(params, [0], [], CONNECTORS);
    assertValidSplit(result, 2, params, 'slotted');
  }, 60000);

  it('splits bin with label tabs', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 3,
      label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
    };

    const result = generateSplitPreview(params, [0], [], CONNECTORS);
    assertValidSplit(result, 2, params, 'label tabs');
  }, 60000);

  it('splits bin with compartments + scoop + thick walls + connectors', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 8,
      depth: 4,
      height: 4,
      wallThickness: 1.6,
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
      scoop: { enabled: true, radius: 'auto' },
    };

    const result = generateSplitPreview(params, [0], [], CONNECTORS);
    assertValidSplit(result, 2, params, 'combined features');
  }, 90000);
});

// ─── Bin Size Extremes ──────────────────────────────────────────────────────

describe('split robustness: size extremes', () => {
  it('smallest viable split: 2×2 bin cut in half', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 3,
    };

    const result = generateSplitPreview(params, [0], [], CONNECTORS);
    assertValidSplit(result, 2, params, '2×2 half');
  }, 60000);

  it('tall bin: 6×2×10 split with connectors', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 10,
    };

    const result = generateSplitPreview(params, [0], [], CONNECTORS);
    assertValidSplit(result, 2, params, 'tall 10u');

    // Tall bins should have proportionally taller pieces
    const totalH = params.height * GRIDFINITY.HEIGHT_UNIT;
    for (const piece of result.pieces) {
      const bb = boundingBox(piece.vertices);
      expect(bb.maxZ - bb.minZ, 'piece height').toBeGreaterThan(totalH - 1);
    }
  }, 60000);

  it('minimum height: 6×2×2 split', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 2,
    };

    const result = generateSplitPreview(params, [0], [], CONNECTORS);
    assertValidSplit(result, 2, params, 'min height 2u');
  }, 60000);
});

// ─── Y-Axis and Dual-Axis Splits ────────────────────────────────────────────

describe('split robustness: split axis variations', () => {
  it('Y-only split: 4×6×3 cut along Y at y=0', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 4,
      depth: 6,
      height: 3,
    };

    const result = generateSplitPreview(params, [], [0], CONNECTORS);
    assertValidSplit(result, 2, params, 'Y-only split');

    // Verify pieces are stacked in Y direction
    const sorted = [...result.pieces].sort((a, b) => a.row - b.row);
    expect(sorted[0].row).toBe(1);
    expect(sorted[1].row).toBe(2);
  }, 60000);

  it('dual-axis split: 6×6×3 into 4 pieces with connectors', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 6,
      height: 3,
    };

    const result = generateSplitPreview(params, [0], [0], CONNECTORS);
    assertValidSplit(result, 4, params, 'dual-axis 2×2');
  }, 120000);

  it('dual-axis split with thick walls: 6×6×3 at 1.6mm', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 6,
      height: 3,
      wallThickness: 1.6,
    };

    const result = generateSplitPreview(params, [0], [0], CONNECTORS);
    assertValidSplit(result, 4, params, 'dual-axis 1.6mm');
  }, 120000);

  it('3-way X split: 12×2×3 into 3 pieces', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 12,
      depth: 2,
      height: 3,
    };

    const cutX = [-2 * SIZE, 2 * SIZE];
    const result = generateSplitPreview(params, cutX, [], CONNECTORS);
    assertValidSplit(result, 3, params, '3-way X split');
  }, 90000);
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

  it('thick tongue (3.0mm) connectors at 2.0mm walls', () => {
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
    assertValidSplit(result, 2, params, 'thick tongue');
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

    // With connectors should have more geometry (tongue protrusions)
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
