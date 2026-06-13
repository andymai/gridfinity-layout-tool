import { memo } from 'react';
import { Button } from '@/design-system';
import { useViewStore } from '@/core/store/view';
import type { GridAxisLabelsState } from '@/features/grid-editor/hooks/useGridAxisLabels';

/**
 * Grid Axis Labels Components
 *
 * Renders row and column labels for the grid with click-to-select functionality.
 * Extracted from Grid/index.tsx as part of component decomposition.
 */

export interface RowLabelsProps {
  /** Axis labels state from useGridAxisLabels hook */
  labels: GridAxisLabelsState;
  /** Full row size in pixels (for integer rows) */
  fullRowSize: number;
  /** Fractional row size in pixels (for 0.5 rows) */
  fractionalRowSize: number;
  /** Gap between cells in pixels */
  gap: number;
  /** Handle click on row label */
  onRowClick: (rowNum: number, event: React.MouseEvent) => void;
}

export interface ColumnLabelsProps {
  /** Axis labels state from useGridAxisLabels hook */
  labels: GridAxisLabelsState;
  /** Full column size in pixels (for integer columns) */
  fullColSize: number;
  /** Fractional column size in pixels (for 0.5 columns) */
  fractionalColSize: number;
  /** Gap between cells in pixels */
  gap: number;
  /** Top position of column labels (below grid) */
  gridTop: number;
  /** Handle click on column label */
  onColumnClick: (colNum: number, event: React.MouseEvent) => void;
}

/**
 * Row labels column - sticky to left edge
 */
export const RowLabels = memo(function RowLabels({
  labels,
  fullRowSize,
  fractionalRowSize,
  gap,
  onRowClick,
}: RowLabelsProps) {
  const setHighlightedRowLabel = useViewStore((state) => state.setHighlightedRowLabel);

  const { rowLabels, labelWidth, labelFontSize, hasFractionalDepth, fractionalEdgeY } = labels;

  // Build grid template based on fractionalEdgeY setting
  // 'end' = fractional at top (CSS row 1), 'start' = fractional at bottom (CSS row last)
  const rowTemplate = hasFractionalDepth
    ? fractionalEdgeY === 'end'
      ? `${fractionalRowSize}px repeat(${labels.integerDepth}, ${fullRowSize}px)` // Fractional at top
      : `repeat(${labels.integerDepth}, ${fullRowSize}px) ${fractionalRowSize}px` // Fractional at bottom
    : `repeat(${labels.integerDepth}, ${fullRowSize}px)`;

  return (
    <div
      className="bg-surface"
      style={{
        display: 'grid',
        gridTemplateRows: rowTemplate,
        gap: gap,
        paddingTop: gap,
        paddingBottom: gap,
        position: 'sticky',
        left: 0,
        zIndex: 30,
        alignSelf: 'start',
      }}
    >
      {rowLabels.map((num, idx) => {
        // Fractional row position depends on fractionalEdgeY setting
        const isFractionalRow =
          hasFractionalDepth &&
          ((fractionalEdgeY === 'end' && idx === 0) || // Top
            (fractionalEdgeY === 'start' && idx === rowLabels.length - 1)); // Bottom
        const rowHeight = isFractionalRow ? fractionalRowSize : fullRowSize;
        // Format label: show decimal for fractional, integer otherwise
        const label = typeof num === 'number' && num % 1 !== 0 ? num.toFixed(1) : num;

        return (
          <Button
            variant="ghost"
            key={`row-${num}`}
            type="button"
            touchTarget={false}
            className="group select-none rounded-none font-medium text-content-tertiary tabular-nums hover:bg-transparent hover:text-content cursor-pointer"
            style={{
              width: labelWidth,
              height: rowHeight,
              fontSize: isFractionalRow ? Math.max(6, labelFontSize - 2) : labelFontSize,
              minHeight: 0,
              minWidth: 0,
              padding: 0,
            }}
            onClick={(e) => typeof num === 'number' && onRowClick(Math.floor(num), e)}
            onMouseEnter={() => typeof num === 'number' && setHighlightedRowLabel(Math.floor(num))}
            onMouseLeave={() => setHighlightedRowLabel(null)}
            title={`Click to select row ${label}. Shift-click for range. Ctrl-click to add/remove.`}
            aria-label={`Select bins in row ${label}`}
          >
            {labelFontSize > 0 && label}
          </Button>
        );
      })}
    </div>
  );
});

/**
 * Column labels row - at bottom of grid
 */
export const ColumnLabels = memo(function ColumnLabels({
  labels,
  fullColSize,
  fractionalColSize,
  gap,
  gridTop,
  onColumnClick,
}: ColumnLabelsProps) {
  const setHighlightedColLabel = useViewStore((state) => state.setHighlightedColLabel);

  const { columnLabels, columnLabelHeight, labelFontSize, hasFractionalWidth, fractionalEdgeX } =
    labels;

  // Build grid template based on fractionalEdgeX setting
  // 'start' = fractional at left (CSS col 1), 'end' = fractional at right (CSS col last)
  const colTemplate = hasFractionalWidth
    ? fractionalEdgeX === 'start'
      ? `${fractionalColSize}px repeat(${labels.integerWidth}, ${fullColSize}px)` // Fractional at left
      : `repeat(${labels.integerWidth}, ${fullColSize}px) ${fractionalColSize}px` // Fractional at right
    : `repeat(${labels.integerWidth}, ${fullColSize}px)`;

  return (
    <div
      className="absolute left-0 bg-surface"
      style={{
        display: 'grid',
        gridTemplateColumns: colTemplate,
        gap: gap,
        padding: gap,
        paddingTop: 0,
        top: gridTop,
        height: columnLabelHeight,
        zIndex: 30,
      }}
    >
      {columnLabels.map((num, idx) => {
        // Fractional column position depends on fractionalEdgeX setting
        const isFractionalCol =
          hasFractionalWidth &&
          ((fractionalEdgeX === 'start' && idx === 0) || // Left
            (fractionalEdgeX === 'end' && idx === columnLabels.length - 1)); // Right
        const colWidth = isFractionalCol ? fractionalColSize : fullColSize;
        // Format label: show decimal for fractional, integer otherwise
        const label = typeof num === 'number' && num % 1 !== 0 ? num.toFixed(1) : num;

        return (
          <Button
            variant="ghost"
            key={`col-${num}`}
            type="button"
            touchTarget={false}
            className="group select-none rounded-none font-medium text-content-tertiary tabular-nums hover:bg-transparent hover:text-content cursor-pointer"
            style={{
              width: colWidth,
              height: columnLabelHeight,
              fontSize: isFractionalCol ? Math.max(6, labelFontSize - 2) : labelFontSize,
              minHeight: 0,
              minWidth: 0,
              padding: 0,
            }}
            onClick={(e) => typeof num === 'number' && onColumnClick(Math.floor(num), e)}
            onMouseEnter={() => typeof num === 'number' && setHighlightedColLabel(Math.floor(num))}
            onMouseLeave={() => setHighlightedColLabel(null)}
            title={`Click to select column ${label}. Shift-click for range. Ctrl-click to add/remove.`}
            aria-label={`Select bins in column ${label}`}
          >
            {labelFontSize > 0 && label}
          </Button>
        );
      })}
    </div>
  );
});
