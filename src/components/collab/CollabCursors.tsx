/**
 * Container component for rendering remote user cursors.
 *
 * This component overlays the grid and renders CollabCursor
 * for each connected user who has their cursor on the grid.
 *
 * Coordinate System:
 * - Cursor positions are stored as normalized coordinates (0-1 range)
 * - (0,0) is top-left, (1,1) is bottom-right (matches CSS/screen coords)
 * - Converted to actual pixels at render time for smooth movement
 */

import { useOthers } from '../../liveblocks.config';
import { useUIStore, useLayoutStore } from '../../store';
import { getBaseCellSize } from '../../constants';
import { useResponsive } from '../../hooks/useResponsive';
import { CollabCursor } from './CollabCursor';

interface CollabCursorsProps {
  /** Optional className for the container */
  className?: string;
}

/**
 * Renders all remote users' cursors as an overlay on the grid.
 *
 * Uses Liveblocks' useOthers() hook to get presence data for
 * all other connected users.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <Grid />
 *   <CollabCursors />
 * </div>
 * ```
 */
export function CollabCursors({ className }: CollabCursorsProps) {
  const others = useOthers();
  const zoom = useUIStore((state) => state.zoom);
  const drawer = useLayoutStore((state) => state.layout.drawer);
  const { viewportWidth } = useResponsive();

  // Calculate cell size with zoom
  const cellSize = Math.round(getBaseCellSize(viewportWidth) * zoom);
  const gap = 1; // 1px gap between cells

  // Calculate total grid dimensions for converting normalized coords to pixels
  const gridWidth = drawer.width * (cellSize + gap) + gap;
  const gridHeight = drawer.depth * (cellSize + gap) + gap;

  // Filter to users with valid cursors
  const usersWithCursors = others.filter(
    ({ presence }) => presence.cursor !== null
  );

  if (usersWithCursors.length === 0) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-40 overflow-hidden ${className ?? ''}`}
      aria-label={`${usersWithCursors.length} other user${usersWithCursors.length === 1 ? '' : 's'} viewing`}
    >
      {usersWithCursors.map(({ connectionId, presence }) => (
        // Normalized coords are already in screen space (0,0 = top-left)
        <CollabCursor
          key={connectionId}
          presence={presence}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
        />
      ))}
    </div>
  );
}
