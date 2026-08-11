/**
 * The compartment grid itself: cells, intersection dots, divider hit targets
 * and the drag ghost. Driven entirely by {@link useCompartmentGrid}, so the
 * sidebar and the Bento workspace draw the same grid from the same model and
 * differ only in how much room they give it.
 *
 * Sizing is the caller's business. The sidebar caps the grid to a fixed
 * envelope; the workspace lets it fill the pane. Both keep the bin's true
 * top-view proportions via `aspectRatio`.
 */

import { GridCell, GhostPreview } from './CompartmentEditorParts';
import { DividerHitTargets } from './DividerHitTargets';
import type { CompartmentGridApi } from './useCompartmentGrid';
import type { CSSProperties } from 'react';

export interface CompartmentGridViewProps {
  readonly grid: CompartmentGridApi;
  /** Extra sizing constraints (e.g. the sidebar's fixed envelope cap). */
  readonly style?: CSSProperties;
  readonly className?: string;
  /** Element id holding the instruction text, for `aria-describedby`. */
  readonly describedById?: string;
  /**
   * Makes the walls draggable. Supplying this also shows the divider overlay
   * unconditionally: the sidebar keeps it behind the `angledDividersEnabled`
   * opt-in so dense grids stay legible (#2044), but in the Bento workspace
   * moving walls IS the mode, so hiding the handles would hide the feature.
   */
  readonly dividerDrag?: {
    readonly onDragStart: (key: string, event: React.PointerEvent) => void;
    readonly draggingKey: string | null;
  };
}

export function CompartmentGridView({
  grid,
  style,
  className = '',
  describedById,
  dividerDrag,
}: CompartmentGridViewProps) {
  const {
    compartments,
    cols,
    rows,
    cells,
    interiorW,
    interiorD,
    aspectRatio,
    gridDots,
    labeling,
    previewColor,
    angledDividersEnabled,
    eligibleDividers,
    dividerHighlightCompartments,
    dividerTiltPreview,
    selectedDividerKey,
    hoveredDividerKey,
    setSelectedDividerKey,
    setHoveredDividerKey,
    rowLabelForHitTarget,
    selection,
    isDragging,
    hoverIdx,
    setHoverIdx,
    selectionAction,
    compartmentCellCounts,
    gridRef,
    handleCellPointerDown,
    handleCellPointerEnter,
    handleCellPointerLeave,
    handlePointerUp,
  } = grid;

  return (
    <div
      ref={gridRef}
      className={`relative select-none overflow-hidden rounded-lg border-2 border-stroke-subtle bg-surface-elevated p-2 ${className}`}
      style={{ aspectRatio, ...style }}
      role="application"
      aria-label={`Compartment grid, ${cols} columns by ${rows} rows`}
      aria-describedby={describedById}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        handlePointerUp();
        setHoverIdx(null);
      }}
    >
      {/* Grid dots overlay at intersections */}
      {gridDots.length > 0 && (
        <div className="pointer-events-none absolute inset-2">
          {gridDots.map(({ x, y }, i) => (
            <div
              key={i}
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-content-tertiary/40"
              style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
            />
          ))}
        </div>
      )}
      {/* Use flex-col-reverse to match 3D orientation: row 0 = front = bottom of UI */}
      {/* No gap - merged cells should visually connect; borders handle separation */}
      <div className="relative flex h-full w-full flex-col-reverse">
        {Array.from({ length: rows }, (_, visualRow) => {
          const dataRow = visualRow; // flex-col-reverse handles the flip
          return (
            <div
              key={dataRow}
              className="grid min-h-0 min-w-0 flex-1"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
            >
              {Array.from({ length: cols }, (_, col) => {
                const idx = dataRow * cols + col;
                const compartmentId = cells[idx];
                return (
                  <GridCell
                    key={idx}
                    idx={idx}
                    compartmentId={compartmentId}
                    isSelected={selection.has(idx)}
                    isHovered={hoverIdx === idx && !isDragging}
                    isSplittable={
                      !isDragging && (compartmentCellCounts.get(compartmentId) ?? 0) > 1
                    }
                    isDragging={isDragging}
                    isDividerHoverHighlighted={dividerHighlightCompartments.has(compartmentId)}
                    labelMode={labeling.labelMode}
                    isLabelSelected={labeling.labelMode && labeling.editingId === compartmentId}
                    labelText={labeling.textOf(compartmentId)}
                    displayNumber={labeling.displayNumberOf(compartmentId)}
                    config={compartments}
                    previewColor={previewColor}
                    onPointerDown={handleCellPointerDown}
                    onPointerEnter={handleCellPointerEnter}
                    onPointerLeave={handleCellPointerLeave}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      {/* Divider hit targets: clickable lines above the cells, transparent
          container with per-line pointer-events so cell drag-merge still
          works. Hidden during cell-merge drag to keep the surface calm. */}
      {!isDragging && (angledDividersEnabled || dividerDrag) && eligibleDividers.length > 0 && (
        <DividerHitTargets
          compartments={compartments}
          dividers={eligibleDividers}
          interiorW={interiorW}
          interiorD={interiorD}
          preview={dividerTiltPreview}
          selectedKey={selectedDividerKey}
          hoveredKey={hoveredDividerKey}
          onSelect={setSelectedDividerKey}
          onHoverChange={setHoveredDividerKey}
          rowLabel={rowLabelForHitTarget}
          onDragStart={dividerDrag?.onDragStart}
          draggingKey={dividerDrag?.draggingKey ?? null}
        />
      )}
      {/* Ghost preview overlay during cell-select drag */}
      {isDragging && selection.size >= 2 && (
        <GhostPreview
          selection={selection}
          selectionAction={selectionAction}
          cols={cols}
          rows={rows}
        />
      )}
    </div>
  );
}
