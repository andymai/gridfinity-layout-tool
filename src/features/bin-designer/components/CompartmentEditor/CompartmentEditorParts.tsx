/**
 * Sub-components for the compartment editor's 2D grid view:
 *   - `GridCell`     — one interactive cell with merge/split visualization
 *   - `GhostPreview` — drag-time preview overlay (single dashed pulse for
 *                     merge, individual cell outlines for split)
 */

import { useMemo, type ReactNode } from 'react';
import { cellIndex, getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import {
  getCompartmentFill,
  getPreviewBorderColor,
} from '@/features/bin-designer/hooks/usePreviewColor';

/** Renders a single cell in the compartment grid with dynamic styling and keyboard support. */
export function GridCell({
  idx,
  compartmentId,
  isSelected,
  isHovered,
  isSplittable,
  isDragging,
  config,
  previewColor,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  idx: number;
  compartmentId: number;
  isSelected: boolean;
  isHovered: boolean;
  isSplittable: boolean;
  isDragging: boolean;
  config: CompartmentConfig;
  previewColor: string;
  onPointerDown: (idx: number) => void;
  onPointerEnter: (idx: number) => void;
  onPointerLeave: () => void;
}) {
  const col = idx % config.cols;
  const row = Math.floor(idx / config.cols);

  // Determine which edges are at the boundary of this compartment
  // Note: Visual orientation is flipped via flex-col-reverse, so:
  // - Data row 0 is at VISUAL BOTTOM
  // - Data row (rows-1) is at VISUAL TOP
  // - "Visual top neighbor" = data row + 1 (higher row index, rendered above)
  // - "Visual bottom neighbor" = data row - 1 (lower row index, rendered below)
  const hasRightNeighbor =
    col < config.cols - 1 && config.cells[cellIndex(config.cols, col + 1, row)] === compartmentId;
  const hasVisualTopNeighbor =
    row < config.rows - 1 && config.cells[cellIndex(config.cols, col, row + 1)] === compartmentId;
  const hasLeftNeighbor =
    col > 0 && config.cells[cellIndex(config.cols, col - 1, row)] === compartmentId;
  const hasVisualBottomNeighbor =
    row > 0 && config.cells[cellIndex(config.cols, col, row - 1)] === compartmentId;

  // Round only the outer corners of the entire grid (not interior compartment corners)
  const cornerRadius = 5;
  const isAtGridTop = row === config.rows - 1;
  const isAtGridBottom = row === 0;
  const isAtGridLeft = col === 0;
  const isAtGridRight = col === config.cols - 1;
  const topLeft = isAtGridTop && isAtGridLeft ? cornerRadius : 0;
  const topRight = isAtGridTop && isAtGridRight ? cornerRadius : 0;
  const bottomRight = isAtGridBottom && isAtGridRight ? cornerRadius : 0;
  const bottomLeft = isAtGridBottom && isAtGridLeft ? cornerRadius : 0;

  const fillColor = getCompartmentFill(compartmentId, previewColor);
  const borderColor = getPreviewBorderColor(previewColor);

  // Build box-shadow for compartment edges (inset shadows that properly merge)
  // Walls are shared: only draw right/bottom for internal boundaries to avoid doubling
  // Always draw all edges for outer grid boundaries
  const shadowParts: string[] = [];
  const shadowWidth = 2;
  const isTopEdge = row === config.rows - 1; // Visual top of grid
  const isLeftEdge = col === 0;

  // Top: only draw if outer grid edge, OR if it's a compartment boundary (always draw bottom of neighbor)
  if (!hasVisualTopNeighbor && isTopEdge) {
    shadowParts.push(`inset 0 ${shadowWidth}px 0 0 ${borderColor}`);
  }
  // Right: always draw compartment boundaries (this is the "owned" side)
  if (!hasRightNeighbor) {
    shadowParts.push(`inset -${shadowWidth}px 0 0 0 ${borderColor}`);
  }
  // Bottom: always draw compartment boundaries (this is the "owned" side)
  if (!hasVisualBottomNeighbor) {
    shadowParts.push(`inset 0 -${shadowWidth}px 0 0 ${borderColor}`);
  }
  // Left: only draw if outer grid edge
  if (!hasLeftNeighbor && isLeftEdge) {
    shadowParts.push(`inset ${shadowWidth}px 0 0 0 ${borderColor}`);
  }
  const boxShadow = shadowParts.length > 0 ? shadowParts.join(', ') : 'none';

  // Show dimension label on the visual top-left cell of multi-cell compartments (hover only)
  const isTopLeftOfCompartment = !hasVisualTopNeighbor && !hasLeftNeighbor;
  let dimensionLabel: string | null = null;
  if (isTopLeftOfCompartment && isSplittable) {
    const bounds = getCompartmentBounds(config, compartmentId);
    if (bounds) {
      const cWidth = bounds.maxCol - bounds.minCol + 1;
      const cHeight = bounds.maxRow - bounds.minRow + 1;
      dimensionLabel = `${cWidth}×${cHeight}`;
    }
  }

  // Determine the cell's accessible label
  const cellLabel = dimensionLabel
    ? `Compartment ${compartmentId + 1}, ${dimensionLabel}, ${isSplittable ? 'click to split' : ''}`
    : `Cell ${col + 1}, ${row + 1}`;

  // Reveal the dimension label only when this specific cell is hovered.
  const showDimensionLabel = isHovered && dimensionLabel;

  return (
    <div
      className="relative touch-manipulation min-w-[28px] min-h-[28px]"
      role="button"
      tabIndex={0}
      aria-label={cellLabel}
      aria-pressed={isSelected}
      style={{
        backgroundColor: isSelected
          ? 'var(--color-accent)'
          : isHovered && isSplittable
            ? 'var(--color-accent-muted, hsl(214, 60%, 85%))'
            : fillColor,
        borderRadius: `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`,
        boxShadow: isSelected ? `inset 0 0 0 2px var(--color-accent)` : boxShadow,
        opacity: isSelected ? 0.8 : 1,
        cursor: isDragging ? 'crosshair' : isSplittable ? 'pointer' : 'crosshair',
        transition: 'all 150ms ease-out',
        transform: isSelected ? 'scale(0.97)' : 'scale(1)',
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        onPointerDown(idx);
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onPointerDown(idx);
        }
      }}
      onPointerEnter={() => onPointerEnter(idx)}
      onPointerLeave={onPointerLeave}
    >
      {/* Dimension label - shown on hover only */}
      {dimensionLabel && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums transition-opacity duration-100"
          style={{
            color: 'var(--color-accent)',
            opacity: showDimensionLabel ? 1 : 0,
          }}
        >
          {dimensionLabel}
        </span>
      )}
    </div>
  );
}

