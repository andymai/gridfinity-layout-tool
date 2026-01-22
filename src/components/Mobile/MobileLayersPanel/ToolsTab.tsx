import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';

// Square sizes (matching desktop ActiveLayerPanel)
const SQUARE_SIZES = [1, 2, 3, 4, 5, 6];

// Rectangle sizes (width × depth where width < depth)
const RECTANGLE_SIZES = [
  { w: 1, d: 2 },
  { w: 1, d: 3 },
  { w: 1, d: 4 },
  { w: 1, d: 5 },
  { w: 1, d: 6 },
  { w: 2, d: 3 },
  { w: 2, d: 4 },
  { w: 2, d: 5 },
  { w: 2, d: 6 },
  { w: 3, d: 4 },
  { w: 3, d: 5 },
  { w: 3, d: 6 },
  { w: 4, d: 5 },
  { w: 4, d: 6 },
  { w: 5, d: 6 },
];

/**
 * Tools tab content - bin palette for paint mode and layer fill actions.
 * Mobile-optimized with 44px touch targets.
 */
export function ToolsTab() {
  const [rotated, setRotated] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { layout, fillLayer, fillLayerGaps, clearLayer } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      fillLayer: state.fillLayer,
      fillLayerGaps: state.fillLayerGaps,
      clearLayer: state.clearLayer,
    }))
  );

  const {
    activeLayerId,
    activeCategoryId,
    paintSize,
    togglePaintSize,
    setPaintSize,
    setSelectedBins,
    halfBinMode,
    closeMobilePanel,
  } = useUIStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      activeCategoryId: state.activeCategoryId,
      paintSize: state.paintSize,
      togglePaintSize: state.togglePaintSize,
      setPaintSize: state.setPaintSize,
      setSelectedBins: state.setSelectedBins,
      halfBinMode: state.halfBinMode,
      closeMobilePanel: state.closeMobilePanel,
    }))
  );

  const addToast = useToastStore((state) => state.addToast);
  const { execute } = useUndoableAction();

  const activeLayer = layout.layers.find((l) => l.id === activeLayerId);
  const layerBins = layout.bins.filter((b) => b.layerId === activeLayerId);

  // Calculate empty cells for Fill Gaps button
  const totalCells = layout.drawer.width * layout.drawer.depth;
  const coveredCells = layerBins.reduce((sum, b) => sum + b.width * b.depth, 0);
  const emptyCells = totalCells - coveredCells;

  const isPaintActive = (w: number, d: number) => paintSize?.width === w && paintSize?.depth === d;

  const handleFillGaps = () => {
    if (!activeLayerId) return;
    const beforeCount = layerBins.length;
    execute(() => {
      fillLayerGaps(activeLayerId, activeCategoryId, halfBinMode);
    });
    closeMobilePanel();
    setTimeout(() => {
      const afterCount = useLayoutStore
        .getState()
        .layout.bins.filter((b) => b.layerId === activeLayerId).length;
      const added = afterCount - beforeCount;
      if (added > 0) {
        addToast(`Added ${added} bin${added !== 1 ? 's' : ''} to fill gaps`, 'success');
      }
    }, 0);
  };

  const handleClearLayer = () => {
    if (!activeLayerId || layerBins.length === 0) return;
    const count = layerBins.length;
    execute(() => {
      clearLayer(activeLayerId);
      setSelectedBins([]);
    });
    addToast(`Cleared ${count} bins from layer`, 'success');
    setShowClearConfirm(false);
    closeMobilePanel();
  };

  const handleFill = (width: number, depth: number) => {
    if (!activeLayerId) return;
    const beforeCount = layerBins.length;
    execute(() => {
      fillLayer(activeLayerId, width, depth, activeCategoryId, halfBinMode);
    });
    // Exit paint mode after filling
    setPaintSize(null);
    closeMobilePanel();
    setTimeout(() => {
      const afterCount = useLayoutStore
        .getState()
        .layout.bins.filter((b) => b.layerId === activeLayerId).length;
      const added = afterCount - beforeCount;
      if (added > 0) {
        addToast(`Added ${added} ${width}×${depth} bins`, 'success');
      }
    }, 0);
  };

  if (!activeLayer) return null;

  // Get rectangle dimensions based on rotation state
  const getRectDims = (w: number, d: number) => (rotated ? { w: d, d: w } : { w, d });

  // Mobile-optimized size button with larger touch targets
  const SizeButton = ({ w, d }: { w: number; d: number }) => {
    const isActive = isPaintActive(w, d);
    // Proportional preview scaled for mobile
    const previewWidth = w * 5;
    const previewHeight = d * 5;

    return (
      <button
        onClick={() => togglePaintSize({ width: w, depth: d })}
        className={`flex flex-col items-center justify-end gap-1 min-h-[56px] p-2 rounded transition-colors ${
          isActive
            ? 'bg-accent/20 ring-2 ring-accent'
            : 'bg-surface-elevated hover:bg-surface-hover'
        }`}
        aria-label={`${isActive ? 'Deselect' : 'Select'} ${w}×${d} for painting`}
      >
        <div
          className="rounded-[2px]"
          style={{
            width: previewWidth,
            height: previewHeight,
            backgroundColor: isActive ? 'var(--color-accent)' : 'var(--text-tertiary)',
          }}
        />
        <span
          className={`text-xs ${isActive ? 'text-accent font-medium' : 'text-content-tertiary'}`}
        >
          {w}×{d}
        </span>
      </button>
    );
  };

  return (
    <div className="pb-4">
      {/* Instructions */}
      <p className="text-xs text-content-tertiary mb-4">
        Select a size, then tap or drag on grid to place bins.
      </p>

      {/* Squares section */}
      <div className="text-xs text-content-tertiary mb-2 uppercase tracking-wide">Squares</div>
      <div className="grid grid-cols-6 gap-2">
        {SQUARE_SIZES.map((size) => (
          <SizeButton key={`${size}×${size}`} w={size} d={size} />
        ))}
      </div>

      {/* Rectangles section */}
      <div className="flex items-center justify-between mt-4 mb-2">
        <span className="text-xs text-content-tertiary uppercase tracking-wide">Rectangles</span>
        <button
          onClick={() => setRotated(!rotated)}
          className="text-xs text-content-tertiary hover:text-content flex items-center gap-1.5 px-2 py-1 rounded transition-colors"
          aria-label={rotated ? 'Switch to wide rectangles' : 'Switch to tall rectangles'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {rotated ? 'Tall' : 'Wide'}
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {RECTANGLE_SIZES.map(({ w, d }) => {
          const dims = getRectDims(w, d);
          return <SizeButton key={`${w}×${d}`} w={dims.w} d={dims.d} />;
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-6 space-y-2">
        {/* Fill with selected size (conditional) */}
        {paintSize && (
          <button
            onClick={() => handleFill(paintSize.width, paintSize.depth)}
            className="btn btn-primary w-full h-11 justify-center"
          >
            Fill with {paintSize.width}×{paintSize.depth}
          </button>
        )}

        {/* Fill Gaps */}
        <button
          onClick={handleFillGaps}
          disabled={emptyCells === 0}
          className="btn btn-secondary w-full h-11 justify-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
          {emptyCells > 0 ? `Fill ${emptyCells} Gaps` : 'No Gaps'}
        </button>

        {/* Clear Layer */}
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={layerBins.length === 0}
          className="btn btn-ghost w-full h-11 justify-center text-error hover:bg-error/10"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          {layerBins.length > 0 ? `Clear ${layerBins.length} Bins` : 'No Bins'}
        </button>
      </div>

      {/* Clear confirmation dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Layer"
        message={`Remove all ${layerBins.length} bin${layerBins.length !== 1 ? 's' : ''} from "${activeLayer.name}"? This can be undone.`}
        confirmText="Clear"
        destructive
        onConfirm={handleClearLayer}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
