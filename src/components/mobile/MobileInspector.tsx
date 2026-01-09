import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore, useUndoableAction } from '../../store';
import { STAGING_ID, CONSTRAINTS, calcMaxGridUnits, DEFAULT_CATEGORY_COLOR } from '../../constants';
import { getLayerZStart } from '../../utils/collision';
import { clamp } from '../../utils/validation';
import { ConfirmDialog } from '../modals/ConfirmDialog';

/**
 * Mobile-optimized bin inspector with large touch targets.
 */
export function MobileInspector() {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { selectedBinIds, setSelectedBins, closeMobilePanel } = useUIStore(
    useShallow((state) => ({
      selectedBinIds: state.selectedBinIds,
      setSelectedBins: state.setSelectedBins,
      closeMobilePanel: state.closeMobilePanel,
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

  const selectedBins = layout.bins.filter(b => selectedBinIds.includes(b.id));
  const isMultiSelect = selectedBins.length > 1;
  const bin = selectedBins.length === 1 ? selectedBins[0] : null;
  const category = bin ? layout.categories.find(c => c.id === bin.category) : null;
  const layer = bin ? layout.layers.find(l => l.id === bin.layerId) : null;

  const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);

  // Calculate max height
  const maxBinHeight = bin && layer
    ? layout.drawer.height - getLayerZStart(bin.layerId, layout.layers)
    : 1;

  // Calculate max clearance for selected bin
  const maxClearance = bin && layer
    ? layout.drawer.height - getLayerZStart(bin.layerId, layout.layers) - bin.height
    : 0;

  const handleUpdateBin = (field: string, value: string | number) => {
    if (!bin) return;
    execute(() => {
      if (field === 'width' || field === 'depth') {
        updateBin(bin.id, { [field]: Math.max(1, parseInt(value as string, 10) || 1) });
      } else if (field === 'height') {
        const minHeight = layer?.height || 1;
        const newHeight = clamp(typeof value === 'number' ? value : parseInt(value, 10) || minHeight, minHeight, maxBinHeight);
        // Adjust clearance to keep total (height + clearance) constant
        const currentTotal = bin.height + (bin.clearanceHeight || 0);
        const newClearance = Math.max(0, currentTotal - newHeight);
        updateBin(bin.id, { height: newHeight, clearanceHeight: newClearance });
      } else if (field === 'clearanceHeight') {
        const newClearance = clamp(typeof value === 'number' ? value : parseInt(value, 10) || 0, 0, maxClearance);
        updateBin(bin.id, { clearanceHeight: newClearance });
      } else {
        updateBin(bin.id, { [field]: value });
      }
    });
  };

  const handleUpdateMultiCategory = (categoryId: string) => {
    execute(() => {
      for (const b of selectedBins) {
        updateBin(b.id, { category: categoryId });
      }
    });
  };

  const handleUpdateMultiHeight = (delta: number) => {
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
    execute(() => {
      for (const b of selectedBins) {
        deleteBin(b.id);
      }
    });
    setSelectedBins([]);
    setConfirmDelete(false);
    closeMobilePanel();
  };

  const handleMoveToStaging = () => {
    execute(() => {
      for (const b of selectedBins) {
        moveBinToStaging(b.id);
      }
    });
    closeMobilePanel();
  };

  // Empty state
  if (selectedBins.length === 0) {
    return (
      <div className="py-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-surface-elevated">
          <svg className="w-8 h-8 text-content-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <p className="font-medium mb-1 text-content-secondary">No bin selected</p>
        <p className="text-sm mb-4 text-content-disabled">
          Tap a bin on the grid to edit it
        </p>

        {/* Creation hint */}
        <div className="mx-4 p-3 rounded-lg text-left bg-surface-elevated border border-stroke-subtle">
          <p className="text-sm font-medium mb-2 text-content-secondary">
            How to create bins:
          </p>
          <ul className="text-sm space-y-1.5 text-content-tertiary">
            <li className="flex items-start gap-2">
              <span className="text-accent">1.</span>
              <span>Tap and drag on empty grid cells to draw a bin</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent">2.</span>
              <span>Or use <strong>Layers</strong> tab to select a size, then tap to place</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent">3.</span>
              <span>Long-press a bin for quick actions</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // Multi-select
  if (isMultiSelect) {
    const commonCategory = selectedBins.every(b => b.category === selectedBins[0]?.category)
      ? selectedBins[0]?.category
      : null;

    return (
      <div className="pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg bg-accent text-black">
            {selectedBins.length}
          </div>
          <div>
            <h3 className="font-semibold text-content">
              {selectedBins.length} Bins Selected
            </h3>
            <p className="text-sm text-content-tertiary">
              Move or delete together
            </p>
          </div>
        </div>

        {/* Category selector */}
        <div className="mb-4">
          <label className="block text-sm mb-2 text-content-tertiary">
            Category
          </label>
          <div className="relative">
            {commonCategory ? (
              <div
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded pointer-events-none"
                style={{ backgroundColor: layout.categories.find(c => c.id === commonCategory)?.color || DEFAULT_CATEGORY_COLOR }}
              />
            ) : (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded pointer-events-none bg-surface-hover border border-stroke-subtle" />
            )}
            <select
              value={commonCategory || ''}
              onChange={(e) => handleUpdateMultiCategory(e.target.value)}
              className="input w-full h-12 pl-10 pr-10 appearance-none"
            >
              {!commonCategory && (
                <option value="" disabled>Mixed categories</option>
              )}
              {layout.categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none text-content-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Height control */}
        <div className="mb-4">
          <label className="block text-sm mb-2 text-content-tertiary">
            Height
          </label>
          <div className="flex items-center">
            <button
              onClick={() => handleUpdateMultiHeight(-1)}
              className="btn btn-secondary w-12 h-12 p-0 rounded-r-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="flex-1 h-12 flex items-center justify-center font-semibold bg-surface-elevated text-content">
              {selectedBins.every(b => b.height === selectedBins[0]?.height)
                ? `${selectedBins[0]?.height}u`
                : 'Mixed'}
            </span>
            <button
              onClick={() => handleUpdateMultiHeight(1)}
              className="btn btn-secondary w-12 h-12 p-0 rounded-l-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {selectedBins.some(b => b.layerId !== STAGING_ID) && (
            <button onClick={handleMoveToStaging} className="btn btn-secondary flex-1">
              To Stash
            </button>
          )}
          <button onClick={() => setConfirmDelete(true)} className="btn btn-danger flex-1">
            Delete All
          </button>
        </div>

        <ConfirmDialog
          isOpen={confirmDelete}
          title="Delete Bins"
          message={`Delete ${selectedBins.length} selected bins?`}
          confirmText="Delete"
          destructive
          onConfirm={handleDeleteBin}
          onCancel={() => setConfirmDelete(false)}
        />
      </div>
    );
  }

  // Single bin - after early returns, bin is guaranteed to be non-null
  // TypeScript needs explicit guard since the early returns don't directly check `bin`
  if (!bin) return null;

  const needsSplit = bin.width > maxGridUnits || bin.depth > maxGridUnits;

  return (
    <div className="pb-4">
      {/* Bin header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-lg flex-shrink-0"
          style={{ backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR }}
        />
        <div>
          <h3 className="font-semibold text-content">
            {bin.width}×{bin.depth} Bin
          </h3>
          <p className="text-sm text-content-tertiary">
            {layer?.name || 'Unknown layer'}
          </p>
        </div>
      </div>

      {/* Size controls */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-sm mb-1 text-content-tertiary">
            Width
          </label>
          <div className="flex items-center">
            <button
              onClick={() => handleUpdateBin('width', bin.width - 1)}
              disabled={bin.width <= 1}
              className="btn btn-secondary w-12 h-12 p-0 rounded-r-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="flex-1 h-12 flex items-center justify-center font-semibold bg-surface-elevated text-content">
              {bin.width}
            </span>
            <button
              onClick={() => handleUpdateBin('width', bin.width + 1)}
              className="btn btn-secondary w-12 h-12 p-0 rounded-l-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1 text-content-tertiary">
            Depth
          </label>
          <div className="flex items-center">
            <button
              onClick={() => handleUpdateBin('depth', bin.depth - 1)}
              disabled={bin.depth <= 1}
              className="btn btn-secondary w-12 h-12 p-0 rounded-r-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="flex-1 h-12 flex items-center justify-center font-semibold bg-surface-elevated text-content">
              {bin.depth}
            </span>
            <button
              onClick={() => handleUpdateBin('depth', bin.depth + 1)}
              className="btn btn-secondary w-12 h-12 p-0 rounded-l-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Height control */}
      <div className="mb-4">
        <label className="block text-sm mb-1 text-content-tertiary">
          Height
        </label>
        <div className="flex items-center">
          <button
            onClick={() => handleUpdateBin('height', bin.height - 1)}
            disabled={bin.height <= (layer?.height ?? 1)}
            className="btn btn-secondary w-12 h-12 p-0 rounded-r-none"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="flex-1 h-12 flex items-center justify-center font-semibold bg-surface-elevated text-content">
            {bin.height}u
          </span>
          <button
            onClick={() => handleUpdateBin('height', bin.height + 1)}
            disabled={bin.height >= maxBinHeight}
            className="btn btn-secondary w-12 h-12 p-0 rounded-l-none"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="text-center text-xs mt-1 text-content-disabled">
          Range: {layer?.height}u – {maxBinHeight}u
        </div>
      </div>

      {/* Clearance control - only show with 2+ layers */}
      {layout.layers.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm mb-1 text-content-tertiary">
            Clearance
          </label>
          <div className="flex items-center">
            <button
              onClick={() => handleUpdateBin('clearanceHeight', (bin.clearanceHeight || 0) - 1)}
              disabled={(bin.clearanceHeight || 0) <= 0}
              className="btn btn-secondary w-12 h-12 p-0 rounded-r-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="flex-1 h-12 flex items-center justify-center font-semibold bg-surface-elevated text-content">
              {bin.clearanceHeight || 0}u
            </span>
            <button
              onClick={() => handleUpdateBin('clearanceHeight', (bin.clearanceHeight || 0) + 1)}
              disabled={(bin.clearanceHeight || 0) >= maxClearance}
              className="btn btn-secondary w-12 h-12 p-0 rounded-l-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="text-center text-xs mt-1 text-content-disabled">
            Blocks {bin.clearanceHeight || 0}u above bin
          </div>
        </div>
      )}

      {/* Split warning */}
      {needsSplit && (
        <div className="flex items-center gap-2 p-3 rounded-lg mb-4 bg-[var(--color-warning-muted)] border border-[var(--color-warning)] text-[var(--color-warning)]">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm">Will be split for printing</span>
        </div>
      )}

      {/* Category */}
      <div className="mb-4">
        <label className="block text-sm mb-1 text-content-tertiary">
          Category
        </label>
        <div className="relative">
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded pointer-events-none"
            style={{ backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR }}
          />
          <select
            value={bin.category}
            onChange={(e) => handleUpdateBin('category', e.target.value)}
            className="input w-full h-12 pl-10 pr-10 appearance-none"
          >
            {layout.categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none text-content-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Label */}
      <div className="mb-4">
        <label className="block text-sm mb-1 text-content-tertiary">
          Label
        </label>
        <input
          type="text"
          value={bin.label}
          onChange={(e) => handleUpdateBin('label', e.target.value.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH))}
          className="input w-full h-12"
          placeholder="Optional label"
        />
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-sm mb-1 text-content-tertiary">
          Notes
        </label>
        <textarea
          value={bin.notes}
          onChange={(e) => handleUpdateBin('notes', e.target.value.slice(0, CONSTRAINTS.NOTES_MAX_LENGTH))}
          className="input w-full"
          placeholder="Optional notes"
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {bin.layerId !== STAGING_ID && (
          <button onClick={handleMoveToStaging} className="btn btn-secondary flex-1">
            To Stash
          </button>
        )}
        <button onClick={() => setConfirmDelete(true)} className="btn btn-danger flex-1">
          Delete
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Bin"
        message={`Delete this ${bin?.width}×${bin?.depth} bin?`}
        confirmText="Delete"
        destructive
        onConfirm={handleDeleteBin}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
