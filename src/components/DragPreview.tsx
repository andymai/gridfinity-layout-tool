import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore } from '../store';
import { BASE_CELL_SIZE, DEFAULT_CATEGORY_COLOR } from '../constants';
import { getContrastColor } from '../utils/color';

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

  if (!interaction || !mousePos) return null;

  const cellSize = Math.round(BASE_CELL_SIZE * zoom);
  const gap = 1;

  let draggedBins: typeof bins = [];
  if (interaction.type === 'drag') {
    draggedBins = bins.filter(b => interaction.binIds.includes(b.id));
  } else if (interaction.type === 'stagingDrag') {
    const bin = bins.find(b => b.id === interaction.binId);
    if (bin) draggedBins = [bin];
  }

  if (draggedBins.length === 0) return null;

  // Calculate bounding box of all dragged bins (relative to first bin)
  const minX = Math.min(...draggedBins.map(b => b.x));
  const minY = Math.min(...draggedBins.map(b => b.y));

  return (
    <div
      className="fixed pointer-events-none z-[100]"
      style={{
        left: mousePos.x - cellSize / 2,
        top: mousePos.y - cellSize / 2,
      }}
    >
      {draggedBins.map((bin) => {
        const category = categories.find(c => c.id === bin.category);
        const bgColor = category?.color || DEFAULT_CATEGORY_COLOR;
        const textColor = getContrastColor(bgColor);

        // Position relative to first bin
        const offsetX = (bin.x - minX) * (cellSize + gap);
        const offsetY = -(bin.y - minY) * (cellSize + gap); // Invert Y for screen coords

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
            {bin.label && (
              <div className="text-center pointer-events-none select-none text-xs truncate px-1" style={{ color: textColor, opacity: 0.85 }}>
                {bin.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
