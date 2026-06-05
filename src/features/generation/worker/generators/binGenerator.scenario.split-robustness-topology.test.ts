// @vitest-environment node
/**
 * Split robustness across cut topology — the dimensions that change what the
 * cut plane has to pass through: interior features (compartments/scoops/wall
 * cutouts/label tabs crossing the plane), bin size extremes, and split-axis
 * variations (Y-only, dual-axis, multi-cut).
 *
 * Split out of binGenerator.scenario.split-robustness.test.ts (which keeps the
 * parameter-permutation + regression cases) so the two halves run on separate
 * Vitest workers in parallel. Each test validates piece count, finite vertex
 * data, non-degenerate geometry, and bounding box — see assertValidSplit.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT, GRIDFINITY } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { initBrepjs, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';
import { boundingBox, assertValidSplit } from './__kernel-tests__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

// ─── Constants ──────────────────────────────────────────────────────────────

const SIZE = GRIDFINITY.GRID_SIZE;

const CONNECTORS: SplitConnectorConfig = DEFAULT_SPLIT_CONNECTOR_CONFIG;

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
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        interior: DISABLED_WALL_CUTOUT,
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
