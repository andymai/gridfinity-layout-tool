import type { ResizeHandle, HandlePlacement, HandlePositionConfig, HandleVisualConfig } from '../types';

/** Touch target size (Apple HIG minimum) */
const TOUCH_TARGET_SIZE = 44;

/** Half of touch target for centering */
const TOUCH_TARGET_HALF = TOUCH_TARGET_SIZE / 2;

/** Offset for internal handles (centers target on edge) */
const INTERNAL_OFFSET = -TOUCH_TARGET_HALF;

/** Offset for external handles (places target fully outside) */
const EXTERNAL_OFFSET = -TOUCH_TARGET_SIZE;

/** Visual indicator sizes */
const EDGE_VISUAL_WIDTH = 10;
const EDGE_VISUAL_MIN = 20;
const CORNER_VISUAL_SIZE = 12;

/** Corner handle types */
const CORNER_HANDLES: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];

/**
 * Check if a handle is a corner handle.
 *
 * @param handle - Handle direction
 * @returns true if handle is a corner handle (nw/ne/sw/se)
 */
export function isCornerHandle(handle: ResizeHandle): boolean {
  return CORNER_HANDLES.includes(handle);
}

/**
 * Determine if a bin should use external handle placement.
 * Applied when bin width OR depth <= 1 (including fractional like 0.5).
 *
 * @param binWidth - Bin width in grid units
 * @param binDepth - Bin depth in grid units
 * @returns true if handles should be placed externally
 */
export function shouldUseExternalHandles(binWidth: number, binDepth: number): boolean {
  return binWidth <= 1 || binDepth <= 1;
}

/**
 * Get touch target position for a handle.
 * Returns CSS positioning properties for the outer touch target.
 *
 * @param handle - Handle direction (n/s/e/w/ne/nw/se/sw)
 * @param placement - Internal (default) or external positioning
 * @returns CSS position configuration object
 */
export function getHandlePosition(
  handle: ResizeHandle,
  placement: HandlePlacement
): HandlePositionConfig {
  const offset = placement === 'external' ? EXTERNAL_OFFSET : INTERNAL_OFFSET;

  switch (handle) {
    case 'w':
      return {
        left: offset,
        top: '50%',
        width: TOUCH_TARGET_SIZE,
        height: TOUCH_TARGET_SIZE,
        transform: 'translateY(-50%)',
        cursor: 'ew-resize',
      };
    case 'e':
      return {
        right: offset,
        top: '50%',
        width: TOUCH_TARGET_SIZE,
        height: TOUCH_TARGET_SIZE,
        transform: 'translateY(-50%)',
        cursor: 'ew-resize',
      };
    case 'n':
      return {
        top: offset,
        left: '50%',
        width: TOUCH_TARGET_SIZE,
        height: TOUCH_TARGET_SIZE,
        transform: 'translateX(-50%)',
        cursor: 'ns-resize',
      };
    case 's':
      return {
        bottom: offset,
        left: '50%',
        width: TOUCH_TARGET_SIZE,
        height: TOUCH_TARGET_SIZE,
        transform: 'translateX(-50%)',
        cursor: 'ns-resize',
      };
    case 'nw':
      return {
        left: offset,
        top: offset,
        width: TOUCH_TARGET_SIZE,
        height: TOUCH_TARGET_SIZE,
        cursor: 'nwse-resize',
      };
    case 'ne':
      return {
        right: offset,
        top: offset,
        width: TOUCH_TARGET_SIZE,
        height: TOUCH_TARGET_SIZE,
        cursor: 'nesw-resize',
      };
    case 'sw':
      return {
        left: offset,
        bottom: offset,
        width: TOUCH_TARGET_SIZE,
        height: TOUCH_TARGET_SIZE,
        cursor: 'nesw-resize',
      };
    case 'se':
      return {
        right: offset,
        bottom: offset,
        width: TOUCH_TARGET_SIZE,
        height: TOUCH_TARGET_SIZE,
        cursor: 'nwse-resize',
      };
  }
}

/**
 * Get visual indicator dimensions for a handle.
 * Returns dimensions for the colored visual indicator inside the touch target.
 *
 * @param handle - Handle direction
 * @returns Visual indicator size configuration
 */
export function getHandleVisual(handle: ResizeHandle): HandleVisualConfig {
  // Corner handles use fixed square dimensions
  if (isCornerHandle(handle)) {
    return {
      width: CORNER_VISUAL_SIZE,
      height: CORNER_VISUAL_SIZE,
    };
  }

  // Edge handles use percentage dimensions that adapt to bin size
  // Horizontal edges (n/s) vary width
  if (handle === 'n' || handle === 's') {
    return {
      width: '45%',
      minWidth: EDGE_VISUAL_MIN,
      height: EDGE_VISUAL_WIDTH,
    };
  }

  // Vertical edges (w/e) vary height
  return {
    width: EDGE_VISUAL_WIDTH,
    height: '45%',
    minHeight: EDGE_VISUAL_MIN,
  };
}

/**
 * Get all handles that should be rendered.
 * Always returns all 8 handles (4 edges + 4 corners).
 *
 * @returns Array of all resize handle directions
 */
export function getAllHandles(): ResizeHandle[] {
  return ['w', 'e', 'n', 's', 'nw', 'ne', 'sw', 'se'];
}
