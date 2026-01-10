import type { Layout, Category } from './types';

// === Constraints (from PRD) ===

export const CONSTRAINTS = {
  GRID_MIN: 1,
  GRID_MAX: 50,
  LAYERS_MIN: 1,
  LAYERS_MAX: 10,
  CATEGORIES_MIN: 1,
  CATEGORIES_MAX: 20,
  UNDO_LIMIT: 50,
  ZOOM_MIN: 0.25,
  ZOOM_MAX: 4.0,
  ZOOM_STEP: 0.1,
  MIN_VIEWPORT: 1024,
  LABEL_MAX_LENGTH: 24,
  NOTES_MAX_LENGTH: 256,
  NAME_MAX_LENGTH: 64,
  QUICK_FILL_MAX_BINS: 2500,
  QUICK_FILL_CONFIRM_THRESHOLD: 100,
  PRINT_GAP_MM: 10,  // Gap between bins on print bed
} as const;

/**
 * Calculate max grid units that fit on a print bed with gaps between bins.
 * Formula: N bins fit when N*gridUnit + (N-1)*gap ≤ bedSize
 * Solved: N ≤ (bedSize + gap) / (gridUnit + gap)
 */
export function calcMaxGridUnits(printBedSizeMm: number, gridUnitMm: number): number {
  const gap = CONSTRAINTS.PRINT_GAP_MM;
  return Math.max(1, Math.floor((printBedSizeMm + gap) / (gridUnitMm + gap)));
}

// === Staging ===

export const STAGING_ID = '__staging__';

// === Default Colors ===

/** Default category color (slate gray) - used as fallback when category is undefined */
export const DEFAULT_CATEGORY_COLOR = '#6b7280';

// === Default Categories ===

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'coral', name: 'Coral', color: '#f87171' },
  { id: 'sky', name: 'Sky', color: '#38bdf8' },
  { id: 'green', name: 'Green', color: '#4ade80' },
  { id: 'cloud', name: 'Cloud', color: '#e2e8f0' },
  { id: 'charcoal', name: 'Charcoal', color: '#334155' },
];

// === ID Generation ===

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// === Default Layout ===

export const createDefaultLayout = (): Layout => ({
  version: '1.0',
  name: 'Untitled layout',
  drawer: { width: 10, depth: 8, height: 12 },
  printBedSize: 256,  // mm - typical print bed size
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: [...DEFAULT_CATEGORIES],
  layers: [
    { id: generateId(), name: 'Layer 1', height: 3 },
  ],
  bins: [],
});

// === Grid Sizing ===

export const BASE_CELL_SIZE = 32; // px at 100% zoom (default/desktop)

/**
 * Get adaptive base cell size based on viewport width.
 * Larger cells on tablets, smaller on tiny phones.
 */
export function getBaseCellSize(viewportWidth: number): number {
  if (viewportWidth < 375) return 28; // Tiny phones (iPhone SE 1st gen, small Android)
  if (viewportWidth < 768) return 32; // Mobile (current default)
  if (viewportWidth < 900) return 36; // Tablet (more space available)
  return 32; // Desktop (current default)
}

// === Keyboard Shortcuts ===

export const SHORTCUTS = {
  DELETE: ['Delete', 'Backspace'],
  ESCAPE: ['Escape'],
  UNDO: 'z',        // with Ctrl/Cmd
  REDO: 'y',        // with Ctrl/Cmd
  REDO_ALT: 'Z',    // Shift+Ctrl/Cmd+Z
  DUPLICATE: 'd',   // with Ctrl/Cmd
  ZOOM_IN: ['+', '='],
  ZOOM_OUT: ['-'],
  HELP: '?',
  // Navigation
  LAYER_UP: 'w',
  LAYER_DOWN: 's',
  SELECT_PREV_BIN: 'a',
  SELECT_NEXT_BIN: 'd',
  CATEGORY_PREV: '[',
  CATEGORY_NEXT: ']',
  QUICK_LABEL: 'l',
  NUDGE_UP: 'ArrowUp',
  NUDGE_DOWN: 'ArrowDown',
  NUDGE_LEFT: 'ArrowLeft',
  NUDGE_RIGHT: 'ArrowRight',
  // 3D Preview shortcuts
  PREVIEW_TOGGLE: 'v',
  PREVIEW_EXPAND: 'Space',
  // Camera preset shortcuts
  PRESET_ISOMETRIC: '1',
  PRESET_TOP: '2',
  PRESET_FRONT: '3',
  PRESET_SIDE: '4',
} as const;
