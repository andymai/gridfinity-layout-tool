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
  getContrastingTextColor,
} from '@/features/bin-designer/hooks/usePreviewColor';
import { useTranslation } from '@/i18n';

/** Renders a single cell in the compartment grid with dynamic styling and keyboard support. */
export function GridCell({
  idx,
  compartmentId,
  isSelected,
  isHovered,
  isSplittable,
  isDragging,
  isDividerHoverHighlighted = false,
  labelMode = false,
  isLabelSelected = false,
  labelText = '',
  displayNumber,
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
  /** True when this compartment is one of the two adjacent to the hovered divider.
   *  Optional + defaults to false so unit tests and any future call site that
   *  doesn't care about divider hover don't have to thread the prop. */
  isDividerHoverHighlighted?: boolean;
  /** True while the editor is in "Add labels" mode (click selects to label). */
  labelMode?: boolean;
  /** True when this compartment is the one currently being labeled. */
  isLabelSelected?: boolean;
  /** Committed label text for this compartment; shown always when present. */
  labelText?: string;
  /** 1-based compartment number, shown on empty cells while labeling. */
  displayNumber?: number;
  config: CompartmentConfig;
  previewColor: string;
  onPointerDown: (idx: number) => void;
  onPointerEnter: (idx: number) => void;
  onPointerLeave: () => void;
}) {
  const t = useTranslation();
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

  // Labels render once per compartment, on its visual top-left cell. The
  // dimension overlay is a divider-mode hover affordance, so it's suppressed
  // while labeling.
  const isTopLeftOfCompartment = !hasVisualTopNeighbor && !hasLeftNeighbor;
  let dimensionLabel: string | null = null;
  if (isTopLeftOfCompartment && isSplittable && !labelMode) {
    const bounds = getCompartmentBounds(config, compartmentId);
    if (bounds) {
      const cWidth = bounds.maxCol - bounds.minCol + 1;
      const cHeight = bounds.maxRow - bounds.minRow + 1;
      dimensionLabel = `${cWidth}×${cHeight}`;
    }
  }

  // The user's label is always visible (recognition over recall, and hover
  // doesn't exist on touch). Empty compartments show their number, but only
  // while labeling — divider editing stays an uncluttered color grid.
  const trimmedLabel = labelText.trim();
  const showLabelText = isTopLeftOfCompartment && trimmedLabel.length > 0;
  const showEmptyNumber =
    isTopLeftOfCompartment && labelMode && trimmedLabel.length === 0 && displayNumber !== undefined;

  // In label mode a cell IS a labeling target, so it announces the compartment
  // number (matching the visible number and the "Comp. N" field) rather than a
  // grid coordinate.
  let cellLabel: string;
  if (trimmedLabel) {
    cellLabel = t('binDesigner.compartmentEditor.compartmentAriaLabeled', {
      n: displayNumber ?? compartmentId + 1,
      label: trimmedLabel,
    });
  } else if (labelMode && displayNumber !== undefined) {
    cellLabel = t('binDesigner.compartmentEditor.compartmentAriaNumber', { n: displayNumber });
  } else if (dimensionLabel && isSplittable) {
    cellLabel = t('binDesigner.compartmentEditor.compartmentAriaSplittable', {
      n: compartmentId + 1,
      dimension: dimensionLabel,
    });
  } else if (dimensionLabel) {
    cellLabel = t('binDesigner.compartmentEditor.compartmentAria', {
      n: compartmentId + 1,
      dimension: dimensionLabel,
    });
  } else {
    cellLabel = t('binDesigner.compartmentEditor.cellAria', { col: col + 1, row: row + 1 });
  }

  // Reveal the dimension label only when this specific cell is hovered.
  const showDimensionLabel = isHovered && dimensionLabel;

  return (
    <div
      className="relative touch-manipulation min-w-0 min-h-0"
      role="button"
      tabIndex={0}
      aria-label={cellLabel}
      aria-pressed={labelMode ? isLabelSelected : isSelected}
      style={{
        backgroundColor: isSelected
          ? 'var(--color-accent)'
          : isHovered && isSplittable
            ? 'var(--color-accent-muted, hsl(214, 60%, 85%))'
            : fillColor,
        borderRadius: `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`,
        boxShadow: isSelected
          ? `inset 0 0 0 2px var(--color-accent)`
          : isLabelSelected
            ? `inset 0 0 0 2px var(--color-accent), ${boxShadow}`
            : boxShadow,
        opacity: isSelected ? 0.8 : 1,
        cursor: isDragging ? 'crosshair' : labelMode || isSplittable ? 'pointer' : 'crosshair',
        // Brighten the adjacent compartments when their divider is hovered/selected.
        // Filter is composable with the existing background and avoids fighting the
        // inset-shadow border system; pulse-free since the divider hover is the
        // primary signal — this is a quiet companion highlight.
        filter: isDividerHoverHighlighted ? 'brightness(1.18)' : 'none',
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
      {/* Dimension label - shown on hover only (divider mode) */}
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
      {/* Always-visible compartment label (truncated; full text via title).
          Text color contrasts the compartment FILL (filament color), not the
          theme, so it never sits white-on-white / black-on-black. */}
      {showLabelText && (
        <span
          title={trimmedLabel}
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap px-1 text-center text-[10px] font-semibold leading-tight"
          style={{ color: getContrastingTextColor(previewColor) }}
        >
          {trimmedLabel}
        </span>
      )}
      {/* Empty compartment: show its number while labeling. */}
      {showEmptyNumber && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-medium tabular-nums"
          style={{ color: getContrastingTextColor(previewColor), opacity: 0.55 }}
        >
          {displayNumber}
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
