import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '../../store';
import { useToastStore } from '../../store/toast';

// Square sizes
const SQUARE_SIZES = [1, 2, 3, 4, 5, 6];

// Rectangle sizes (width × depth where width < depth)
const RECTANGLE_SIZES = [
  { w: 1, d: 2 }, { w: 1, d: 3 }, { w: 1, d: 4 }, { w: 1, d: 5 }, { w: 1, d: 6 },
  { w: 2, d: 3 }, { w: 2, d: 4 }, { w: 2, d: 5 }, { w: 2, d: 6 },
  { w: 3, d: 4 }, { w: 3, d: 5 }, { w: 3, d: 6 },
  { w: 4, d: 5 }, { w: 4, d: 6 },
  { w: 5, d: 6 },
];

export function ActiveLayerPanel() {
  const [rotated, setRotated] = useState(false);

  const { layout, fillLayer } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      fillLayer: state.fillLayer,
    }))
  );

  const {
    activeLayerId,
    activeCategoryId,
    paintSize,
    togglePaintSize,
  } = useUIStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      activeCategoryId: state.activeCategoryId,
      paintSize: state.paintSize,
      togglePaintSize: state.togglePaintSize,
    }))
  );

  const addToast = useToastStore(state => state.addToast);
  const { execute } = useUndoableAction();

  const isPaintActive = (w: number, d: number) =>
    paintSize?.width === w && paintSize?.depth === d;

  const activeLayer = layout.layers.find(l => l.id === activeLayerId);
  const layerBins = layout.bins.filter(b => b.layerId === activeLayerId);

  const handleFill = (width: number, depth: number) => {
    if (!activeLayerId) return;
    const beforeCount = layerBins.length;
    execute(() => {
      fillLayer(activeLayerId, width, depth, activeCategoryId);
    });
    setTimeout(() => {
      const afterCount = useLayoutStore.getState().layout.bins.filter(b => b.layerId === activeLayerId).length;
      const added = afterCount - beforeCount;
      if (added > 0) {
        addToast(`Added ${added} ${width}×${depth} bins`, 'success');
      }
    }, 0);
  };

  if (!activeLayer) return null;

  // Helper to render a size button with proportional preview
  const SizeButton = ({ w, d, className = '' }: { w: number; d: number; className?: string }) => {
    const isActive = isPaintActive(w, d);
    // Pure proportional sizing for correct aspect ratios
    // Multiplier of 4 ensures 6x6 (24x24px) fits within narrow grid cells
    const previewWidth = w * 4;
    const previewHeight = d * 4;
    return (
      <button
        onClick={() => togglePaintSize({ width: w, depth: d })}
        className={`flex flex-col items-center justify-end gap-1 h-[60px] p-1.5 rounded transition-colors ${isActive ? 'bg-accent/20' : 'hover:bg-surface-hover'} ${className}`}
        aria-label={`${isActive ? 'Deselect' : 'Select'} ${w}×${d} for painting`}
        title={`Click to paint ${w}×${d} bins`}
      >
        <div
          className="rounded-[1px]"
          style={{
            width: previewWidth,
            height: previewHeight,
            backgroundColor: isActive ? 'var(--color-accent)' : 'var(--text-tertiary)',
          }}
        />
        <span className={`text-[9px] ${isActive ? 'text-accent' : 'text-content-tertiary'}`}>{w}×{d}</span>
      </button>
    );
  };

  // Get rectangle dimensions based on rotation state
  const getRectDims = (w: number, d: number) => rotated ? { w: d, d: w } : { w, d };

  return (
    <div>
      {/* Bin Palette header */}
      <h2 className="text-sm font-semibold text-content-secondary tracking-wide mb-3" title="Select a size, then click or drag on the grid to place bins">Bin Palette</h2>

      {/* Squares section */}
      <div className="text-xs text-content-tertiary mb-1.5">Squares</div>
      <div className="grid grid-cols-6 gap-1.5">
        {SQUARE_SIZES.map(size => (
          <SizeButton key={`${size}×${size}`} w={size} d={size} className="w-full" />
        ))}
      </div>

      {/* Rectangles section */}
      <div className="flex items-center justify-between mt-3 mb-1.5">
        <span className="text-xs text-content-tertiary">Rectangles</span>
        <button
          onClick={() => setRotated(!rotated)}
          className="text-xs text-content-tertiary hover:text-content flex items-center gap-1 transition-colors"
          title={rotated ? 'Showing tall bins (click for wide)' : 'Showing wide bins (click for tall)'}
          aria-label={rotated ? 'Switch to wide rectangles' : 'Switch to tall rectangles'}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {rotated ? 'Tall' : 'Wide'}
        </button>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {RECTANGLE_SIZES.map(({ w, d }) => {
          const dims = getRectDims(w, d);
          return <SizeButton key={`${w}×${d}`} w={dims.w} d={dims.d} className="w-full" />;
        })}
      </div>

      {/* Fill button when size selected */}
      {paintSize && (
        <button
          onClick={() => handleFill(paintSize.width, paintSize.depth)}
          className="btn btn-primary w-full justify-center mt-3 text-sm"
          title={`Fill empty space with ${paintSize.width}×${paintSize.depth} bins`}
          aria-label={`Fill layer with ${paintSize.width} by ${paintSize.depth} bins`}
        >
          Fill with {paintSize.width}×{paintSize.depth}
        </button>
      )}
    </div>
  );
}
