import React, { useState, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore, useUndoableAction } from '../store';
import { STAGING_ID, CONSTRAINTS, calcMaxGridUnits, DEFAULT_CATEGORY_COLOR } from '../constants';
import { generatePrintList, getTotalBins, getTotalPieces, getTotalFilament, getSpoolEstimate } from '../utils/split';
import { getLayerZStart } from '../utils/collision';
import { clamp } from '../utils/validation';
import { exportPrintListTSV } from '../utils/storage';
import { ConfirmDialog } from './modals/ConfirmDialog';
import type { PrintPiece } from '../types';

const STYLES = {
  // Split preview piece - custom colors not in Tailwind
  splitPiece: {
    backgroundColor: 'var(--color-primary-muted)',
    border: '1px solid var(--color-primary)',
    borderRadius: '2px',
    fontSize: '9px',
    color: 'var(--text-secondary)',
  },

  // Dynamic inline styles for hover effects
  textareaResize: { resize: 'vertical' as const, minHeight: '60px' },
} as const;

/**
 * Small visual showing how a bin compares to max print bed size.
 * Shows print bed outline with bin overlaid, scaled proportionally.
 */
function PrintBedIndicator({
  binWidth,
  binDepth,
  maxUnits,
  gridUnitMm,
  printBedSize,
}: {
  binWidth: number;
  binDepth: number;
  maxUnits: number;
  gridUnitMm: number;
  printBedSize: number;
}) {
  const size = 64; // Visual size in pixels
  const padding = 4;
  const innerSize = size - padding * 2;

  // Scale: print bed = full inner size
  const scale = innerSize / printBedSize;

  // Bin dimensions in mm (including gap allowance)
  const binWidthMm = binWidth * gridUnitMm;
  const binDepthMm = binDepth * gridUnitMm;

  // Max printable area indicator
  const maxMm = maxUnits * gridUnitMm;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      title={`Print bed: ${printBedSize}×${printBedSize}mm, Max bin: ${maxUnits}×${maxUnits} units`}
    >
      {/* Print bed outline */}
      <div
        className="absolute border-2 border-dashed border-stroke rounded-sm"
        style={{
          left: padding,
          top: padding,
          width: innerSize,
          height: innerSize,
        }}
      />

      {/* Max printable zone */}
      <div
        className="absolute bg-success/10 border border-success/30 rounded-sm"
        style={{
          left: padding,
          bottom: padding,
          width: Math.min(maxMm * scale, innerSize),
          height: Math.min(maxMm * scale, innerSize),
        }}
      />

      {/* Bin overlay (shows overflow) */}
      <div
        className="absolute bg-warning/30 border-2 border-warning rounded-sm"
        style={{
          left: padding,
          bottom: padding,
          width: Math.min(binWidthMm * scale, innerSize + padding),
          height: Math.min(binDepthMm * scale, innerSize + padding),
        }}
      />

      {/* Label */}
      <div className="absolute bottom-0 right-0 text-[8px] text-content-disabled px-0.5">
        {printBedSize}mm
      </div>
    </div>
  );
}

/**
 * Visual preview of how a bin will be split for printing.
 * Shows a grid diagram with the split pieces.
 */
