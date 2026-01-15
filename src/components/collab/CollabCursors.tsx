/**
 * Container component for rendering remote user cursors.
 *
 * This component overlays the grid and renders CollabCursor
 * for each connected user who has their cursor on the grid.
 *
 * Coordinate System:
 * - Grid uses bottom-left origin (y=0 at bottom)
 * - CSS uses top-left origin (y=0 at top)
 * - We transform coordinates when rendering
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
      {usersWithCursors.map(({ connectionId, presence }) => {
        // Transform y coordinate from bottom-left to top-left origin
        // Grid y=0 is at bottom, CSS y=0 is at top
        const transformedPresence = {
          ...presence,
          cursor: presence.cursor
            ? {
                x: presence.cursor.x,
                // Flip y: grid bottom (y=0) should be CSS bottom (y=gridHeight)
                y: drawer.depth - 1 - presence.cursor.y,
              }
            : null,
        };

        return (
          <CollabCursor
            key={connectionId}
            presence={transformedPresence}
            cellSize={cellSize}
            gap={gap}
          />
        );
      })}
    </div>
  );
}
