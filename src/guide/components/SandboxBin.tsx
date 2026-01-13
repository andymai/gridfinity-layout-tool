import type { PointerEvent, CSSProperties } from 'react';
import { memo, useRef, useState, useCallback, useMemo } from 'react';
import type { SandboxBin as SandboxBinType, SandboxCategory } from '../hooks/useSandboxState';

/** Resize handle positions */
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface SandboxBinProps {
  bin: SandboxBinType;
  category?: SandboxCategory;
  cellSize: number;
  gap: number;
  drawerDepth: number;
  isSelected: boolean;
  isValid?: boolean;
  isDragging?: boolean;
  dragDelta?: { x: number; y: number };
  onSelect: (binId: string) => void;
  onStartDrag: (binId: string, clientX: number, clientY: number) => void;
  onStartResize: (binId: string, handle: ResizeHandle) => void;
  onDelete?: (binId: string) => void;
}

const DEFAULT_BIN_COLOR = '#6366f1';

/**
 * Get contrasting text colors for a bin based on its background color.
 */
function getTextColor(bgColor: string): string {
  // Simple luminance check
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1f2937' : '#ffffff';
}

/**
 * Simplified bin component for sandbox use.
 * Supports selection, drag, and resize interactions.
 */
function SandboxBinComponent({
  bin,
  category,
  cellSize,
  gap,
  drawerDepth,
  isSelected,
  isValid = true,
  isDragging = false,
  dragDelta = { x: 0, y: 0 },
  onSelect,
  onStartDrag,
  onStartResize,
  onDelete,
}: SandboxBinProps) {
  const [isHovered, setIsHovered] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  // Calculate position and size
  const visualX = bin.x + (isDragging ? dragDelta.x : 0);
  const visualY = bin.y + (isDragging ? dragDelta.y : 0);

  // CSS Grid uses row 1 at top, but our y=0 is at bottom
  const gridCol = Math.floor(visualX) + 1;
  const gridRow = Math.floor(drawerDepth - visualY - bin.depth) + 1;

  // Calculate pixel dimensions
  const pixelWidth = bin.width * cellSize + (bin.width - 1) * gap;
  const pixelHeight = bin.depth * cellSize + (bin.depth - 1) * gap;

  const bgColor = category?.color || DEFAULT_BIN_COLOR;
  const textColor = getTextColor(bgColor);

  // Format dimensions text
  const dimensionsText = `${bin.width}×${bin.depth}`;

  // Memoize styles
  const containerStyle = useMemo((): CSSProperties => ({
    gridColumn: `${gridCol} / span ${Math.ceil(bin.width)}`,
    gridRow: `${gridRow} / span ${Math.ceil(bin.depth)}`,
    width: pixelWidth,
    height: pixelHeight,
    backgroundColor: bgColor,
    borderRadius: '4px',
    cursor: isDragging ? 'grabbing' : 'grab',
    opacity: isDragging ? 0.8 : isValid ? 1 : 0.5,
    transition: isDragging ? 'none' : 'box-shadow 150ms, transform 150ms',
    boxShadow: isSelected
      ? '0 0 0 2px var(--selection-ring, #f59e0b), 0 0 20px var(--selection-glow, rgba(245, 158, 11, 0.3))'
      : 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.1))',
    transform: isSelected && !isDragging ? 'scale(1.02)' : 'none',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    zIndex: isDragging ? 100 : isSelected ? 50 : isHovered ? 30 : 10,
    border: !isValid ? '2px dashed #ef4444' : 'none',
  }), [gridCol, gridRow, bin.width, bin.depth, pixelWidth, pixelHeight, bgColor, isDragging, isValid, isSelected, isHovered]);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    onSelect(bin.id);
  }, [bin.id, onSelect]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Start drag after 5px movement
    if (distance > 5) {
      onStartDrag(bin.id, e.clientX, e.clientY);
      pointerStartRef.current = null;
    }
  }, [bin.id, onStartDrag]);

  const handlePointerUp = useCallback(() => {
    pointerStartRef.current = null;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && onDelete) {
      e.preventDefault();
      onDelete(bin.id);
    }
  }, [bin.id, onDelete]);

  const handleResizePointerDown = useCallback((e: PointerEvent<HTMLDivElement>, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button === 0) {
      onStartResize(bin.id, handle);
    }
  }, [bin.id, onStartResize]);

  // Font size based on bin size
  const fontSize = Math.max(10, Math.min(16, Math.min(pixelWidth, pixelHeight) * 0.25));
  const showText = pixelWidth > 30 && pixelHeight > 20;

  return (
    <div
      data-bin-id={bin.id}
      className="relative flex flex-col items-center justify-center"
      style={containerStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      role="button"
      aria-label={`Bin ${bin.width} by ${bin.depth}${category ? `, category ${category.name}` : ''}`}
      aria-pressed={isSelected}
      tabIndex={0}
    >
      {/* Dimensions text */}
      {showText && (
        <span
          className="font-mono font-semibold pointer-events-none"
          style={{
            color: textColor,
            fontSize,
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        >
          {bin.label || dimensionsText}
        </span>
      )}

      {/* Resize handles - only for selected bins */}
      {isSelected && !isDragging && (
        <ResizeHandles onResizePointerDown={handleResizePointerDown} />
      )}
    </div>
  );
}

/**
 * Resize handles component.
 */
interface ResizeHandlesProps {
  onResizePointerDown: (e: PointerEvent<HTMLDivElement>, handle: ResizeHandle) => void;
}

function ResizeHandles({ onResizePointerDown }: ResizeHandlesProps) {
  const handles: { handle: ResizeHandle; position: CSSProperties; cursor: string }[] = [
    { handle: 'n', position: { top: -4, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { handle: 's', position: { bottom: -4, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { handle: 'e', position: { right: -4, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
    { handle: 'w', position: { left: -4, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
    { handle: 'ne', position: { top: -4, right: -4 }, cursor: 'nesw-resize' },
    { handle: 'nw', position: { top: -4, left: -4 }, cursor: 'nwse-resize' },
    { handle: 'se', position: { bottom: -4, right: -4 }, cursor: 'nwse-resize' },
    { handle: 'sw', position: { bottom: -4, left: -4 }, cursor: 'nesw-resize' },
  ];

  return (
    <>
      {handles.map(({ handle, position, cursor }) => (
        <div
          key={handle}
          className="absolute w-3 h-3 bg-white border-2 border-amber-500 rounded-full shadow-md"
          style={{
            ...position,
            cursor,
            touchAction: 'none',
          }}
          onPointerDown={(e) => onResizePointerDown(e, handle)}
          aria-label={`Resize ${handle}`}
        />
      ))}
    </>
  );
}

export const SandboxBin = memo(SandboxBinComponent);