function SplitPreview({ width, depth, pieces }: { width: number; depth: number; pieces: PrintPiece[] }) {
  // Create a 2D grid to place pieces
  const grid: (PrintPiece | null)[][] = Array.from({ length: depth }, () =>
    Array.from({ length: width }, () => null)
  );

  // Place pieces using greedy left-to-right, bottom-to-top
  const placedPieces: Array<{ piece: PrintPiece; x: number; y: number }> = [];
  const piecesToPlace = pieces.flatMap(p => Array(p.count).fill({ width: p.width, depth: p.depth }));

  for (const piece of piecesToPlace) {
    // Find first available position
    outer: for (let y = 0; y < depth; y++) {
      for (let x = 0; x < width; x++) {
        // Check if piece fits at this position
        let fits = true;
        if (x + piece.width > width || y + piece.depth > depth) {
          fits = false;
        } else {
          for (let py = y; py < y + piece.depth && fits; py++) {
            for (let px = x; px < x + piece.width && fits; px++) {
              if (grid[py][px] !== null) fits = false;
            }
          }
        }

        if (fits) {
          // Place the piece
          for (let py = y; py < y + piece.depth; py++) {
            for (let px = x; px < x + piece.width; px++) {
              grid[py][px] = piece;
            }
          }
          placedPieces.push({ piece, x, y });
          break outer;
        }
      }
    }
  }

  const cellSize = 16;
  const gap = 2;

  return (
    <div
      className="relative"
      style={{
        width: width * cellSize + (width - 1) * gap,
        height: depth * cellSize + (depth - 1) * gap,
      }}
    >
      {placedPieces.map((placed) => (
        <div
          key={`${placed.x}-${placed.y}-${placed.piece.width}x${placed.piece.depth}`}
          className="absolute flex items-center justify-center"
          style={{
            left: placed.x * (cellSize + gap),
            bottom: placed.y * (cellSize + gap),
            width: placed.piece.width * cellSize + (placed.piece.width - 1) * gap,
            height: placed.piece.depth * cellSize + (placed.piece.depth - 1) * gap,
            ...STYLES.splitPiece,
          }}
        >
          {placed.piece.width}×{placed.piece.depth}
        </div>
      ))}
    </div>
  );
}

