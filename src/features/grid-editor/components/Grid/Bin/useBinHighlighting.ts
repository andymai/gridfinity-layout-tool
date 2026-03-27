import type { GridUnits } from '@/core/types';
import { useViewStore } from '@/core/store';

export interface BinHighlightingInput {
  binX: GridUnits;
  binY: GridUnits;
  binWidth: GridUnits;
  binDepth: GridUnits;
  categoryId: string | undefined;
}

export interface BinHighlightingResult {
  isCategoryHighlighted: boolean;
  isAnyCategoryHighlighted: boolean;
  isRowColHighlighted: boolean;
  isAnyRowColHighlighted: boolean;
}

/**
 * Hook that reads view store selectors for category and row/col highlighting.
 * Uses derived selectors so bins only re-render when their highlight state actually changes.
 */
export function useBinHighlighting(input: BinHighlightingInput): BinHighlightingResult {
  const { binX, binY, binWidth, binDepth, categoryId } = input;

  // Performance: Use derived selector for category highlighting.
  // This only re-renders bins whose highlight state actually changes.
  const isCategoryHighlighted = useViewStore(
    (state) => state.highlightedCategoryId !== null && state.highlightedCategoryId === categoryId
  );
  const isAnyCategoryHighlighted = useViewStore((state) => state.highlightedCategoryId !== null);

  // Performance: Use derived selector for row/column label highlighting.
  // Check if this bin overlaps with the highlighted row or column (1-indexed).
  const isRowColHighlighted = useViewStore((state) => {
    const { highlightedRowLabel, highlightedColLabel } = state;
    if (highlightedRowLabel === null && highlightedColLabel === null) return false;

    // Check row overlap: row N (1-indexed) corresponds to grid y = N-1
    // Bin occupies rows where bin.y <= rowY < bin.y + bin.depth
    if (highlightedRowLabel !== null) {
      const rowY = highlightedRowLabel - 1; // Convert 1-indexed to 0-indexed
      if (rowY >= binY && rowY < binY + binDepth) return true;
    }

    // Check column overlap: column N (1-indexed) corresponds to grid x = N-1
    // Bin occupies columns where bin.x <= colX < bin.x + bin.width
    if (highlightedColLabel !== null) {
      const colX = highlightedColLabel - 1; // Convert 1-indexed to 0-indexed
      if (colX >= binX && colX < binX + binWidth) return true;
    }

    return false;
  });
  const isAnyRowColHighlighted = useViewStore(
    (state) => state.highlightedRowLabel !== null || state.highlightedColLabel !== null
  );

  return {
    isCategoryHighlighted,
    isAnyCategoryHighlighted,
    isRowColHighlighted,
    isAnyRowColHighlighted,
  };
}
