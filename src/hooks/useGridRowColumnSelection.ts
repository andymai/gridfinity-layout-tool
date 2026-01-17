import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useSelectionStore } from '../core/store/selection';
import type { Bin } from '../core/types';
import { STAGING_ID } from '../core/constants';

/**
 * Grid Row/Column Selection Hook
 *
 * Handles row/column click-to-select with support for:
 * - Single click: select all bins in row/column
 * - Shift-click: range selection from last clicked
 * - Ctrl/Cmd-click: toggle bins in row/column
 *
 * Extracted from Grid/index.tsx as part of component decomposition.
 */

export interface GridRowColumnSelectionState {
  /** Handle click on row label - selects bins occupying that row */
  handleRowClick: (rowNum: number, event: React.MouseEvent) => void;
  /** Handle click on column label - selects bins occupying that column */
  handleColumnClick: (colNum: number, event: React.MouseEvent) => void;
}

export interface UseGridRowColumnSelectionOptions {
  /** All bins in the layout */
  bins: Bin[];
  /** Active layer ID for filtering bins */
  activeLayerId: string;
}

export function useGridRowColumnSelection(
  options: UseGridRowColumnSelectionOptions
): GridRowColumnSelectionState {
  const { bins, activeLayerId } = options;

  const { selectedBinIds, setSelectedBins } = useSelectionStore(
    useShallow((state) => ({
      selectedBinIds: state.selectedBinIds,
      setSelectedBins: state.setSelectedBins,
    }))
  );

  // Note: setHighlightedRowLabel and setHighlightedColLabel are accessed
  // directly by GridAxisLabels component via useViewStore, not through this hook

  // Track last clicked row/column for shift-click range selection
  const [lastClickedRow, setLastClickedRow] = useState<number | null>(null);
  const [lastClickedCol, setLastClickedCol] = useState<number | null>(null);

  // Get all bins that occupy any row in the given range (1-indexed row numbers)
  const getBinsInRowRange = useCallback(
    (startRow: number, endRow: number): Bin[] => {
      const minRow = Math.min(startRow, endRow) - 1; // Convert to 0-indexed
      const maxRow = Math.max(startRow, endRow) - 1;
      return bins.filter(
        (b) =>
          b.layerId === activeLayerId &&
          b.layerId !== STAGING_ID &&
          // Bin occupies rows from b.y to b.y + b.depth - 1
          // Check if bin overlaps with range [minRow, maxRow]
          b.y + b.depth - 1 >= minRow &&
          b.y <= maxRow
      );
    },
    [bins, activeLayerId]
  );

  // Get all bins that occupy any column in the given range (1-indexed column numbers)
  const getBinsInColRange = useCallback(
    (startCol: number, endCol: number): Bin[] => {
      const minCol = Math.min(startCol, endCol) - 1; // Convert to 0-indexed
      const maxCol = Math.max(startCol, endCol) - 1;
      return bins.filter(
        (b) =>
          b.layerId === activeLayerId &&
          b.layerId !== STAGING_ID &&
          // Bin occupies columns from b.x to b.x + b.width - 1
          // Check if bin overlaps with range [minCol, maxCol]
          b.x + b.width - 1 >= minCol &&
          b.x <= maxCol
      );
    },
    [bins, activeLayerId]
  );

  // Select all bins that occupy a given row (1-indexed row number)
  // Supports shift-click for range selection and ctrl/cmd-click to add/remove
  const handleRowClick = useCallback(
    (rowNum: number, event: React.MouseEvent) => {
      // Convert 1-indexed to 0-indexed Y coordinate
      const rowY = rowNum - 1;
      // Find all bins on the active layer that occupy this row
      const binsInRow = bins.filter(
        (b) =>
          b.layerId === activeLayerId &&
          b.layerId !== STAGING_ID &&
          rowY >= b.y &&
          rowY < b.y + b.depth
      );

      const binIds = binsInRow.map((b) => b.id);

      if (event.shiftKey && lastClickedRow !== null) {
        // Shift-click: select range from last clicked row to this row
        const rangeBins = getBinsInRowRange(lastClickedRow, rowNum);
        const rangeIds = rangeBins.map((b) => b.id);
        // Add range to existing selection (deduplicated)
        setSelectedBins([...new Set([...selectedBinIds, ...rangeIds])]);
        // Update anchor for subsequent shift-clicks
        setLastClickedRow(rowNum);
      } else if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd-click: toggle bins in this row
        if (binIds.length > 0) {
          const allSelected = binIds.every((id) => selectedBinIds.includes(id));
          if (allSelected) {
            // Remove all bins in this row from selection
            setSelectedBins(selectedBinIds.filter((id) => !binIds.includes(id)));
          } else {
            // Add all bins in this row to selection
            setSelectedBins([...new Set([...selectedBinIds, ...binIds])]);
          }
        }
        setLastClickedRow(rowNum);
      } else {
        // Normal click: replace selection
        if (binIds.length > 0) {
          setSelectedBins(binIds);
        }
        setLastClickedRow(rowNum);
      }
    },
    [bins, activeLayerId, setSelectedBins, lastClickedRow, selectedBinIds, getBinsInRowRange]
  );

  // Select all bins that occupy a given column (1-indexed column number)
  // Supports shift-click for range selection and ctrl/cmd-click to add/remove
  const handleColumnClick = useCallback(
    (colNum: number, event: React.MouseEvent) => {
      // Convert 1-indexed to 0-indexed X coordinate
      const colX = colNum - 1;
      // Find all bins on the active layer that occupy this column
      const binsInCol = bins.filter(
        (b) =>
          b.layerId === activeLayerId &&
          b.layerId !== STAGING_ID &&
          colX >= b.x &&
          colX < b.x + b.width
      );

      const binIds = binsInCol.map((b) => b.id);

      if (event.shiftKey && lastClickedCol !== null) {
        // Shift-click: select range from last clicked column to this column
        const rangeBins = getBinsInColRange(lastClickedCol, colNum);
        const rangeIds = rangeBins.map((b) => b.id);
        // Add range to existing selection (deduplicated)
        setSelectedBins([...new Set([...selectedBinIds, ...rangeIds])]);
        // Update anchor for subsequent shift-clicks
        setLastClickedCol(colNum);
      } else if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd-click: toggle bins in this column
        if (binIds.length > 0) {
          const allSelected = binIds.every((id) => selectedBinIds.includes(id));
          if (allSelected) {
            // Remove all bins in this column from selection
            setSelectedBins(selectedBinIds.filter((id) => !binIds.includes(id)));
          } else {
            // Add all bins in this column to selection
            setSelectedBins([...new Set([...selectedBinIds, ...binIds])]);
          }
        }
        setLastClickedCol(colNum);
      } else {
        // Normal click: replace selection
        if (binIds.length > 0) {
          setSelectedBins(binIds);
        }
        setLastClickedCol(colNum);
      }
    },
    [bins, activeLayerId, setSelectedBins, lastClickedCol, selectedBinIds, getBinsInColRange]
  );

  // Note: setHighlightedRowLabel and setHighlightedColLabel are used directly
  // by the GridAxisLabels component for hover highlighting, not returned here

  return {
    handleRowClick,
    handleColumnClick,
  };
}
