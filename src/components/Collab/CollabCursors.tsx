/**
 * Container component for rendering remote user cursors.
 *
 * This component overlays the grid and renders CollabCursor
 * for each connected user who has their cursor on the grid.
 *
 * Coordinate System:
 * - Cursor positions are stored as normalized coordinates (0-1 range)
 * - (0,0) is top-left, (1,1) is bottom-right (matches CSS/screen coords)
 * - Positions are interpolated at 60fps for smooth movement
 */

import { useOthers } from '../../liveblocks.config';
import { useUIStore, useLayoutStore } from '../../core/store';
import { getBaseCellSize } from '../../core/constants';
import { useResponsive } from '../../shared/hooks';
import { useInterpolatedPresence } from '../../hooks/useInterpolatedPresence';
import { CollabCursor } from './CollabCursor';

interface CollabCursorsProps {
  /** Optional className for the container */
  className?: string;
}

/**
 * Renders all remote users' cursors as an overlay on the grid.
 *
 * Uses smooth 60fps interpolation via useInterpolatedPresence hook
 * while keeping network updates throttled to 20fps for bandwidth.
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

  // Get interpolated cursor positions (60fps smooth)
  const interpolatedPositions = useInterpolatedPresence(gridWidth, gridHeight);

  // Filter to users with visible cursors (either with position or fading out)
  const visibleCursors = others.filter(({ connectionId }) => {
    const pos = interpolatedPositions.get(connectionId);
    return pos !== undefined;
  });

  if (visibleCursors.length === 0) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-40 overflow-hidden ${className ?? ''}`}
      aria-label={`${visibleCursors.length} other user${visibleCursors.length === 1 ? '' : 's'} viewing`}
    >
      {visibleCursors.map(({ connectionId, presence }) => {
        const position = interpolatedPositions.get(connectionId);
        if (!position) return null;

        return (
          <CollabCursor
            key={connectionId}
            presence={presence}
            position={position}
          />
        );
      })}
    </div>
  );
}
