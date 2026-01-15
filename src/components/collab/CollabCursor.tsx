/**
 * Individual remote cursor component.
 *
 * Displays a cursor icon with the user's name label.
 * Uses CSS transitions for smooth movement.
 */

import { useMemo } from 'react';
import type { UserPresence } from '../../liveblocks.config';

interface CollabCursorProps {
  /** User presence data containing cursor position, name, and color */
  presence: UserPresence;
  /** Current cell size in pixels (accounts for zoom) */
  cellSize: number;
  /** Gap between cells in pixels */
  gap: number;
}

/**
 * Renders a single remote user's cursor with their name label.
 *
 * The cursor uses CSS transform for positioning, which enables
 * smooth transitions without layout thrashing.
 */
export function CollabCursor({ presence, cellSize, gap }: CollabCursorProps) {
  const { cursor, name, color } = presence;

  // Convert grid coordinates to pixel position
  // Grid origin (0,0) is bottom-left, but CSS origin is top-left
  // The parent overlay handles the coordinate system conversion
  // useMemo must be called unconditionally (React Rules of Hooks)
  const style = useMemo(() => {
    if (!cursor) return null;
    const x = cursor.x * (cellSize + gap) + gap;
    const y = cursor.y * (cellSize + gap) + gap;

    return {
      transform: `translate(${x}px, ${y}px)`,
      color,
    };
  }, [cursor, cellSize, gap, color]);

  // Don't render if cursor is null (user is outside the grid)
  if (!cursor || !style) {
    return null;
  }

  return (
    <div
      className="absolute transition-transform duration-75 ease-out pointer-events-none"
      style={style}
      aria-hidden="true"
    >
      {/* Cursor SVG - points down-right like a typical mouse cursor */}
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        className="drop-shadow-md"
      >
        <path
          d="M1 1L1 14L5 10L8 17L10 16L7 9L13 9L1 1Z"
          fill="currentColor"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Name label positioned to the right of the cursor */}
      <div
        className="absolute left-4 top-3 px-2 py-0.5 text-xs font-medium text-white rounded whitespace-nowrap max-w-[120px] truncate shadow-md"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>
    </div>
  );
}
