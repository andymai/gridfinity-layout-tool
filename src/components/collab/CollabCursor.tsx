/**
 * Individual remote cursor component.
 *
 * Displays a cursor icon with the user's name label.
 * Uses CSS transitions for smooth movement.
 *
 * Cursor positions are stored as normalized coordinates (0-1 range)
 * and converted to actual pixels at render time for smooth movement.
 */

import { useMemo } from 'react';
import type { UserPresence } from '../../liveblocks.config';

interface CollabCursorProps {
  /** User presence data containing cursor position, name, and color */
  presence: UserPresence;
  /** Total grid width in pixels (for converting normalized coords) */
  gridWidth: number;
  /** Total grid height in pixels (for converting normalized coords) */
  gridHeight: number;
}

/**
 * Renders a single remote user's cursor with their name label.
 *
 * The cursor uses CSS transform for positioning, which enables
 * smooth transitions without layout thrashing.
 */
export function CollabCursor({ presence, gridWidth, gridHeight }: CollabCursorProps) {
  const { cursor, name, color } = presence;

  // Convert normalized (0-1) coordinates to pixel position
  // useMemo must be called unconditionally (React Rules of Hooks)
  const style = useMemo(() => {
    if (!cursor) return null;
    // Cursor coords are normalized 0-1, multiply by grid dimensions
    const x = cursor.x * gridWidth;
    const y = cursor.y * gridHeight;

    return {
      transform: `translate(${x}px, ${y}px)`,
      color,
    };
  }, [cursor, gridWidth, gridHeight, color]);

  // Don't render if cursor is null (user is outside the grid)
  if (!cursor || !style) {
    return null;
  }

  return (
    <div
      className="absolute transition-transform duration-[16ms] ease-linear pointer-events-none"
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

      {/* Name label floating above the cursor for better visibility */}
      <div
        className="absolute left-3 -top-5 px-1.5 py-0.5 text-[10px] font-medium text-white rounded whitespace-nowrap max-w-[100px] truncate shadow-md"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>
    </div>
  );
}