export function RightPanel() {
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [printListExpanded, setPrintListExpanded] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [expandedSplitRow, setExpandedSplitRow] = useState<number | null>(null);

  const { selectedBinIds, setSelectedBins, collapsed, toggle } = useUIStore(
    useShallow((state) => ({
      selectedBinIds: state.selectedBinIds,
      setSelectedBins: state.setSelectedBins,
      collapsed: state.rightPanelCollapsed,
      toggle: state.toggleRightPanel,
    }))
  );

  const { layout, updateBin, deleteBin, moveBinToStaging } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      updateBin: state.updateBin,
      deleteBin: state.deleteBin,
      moveBinToStaging: state.moveBinToStaging,
    }))
  );

  const { execute } = useUndoableAction();

  // Single selection vs multi-selection
  const selectedBins = layout.bins.filter(b => selectedBinIds.includes(b.id));
  const isMultiSelect = selectedBins.length > 1;
  const bin = selectedBins.length === 1 ? selectedBins[0] : null;
  const category = bin ? layout.categories.find(c => c.id === bin.category) : null;
  const layer = bin ? layout.layers.find(l => l.id === bin.layerId) : null;

  // Calculate max height for selected bin
  const maxBinHeight = bin && layer
    ? layout.drawer.height - getLayerZStart(bin.layerId, layout.layers)
    : 1;

  // Calculate max grid units from print bed size (accounting for gaps between bins)
  const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);

  // Memoize print list calculation - expensive operation
  const printRows = useMemo(
    () => generatePrintList(layout.bins, maxGridUnits),
    [layout.bins, maxGridUnits]
  );
  const totalBins = useMemo(() => getTotalBins(printRows), [printRows]);
  const totalPieces = useMemo(() => getTotalPieces(printRows), [printRows]);
  const totalFilament = useMemo(() => getTotalFilament(printRows), [printRows]);
  const spoolEstimate = useMemo(() => getSpoolEstimate(totalFilament), [totalFilament]);
  const hasAnySplits = useMemo(() => printRows.some(r => r.needsSplit), [printRows]);

  // Calculate max clearance for selected bin
  const maxClearance = bin && layer
    ? layout.drawer.height - getLayerZStart(bin.layerId, layout.layers) - bin.height
    : 0;

  const handleUpdateBin = (field: 'width' | 'depth' | 'height' | 'clearanceHeight' | 'category' | 'label' | 'notes', value: string | number) => {
    if (!bin) return;
    execute(() => {
      if (field === 'width' || field === 'depth') {
        updateBin(bin.id, { [field]: Math.max(1, parseInt(value as string, 10) || 1) });
      } else if (field === 'height') {
        const minHeight = layer?.height || 1;
        const newHeight = clamp(typeof value === 'number' ? value : parseInt(value, 10) || minHeight, minHeight, maxBinHeight);
        updateBin(bin.id, { height: newHeight });
      } else if (field === 'clearanceHeight') {
        const newClearance = clamp(typeof value === 'number' ? value : parseInt(value, 10) || 0, 0, maxClearance);
        updateBin(bin.id, { clearanceHeight: newClearance });
      } else {
        updateBin(bin.id, { [field]: value });
      }
    });
  };

  const handleUpdateMultiCategory = (categoryId: string) => {
    if (selectedBins.length === 0) return;
    execute(() => {
      for (const b of selectedBins) {
        updateBin(b.id, { category: categoryId });
      }
    });
  };

  const handleUpdateMultiHeight = (delta: number) => {
    if (selectedBins.length === 0) return;
    execute(() => {
      for (const b of selectedBins) {
        const binLayer = layout.layers.find(l => l.id === b.layerId);
        const minHeight = binLayer?.height || 1;
        const binMaxHeight = layout.drawer.height - getLayerZStart(b.layerId, layout.layers);
        const newHeight = clamp(b.height + delta, minHeight, binMaxHeight);
        updateBin(b.id, { height: newHeight });
      }
    });
  };

  const handleDeleteBin = () => {
    if (selectedBins.length === 0) return;
    setConfirmDelete({
      title: selectedBins.length > 1 ? 'Delete Bins' : 'Delete Bin',
      message: selectedBins.length > 1
        ? `Delete ${selectedBins.length} selected bins?`
        : `Delete this ${bin?.width}×${bin?.depth} bin?`,
    });
  };

  const confirmDeleteBin = () => {
    if (selectedBins.length === 0) return;
    execute(() => {
      for (const b of selectedBins) {
        deleteBin(b.id);
      }
    });
    setSelectedBins([]);
    setConfirmDelete(null);
  };

  const handleMoveToStaging = () => {
    if (selectedBins.length === 0) return;
    execute(() => {
      for (const b of selectedBins) {
        moveBinToStaging(b.id);
      }
    });
  };

  const needsSplit = bin ? (bin.width > maxGridUnits || bin.depth > maxGridUnits) : false;

  const cancelDelete = useCallback(() => {
    setConfirmDelete(null);
  }, []);

  if (collapsed) {
    return (
      <aside
        className="flex-shrink-0 flex flex-col transition-all duration-200 ease-in-out bg-surface-secondary border-l border-stroke-subtle"
        style={{ width: '40px' }}
      >
        <div className="flex flex-col items-center py-3">
          <button
            onClick={toggle}
            className="p-1 rounded transition-colors text-content-secondary hover:bg-surface-hover hover:text-content"
            title="Expand panel"
            aria-label="Expand right panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </aside>
    );
  }

  const collapseButton = (
    <button
      onClick={toggle}
      className="flex-shrink-0 p-1 rounded transition-colors text-content-tertiary hover:bg-surface-hover hover:text-content"
      title="Collapse panel"
      aria-label="Collapse right panel"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    </button>
  );

  return (
    <aside
      className="flex-shrink-0 flex flex-col h-full overflow-hidden transition-all duration-200 ease-in-out bg-surface-secondary border-l border-stroke-subtle"
      style={{ width: '288px' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stroke-subtle">
        {collapseButton}
        <h2 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider">
          Inspector
        </h2>
      </div>

      {/* Selection Panel */}
      {isMultiSelect ? (
        /* Multi-selection panel */
        <div className="p-4 animate-fade-in border-b border-stroke-subtle">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center bg-accent shadow-sm"
              aria-hidden="true"
            >
              <span className="text-[10px] font-bold text-black">{selectedBins.length}</span>
            </div>
            <h2 className="flex-1 text-lg font-semibold text-content">
              {selectedBins.length} Bins Selected
            </h2>
            <button
              onClick={() => setSelectedBins([])}
              className="btn btn-ghost w-7 h-7 p-0 min-w-0 min-h-0"
              aria-label="Deselect all bins"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-content-secondary mb-4">
            Drag to move all selected bins together, or use arrow keys to nudge.
          </p>

          {/* Category for multiple bins */}
          <div className="mb-3">
            <label className="block mb-1 text-xs text-content-tertiary">
              Category
            </label>
            <div className="relative">
              {selectedBins.every(b => b.category === selectedBins[0]?.category) ? (
                <div
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded pointer-events-none"
                  style={{ backgroundColor: layout.categories.find(c => c.id === selectedBins[0]?.category)?.color || DEFAULT_CATEGORY_COLOR }}
                />
              ) : (
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded pointer-events-none bg-surface-hover border border-stroke-subtle" />
              )}
              <select
                value={
                  // Show common category if all selected bins have the same one, otherwise empty
                  selectedBins.every(b => b.category === selectedBins[0]?.category)
                    ? selectedBins[0]?.category || ''
                    : ''
                }
                onChange={(e) => handleUpdateMultiCategory(e.target.value)}
                className="input w-full pl-8 pr-8 appearance-none"
                aria-label="Category for selected bins"
              >
                {!selectedBins.every(b => b.category === selectedBins[0]?.category) && (
                  <option value="" disabled>
                    {(() => {
                      // Show category breakdown: "2 Tools, 1 Hardware"
                      const counts = new Map<string, number>();
                      for (const b of selectedBins) {
                        counts.set(b.category, (counts.get(b.category) || 0) + 1);
                      }
                      const parts: string[] = [];
                      counts.forEach((count, catId) => {
                        const cat = layout.categories.find(c => c.id === catId);
                        parts.push(`${count} ${cat?.name || 'Unknown'}`);
                      });
                      return parts.slice(0, 3).join(', ') + (parts.length > 3 ? '...' : '');
                    })()}
                  </option>
                )}
                {layout.categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <svg
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-content-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Height control for multiple bins */}
          <div className="mb-3">
            <label className="block mb-1 text-xs text-content-tertiary">
              Height
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleUpdateMultiHeight(-1)}
                className="btn btn-secondary w-10 h-10 p-0 min-w-[40px] min-h-[40px]"
                aria-label="Decrease height"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="flex-1 text-center font-semibold text-lg text-content">
                {selectedBins.every(b => b.height === selectedBins[0]?.height)
                  ? `${selectedBins[0]?.height}u`
                  : (() => {
                      const heights = selectedBins.map(b => b.height);
                      const minH = Math.min(...heights);
                      const maxH = Math.max(...heights);
                      return `${minH}–${maxH}u`;
                    })()}
              </span>
              <button
                onClick={() => handleUpdateMultiHeight(1)}
                className="btn btn-secondary w-10 h-10 p-0 min-w-[40px] min-h-[40px]"
                aria-label="Increase height"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Actions for multiple bins */}
          <div className="flex gap-2">
            {selectedBins.some(b => b.layerId !== STAGING_ID) && (
              <button
                onClick={handleMoveToStaging}
                className="btn btn-secondary flex-1"
              >
                To Stash
              </button>
            )}
            <button
              onClick={handleDeleteBin}
              className="btn btn-danger flex-1"
            >
              Delete All
            </button>
          </div>
        </div>
      ) : bin ? (
        <div className="p-4 animate-fade-in border-b border-stroke-subtle">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-5 h-5 rounded flex-shrink-0 shadow-sm"
              style={{ backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR }}
              aria-hidden="true"
            />
            <h2 className="flex-1 text-lg font-semibold text-content">
              {bin.width}×{bin.depth} Bin
            </h2>
            <button
              onClick={() => setSelectedBins([])}
              className="btn btn-ghost w-7 h-7 p-0 min-w-0 min-h-0"
              aria-label="Deselect bin"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Size inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-xs text-content-tertiary">
                  Width
                </label>
                <input
                  type="number"
                  value={bin.width}
                  onChange={(e) => handleUpdateBin('width', e.target.value)}
                  className="input w-full"
                  min={1}
                  aria-label="Bin width"
                />
              </div>
              <div>
                <label className="block mb-1 text-xs text-content-tertiary">
                  Depth
                </label>
                <input
                  type="number"
                  value={bin.depth}
                  onChange={(e) => handleUpdateBin('depth', e.target.value)}
                  className="input w-full"
                  min={1}
                  aria-label="Bin depth"
                />
              </div>
            </div>

            {/* Height control with +/- buttons */}
            <div>
              <label className="block mb-1 text-xs text-content-tertiary">
                Height
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateBin('height', bin.height - 1)}
                  disabled={bin.height <= (layer?.height ?? 1)}
                  className="btn btn-secondary w-10 h-10 p-0 min-w-[40px] min-h-[40px]"
                  aria-label="Decrease height"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="flex-1 text-center font-semibold text-lg text-content">
                  {bin.height}u
                </span>
                <button
                  onClick={() => handleUpdateBin('height', bin.height + 1)}
                  disabled={bin.height >= maxBinHeight}
                  className="btn btn-secondary w-10 h-10 p-0 min-w-[40px] min-h-[40px]"
                  aria-label="Increase height"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <div className="text-center mt-1 text-xs text-content-disabled">
                Range: {layer?.height}u – {maxBinHeight}u
              </div>
            </div>

            {/* Clearance control - only show with 2+ layers */}
            {layout.layers.length > 1 && (
              <div>
                <label className="block mb-1 text-xs text-content-tertiary" title="Extra blocked space above this bin for tall contents (e.g., scissors, tools)">
                  Clearance
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateBin('clearanceHeight', (bin.clearanceHeight || 0) - 1)}
                    disabled={(bin.clearanceHeight || 0) <= 0}
                    className="btn btn-secondary w-10 h-10 p-0 min-w-[40px] min-h-[40px]"
                    aria-label="Decrease clearance"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="flex-1 text-center font-semibold text-lg text-content">
                    {bin.clearanceHeight || 0}u
                  </span>
                  <button
                    onClick={() => handleUpdateBin('clearanceHeight', (bin.clearanceHeight || 0) + 1)}
                    disabled={(bin.clearanceHeight || 0) >= maxClearance}
                    className="btn btn-secondary w-10 h-10 p-0 min-w-[40px] min-h-[40px]"
                    aria-label="Increase clearance"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <div className="text-center mt-1 text-xs text-content-disabled">
                  Blocks {bin.clearanceHeight || 0}u above bin
                </div>
              </div>
            )}

            {/* Split warning with print bed visualization */}
            {needsSplit && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-warning-muted)] border border-[var(--color-warning)] text-[var(--color-warning)] text-sm">
                <PrintBedIndicator
                  binWidth={bin.width}
                  binDepth={bin.depth}
                  maxUnits={maxGridUnits}
                  gridUnitMm={layout.gridUnitMm}
                  printBedSize={layout.printBedSize}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">Exceeds print bed</span>
                  </div>
                  <p className="text-xs opacity-80">
                    Will be split into {Math.ceil(bin.width / maxGridUnits) * Math.ceil(bin.depth / maxGridUnits)} pieces
                    (max {maxGridUnits}×{maxGridUnits} per piece)
                  </p>
                </div>
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block mb-1 text-xs text-content-tertiary">
                Category
              </label>
              <div className="relative">
                <div
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded pointer-events-none"
                  style={{ backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR }}
                />
                <select
                  value={bin.category}
                  onChange={(e) => handleUpdateBin('category', e.target.value)}
                  className="input w-full pl-8 pr-8 appearance-none"
                  aria-label="Bin category"
                >
                  {layout.categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <svg
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-content-tertiary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="block mb-1 text-xs text-content-tertiary">
                Label
              </label>
              <input
                type="text"
                value={bin.label}
                onChange={(e) => handleUpdateBin('label', e.target.value.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH))}
                className="input w-full"
                placeholder="Optional label"
                aria-label="Bin label"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block mb-1 text-xs text-content-tertiary">
                Notes
              </label>
              <textarea
                value={bin.notes}
                onChange={(e) => handleUpdateBin('notes', e.target.value.slice(0, CONSTRAINTS.NOTES_MAX_LENGTH))}
                className="input w-full"
                placeholder="e.g., 2 dividers, STL link, contents"
                aria-label="Bin notes"
                rows={3}
                style={STYLES.textareaResize}
              />
              <div className="text-right mt-1 text-[10px] text-content-disabled">
                {bin.notes.length}/{CONSTRAINTS.NOTES_MAX_LENGTH}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {bin.layerId !== STAGING_ID && (
                <button
                  onClick={handleMoveToStaging}
                  className="btn btn-secondary flex-1"
                >
                  To Stash
                </button>
              )}
              <button
                onClick={handleDeleteBin}
                className="btn btn-danger flex-1"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state when no bin selected */
        <div className="p-4 border-b border-stroke-subtle">
          <div className="empty-state py-4">
            <div className="empty-state-icon">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-sm text-content-secondary mb-1">
              No bin selected
            </p>
            <p className="text-xs text-content-disabled">
              Click a bin to edit its properties
            </p>
          </div>
        </div>
      )}

      {/* Print List - Collapsible */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className={`flex items-center justify-between px-4 py-3 ${printListExpanded ? 'border-b border-stroke-subtle' : ''}`}>
          <button
            className="flex items-center gap-2 transition-colors bg-transparent"
            onClick={() => setPrintListExpanded(!printListExpanded)}
            aria-expanded={printListExpanded}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 text-content-tertiary ${printListExpanded ? 'rotate-0' : '-rotate-90'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <h2 className="section-header m-0">Bin List</h2>
            {printRows.length > 0 && (
              <span className="badge badge-info">{totalBins}</span>
            )}
          </button>
          {printRows.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const tsv = exportPrintListTSV(printRows);
                navigator.clipboard.writeText(tsv);
                setCopyFeedback(true);
                setTimeout(() => setCopyFeedback(false), 2000);
              }}
              className="btn btn-ghost p-1.5 min-w-0 min-h-0"
              title="Copy as TSV for spreadsheets"
              aria-label="Copy bin list as TSV"
            >
              {copyFeedback ? (
                <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
        </div>

        <div
          className={`flex-1 flex flex-col min-h-0 transition-all duration-200 ${printListExpanded ? 'opacity-100' : 'opacity-0 max-h-0'}`}
        >
          <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
            {printRows.length === 0 ? (
              <div className="empty-state py-6 px-4">
                <div className="empty-state-icon">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-content-secondary mb-1">
                  No bins placed yet
                </p>
                <p className="text-xs text-content-disabled">
                  Draw or click to place bins on the grid
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-elevated">
                  <tr>
                    <th className="pl-4 pr-2 py-2 text-left font-medium sticky top-0 text-content-secondary bg-surface-elevated">
                      Size
                    </th>
                    <th className="px-2 py-2 text-left font-medium sticky top-0 text-content-secondary bg-surface-elevated" title="Height">
                      H
                    </th>
                    <th className="px-2 py-2 text-right font-medium sticky top-0 text-content-secondary bg-surface-elevated" title="Quantity">
                      Qty
                    </th>
                    {hasAnySplits && (
                      <th className="px-2 py-2 text-right font-medium sticky top-0 text-content-secondary bg-surface-elevated" title="Pieces after split">
                        Pcs
                      </th>
                    )}
                    <th className="pl-2 pr-4 py-2 text-right font-medium sticky top-0 text-content-secondary bg-surface-elevated" title="Estimated filament (meters)">
                      ~m
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {printRows.map((row, index) => {
                    const isExpanded = expandedSplitRow === index;
                    const [w, d] = row.size.split('×').map(Number);

                    return (
                      <React.Fragment key={`${row.size}-${row.height}-${row.labels.join(',')}`}>
                        <tr
                          className={`transition-colors hover:bg-surface-hover ${isExpanded ? '' : 'border-b border-stroke-subtle'} ${row.needsSplit ? 'cursor-pointer' : 'cursor-default'}`}
                          onClick={() => row.needsSplit && setExpandedSplitRow(isExpanded ? null : index)}
                        >
                          <td className="pl-4 pr-2 py-2 text-content">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1.5">
                                {/* Category color dots with name tooltip */}
                                <span
                                  className="inline-flex gap-0.5"
                                  title={row.categoryIds.map(catId => layout.categories.find(c => c.id === catId)?.name || 'Unknown').join(', ')}
                                >
                                  {row.categoryIds.slice(0, 3).map((catId) => {
                                    const cat = layout.categories.find(c => c.id === catId);
                                    return (
                                      <span
                                        key={catId}
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: cat?.color || DEFAULT_CATEGORY_COLOR }}
                                        aria-label={cat?.name || 'Unknown category'}
                                      />
                                    );
                                  })}
                                  {row.categoryIds.length > 3 && (
                                    <span className="text-[9px] text-content-disabled">+{row.categoryIds.length - 3}</span>
                                  )}
                                </span>
                                {row.size}
                                {row.needsSplit && (
                                  <svg
                                    className={`w-3.5 h-3.5 flex-shrink-0 transition-transform text-[var(--color-warning)] ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-label="Click to see split preview"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                )}
                              </span>
                              {/* Label and Notes */}
                              {(row.labels[0] || row.notes) && (
                                <span className="flex items-center gap-1">
                                  {row.labels[0] && (
                                    <span
                                      className="text-xs truncate text-content-tertiary max-w-[80px]"
                                      title={row.labels[0]}
                                    >
                                      {row.labels[0]}
                                    </span>
                                  )}
                                  {row.notes && (
                                    <span title={row.notes}>
                                      <svg
                                        className="w-3 h-3 flex-shrink-0 text-content-disabled"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                      </svg>
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-content-tertiary">
                            {row.height}u
                          </td>
                          <td className="px-2 py-2 text-right text-content">
                            {row.binCount}
                          </td>
                          {hasAnySplits && (
                            <td className="px-2 py-2 text-right text-content">
                              {row.totalPieces}
                            </td>
                          )}
                          <td className="pl-2 pr-4 py-2 text-right text-content-tertiary">
                            {row.filament}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-surface-elevated">
                            <td
                              colSpan={hasAnySplits ? 5 : 4}
                              className="px-4 py-3 border-b border-stroke-subtle"
                            >
                              <div className="flex items-start gap-4">
                                <SplitPreview width={w} depth={d} pieces={row.pieces} />
                                <div className="text-xs text-content-secondary">
                                  <div className="font-medium mb-1">
                                    Split into {row.totalPieces} pieces:
                                  </div>
                                  {row.pieces.map((piece) => (
                                    <div key={`${piece.width}x${piece.depth}`} className="text-content-tertiary">
                                      {piece.count}× {piece.width}×{piece.depth}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {printRows.length > 0 && (
            <div className="px-4 py-3 border-t border-stroke-subtle bg-surface-elevated">
              <div className="flex justify-between font-medium mb-2 text-sm text-content">
                <span>Total</span>
                <span>{totalBins} bins{hasAnySplits ? `, ${totalPieces} pieces` : ''}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-stroke-subtle text-xs text-content-secondary">
                <span className="text-content-tertiary">Est. filament</span>
                <span title="Based on 1kg spool (~330m of 1.75mm PLA)">{totalFilament}m (~{spoolEstimate}× 1kg)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title={confirmDelete?.title || ''}
        message={confirmDelete?.message || ''}
        confirmText="Delete"
        destructive
        onConfirm={confirmDeleteBin}
        onCancel={cancelDelete}
      />
    </aside>
  );
}
