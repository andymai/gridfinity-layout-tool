/**
 * Individual remote cursor component.
 *
 * Displays a cursor icon with the user's name and activity label.
 * Receives pre-interpolated pixel positions for smooth 60fps rendering.
 *
 * Features:
 * - Smooth movement via interpolated positions
 * - Fade in/out transitions
 * - Activity indicator showing current operation (Drawing, Moving, etc.)
 */

import type { UserPresence, InteractionHint } from '@/liveblocks.config';
import type { InterpolatedPosition } from '@/hooks/useInterpolatedPresence';

interface CollabCursorProps {
  /** User presence data containing cursor position, name, and color */
  presence: UserPresence;
  /** Pre-interpolated pixel position from useInterpolatedPresence */
  position: InterpolatedPosition;
}

/**
 * Maps interaction hint type to user-friendly activity text.
 * Returns null for idle state (no label shown).
 */
function getActivityText(interaction?: InteractionHint): string | null {
  if (!interaction || interaction.type === 'idle') return null;

  switch (interaction.type) {
    case 'drawing':
      return 'Drawing...';
    case 'dragging':
      return 'Moving...';
    case 'resizing':
      return 'Resizing...';
    case 'selecting':
      return 'Selecting...';
    default:
      return null;
  }
}

/**
 * Renders a single remote user's cursor with name and activity labels.
 *
 * The cursor uses pre-interpolated positions from useInterpolatedPresence
 * for smooth 60fps animation while keeping network updates throttled.
 */
export function CollabCursor({ presence, position }: CollabCursorProps) {
  const { name, color, interaction } = presence;
  const activityText = getActivityText(interaction);

  const style = {
    transform: `translate(${position.x}px, ${position.y}px)`,
    color,
    opacity: position.opacity,
  };

  return (
    <div
      className="absolute pointer-events-none transition-opacity duration-200"
      style={style}
      aria-hidden="true"
    >
      {/* Cursor SVG - points down-right like a typical mouse cursor */}
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="drop-shadow-md">
        <path
          d="M1 1L1 14L5 10L8 17L10 16L7 9L13 9L1 1Z"
          fill="currentColor"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Name label floating above the cursor */}
      <div
        className="absolute left-3 -top-5 px-1.5 py-0.5 text-[10px] font-medium text-white rounded whitespace-nowrap max-w-[100px] truncate shadow-md"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>

      {/* Activity label below the name (only shown when not idle) */}
      {activityText && (
        <div
          className="absolute left-3 top-0 px-1.5 py-0.5 text-[9px] font-medium text-white rounded whitespace-nowrap shadow-sm animate-in fade-in duration-150"
          style={{ backgroundColor: color, opacity: 0.9 }}
        >
          {activityText}
        </div>
      )}
    </div>
  );
}
