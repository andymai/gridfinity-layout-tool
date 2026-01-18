import { memo } from 'react';
import type { ResizeDirection } from '@/features/grid-editor/hooks/useGridResize';

/**
 * Drawer Resize Handles Component
 *
 * Renders edge and corner resize handles for the drawer grid.
 * Note: This is for resizing the drawer dimensions, not individual bins.
 * Extracted from Grid/index.tsx as part of component decomposition.
 */

export interface DrawerResizeHandlesProps {
  /** Grid width in pixels */
  gridWidth: number;
  /** Grid height in pixels */
  gridHeight: number;
  /** Height of column labels row in pixels */
  columnLabelHeight: number;
  /** Whether axis labels are visible (affects handle positioning) */
  axisLabelsVisible: boolean;
  /** Current resize direction being dragged (null when not resizing) */
  resizeDirection: ResizeDirection;
  /** Whether resize handles should pulse (first-use hint) */
  shouldPulse: boolean;
  /** Start resize operation */
  onResizeStart: (direction: ResizeDirection, e: React.MouseEvent) => void;
}

export const DrawerResizeHandles = memo(function DrawerResizeHandles({
  gridWidth,
  gridHeight,
  columnLabelHeight,
  axisLabelsVisible,
  resizeDirection,
  shouldPulse,
  onResizeStart,
}: DrawerResizeHandlesProps) {
  const pulseClass = shouldPulse ? 'animate-pulse' : '';

  return (
    <>
      {/* Right edge resize handle */}
      <div
        className="absolute top-0 flex items-center justify-center group"
        style={{
          left: gridWidth,
          height: gridHeight,
          width: 24,
          cursor: 'ew-resize',
        }}
        onMouseDown={(e) => onResizeStart('width', e)}
        title="Drag to add/remove columns"
      >
        <div
          className={`h-16 w-1 rounded-full transition-all group-hover:h-24 group-hover:w-[3px] group-hover:scale-[1.3] group-hover:drop-shadow-lg ${pulseClass}`}
          style={{
            backgroundColor:
              resizeDirection === 'width' || resizeDirection === 'both'
                ? 'var(--color-primary)'
                : 'var(--border-default)',
          }}
        />
      </div>

      {/* Bottom edge resize handle - positioned below column labels */}
      <div
        className="absolute left-0 flex items-center justify-center group"
        style={{
          top: gridHeight + (axisLabelsVisible ? columnLabelHeight : 0),
          width: gridWidth,
          height: 24,
          cursor: 'ns-resize',
        }}
        onMouseDown={(e) => onResizeStart('depth', e)}
        title="Drag to add/remove rows"
      >
        <div
          className={`w-16 h-1 rounded-full transition-all group-hover:w-24 group-hover:h-[3px] group-hover:scale-[1.3] group-hover:drop-shadow-lg ${pulseClass}`}
          style={{
            backgroundColor:
              resizeDirection === 'depth' || resizeDirection === 'both'
                ? 'var(--color-primary)'
                : 'var(--border-default)',
          }}
        />
      </div>

      {/* Corner resize handle - positioned below column labels */}
      <div
        className="absolute flex items-center justify-center group"
        style={{
          left: gridWidth,
          top: gridHeight + (axisLabelsVisible ? columnLabelHeight : 0),
          width: 24,
          height: 24,
          cursor: 'nwse-resize',
        }}
        onMouseDown={(e) => onResizeStart('both', e)}
        title="Drag to add/remove rows and columns"
      >
        <div
          className={`w-3 h-3 rounded-sm transition-all group-hover:w-5 group-hover:h-5 group-hover:scale-[1.3] group-hover:drop-shadow-lg ${pulseClass}`}
          style={{
            backgroundColor:
              resizeDirection === 'both' ? 'var(--color-primary)' : 'var(--border-default)',
          }}
        />
      </div>
    </>
  );
});
