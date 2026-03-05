/**
 * Constants for the WebGL cutout renderer.
 */

/** Render order layers (higher = drawn later = on top) */
export const RENDER_ORDER = {
  BACKGROUND: 0,
  SHAPES: 10,
  GROUP_FILL: 11,
  GROUP_STROKE: 12,
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

/** Colors — match app theme (amber accent on dark surface) */
export const ACCENT_COLOR_HEX = '#f59e0b'; // --color-accent
export const HANDLE_COLOR = '#fbbf24';
export const HANDLE_STROKE_COLOR = '#ffffff';

/** Handle sizes in screen pixels */
export const CORNER_HANDLE_SIZE = 10;
export const EDGE_HANDLE_WIDTH = 8;
export const EDGE_HANDLE_HEIGHT = 4;

/** Hover scale factor for handles */
export const HANDLE_HOVER_SCALE = 1.3;

/** Grid dot radius in screen pixels (constant size regardless of zoom) */
export const DOT_RADIUS_PX = 1.2;

/** SDF stroke width in screen pixels */
export const STROKE_WIDTH_SELECTED_PX = 1.5;
export const STROKE_WIDTH_DEFAULT_PX = 0.75;
export const STROKE_WIDTH_HOVER_PX = 1;
export const STROKE_WIDTH_GROUPED_PX = 0.75;

/** Rotation handle offset in screen pixels above the shape */
export const ROTATION_HANDLE_OFFSET_PX = 15;
export const ROTATION_HANDLE_RADIUS_PX = 4;

/** Dot grid threshold — bins larger than this use 2mm spacing */
export const LARGE_BIN_THRESHOLD = 10000;