/** Shows a preview of what the merge/split result will look like during drag. */
export function GhostPreview({
  selection,
  selectionAction,
  cols,
  rows,
}: {
  selection: Set<number>;
  selectionAction: 'merge' | 'split' | 'none';
  cols: number;
  rows: number;
}) {
  // Compute bounding box of selection
  const bounds = useMemo(() => {
    if (selection.size === 0) return null;
    let minCol = cols,
      maxCol = 0,
      minRow = rows,
      maxRow = 0;
    for (const idx of selection) {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
    }
    return { minCol, maxCol, minRow, maxRow };
  }, [selection, cols, rows]);

  if (!bounds || selectionAction === 'none') return null;

  const { minCol, maxCol, minRow, maxRow } = bounds;

  // For merge: show single unified preview
  // For split: show individual cell previews
  if (selectionAction === 'merge') {
    // Calculate position as percentages (remember flex-col-reverse: row 0 = bottom)
    const left = (minCol / cols) * 100;
    const right = ((cols - maxCol - 1) / cols) * 100;
    // Visual top = data maxRow+1, visual bottom = data minRow
    const top = ((rows - maxRow - 1) / rows) * 100;
    const bottom = (minRow / rows) * 100;

    return (
      <div
        className="pointer-events-none absolute animate-pulse"
        style={{
          left: `${left}%`,
          right: `${right}%`,
          top: `${top}%`,
          bottom: `${bottom}%`,
          border: '2px dashed var(--color-accent)',
          borderRadius: '4px',
          backgroundColor: 'var(--color-accent)',
          opacity: 0.15,
        }}
      />
    );
  }

  // For split: show individual cell outlines
  const cellPreviews: ReactNode[] = [];
  for (const idx of selection) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const left = (col / cols) * 100;
    const width = (1 / cols) * 100;
    // Visual positioning (flex-col-reverse)
    const top = ((rows - row - 1) / rows) * 100;
    const height = (1 / rows) * 100;

    cellPreviews.push(
      <div
        key={idx}
        className="pointer-events-none absolute animate-pulse"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
          border: '1px dashed var(--color-accent)',
          backgroundColor: 'var(--color-accent)',
          opacity: 0.1,
        }}
      />
    );
  }

  return <>{cellPreviews}</>;
}
