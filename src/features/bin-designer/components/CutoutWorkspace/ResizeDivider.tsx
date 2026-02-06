/**
 * Draggable vertical divider for split-pane resizing.
 *
 * Separates the cutout workspace from the 3D preview.
 */

import { useCallback, useRef } from 'react';
import { saveSplitRatio } from './splitRatioStorage';

const MIN_RATIO = 0.25;
const MAX_RATIO = 0.75;

interface ResizeDividerProps {
  readonly onRatioChange: (ratio: number) => void;
  readonly ratio: number;
}

export function ResizeDivider({ onRatioChange, ratio }: ResizeDividerProps) {
  const draggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const handleMove = (moveEvent: PointerEvent) => {
        if (!draggingRef.current) return;
        const parent = containerRef.current?.parentElement;
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();
        const newRatio = Math.max(
          MIN_RATIO,
          Math.min(MAX_RATIO, (moveEvent.clientX - parentRect.left) / parentRect.width)
        );
        onRatioChange(newRatio);
      };

      const handleUp = () => {
        draggingRef.current = false;
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        saveSplitRatio(ratio);
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
    },
    [onRatioChange, ratio]
  );

  return (
    <div
      ref={containerRef}
      className="relative flex-shrink-0 cursor-col-resize select-none"
      style={{ width: 4 }}
      onPointerDown={handlePointerDown}
    >
      {/* Visual bar */}
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-stroke-subtle" />
      {/* Hit target (wider than visual) */}
      <div className="absolute inset-y-0 -left-1.5 w-4" />
    </div>
  );
}
