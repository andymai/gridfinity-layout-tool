import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore } from '../core/store';
import { getBaseCellSize, DEFAULT_CATEGORY_COLOR } from '../core/constants';
import { getContrastColor } from '../shared/utils';
import { useResponsive } from '../hooks';

/**
 * Floating drag preview that follows the cursor during drag operations.
 * Shows a visual representation of the bin(s) being dragged.
 */
export function DragPreview() {
  const { interaction, zoom } = useUIStore(
    useShallow((state) => ({
      interaction: state.interaction,
      zoom: state.zoom,
    }))
  );
  const { bins, categories } = useLayoutStore(
    useShallow((state) => ({
      bins: state.layout.bins,
      categories: state.layout.categories,
    }))
  );

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const isDragging = interaction && (interaction.type === 'drag' || interaction.type === 'stagingDrag');

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('pointermove', handlePointerMove);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      setMousePos(null);
    };
  }, [isDragging]);

  // Must call hooks unconditionally before any early returns
  const { viewportWidth } = useResponsive();
  const cellSize = Math.round(getBaseCellSize(viewportWidth) * zoom);

  if (!interaction || !mousePos) return null;

  const gap = 1;

  let draggedBins: typeof bins = [];
  if (interaction.type === 'drag') {
    draggedBins = bins.filter(b => interaction.binIds.includes(b.id));
  } else if (interaction.type === 'stagingDrag') {
    const bin = bins.find(b => b.id === interaction.binId);
    if (bin) draggedBins = [bin];
  }

  if (draggedBins.length === 0) return null;

  // Calculate bounding box of all dragged bins
  const minX = Math.min(...draggedBins.map(b => b.x));
  // Use TOP of bins (y + depth) for Y alignment, since bins may have different depths
  // but share the same visual top edge
  const maxYTop = Math.max(...draggedBins.map(b => b.y + b.depth));

  // Use clickOffset from interaction if available for smooth dragging
  // Otherwise fall back to centering on cursor
  let previewOffsetX = cellSize / 2;
  let previewOffsetY = cellSize / 2;

  if (interaction.type === 'drag' && interaction.clickOffset) {
    previewOffsetX = interaction.clickOffset.x;
    previewOffsetY = interaction.clickOffset.y;
  }

  return (
    <div
      className="fixed pointer-events-none z-[101]"
      style={{
        left: mousePos.x - previewOffsetX,
        top: mousePos.y - previewOffsetY,
      }}
    >
      {draggedBins.map((bin) => {
        const category = categories.find(c => c.id === bin.category);
        const bgColor = category?.color || DEFAULT_CATEGORY_COLOR;
        const textColor = getContrastColor(bgColor);

        // Position relative to bounding box
        const offsetX = (bin.x - minX) * (cellSize + gap);
        // Calculate offset from the top of the bounding box (maxYTop)
        // Bins with the same top edge (y + depth) get the same offsetY
        const offsetY = (maxYTop - (bin.y + bin.depth)) * (cellSize + gap);

        const width = bin.width * cellSize + (bin.width - 1) * gap;
        const height = bin.depth * cellSize + (bin.depth - 1) * gap;

        return (
          <div
            key={bin.id}
            className="absolute flex items-center justify-center rounded"
            style={{
              left: offsetX,
              top: offsetY,
              width,
              height,
              backgroundColor: bgColor,
              opacity: 0.85,
              boxShadow: 'var(--shadow-floating), 0 0 0 2px var(--highlight-ring)',
              transform: 'scale(1.02)',
            }}
          >
            {bin.label && (() => {
              // Smart rotation: match Bin.tsx logic - rotate if significantly taller than wide
              const shouldRotate = bin.depth > bin.width * 1.5;
              return (
                <div
                  className="text-center pointer-events-none select-none text-xs truncate px-1"
                  style={{
                    color: textColor,
                    opacity: 0.85,
                    transform: shouldRotate ? 'rotate(-90deg)' : 'none',
                    width: shouldRotate ? `${(bin.depth / bin.width) * 90}%` : 'auto',
                  }}
                >
                  {bin.label}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
