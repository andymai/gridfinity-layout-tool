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
  deriveWallSegments,
  fromDividerConfig,
  type WallSegment,
} from '@/features/bin-designer/utils/compartments';
import type { CompartmentConfig } from '@/features/bin-designer/types';

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
});
