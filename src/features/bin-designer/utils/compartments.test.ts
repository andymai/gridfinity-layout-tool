import { describe, it, expect } from 'vitest';
import {
  createUniformGrid,
  createSingleCell,
  getCellId,
  cellIndex,
  getCompartmentIds,
  getCellsForCompartment,
  getCompartmentBounds,
  getCompartmentCount,
  isRectangularSelection,
  validateCompartmentGrid,
  mergeCells,
  splitCompartment,
  normalizeIds,
  normalizeIdsWithRemap,
  remapCompartmentTexts,
  remapDividerOverrides,
  rectStraddlesTiltedDivider,
  validateDividerOverride,
  validateDividerOverrides,
  compartmentHasTiltedEdge,
  compartmentHasTiltedBackWall,
  deriveWallSegments,
  fromDividerConfig,
} from '@/features/bin-designer/utils/compartments';
import type { CompartmentConfig, DividerOverride } from '@/features/bin-designer/types';

describe('compartments', () => {
  // =============================================================================
  // Grid Creation
  // =============================================================================

  describe('createUniformGrid', () => {
    it('creates a 1×1 grid with single cell', () => {
      const config = createUniformGrid(1, 1, 1.2);
      expect(config.cols).toBe(1);
      expect(config.rows).toBe(1);
      expect(config.thickness).toBe(1.2);
      expect(config.cells).toEqual([0]);
    });

    it('creates a 3×2 grid with unique IDs', () => {
      const config = createUniformGrid(3, 2, 1.2);
      expect(config.cols).toBe(3);
      expect(config.rows).toBe(2);
      expect(config.thickness).toBe(1.2);
      expect(config.cells).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('creates a 4×4 grid', () => {
      const config = createUniformGrid(4, 4, 1.0);
      expect(config.cols).toBe(4);
      expect(config.rows).toBe(4);
      expect(config.cells.length).toBe(16);
      expect(config.cells).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    });

    it('preserves custom thickness values', () => {
      const config = createUniformGrid(2, 2, 2.5);
      expect(config.thickness).toBe(2.5);
    });
  });

  describe('createSingleCell', () => {
    it('creates a 1×1 grid with ID 0', () => {
      const config = createSingleCell(1.2);
      expect(config.cols).toBe(1);
      expect(config.rows).toBe(1);
      expect(config.thickness).toBe(1.2);
      expect(config.cells).toEqual([0]);
    });

    it('preserves custom thickness', () => {
      const config = createSingleCell(3.0);
      expect(config.thickness).toBe(3.0);
    });
  });

  // =============================================================================
  // Cell Access Helpers
  // =============================================================================

  describe('getCellId', () => {
    it('gets cell ID at (0,0) for 1×1 grid', () => {
      const config = createUniformGrid(1, 1, 1.2);
      expect(getCellId(config, 0, 0)).toBe(0);
    });

    it('gets correct IDs for 3×2 grid', () => {
      const config = createUniformGrid(3, 2, 1.2);
      // Row 0: [0, 1, 2]
      expect(getCellId(config, 0, 0)).toBe(0);
      expect(getCellId(config, 1, 0)).toBe(1);
      expect(getCellId(config, 2, 0)).toBe(2);
      // Row 1: [3, 4, 5]
      expect(getCellId(config, 0, 1)).toBe(3);
      expect(getCellId(config, 1, 1)).toBe(4);
      expect(getCellId(config, 2, 1)).toBe(5);
    });

    it('gets IDs from merged cells', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 2, 3, 4], // Top row merged: [0,0,1]
      };
      expect(getCellId(config, 0, 0)).toBe(0);
      expect(getCellId(config, 1, 0)).toBe(0);
      expect(getCellId(config, 2, 0)).toBe(1);
    });
  });

  describe('cellIndex', () => {
    it('returns 0 for (0,0)', () => {
      expect(cellIndex(3, 0, 0)).toBe(0);
    });

    it('computes correct flat index for row-major storage', () => {
      // 3×2 grid: [0,1,2,3,4,5]
      expect(cellIndex(3, 0, 0)).toBe(0); // row 0, col 0
      expect(cellIndex(3, 1, 0)).toBe(1); // row 0, col 1
      expect(cellIndex(3, 2, 0)).toBe(2); // row 0, col 2
      expect(cellIndex(3, 0, 1)).toBe(3); // row 1, col 0
      expect(cellIndex(3, 1, 1)).toBe(4); // row 1, col 1
      expect(cellIndex(3, 2, 1)).toBe(5); // row 1, col 2
    });

    it('works for different grid widths', () => {
      expect(cellIndex(4, 2, 1)).toBe(6); // 4*1 + 2
      expect(cellIndex(5, 3, 2)).toBe(13); // 5*2 + 3
    });
  });

  // =============================================================================
  // Compartment Queries
  // =============================================================================

  describe('getCompartmentIds', () => {
    it('returns [0] for single-cell grid', () => {
      const config = createSingleCell(1.2);
      expect(getCompartmentIds(config)).toEqual([0]);
    });

    it('returns unique sorted IDs for uniform grid', () => {
      const config = createUniformGrid(3, 2, 1.2);
      expect(getCompartmentIds(config)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('returns unique IDs after merge', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 2, 2, 3], // Merged: [0,0], [2,2]
      };
      expect(getCompartmentIds(config)).toEqual([0, 1, 2, 3]);
    });

    it('sorts IDs in ascending order', () => {
      const config: CompartmentConfig = {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [5, 2, 8, 1],
      };
      expect(getCompartmentIds(config)).toEqual([1, 2, 5, 8]);
    });
  });

  describe('getCellsForCompartment', () => {
    it('returns single cell index for uniform grid', () => {
      const config = createUniformGrid(3, 2, 1.2);
      expect(getCellsForCompartment(config, 0)).toEqual([0]);
      expect(getCellsForCompartment(config, 4)).toEqual([4]);
    });

    it('returns all cells for merged compartment', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 2, 3, 4],
      };
      expect(getCellsForCompartment(config, 0)).toEqual([0, 1]);
    });

    it('returns empty array for non-existent compartment', () => {
      const config = createUniformGrid(2, 2, 1.2);
      expect(getCellsForCompartment(config, 99)).toEqual([]);
    });

    it('returns all cells for large merged compartment', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 0, 0, 0, 0], // All merged
      };
      expect(getCellsForCompartment(config, 0)).toEqual([0, 1, 2, 3, 4, 5]);
    });
  });

  describe('getCompartmentBounds', () => {
    it('returns null for non-existent compartment', () => {
      const config = createUniformGrid(2, 2, 1.2);
      expect(getCompartmentBounds(config, 99)).toBeNull();
    });

    it('returns single cell bounds', () => {
      const config = createUniformGrid(3, 2, 1.2);
      const bounds = getCompartmentBounds(config, 0);
      expect(bounds).toEqual({ minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 });
    });

    it('returns bounds for horizontal merge', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 2, 3, 4], // Top row first two cells merged
      };
      const bounds = getCompartmentBounds(config, 0);
      expect(bounds).toEqual({ minCol: 0, maxCol: 1, minRow: 0, maxRow: 0 });
    });

    it('returns bounds for vertical merge', () => {
      const config: CompartmentConfig = {
        cols: 2,
        rows: 3,
        thickness: 1.2,
        cells: [0, 1, 0, 2, 0, 3], // First column merged
      };
      const bounds = getCompartmentBounds(config, 0);
      expect(bounds).toEqual({ minCol: 0, maxCol: 0, minRow: 0, maxRow: 2 });
    });

    it('returns bounds for rectangular merge', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 3,
        thickness: 1.2,
        cells: [0, 0, 1, 0, 0, 2, 3, 4, 5], // Top-left 2×2
      };
      const bounds = getCompartmentBounds(config, 0);
      expect(bounds).toEqual({ minCol: 0, maxCol: 1, minRow: 0, maxRow: 1 });
    });

    it('returns bounds for entire grid merged', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 0, 0, 0, 0],
      };
      const bounds = getCompartmentBounds(config, 0);
      expect(bounds).toEqual({ minCol: 0, maxCol: 2, minRow: 0, maxRow: 1 });
    });
  });

  describe('getCompartmentCount', () => {
    it('returns 1 for single-cell grid', () => {
      const config = createSingleCell(1.2);
      expect(getCompartmentCount(config)).toBe(1);
    });

    it('returns correct count for uniform grid', () => {
      const config = createUniformGrid(3, 2, 1.2);
      expect(getCompartmentCount(config)).toBe(6);
    });

    it('returns reduced count after merge', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 2, 2, 3], // 4 compartments
      };
      expect(getCompartmentCount(config)).toBe(4);
    });

    it('returns 1 when all cells merged', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 0, 0, 0, 0],
      };
      expect(getCompartmentCount(config)).toBe(1);
    });
  });

  // =============================================================================
  // Validation
  // =============================================================================

  describe('isRectangularSelection', () => {
    it('returns false for empty selection', () => {
      expect(isRectangularSelection(3, [])).toBe(false);
    });

    it('returns true for single cell', () => {
      expect(isRectangularSelection(3, [0])).toBe(true);
      expect(isRectangularSelection(3, [5])).toBe(true);
    });

    it('returns true for horizontal rectangle', () => {
      // 3×2 grid, top row: [0,1,2]
      expect(isRectangularSelection(3, [0, 1, 2])).toBe(true);
    });

    it('returns true for vertical rectangle', () => {
      // 3×3 grid, first column: [0,3,6]
      expect(isRectangularSelection(3, [0, 3, 6])).toBe(true);
    });

    it('returns true for 2×2 rectangle', () => {
      // 3×3 grid, top-left 2×2: [0,1,3,4]
      expect(isRectangularSelection(3, [0, 1, 3, 4])).toBe(true);
    });

    it('returns true for entire grid', () => {
      // 2×2 grid
      expect(isRectangularSelection(2, [0, 1, 2, 3])).toBe(true);
    });

    it('returns false for L-shape', () => {
      // 3×3 grid, L-shape: [0,1,3]
      expect(isRectangularSelection(3, [0, 1, 3])).toBe(false);
    });

    it('returns false for diagonal selection', () => {
      // 3×3 grid, diagonal: [0,4,8]
      expect(isRectangularSelection(3, [0, 4, 8])).toBe(false);
    });

    it('returns false for non-contiguous cells', () => {
      // 3×3 grid, corners: [0,2,6,8]
      expect(isRectangularSelection(3, [0, 2, 6, 8])).toBe(false);
    });

    it('returns false for missing cell in rectangle', () => {
      // 3×3 grid, 2×2 with one missing: [0,1,3] (missing 4)
      expect(isRectangularSelection(3, [0, 1, 3])).toBe(false);
    });

    it('handles readonly arrays', () => {
      const cells: readonly number[] = [0, 1];
      expect(isRectangularSelection(3, cells)).toBe(true);
    });
  });

  describe('validateCompartmentGrid', () => {
    it('returns empty array for valid uniform grid', () => {
      const config = createUniformGrid(3, 2, 1.2);
      expect(validateCompartmentGrid(config)).toEqual([]);
    });

    it('returns empty array for valid merged compartments', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 2, 2, 3],
      };
      expect(validateCompartmentGrid(config)).toEqual([]);
    });

    it('returns IDs of L-shaped compartments', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 3,
        thickness: 1.2,
        cells: [0, 0, 1, 0, 2, 3, 4, 5, 6], // ID 0 forms an L
      };
      expect(validateCompartmentGrid(config)).toEqual([0]);
    });

    it('returns multiple invalid IDs', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 3,
        thickness: 1.2,
        // ID 0: cells [0,1,3] = L-shape in top-left
        // ID 1: cells [2,5] = vertical pair (valid)
        // ID 2: cells [4,6,7] = L-shape in bottom-left
        cells: [0, 0, 1, 0, 2, 1, 2, 2, 3],
      };
      const invalid = validateCompartmentGrid(config);
      expect(invalid).toContain(0);
      expect(invalid).toContain(2);
      expect(invalid.length).toBe(2);
    });

    it('returns empty array when all compartments are single cells', () => {
      const config = createSingleCell(1.2);
      expect(validateCompartmentGrid(config)).toEqual([]);
    });
  });

  // =============================================================================
  // Merge / Split Operations
  // =============================================================================

  describe('mergeCells', () => {
    it('returns null for non-rectangular selection', () => {
      const config = createUniformGrid(3, 3, 1.2);
      // L-shape: [0,1,3]
      const result = mergeCells(config, [0, 1, 3]);
      expect(result).toBeNull();
    });

    it('merges horizontal cells', () => {
      const config = createUniformGrid(3, 2, 1.2);
      // Merge top row: [0,1,2]
      const result = mergeCells(config, [0, 1, 2]);
      expect(result).not.toBeNull();
      expect(result!.cells[0]).toBe(result!.cells[1]);
      expect(result!.cells[1]).toBe(result!.cells[2]);
    });

    it('merges vertical cells', () => {
      const config = createUniformGrid(2, 3, 1.2);
      // Merge first column: [0,2,4]
      const result = mergeCells(config, [0, 2, 4]);
      expect(result).not.toBeNull();
      expect(result!.cells[0]).toBe(result!.cells[2]);
      expect(result!.cells[2]).toBe(result!.cells[4]);
    });

    it('merges 2×2 rectangle', () => {
      const config = createUniformGrid(3, 3, 1.2);
      // Top-left 2×2: [0,1,3,4]
      const result = mergeCells(config, [0, 1, 3, 4]);
      expect(result).not.toBeNull();
      const mergedId = result!.cells[0];
      expect(result!.cells[0]).toBe(mergedId);
      expect(result!.cells[1]).toBe(mergedId);
      expect(result!.cells[3]).toBe(mergedId);
      expect(result!.cells[4]).toBe(mergedId);
    });

    it('uses lowest existing ID as target', () => {
      const config = createUniformGrid(3, 2, 1.2);
      // cells: [0,1,2,3,4,5]
      // Merge bottom row: [3,4,5]
      const result = mergeCells(config, [3, 4, 5]);
      expect(result).not.toBeNull();
      // After normalization, the merged cells should have the same ID
      expect(result!.cells[3]).toBe(result!.cells[4]);
      expect(result!.cells[4]).toBe(result!.cells[5]);
    });

    it('normalizes IDs after merge', () => {
      const config = createUniformGrid(3, 2, 1.2);
      const result = mergeCells(config, [0, 1, 2]);
      expect(result).not.toBeNull();
      // Should normalize to contiguous IDs starting from 0
      const ids = getCompartmentIds(result!);
      expect(ids).toEqual([0, 1, 2, 3]);
    });

    it('handles readonly arrays', () => {
      const config = createUniformGrid(2, 2, 1.2);
      const cells: readonly number[] = [0, 1];
      const result = mergeCells(config, cells);
      expect(result).not.toBeNull();
    });

    it('merges entire grid', () => {
      const config = createUniformGrid(2, 2, 1.2);
      const result = mergeCells(config, [0, 1, 2, 3]);
      expect(result).not.toBeNull();
      expect(getCompartmentCount(result!)).toBe(1);
    });
  });

  describe('splitCompartment', () => {
    it('splits merged compartment back to individual cells', () => {
      // Start with merged cells
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 2, 3, 4],
      };
      const result = splitCompartment(config, 0);

      // After split, cells [0,1] should have different IDs
      expect(result.cells[0]).not.toBe(result.cells[1]);

      // Should have more compartments than before
      expect(getCompartmentCount(result)).toBeGreaterThan(getCompartmentCount(config));
    });

    it('keeps first cell with original ID', () => {
      const config: CompartmentConfig = {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 2],
      };
      const result = splitCompartment(config, 0);

      // First occurrence (index 0) keeps ID 0
      expect(result.cells[0]).toBe(0);
      // Second occurrence gets new ID
      expect(result.cells[1]).not.toBe(0);
    });

    it('normalizes IDs after split', () => {
      const config: CompartmentConfig = {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [5, 5, 8, 10],
      };
      const result = splitCompartment(config, 5);

      // IDs should be normalized to 0..N-1
      const ids = getCompartmentIds(result);
      expect(ids).toEqual([0, 1, 2, 3]);
    });

    it('no-op when splitting non-existent compartment', () => {
      const config = createUniformGrid(2, 2, 1.2);
      const result = splitCompartment(config, 99);

      // Grid should be unchanged
      expect(result.cells).toEqual(config.cells);
    });

    it('no-op when splitting single-cell compartment', () => {
      const config = createUniformGrid(2, 2, 1.2);
      const originalCount = getCompartmentCount(config);
      const result = splitCompartment(config, 0);

      // Already individual cells, count should be same
      expect(getCompartmentCount(result)).toBe(originalCount);
    });

    it('splits large merged compartment', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 0, 0, 0, 0],
      };
      const result = splitCompartment(config, 0);

      // Should create 6 separate compartments
      expect(getCompartmentCount(result)).toBe(6);
    });
  });

  describe('normalizeIds', () => {
    it('preserves already normalized IDs', () => {
      const cells = [0, 1, 2, 3];
      expect(normalizeIds(cells)).toEqual([0, 1, 2, 3]);
    });

    it('renumbers non-contiguous IDs', () => {
      const cells = [5, 10, 5, 15];
      const result = normalizeIds(cells);
      expect(result).toEqual([0, 1, 0, 2]);
    });

    it('preserves first-occurrence order', () => {
      const cells = [3, 1, 3, 5, 1, 5];
      const result = normalizeIds(cells);
      expect(result).toEqual([0, 1, 0, 2, 1, 2]);
    });

    it('handles single ID', () => {
      const cells = [42, 42, 42];
      expect(normalizeIds(cells)).toEqual([0, 0, 0]);
    });

    it('handles empty array', () => {
      expect(normalizeIds([])).toEqual([]);
    });

    it('renumbers descending IDs', () => {
      const cells = [100, 50, 25];
      expect(normalizeIds(cells)).toEqual([0, 1, 2]);
    });

    it('preserves spatial ordering for grid', () => {
      // 2×2 grid with top row merged
      const cells = [10, 10, 5, 8];
      const result = normalizeIds(cells);
      // First occurrence: 10 -> 0, 5 -> 1, 8 -> 2
      expect(result).toEqual([0, 0, 1, 2]);
    });
  });

  describe('normalizeIdsWithRemap', () => {
    it('exposes the oldId -> newId remap alongside normalized cells', () => {
      const { cells, remap } = normalizeIdsWithRemap([10, 10, 5, 8]);
      expect(cells).toEqual([0, 0, 1, 2]);
      expect(remap.get(10)).toBe(0);
      expect(remap.get(5)).toBe(1);
      expect(remap.get(8)).toBe(2);
    });

    it('returns empty cells + empty remap for an empty input', () => {
      const { cells, remap } = normalizeIdsWithRemap([]);
      expect(cells).toEqual([]);
      expect(remap.size).toBe(0);
    });
  });

  describe('remapCompartmentTexts', () => {
    it('returns empty array for undefined or empty input', () => {
      expect(remapCompartmentTexts(undefined, new Map())).toEqual([]);
      expect(remapCompartmentTexts([], new Map([[0, 0]]))).toEqual([]);
    });

    it('migrates per-compartment text into the new ID slots', () => {
      // Original IDs 0,1,2 → remapped to 0,1,2 (no change)
      const remap = new Map([
        [0, 0],
        [1, 1],
        [2, 2],
      ]);
      const out = remapCompartmentTexts(['A', 'B', 'C'], remap);
      expect(out).toEqual(['A', 'B', 'C']);
    });

    it('handles renumbering across split (new IDs get empty strings)', () => {
      // Split: a compartment is split, so a new ID appears in cells. The
      // remap from normalizeIdsWithRemap is always 1:1 — the new ID is
      // present with its own slot. Original IDs that survived keep their text.
      // Setup: original ids 0,1,2,3 with texts ['A','B','C','D']. Split id 1
      // into two — the parent keeps id 1, the new cell gets id 4. After
      // normalize: cells use 0,1,2,3,4 → renumbered to 0,1,2,3,4 (same).
      const remap = new Map([
        [0, 0],
        [1, 1],
        [4, 2], // new compartment from split — no source text → ''
        [2, 3],
        [3, 4],
      ]);
      const out = remapCompartmentTexts(['A', 'B', 'C', 'D'], remap);
      expect(out).toEqual(['A', 'B', '', 'C', 'D']);
    });

    it('drops text for compartments that disappeared from the remap', () => {
      // Merge: ids 1,2 were stomped to 0 before normalize ran, so the post-
      // normalize remap only contains the surviving IDs (0 and 3). The
      // disappearing IDs (1, 2) are not in the remap — their texts drop.
      // Original cells [0,1,2,3] with texts ['A','B','C','D']. After merge
      // and normalize: cells [0,0,0,1], remap {0→0, 3→1}.
      const remap = new Map([
        [0, 0],
        [3, 1],
      ]);
      const out = remapCompartmentTexts(['A', 'B', 'C', 'D'], remap);
      expect(out).toEqual(['A', 'D']);
    });
  });

  describe('mergeCells with compartmentTexts', () => {
    it('keeps the target compartment text after a merge', () => {
      // 2×2 with cells [0,1,2,3] and texts ['A','B','C','D']. Merge indices
      // [0,1] (top row). targetId = min(0,1) = 0, so the merged compartment
      // keeps text 'A'. The remaining compartments (old 2,3 → new 1,2) keep
      // 'C' and 'D'.
      const config: CompartmentConfig = {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1, 2, 3],
        compartmentTexts: ['A', 'B', 'C', 'D'],
      };
      const merged = mergeCells(config, [0, 1]);
      expect(merged?.cells).toEqual([0, 0, 1, 2]);
      expect(merged?.compartmentTexts).toEqual(['A', 'C', 'D']);
    });
  });

  describe('splitCompartment with compartmentTexts', () => {
    it('keeps the parent text on the first cell of the split', () => {
      // 2×2 with [0,0,1,2] (top row merged) and texts ['MERGED','SOLO','OTHER'].
      // Split compartment 0 → top-left keeps 0 with 'MERGED'; top-right gets
      // new ID; everything renumbers.
      const config: CompartmentConfig = {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 2],
        compartmentTexts: ['MERGED', 'SOLO', 'OTHER'],
      };
      const split = splitCompartment(config, 0);
      // After split + normalize: [0, 1, 2, 3]. Top-left keeps 'MERGED',
      // new compartment 1 gets ''.
      expect(split.cells).toEqual([0, 1, 2, 3]);
      expect(split.compartmentTexts).toEqual(['MERGED', '', 'SOLO', 'OTHER']);
    });
  });

  // =============================================================================
  // Wall Segment Derivation
  // =============================================================================

  describe('deriveWallSegments', () => {
    it('returns empty array for 1×1 grid', () => {
      const config = createSingleCell(1.2);
      const segments = deriveWallSegments(config, 100, 100);
      expect(segments).toEqual([]);
    });

    it('derives single vertical wall for 2×1 uniform grid', () => {
      const config = createUniformGrid(2, 1, 1.2);
      const segments = deriveWallSegments(config, 100, 100);

      expect(segments.length).toBe(1);
      expect(segments[0].orientation).toBe('vertical');
      expect(segments[0].x).toBe(50); // 100 / 2
      expect(segments[0].y).toBe(0);
      expect(segments[0].length).toBe(100);
    });

    it('derives single horizontal wall for 1×2 uniform grid', () => {
      const config = createUniformGrid(1, 2, 1.2);
      const segments = deriveWallSegments(config, 100, 100);

      expect(segments.length).toBe(1);
      expect(segments[0].orientation).toBe('horizontal');
      expect(segments[0].x).toBe(0);
      expect(segments[0].y).toBe(50); // 100 / 2
      expect(segments[0].length).toBe(100);
    });

    it('derives cross for 2×2 uniform grid', () => {
      const config = createUniformGrid(2, 2, 1.2);
      const segments = deriveWallSegments(config, 100, 100);

      expect(segments.length).toBe(2);

      // One vertical, one horizontal
      const vertical = segments.find((s) => s.orientation === 'vertical');
      const horizontal = segments.find((s) => s.orientation === 'horizontal');

      expect(vertical).toBeDefined();
      expect(horizontal).toBeDefined();

      expect(vertical!.x).toBe(50);
      expect(vertical!.length).toBe(100);

      expect(horizontal!.y).toBe(50);
      expect(horizontal!.length).toBe(100);
    });

    it('derives grid for 3×3 uniform grid', () => {
      const config = createUniformGrid(3, 3, 1.2);
      const segments = deriveWallSegments(config, 90, 90);

      // 2 vertical walls + 2 horizontal walls
      expect(segments.length).toBe(4);

      const vertical = segments.filter((s) => s.orientation === 'vertical');
      const horizontal = segments.filter((s) => s.orientation === 'horizontal');

      expect(vertical.length).toBe(2);
      expect(horizontal.length).toBe(2);

      // Check vertical wall positions
      expect(vertical[0].x).toBe(30); // 90 / 3
      expect(vertical[1].x).toBe(60); // 90 / 3 * 2

      // Check horizontal wall positions
      expect(horizontal[0].y).toBe(30);
      expect(horizontal[1].y).toBe(60);
    });

    it('omits walls for merged compartments', () => {
      // Top row merged
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 0, 1, 2, 3],
      };
      const segments = deriveWallSegments(config, 90, 60);

      // Should have:
      // - 1 horizontal wall at y=30 (full width)
      // - 2 vertical walls in bottom row only (partial length)
      expect(segments.length).toBe(3);

      const horizontal = segments.filter((s) => s.orientation === 'horizontal');
      const vertical = segments.filter((s) => s.orientation === 'vertical');

      expect(horizontal.length).toBe(1);
      expect(horizontal[0].length).toBe(90); // Full width

      expect(vertical.length).toBe(2);
      // Vertical walls only in bottom half
      expect(vertical[0].length).toBe(30); // 60 / 2
      expect(vertical[1].length).toBe(30);
    });

    it('merges consecutive wall segments', () => {
      // First column merged vertically
      const config: CompartmentConfig = {
        cols: 2,
        rows: 3,
        thickness: 1.2,
        cells: [0, 1, 0, 2, 0, 3],
      };
      const segments = deriveWallSegments(config, 60, 90);

      // Should have:
      // - 1 vertical wall at x=30 (full length, no breaks)
      // - 2 horizontal walls (right side only)
      expect(segments.length).toBe(3);

      const vertical = segments.filter((s) => s.orientation === 'vertical');
      const horizontal = segments.filter((s) => s.orientation === 'horizontal');

      expect(vertical.length).toBe(1);
      expect(vertical[0].x).toBe(30);
      expect(vertical[0].length).toBe(90); // Full depth

      expect(horizontal.length).toBe(2);
      // Horizontal walls only on right side
      expect(horizontal[0].length).toBe(30); // 60 / 2
      expect(horizontal[1].length).toBe(30);
    });

    it('handles complex merged pattern', () => {
      // 3×3 with center merged into top-middle
      const config: CompartmentConfig = {
        cols: 3,
        rows: 3,
        thickness: 1.2,
        cells: [0, 1, 2, 3, 1, 4, 5, 6, 7], // ID 1 is vertical merge
      };
      const segments = deriveWallSegments(config, 90, 90);

      // Should have walls around all boundaries except within merged cells
      expect(segments.length).toBeGreaterThan(0);

      // Verify no vertical wall breaks the merged compartment
      const verticalAtX30 = segments.find(
        (s) => s.orientation === 'vertical' && s.x === 30 && s.y === 0
      );
      const verticalAtX60 = segments.find(
        (s) => s.orientation === 'vertical' && s.x === 60 && s.y === 0
      );

      // Both vertical walls should have breaks or partial lengths
      expect(verticalAtX30).toBeDefined();
      expect(verticalAtX60).toBeDefined();
    });

    it('respects bin interior dimensions', () => {
      const config = createUniformGrid(2, 2, 1.2);
      const segments = deriveWallSegments(config, 80, 120);

      const vertical = segments.find((s) => s.orientation === 'vertical');
      const horizontal = segments.find((s) => s.orientation === 'horizontal');

      expect(vertical!.x).toBe(40); // 80 / 2
      expect(vertical!.length).toBe(120); // Full depth

      expect(horizontal!.y).toBe(60); // 120 / 2
      expect(horizontal!.length).toBe(80); // Full width
    });

    it('handles entire grid merged (no walls)', () => {
      const config: CompartmentConfig = {
        cols: 3,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 0, 0, 0, 0],
      };
      const segments = deriveWallSegments(config, 90, 60);
      expect(segments).toEqual([]);
    });

    it('handles vertical wall segments with breaks', () => {
      // Top row different, bottom row merged horizontally
      const config: CompartmentConfig = {
        cols: 3,
        rows: 3,
        thickness: 1.2,
        cells: [0, 1, 2, 3, 3, 4, 5, 5, 6],
      };
      const segments = deriveWallSegments(config, 90, 90);

      // Should have vertical walls that stop/start due to merged cells
      expect(segments.length).toBeGreaterThan(0);

      // Check that we have both vertical and horizontal walls
      const vertical = segments.filter((s) => s.orientation === 'vertical');
      const horizontal = segments.filter((s) => s.orientation === 'horizontal');

      expect(vertical.length).toBeGreaterThan(0);
      expect(horizontal.length).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // Migration from Legacy DividerConfig
  // =============================================================================

  describe('fromDividerConfig', () => {
    it('converts no dividers to 1×1 grid', () => {
      const result = fromDividerConfig({ x: 0, y: 0, thickness: 1.2 });
      expect(result.cols).toBe(1);
      expect(result.rows).toBe(1);
      expect(result.thickness).toBe(1.2);
      expect(result.cells).toEqual([0]);
    });

    it('converts 1 x-divider to 2×1 grid', () => {
      const result = fromDividerConfig({ x: 1, y: 0, thickness: 1.2 });
      expect(result.cols).toBe(2);
      expect(result.rows).toBe(1);
      expect(result.cells).toEqual([0, 1]);
    });

    it('converts 1 y-divider to 1×2 grid', () => {
      const result = fromDividerConfig({ x: 0, y: 1, thickness: 1.2 });
      expect(result.cols).toBe(1);
      expect(result.rows).toBe(2);
      expect(result.cells).toEqual([0, 1]);
    });

    it('converts 2×1 dividers to 3×2 grid', () => {
      const result = fromDividerConfig({ x: 2, y: 1, thickness: 1.2 });
      expect(result.cols).toBe(3);
      expect(result.rows).toBe(2);
      expect(result.cells).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('converts 3×3 dividers to 4×4 grid', () => {
      const result = fromDividerConfig({ x: 3, y: 3, thickness: 1.0 });
      expect(result.cols).toBe(4);
      expect(result.rows).toBe(4);
      expect(result.cells.length).toBe(16);
    });

    it('preserves thickness value', () => {
      const result = fromDividerConfig({ x: 1, y: 1, thickness: 2.5 });
      expect(result.thickness).toBe(2.5);
    });

    it('creates uniform grid (each cell unique)', () => {
      const result = fromDividerConfig({ x: 2, y: 2, thickness: 1.2 });
      const ids = getCompartmentIds(result);
      expect(ids.length).toBe(9); // 3×3 = 9 cells
      expect(getCompartmentCount(result)).toBe(9);
    });
  });

  // =============================================================================
  // Divider Override
  // =============================================================================

  describe('validateDividerOverride', () => {
    const config: CompartmentConfig = {
      cols: 1,
      rows: 2,
      thickness: 1.2,
      cells: [0, 1],
    };

    it('accepts a canonical, in-bounds override between adjacent compartments', () => {
      expect(
        validateDividerOverride(config, {
          compartmentA: 0,
          compartmentB: 1,
          offsetStart: 10,
          offsetEnd: -8,
        })
      ).toBeNull();
    });

    it('rejects unordered pair', () => {
      expect(
        validateDividerOverride(config, {
          compartmentA: 1,
          compartmentB: 0,
          offsetStart: 0,
          offsetEnd: 0,
        })
      ).toBe('unordered-pair');
    });

    it('rejects self-pair', () => {
      expect(
        validateDividerOverride(config, {
          compartmentA: 0,
          compartmentB: 0,
          offsetStart: 0,
          offsetEnd: 0,
        })
      ).toBe('self-pair');
    });

    it('rejects unknown compartment IDs', () => {
      expect(
        validateDividerOverride(config, {
          compartmentA: 0,
          compartmentB: 9,
          offsetStart: 0,
          offsetEnd: 0,
        })
      ).toBe('unknown-compartment');
    });

    it('rejects non-adjacent compartments', () => {
      // 1×3 grid: compartments 0 and 2 are not adjacent (compartment 1
      // sits between them).
      const nonAdj: CompartmentConfig = {
        cols: 1,
        rows: 3,
        thickness: 1.2,
        cells: [0, 1, 2],
      };
      expect(
        validateDividerOverride(nonAdj, {
          compartmentA: 0,
          compartmentB: 2,
          offsetStart: 0,
          offsetEnd: 0,
        })
      ).toBe('non-adjacent-compartments');
    });

    it('rejects out-of-bounds offsets', () => {
      expect(
        validateDividerOverride(config, {
          compartmentA: 0,
          compartmentB: 1,
          offsetStart: 999,
          offsetEnd: 0,
        })
      ).toBe('offset-out-of-bounds');
    });

    it('rejects non-finite offsets', () => {
      expect(
        validateDividerOverride(config, {
          compartmentA: 0,
          compartmentB: 1,
          offsetStart: Number.POSITIVE_INFINITY,
          offsetEnd: 0,
        })
      ).toBe('offset-not-finite');
      expect(
        validateDividerOverride(config, {
          compartmentA: 0,
          compartmentB: 1,
          offsetStart: 0,
          offsetEnd: Number.NaN,
        })
      ).toBe('offset-not-finite');
    });
  });

  describe('validateDividerOverrides', () => {
    const config: CompartmentConfig = {
      cols: 2,
      rows: 2,
      thickness: 1.2,
      cells: [0, 1, 2, 3],
    };

    it('rejects duplicate canonical pairs', () => {
      const result = validateDividerOverrides(config, [
        { compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: 0 },
        { compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: 0 },
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('duplicate-pair');
        expect(result.index).toBe(1);
      }
    });

    it('passes on a clean list', () => {
      const result = validateDividerOverrides(config, [
        { compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: 0 },
        { compartmentA: 2, compartmentB: 3, offsetStart: -3, offsetEnd: 0 },
      ]);
      expect(result.ok).toBe(true);
    });
  });

  describe('remapDividerOverrides', () => {
    it('returns empty for undefined / empty input', () => {
      expect(remapDividerOverrides(undefined, new Map())).toEqual([]);
      expect(remapDividerOverrides([], new Map([[0, 0]]))).toEqual([]);
    });

    it('renumbers surviving overrides and preserves canonical ordering', () => {
      const overrides: DividerOverride[] = [
        { compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: -2 },
        { compartmentA: 1, compartmentB: 2, offsetStart: 0, offsetEnd: 3 },
      ];
      // Remap that swaps 0↔1.
      const remap = new Map([
        [0, 1],
        [1, 0],
        [2, 2],
      ]);
      const out = remapDividerOverrides(overrides, remap);
      expect(out).toEqual([
        { compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: -2 },
        { compartmentA: 0, compartmentB: 2, offsetStart: 0, offsetEnd: 3 },
      ]);
    });

    it('drops overrides whose compartment disappeared from the remap', () => {
      const overrides: DividerOverride[] = [
        { compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: 0 },
        { compartmentA: 1, compartmentB: 2, offsetStart: 3, offsetEnd: 0 },
      ];
      // Compartment 2 disappeared (merged into 1).
      const remap = new Map([
        [0, 0],
        [1, 1],
      ]);
      const out = remapDividerOverrides(overrides, remap);
      expect(out).toEqual([{ compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: 0 }]);
    });

    it('drops overrides whose two compartments collapsed to the same ID', () => {
      const overrides: DividerOverride[] = [
        { compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: 0 },
      ];
      // Compartments 0 and 1 merged to 0.
      const remap = new Map([
        [0, 0],
        [1, 0],
      ]);
      expect(remapDividerOverrides(overrides, remap)).toEqual([]);
    });

    it('deduplicates pairs that collapse onto each other after a merge', () => {
      // Imagine a 1×3 with compartments 0,1,2. Two overrides:
      //   - between 0 and 2 (impossible in real grid, but illustrative)
      //   - between 1 and 2
      // After merging 0 and 1 into 0, both overrides target the same new
      // pair (0,2). Without dedup we'd emit two entries with the same key
      // — the worker's lookup map would last-write-wins and the validator
      // would reject the design on next save.
      const overrides: DividerOverride[] = [
        { compartmentA: 0, compartmentB: 2, offsetStart: 5, offsetEnd: 0 },
        { compartmentA: 1, compartmentB: 2, offsetStart: 10, offsetEnd: 0 },
      ];
      const remap = new Map([
        [0, 0],
        [1, 0],
        [2, 1],
      ]);
      const out = remapDividerOverrides(overrides, remap);
      expect(out).toHaveLength(1);
      // First-wins policy: the offsets from the earlier entry survive.
      expect(out[0].offsetStart).toBe(5);
    });
  });

  describe('mergeCells with dividerOverrides', () => {
    it('remaps surviving overrides after a merge', () => {
      const config: CompartmentConfig = {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1, 2, 3],
        dividerOverrides: [
          { compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: -3 },
          { compartmentA: 2, compartmentB: 3, offsetStart: 0, offsetEnd: 8 },
        ],
      };
      // Merge compartments 0 and 1 (top row).
      const merged = mergeCells(config, [0, 1]);
      // Top-row override drops; bottom-row override survives with renumbered IDs.
      expect(merged?.dividerOverrides).toEqual([
        { compartmentA: 1, compartmentB: 2, offsetStart: 0, offsetEnd: 8 },
      ]);
    });
  });

  describe('compartmentHasTiltedEdge / compartmentHasTiltedBackWall', () => {
    it('returns false when no overrides exist', () => {
      const config: CompartmentConfig = {
        cols: 1,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1],
      };
      expect(compartmentHasTiltedEdge(config, 0)).toBe(false);
      expect(compartmentHasTiltedBackWall(config, 0)).toBe(false);
    });

    it('detects a tilted edge on either compartment of an override pair', () => {
      const config: CompartmentConfig = {
        cols: 1,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1],
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: 0 }],
      };
      expect(compartmentHasTiltedEdge(config, 0)).toBe(true);
      expect(compartmentHasTiltedEdge(config, 1)).toBe(true);
    });

    it('flags the back-wall tilt only for the front compartment in a 1×2', () => {
      // 1×2 stacked vertically: row 0 is "front" (closer to y=0), row 1 is
      // "back". The horizontal divider between them is the BACK wall of
      // compartment 0 and the FRONT wall of compartment 1. Only compartment
      // 0's back wall is tilted.
      const config: CompartmentConfig = {
        cols: 1,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1],
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: -5 }],
      };
      expect(compartmentHasTiltedBackWall(config, 0)).toBe(true);
      expect(compartmentHasTiltedBackWall(config, 1)).toBe(false);
    });

    it('rectStraddlesTiltedDivider returns false when no overrides exist', () => {
      const config: CompartmentConfig = {
        cols: 1,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1],
      };
      const rect = { x: -10, y: -10, width: 20, depth: 20 };
      expect(rectStraddlesTiltedDivider(config, 80, 80, rect)).toBe(false);
    });

    it('rectStraddlesTiltedDivider flags an insert that crosses a tilted line', () => {
      const config: CompartmentConfig = {
        cols: 1,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1],
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 20, offsetEnd: -20 }],
      };
      const rect = { x: -15, y: -15, width: 30, depth: 30 };
      expect(rectStraddlesTiltedDivider(config, 80, 80, rect)).toBe(true);
    });

    it('rectStraddlesTiltedDivider returns false for inserts safely inside one wedge', () => {
      const config: CompartmentConfig = {
        cols: 1,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1],
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 20, offsetEnd: -20 }],
      };
      // Tiny insert in the front-right corner, well inside one wedge.
      const rect = { x: 30, y: -30, width: 5, depth: 5 };
      expect(rectStraddlesTiltedDivider(config, 80, 80, rect)).toBe(false);
    });

    it('rectStraddlesTiltedDivider uses partial-span endpoints for non-linear grids', () => {
      // Regression test for the bug Copilot caught on PR #1840:
      // `tiltedDividerEndpoints` was using full-bin endpoints (y: ±innerD/2)
      // for ALL dividers, including partial-span ones. For a 2×2 grid
      // with cells [0,1,2,3], the override on (0,1) applies ONLY to row
      // 0's segment of the col-1 boundary — y range [-innerD/2,0], not
      // the full bin depth.
      //
      // An insert at the BOTTOM of the bin (in row 1's range, where the
      // (0,1) divider doesn't exist) shouldn't be flagged as straddling
      // the (0,1) tilt. With the bug, the line was extrapolated to the
      // full bin and the bottom insert was incorrectly flagged.
      const config: CompartmentConfig = {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1, 2, 3],
        dividerOverrides: [
          // Tilt only the top-row half of the vertical boundary.
          { compartmentA: 0, compartmentB: 1, offsetStart: 15, offsetEnd: -15 },
        ],
      };
      // Insert in row-1's range (y > 0), well away from the row-0 segment.
      const bottomInsert = { x: -5, y: 25, width: 10, depth: 10 };
      expect(rectStraddlesTiltedDivider(config, 80, 80, bottomInsert)).toBe(false);
      // Insert in row-0's range (y < 0), straddling the tilt — should flag.
      const topInsert = { x: -10, y: -30, width: 20, depth: 20 };
      expect(rectStraddlesTiltedDivider(config, 80, 80, topInsert)).toBe(true);
    });

    it('rectStraddlesTiltedDivider skips zero-offset overrides', () => {
      const config: CompartmentConfig = {
        cols: 1,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1],
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 0, offsetEnd: 0 }],
      };
      const rect = { x: -15, y: -15, width: 30, depth: 30 };
      expect(rectStraddlesTiltedDivider(config, 80, 80, rect)).toBe(false);
    });

    it('detects a tilted back wall when the tilt is on a non-minCol neighbor', () => {
      // 2×2 with the top row merged into compartment 0 (spanning both cols)
      // and bottom row split into 1 (left) and 2 (right). The override is
      // between 0 and 2 — i.e. the right half of compartment 0's back wall.
      // Sampling only `bounds.minCol` would miss this because the back
      // neighbor at column 0 is compartment 1, not compartment 2.
      const config: CompartmentConfig = {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 2],
        dividerOverrides: [{ compartmentA: 0, compartmentB: 2, offsetStart: 5, offsetEnd: -5 }],
      };
      expect(compartmentHasTiltedBackWall(config, 0)).toBe(true);
    });
  });
});
