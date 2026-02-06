/**
 * Constants for the WebGL cutout renderer.
 */

/** Render order layers (higher = drawn later = on top) */
export const RENDER_ORDER = {
  BACKGROUND: 0,
  SHAPES: 10,
  SMART_GUIDES: 20,
  DRAWING_PREVIEW: 25,
  GROUP_BOUNDS: 30,
  HANDLES: 40,
  ROTATION_HANDLE: 41,
  MARQUEE: 50,
} as const;

/** Camera zoom limits (zoom = pixels per mm for the orthographic camera) */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 50;
export const ZOOM_STEP = 1.25;

/** Fraction of canvas to leave as padding around the bin when fitting to view */
export const FIT_PADDING = 0.08;

/** Colors */
export const HANDLE_COLOR = '#fbbf24';
export const HANDLE_STROKE_COLOR = '#ffffff';

/** Handle sizes in screen pixels */
export const CORNER_HANDLE_SIZE = 8;
export const EDGE_HANDLE_SIZE = 6;

/** Rotation handle offset in screen pixels above the shape */
export const ROTATION_HANDLE_OFFSET_PX = 15;
export const ROTATION_HANDLE_RADIUS_PX = 4;

/** Dot grid threshold — bins larger than this use 2mm spacing */
export const LARGE_BIN_THRESHOLD = 10000;
