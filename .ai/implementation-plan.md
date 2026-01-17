# Gridfinity Layout Tool - Implementation Plan

> Generated from PRD analysis. Optimized for parallel sub-agent execution.

## Overview

### Target: M1 (Core Editor)
- Grid rendering with layers
- Bin creation, selection, deletion, drag, resize
- Multi-layer support with 3D collision detection
- Blocked zone rendering and interaction
- Categories with color coding
- Basic staging area
- Import/export JSON
- Keyboard shortcuts

### Architecture Summary
- **Framework:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS + CSS custom properties
- **State:** Zustand (layout + ui stores) + history middleware
- **Testing:** Vitest for unit tests

### File Count Target: ~25 files

---

## Dependency Graph

```
Phase 1: Foundation
├── 1A: Project Setup (sequential - must be first)
└── 1B: Types + Constants (parallel, after 1A)
        ├── types.ts
        └── constants.ts

Phase 2: Pure Utils (all parallel, depends on Phase 1)
├── 2A: id.ts
├── 2B: collision.ts + tests
├── 2C: validation.ts + tests
├── 2D: split.ts + tests
├── 2E: fill.ts + tests
└── 2F: storage.ts

Phase 3: State Management (depends on Phase 1-2)
├── 3A: store/layout.ts (depends on types, validation)
├── 3B: store/ui.ts (depends on types)
└── 3C: store/history.ts (depends on 3A)

Phase 4: Hooks (depends on Phase 3)
├── 4A: useGridCoords.ts
├── 4B: useInteraction.ts (depends on 4A, validation)
├── 4C: useKeyboard.ts
└── 4D: useAutoSave.ts

Phase 5: Components (depends on Phase 4)
├── 5A: Grid components (parallel)
│   ├── Grid/index.tsx
│   ├── Grid/GridCanvas.tsx
│   ├── Grid/Bin.tsx
│   └── Grid/Overlay.tsx
├── 5B: Sidebar components (parallel with 5A)
│   ├── Sidebar/index.tsx
│   ├── Sidebar/DrawerPanel.tsx
│   ├── Sidebar/LayersPanel.tsx
│   ├── Sidebar/CategoriesPanel.tsx
│   ├── Sidebar/QuickFillPanel.tsx
│   └── Sidebar/BinPanel.tsx
├── 5C: Other components (parallel with 5A, 5B)
│   ├── Header.tsx
│   ├── Staging.tsx
│   └── PrintList.tsx
└── 5D: Modals (parallel with 5A, 5B, 5C)
    ├── modals/HelpModal.tsx
    ├── modals/ImportModal.tsx
    └── modals/ConfirmDialog.tsx

Phase 6: Integration (sequential, depends on Phase 5)
├── 6A: App.tsx assembly
└── 6B: Final wiring + smoke test

Phase 7: Polish (parallel)
├── 7A: Accessibility pass
├── 7B: Edge case handling
└── 7C: Performance check
```

---

## Phase 1: Foundation

### 1A: Project Setup
**Executor:** Main agent (sequential)
**Duration:** Single task
**Depends on:** Nothing

```bash
# Commands to execute
npm create vite@latest . -- --template react-ts
npm install zustand immer
npm install -D tailwindcss postcss autoprefixer
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npx tailwindcss init -p
```

**Files to create:**

#### vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

#### tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        grid: {
          bg: 'var(--color-bg-grid)',
          border: 'var(--color-border-grid)',
        },
      },
    },
  },
  plugins: [],
}
```

#### src/index.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Colors - from PRD UI Specifications */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f3f4f6;
  --color-bg-grid: #fafafa;
  --color-border: #e5e7eb;
  --color-border-grid: #d1d5db;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-focus: #f59e0b;
  --color-error: #dc2626;
  --color-success: #16a34a;
  --color-selection: #fbbf24;
  --color-invalid: #fee2e2;
  --color-ghost: rgba(0, 0, 0, 0.1);

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* Sizing */
  --sidebar-width: 256px;
  --grid-cell-size: 32px;
  --handle-size: 12px;
  --focus-ring-width: 2px;
  --border-radius-sm: 4px;
  --border-radius-md: 8px;

  /* Animation */
  --transition-fast: 100ms;
  --transition-normal: 200ms;
  --transition-slow: 300ms;
}

/* Dark theme (matches prototype) */
body {
  @apply bg-zinc-900 text-zinc-100;
}
```

#### src/test/setup.ts
```typescript
import '@testing-library/jest-dom'
```

#### src/main.tsx
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

#### src/App.tsx (placeholder)
```typescript
export default function App() {
  return <div className="min-h-screen p-4">Gridfinity Layout Tool</div>
}
```

**Acceptance:** `npm run dev` shows placeholder, `npm test` runs without error.

---

### 1B: Types + Constants
**Executor:** Sub-agent (parallel after 1A)
**Depends on:** 1A complete

#### src/types.ts
```typescript
// === Core Data Model (from PRD 05-technical-reference.md) ===

export interface Layout {
  version: string;           // "1.0"
  name: string;              // max 64 chars
  drawer: Drawer;
  maxPrintSize: number;      // typically 4
  categories: Category[];    // 1-20 items
  layers: Layer[];           // 1-10 items, index 0 = bottom
  bins: Bin[];
}

export interface Drawer {
  width: number;             // 1-50
  depth: number;             // 1-50
  height: number;            // >= sum of layer heights
}

export interface Category {
  id: string;
  name: string;              // max 24 chars, unique (case-insensitive)
  color: string;             // hex color
}

export interface Layer {
  id: string;
  name: string;              // max 24 chars
  height: number;            // >= 1
}

export interface Bin {
  id: string;
  layerId: string;           // base layer ID or "__staging__"
  x: number;                 // 0-based, from left
  y: number;                 // 0-based, from bottom
  width: number;             // >= 1
  depth: number;             // >= 1
  height: number;            // >= base layer height, <= space to drawer top
  category: string;          // references Category.id
  label: string;             // max 24 chars
  notes: string;             // max 256 chars
}

// === Coordinate Types ===

export interface Coord {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface Rect3D extends Rect {
  zStart: number;
  zEnd: number;
}

// === Interaction State ===

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type Interaction =
  | { type: 'draw'; start: Coord; current: Coord }
  | { type: 'drag'; binId: string; startCoord: Coord; currentCoord: Coord; valid: boolean }
  | { type: 'resize'; binId: string; handle: ResizeHandle; startRect: Rect; currentRect: Rect; valid: boolean };

// === UI State ===

export interface UIState {
  activeLayerId: string;
  selectedBinId: string | null;
  activeCategoryId: string;
  zoom: number;              // 0.5 - 2.0
  showOtherLayers: boolean;
}

// === Validation Results ===

export interface ValidationResult {
  valid: boolean;
  reason?: 'out_of_bounds' | 'exceeds_width' | 'exceeds_depth' | 'exceeds_height' |
           'invalid_layer' | 'collision' | 'blocked_zone';
}

// === Print List ===

export interface PrintPiece {
  width: number;
  depth: number;
  count: number;
}

export interface PrintRow {
  size: string;              // "3×2"
  height: number;
  binCount: number;
  pieces: PrintPiece[];
  totalPieces: number;
  needsSplit: boolean;
}

// === Blocked Zone ===

export interface BlockedZone {
  x: number;
  y: number;
  width: number;
  depth: number;
  sourceBinId: string;
  sourceLayerId: string;
}
```

#### src/constants.ts
```typescript
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
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 2.0,
  ZOOM_STEP: 0.1,
  MIN_VIEWPORT: 1024,
  LABEL_MAX_LENGTH: 24,
  NOTES_MAX_LENGTH: 256,
  NAME_MAX_LENGTH: 64,
  QUICK_FILL_MAX_BINS: 500,
  QUICK_FILL_CONFIRM_THRESHOLD: 100,
} as const;

// === Staging ===

export const STAGING_ID = '__staging__';

// === Default Categories (from PRD 01-core-concepts.md) ===

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'tools', name: 'Tools', color: '#ef4444' },
  { id: 'printing', name: '3D Printing', color: '#3b82f6' },
  { id: 'electronics', name: 'Electronics', color: '#10b981' },
  { id: 'household', name: 'Household', color: '#8b5cf6' },
  { id: 'open', name: 'Open', color: '#6b7280' },
];

// === Default Layout ===

export const createDefaultLayout = (): Layout => ({
  version: '1.0',
  name: 'My Drawer Layout',
  drawer: { width: 10, depth: 8, height: 12 },
  maxPrintSize: 4,
  categories: [...DEFAULT_CATEGORIES],
  layers: [
    { id: generateId(), name: 'Layer 1', height: 3 },
  ],
  bins: [],
});

// === ID Generation ===

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// === Grid Sizing ===

export const BASE_CELL_SIZE = 32; // px at 100% zoom

// === Keyboard Shortcuts ===

export const SHORTCUTS = {
  DELETE: ['Delete', 'Backspace'],
  ESCAPE: ['Escape'],
  UNDO: 'z',        // with Ctrl/Cmd
  REDO: 'y',        // with Ctrl/Cmd
  REDO_ALT: 'Z',    // Shift+Ctrl/Cmd+Z
  ZOOM_IN: ['+', '='],
  ZOOM_OUT: ['-'],
  HELP: '?',
  NUDGE_UP: 'ArrowUp',
  NUDGE_DOWN: 'ArrowDown',
  NUDGE_LEFT: 'ArrowLeft',
  NUDGE_RIGHT: 'ArrowRight',
} as const;
```

**Acceptance:** Types compile, constants export correctly.

---

## Phase 2: Pure Utils

> **All Phase 2 tasks can run in parallel.** Each is a pure utility module with tests.

### 2A: ID Utility
**Executor:** Sub-agent
**Depends on:** Phase 1

Already included in constants.ts. Mark complete.

---

### 2B: Collision Detection
**Executor:** Sub-agent
**Depends on:** Phase 1 (types.ts)

#### src/utils/collision.ts
```typescript
import type { Bin, Layer, Rect3D, BlockedZone } from '../types';
import { STAGING_ID } from '../constants';

/**
 * Calculate the Z-axis start position for a layer.
 * Layers stack from bottom (index 0) upward.
 */
export function getLayerZStart(layerId: string, layers: Layer[]): number {
  let z = 0;
  for (const layer of layers) {
    if (layer.id === layerId) return z;
    z += layer.height;
  }
  throw new Error(`Layer not found: ${layerId}`);
}

/**
 * Get the 3D bounding box for a bin.
 */
export function getBin3DRect(bin: Bin, layers: Layer[]): Rect3D {
  const zStart = getLayerZStart(bin.layerId, layers);
  return {
    x: bin.x,
    y: bin.y,
    width: bin.width,
    depth: bin.depth,
    zStart,
    zEnd: zStart + bin.height,
  };
}

/**
 * Check if two 2D rectangles overlap (footprint).
 */
export function footprintsOverlap(a: { x: number; y: number; width: number; depth: number },
                                   b: { x: number; y: number; width: number; depth: number }): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.depth &&
    b.y < a.y + a.depth
  );
}

/**
 * Check if two vertical ranges overlap.
 */
export function verticalRangesOverlap(a: { zStart: number; zEnd: number },
                                       b: { zStart: number; zEnd: number }): boolean {
  return a.zStart < b.zEnd && b.zStart < a.zEnd;
}

/**
 * Check if two bins collide in 3D space.
 * Bins must overlap in both footprint AND vertical range to collide.
 */
export function binsCollide(binA: Bin, binB: Bin, layers: Layer[]): boolean {
  // Staging bins don't collide with anything
  if (binA.layerId === STAGING_ID || binB.layerId === STAGING_ID) {
    return false;
  }

  // Check footprint overlap first (cheaper)
  if (!footprintsOverlap(binA, binB)) {
    return false;
  }

  // Check vertical overlap
  const rectA = getBin3DRect(binA, layers);
  const rectB = getBin3DRect(binB, layers);

  return verticalRangesOverlap(rectA, rectB);
}

/**
 * Find all blocked zones for a given layer.
 * A blocked zone is where a bin from a lower layer protrudes upward.
 */
export function getBlockedZones(
  targetLayerId: string,
  bins: Bin[],
  layers: Layer[]
): BlockedZone[] {
  const targetZStart = getLayerZStart(targetLayerId, layers);
  const targetLayerIndex = layers.findIndex(l => l.id === targetLayerId);

  const blocked: BlockedZone[] = [];

  for (const bin of bins) {
    // Skip staging bins
    if (bin.layerId === STAGING_ID) continue;

    // Skip bins on or above target layer
    const binLayerIndex = layers.findIndex(l => l.id === bin.layerId);
    if (binLayerIndex >= targetLayerIndex) continue;

    // Check if bin protrudes into target layer
    const binRect = getBin3DRect(bin, layers);
    if (binRect.zEnd > targetZStart) {
      blocked.push({
        x: bin.x,
        y: bin.y,
        width: bin.width,
        depth: bin.depth,
        sourceBinId: bin.id,
        sourceLayerId: bin.layerId,
      });
    }
  }

  return blocked;
}

/**
 * Check if a position is within a blocked zone.
 */
export function isInBlockedZone(
  x: number,
  y: number,
  blockedZones: BlockedZone[]
): BlockedZone | null {
  for (const zone of blockedZones) {
    if (
      x >= zone.x &&
      x < zone.x + zone.width &&
      y >= zone.y &&
      y < zone.y + zone.depth
    ) {
      return zone;
    }
  }
  return null;
}
```

#### src/test/collision.test.ts
```typescript
import { describe, it, expect } from 'vitest';
import {
  getLayerZStart,
  footprintsOverlap,
  verticalRangesOverlap,
  binsCollide,
  getBlockedZones,
} from '../utils/collision';
import type { Layer, Bin } from '../types';

const layers: Layer[] = [
  { id: 'layer1', name: 'Layer 1', height: 3 },
  { id: 'layer2', name: 'Layer 2', height: 6 },
  { id: 'layer3', name: 'Layer 3', height: 3 },
];

describe('getLayerZStart', () => {
  it('returns 0 for first layer', () => {
    expect(getLayerZStart('layer1', layers)).toBe(0);
  });

  it('sums heights for subsequent layers', () => {
    expect(getLayerZStart('layer2', layers)).toBe(3);
    expect(getLayerZStart('layer3', layers)).toBe(9);
  });

  it('throws for unknown layer', () => {
    expect(() => getLayerZStart('unknown', layers)).toThrow();
  });
});

describe('footprintsOverlap', () => {
  it('detects overlapping rectangles', () => {
    const a = { x: 0, y: 0, width: 2, depth: 2 };
    const b = { x: 1, y: 1, width: 2, depth: 2 };
    expect(footprintsOverlap(a, b)).toBe(true);
  });

  it('returns false for adjacent rectangles', () => {
    const a = { x: 0, y: 0, width: 2, depth: 2 };
    const b = { x: 2, y: 0, width: 2, depth: 2 };
    expect(footprintsOverlap(a, b)).toBe(false);
  });

  it('returns false for separated rectangles', () => {
    const a = { x: 0, y: 0, width: 2, depth: 2 };
    const b = { x: 5, y: 5, width: 2, depth: 2 };
    expect(footprintsOverlap(a, b)).toBe(false);
  });
});

describe('binsCollide', () => {
  it('returns true for overlapping bins on same layer', () => {
    const binA: Bin = { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    const binB: Bin = { id: '2', layerId: 'layer1', x: 1, y: 1, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    expect(binsCollide(binA, binB, layers)).toBe(true);
  });

  it('returns false for bins on different layers with no vertical overlap', () => {
    const binA: Bin = { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    const binB: Bin = { id: '2', layerId: 'layer2', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    expect(binsCollide(binA, binB, layers)).toBe(false);
  });

  it('returns true for tall bin protruding into upper layer', () => {
    const binA: Bin = { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' }; // extends into layer2
    const binB: Bin = { id: '2', layerId: 'layer2', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    expect(binsCollide(binA, binB, layers)).toBe(true);
  });

  it('returns false for staging bins', () => {
    const binA: Bin = { id: '1', layerId: '__staging__', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    const binB: Bin = { id: '2', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    expect(binsCollide(binA, binB, layers)).toBe(false);
  });
});

describe('getBlockedZones', () => {
  it('returns empty array when no protrusions', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' },
    ];
    expect(getBlockedZones('layer2', bins, layers)).toEqual([]);
  });

  it('returns blocked zone for protruding bin', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' }, // protrudes 3u into layer2
    ];
    const zones = getBlockedZones('layer2', bins, layers);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ x: 0, y: 0, width: 2, depth: 2, sourceBinId: '1' });
  });
});
```

**Acceptance:** All collision tests pass.

---

### 2C: Validation
**Executor:** Sub-agent
**Depends on:** Phase 1, 2B (collision.ts)

#### src/utils/validation.ts
```typescript
import type { Bin, Layout, ValidationResult, Rect } from '../types';
import { CONSTRAINTS, STAGING_ID } from '../constants';
import { binsCollide, getLayerZStart, getBlockedZones, isInBlockedZone } from './collision';

/**
 * Validate if a bin can be placed at the given position.
 */
export function canPlaceBin(
  rect: Rect & { height: number },
  layerId: string,
  layout: Layout,
  excludeBinId?: string
): ValidationResult {
  const { drawer, layers, bins } = layout;

  // Bounds check
  if (rect.x < 0 || rect.y < 0) {
    return { valid: false, reason: 'out_of_bounds' };
  }
  if (rect.x + rect.width > drawer.width) {
    return { valid: false, reason: 'exceeds_width' };
  }
  if (rect.y + rect.depth > drawer.depth) {
    return { valid: false, reason: 'exceeds_depth' };
  }

  // Find layer
  const layer = layers.find(l => l.id === layerId);
  if (!layer) {
    return { valid: false, reason: 'invalid_layer' };
  }

  // Height check
  const zStart = getLayerZStart(layerId, layers);
  const maxHeight = drawer.height - zStart;
  if (rect.height > maxHeight) {
    return { valid: false, reason: 'exceeds_height' };
  }
  if (rect.height < layer.height) {
    // Bin must be at least as tall as its base layer
    return { valid: false, reason: 'exceeds_height' };
  }

  // Check blocked zones
  const blockedZones = getBlockedZones(layerId, bins, layers);
  for (let x = rect.x; x < rect.x + rect.width; x++) {
    for (let y = rect.y; y < rect.y + rect.depth; y++) {
      if (isInBlockedZone(x, y, blockedZones)) {
        return { valid: false, reason: 'blocked_zone' };
      }
    }
  }

  // Collision check with other bins
  const testBin: Bin = {
    id: excludeBinId || '__test__',
    layerId,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    depth: rect.depth,
    height: rect.height,
    category: '',
    label: '',
    notes: '',
  };

  for (const other of bins) {
    if (other.id === excludeBinId) continue;
    if (other.layerId === STAGING_ID) continue;
    if (binsCollide(testBin, other, layers)) {
      return { valid: false, reason: 'collision' };
    }
  }

  return { valid: true };
}

/**
 * Validate an imported layout against the schema and constraints.
 */
export function validateImport(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid data format'] };
  }

  const layout = data as Record<string, unknown>;

  // Required fields
  if (!layout.version) errors.push('Missing version');
  if (!layout.name) errors.push('Missing name');
  if (!layout.drawer) errors.push('Missing drawer');
  if (!Array.isArray(layout.layers)) errors.push('Invalid layers');
  if (!Array.isArray(layout.bins)) errors.push('Invalid bins');
  if (!Array.isArray(layout.categories)) errors.push('Invalid categories');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const drawer = layout.drawer as Record<string, unknown>;
  const layers = layout.layers as unknown[];
  const bins = layout.bins as unknown[];
  const categories = layout.categories as unknown[];

  // Drawer constraints
  if (typeof drawer.width !== 'number' || drawer.width < CONSTRAINTS.GRID_MIN || drawer.width > CONSTRAINTS.GRID_MAX) {
    errors.push(`Drawer width must be ${CONSTRAINTS.GRID_MIN}-${CONSTRAINTS.GRID_MAX}`);
  }
  if (typeof drawer.depth !== 'number' || drawer.depth < CONSTRAINTS.GRID_MIN || drawer.depth > CONSTRAINTS.GRID_MAX) {
    errors.push(`Drawer depth must be ${CONSTRAINTS.GRID_MIN}-${CONSTRAINTS.GRID_MAX}`);
  }

  // Layer constraints
  if (layers.length < CONSTRAINTS.LAYERS_MIN || layers.length > CONSTRAINTS.LAYERS_MAX) {
    errors.push(`Must have ${CONSTRAINTS.LAYERS_MIN}-${CONSTRAINTS.LAYERS_MAX} layers`);
  }

  // Validate layer references
  const layerIds = new Set(layers.map((l: any) => l.id));
  layerIds.add(STAGING_ID);

  // Validate bins
  bins.forEach((bin: any, i) => {
    if (!layerIds.has(bin.layerId)) {
      errors.push(`Bin ${i} references invalid layer: ${bin.layerId}`);
    }
    if (bin.layerId !== STAGING_ID) {
      if (bin.x < 0 || bin.y < 0 ||
          bin.x + bin.width > (drawer.width as number) ||
          bin.y + bin.depth > (drawer.depth as number)) {
        errors.push(`Bin ${i} is out of bounds`);
      }
    }
  });

  // Validate total layer height
  const totalHeight = layers.reduce((sum: number, l: any) => sum + (l.height || 0), 0);
  if (totalHeight > (drawer.height as number)) {
    errors.push('Total layer height exceeds drawer height');
  }

  // Validate category uniqueness
  const categoryNames = new Set<string>();
  categories.forEach((cat: any) => {
    const name = (cat.name || '').toLowerCase();
    if (categoryNames.has(name)) {
      errors.push(`Duplicate category name: ${cat.name}`);
    }
    categoryNames.add(name);
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Clamp a value to a range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Truncate a string to max length.
 */
export function truncate(str: string, maxLength: number): string {
  return str.slice(0, maxLength);
}
```

#### src/test/validation.test.ts
```typescript
import { describe, it, expect } from 'vitest';
import { canPlaceBin, validateImport, clamp, truncate } from '../utils/validation';
import type { Layout } from '../types';

const createTestLayout = (): Layout => ({
  version: '1.0',
  name: 'Test',
  drawer: { width: 10, depth: 10, height: 12 },
  maxPrintSize: 4,
  categories: [{ id: 'cat1', name: 'Test', color: '#000' }],
  layers: [
    { id: 'layer1', name: 'Layer 1', height: 3 },
    { id: 'layer2', name: 'Layer 2', height: 6 },
  ],
  bins: [],
});

describe('canPlaceBin', () => {
  it('allows valid placement', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      { x: 0, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(result.valid).toBe(true);
  });

  it('rejects out of bounds placement', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      { x: -1, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'out_of_bounds' });
  });

  it('rejects placement exceeding width', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      { x: 9, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_width' });
  });

  it('rejects collision with existing bin', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'existing', layerId: 'layer1', x: 0, y: 0, width: 3, depth: 3, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBin(
      { x: 1, y: 1, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'collision' });
  });

  it('allows placement next to existing bin', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'existing', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBin(
      { x: 2, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(result.valid).toBe(true);
  });

  it('excludes specified bin from collision check', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'moving', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBin(
      { x: 1, y: 1, width: 2, depth: 2, height: 3 },
      'layer1',
      layout,
      'moving' // exclude this bin
    );
    expect(result.valid).toBe(true);
  });

  it('rejects placement in blocked zone', () => {
    const layout = createTestLayout();
    layout.bins = [
      // Tall bin on layer 1 that protrudes into layer 2
      { id: 'tall', layerId: 'layer1', x: 0, y: 0, width: 3, depth: 3, height: 6, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBin(
      { x: 1, y: 1, width: 2, depth: 2, height: 6 },
      'layer2',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'blocked_zone' });
  });
});

describe('validateImport', () => {
  it('accepts valid layout', () => {
    const layout = createTestLayout();
    const result = validateImport(layout);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing fields', () => {
    const result = validateImport({ name: 'Test' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing version');
  });

  it('rejects drawer out of range', () => {
    const layout = createTestLayout();
    layout.drawer.width = 100;
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
  });

  it('rejects duplicate category names', () => {
    const layout = createTestLayout();
    layout.categories = [
      { id: '1', name: 'Tools', color: '#f00' },
      { id: '2', name: 'tools', color: '#0f0' }, // duplicate (case-insensitive)
    ];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
  });
});

describe('clamp', () => {
  it('clamps values to range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('hello world', 5)).toBe('hello');
    expect(truncate('hi', 5)).toBe('hi');
  });
});
```

**Acceptance:** All validation tests pass.

---

### 2D: Split Algorithm
**Executor:** Sub-agent
**Depends on:** Phase 1

#### src/utils/split.ts
```typescript
import type { Bin, PrintPiece, PrintRow } from '../types';
import { STAGING_ID } from '../constants';

/**
 * Recursively split a bin size until all pieces fit within maxSize.
 * Uses greedy halving strategy from PRD.
 *
 * Examples (maxSize = 4):
 * - 5×3 → [3×3, 2×3]
 * - 9×3 → [5×3, 4×3] → [3×3, 2×3, 4×3]
 * - 5×6 → [3×3, 2×3, 3×3, 2×3]
 */
export function splitBinSize(width: number, depth: number, maxSize: number): PrintPiece[] {
  if (width <= maxSize && depth <= maxSize) {
    return [{ width, depth, count: 1 }];
  }

  const pieces: PrintPiece[] = [];

  if (width > maxSize && depth <= maxSize) {
    // Split width only
    const left = Math.ceil(width / 2);
    const right = Math.floor(width / 2);
    pieces.push(...splitBinSize(left, depth, maxSize));
    if (right > 0) {
      pieces.push(...splitBinSize(right, depth, maxSize));
    }
  } else if (width <= maxSize && depth > maxSize) {
    // Split depth only
    const top = Math.ceil(depth / 2);
    const bottom = Math.floor(depth / 2);
    pieces.push(...splitBinSize(width, top, maxSize));
    if (bottom > 0) {
      pieces.push(...splitBinSize(width, bottom, maxSize));
    }
  } else {
    // Split both dimensions
    const leftW = Math.ceil(width / 2);
    const rightW = Math.floor(width / 2);
    const topD = Math.ceil(depth / 2);
    const bottomD = Math.floor(depth / 2);

    pieces.push(...splitBinSize(leftW, topD, maxSize));
    if (rightW > 0) pieces.push(...splitBinSize(rightW, topD, maxSize));
    if (bottomD > 0) pieces.push(...splitBinSize(leftW, bottomD, maxSize));
    if (rightW > 0 && bottomD > 0) pieces.push(...splitBinSize(rightW, bottomD, maxSize));
  }

  return pieces.filter(p => p.width > 0 && p.depth > 0);
}

/**
 * Merge identical pieces to consolidate counts.
 */
function mergePieces(pieces: PrintPiece[]): PrintPiece[] {
  const map = new Map<string, PrintPiece>();

  for (const piece of pieces) {
    const key = `${piece.width}×${piece.depth}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += piece.count;
    } else {
      map.set(key, { ...piece });
    }
  }

  return Array.from(map.values());
}

/**
 * Generate the print list from bins.
 * Groups bins by size×height, calculates split pieces.
 */
export function generatePrintList(bins: Bin[], maxPrintSize: number): PrintRow[] {
  // Filter out staging bins
  const placedBins = bins.filter(b => b.layerId !== STAGING_ID);

  // Group by size and height
  const groups = new Map<string, { width: number; depth: number; height: number; count: number }>();

  for (const bin of placedBins) {
    const key = `${bin.width}×${bin.depth}×${bin.height}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
    } else {
      groups.set(key, { width: bin.width, depth: bin.depth, height: bin.height, count: 1 });
    }
  }

  // Generate print rows
  const rows: PrintRow[] = [];

  for (const [, group] of groups) {
    const pieces = splitBinSize(group.width, group.depth, maxPrintSize);
    const mergedPieces = mergePieces(pieces);
    const needsSplit = group.width > maxPrintSize || group.depth > maxPrintSize;
    const totalPieces = mergedPieces.reduce((sum, p) => sum + p.count, 0) * group.count;

    rows.push({
      size: `${group.width}×${group.depth}`,
      height: group.height,
      binCount: group.count,
      pieces: mergedPieces,
      totalPieces,
      needsSplit,
    });
  }

  // Sort by total area descending (batch efficiency)
  rows.sort((a, b) => {
    const areaA = parseInt(a.size.split('×')[0]) * parseInt(a.size.split('×')[1]) * a.binCount;
    const areaB = parseInt(b.size.split('×')[0]) * parseInt(b.size.split('×')[1]) * b.binCount;
    return areaB - areaA;
  });

  return rows;
}

/**
 * Calculate total pieces across all rows.
 */
export function getTotalPieces(rows: PrintRow[]): number {
  return rows.reduce((sum, row) => sum + row.totalPieces, 0);
}

/**
 * Calculate total bins across all rows.
 */
export function getTotalBins(rows: PrintRow[]): number {
  return rows.reduce((sum, row) => sum + row.binCount, 0);
}
```

#### src/test/split.test.ts
```typescript
import { describe, it, expect } from 'vitest';
import { splitBinSize, generatePrintList } from '../utils/split';
import type { Bin } from '../types';

describe('splitBinSize', () => {
  const maxSize = 4;

  it('returns single piece for small bins', () => {
    const pieces = splitBinSize(3, 3, maxSize);
    expect(pieces).toEqual([{ width: 3, depth: 3, count: 1 }]);
  });

  it('splits width only when needed', () => {
    const pieces = splitBinSize(5, 3, maxSize);
    // 5×3 → 3×3 + 2×3
    expect(pieces).toHaveLength(2);
    expect(pieces).toContainEqual({ width: 3, depth: 3, count: 1 });
    expect(pieces).toContainEqual({ width: 2, depth: 3, count: 1 });
  });

  it('splits depth only when needed', () => {
    const pieces = splitBinSize(3, 5, maxSize);
    // 3×5 → 3×3 + 3×2
    expect(pieces).toHaveLength(2);
    expect(pieces).toContainEqual({ width: 3, depth: 3, count: 1 });
    expect(pieces).toContainEqual({ width: 3, depth: 2, count: 1 });
  });

  it('handles PRD example: 9×3 with max 4', () => {
    const pieces = splitBinSize(9, 3, maxSize);
    // 9×3 → 5×3 + 4×3 → 3×3 + 2×3 + 4×3
    expect(pieces).toHaveLength(3);
    const sizes = pieces.map(p => `${p.width}×${p.depth}`).sort();
    expect(sizes).toEqual(['2×3', '3×3', '4×3']);
  });

  it('handles both dimensions exceeding max', () => {
    const pieces = splitBinSize(5, 6, maxSize);
    // Should result in 4 pieces
    expect(pieces.length).toBeGreaterThanOrEqual(4);
    // All pieces should fit
    pieces.forEach(p => {
      expect(p.width).toBeLessThanOrEqual(maxSize);
      expect(p.depth).toBeLessThanOrEqual(maxSize);
    });
  });

  it('handles exact max size', () => {
    const pieces = splitBinSize(4, 4, maxSize);
    expect(pieces).toEqual([{ width: 4, depth: 4, count: 1 }]);
  });
});

describe('generatePrintList', () => {
  it('groups identical bins', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
      { id: '2', layerId: 'l1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(2);
    expect(rows[0].totalPieces).toBe(2);
  });

  it('excludes staging bins', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
      { id: '2', layerId: '__staging__', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows).toHaveLength(1);
    expect(rows[0].binCount).toBe(1);
  });

  it('separates bins with different heights', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'c1', label: '', notes: '' },
      { id: '2', layerId: 'l1', x: 2, y: 0, width: 2, depth: 2, height: 6, category: 'c1', label: '', notes: '' },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows).toHaveLength(2);
  });

  it('calculates split pieces correctly', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'l1', x: 0, y: 0, width: 5, depth: 3, height: 3, category: 'c1', label: '', notes: '' },
    ];
    const rows = generatePrintList(bins, 4);
    expect(rows[0].needsSplit).toBe(true);
    expect(rows[0].totalPieces).toBe(2); // 3×3 + 2×3
  });
});
```

**Acceptance:** All split tests pass, including PRD examples.

---

### 2E: Fill Algorithms
**Executor:** Sub-agent
**Depends on:** Phase 1, 2C (validation)

#### src/utils/fill.ts
```typescript
import type { Bin, Layout, Rect } from '../types';
import { generateId, CONSTRAINTS } from '../constants';
import { canPlaceBin } from './validation';

/**
 * Fill empty cells with bins of specified size.
 * Skips occupied cells and blocked zones.
 */
export function fillAllWithSize(
  layout: Layout,
  layerId: string,
  binWidth: number,
  binDepth: number,
  categoryId: string
): { bins: Bin[]; skippedCells: number } {
  const layer = layout.layers.find(l => l.id === layerId);
  if (!layer) {
    return { bins: [], skippedCells: 0 };
  }

  const newBins: Bin[] = [];
  let skippedCells = 0;

  // Track which cells are covered by new bins
  const covered = new Set<string>();

  for (let y = 0; y < layout.drawer.depth; y += binDepth) {
    for (let x = 0; x < layout.drawer.width; x += binWidth) {
      // Check if we've exceeded max bins
      if (newBins.length >= CONSTRAINTS.QUICK_FILL_MAX_BINS) {
        break;
      }

      // Calculate actual size (may be smaller at edges)
      const actualWidth = Math.min(binWidth, layout.drawer.width - x);
      const actualDepth = Math.min(binDepth, layout.drawer.depth - y);

      // Skip if any cell in this region is already covered
      let alreadyCovered = false;
      for (let cx = x; cx < x + actualWidth && !alreadyCovered; cx++) {
        for (let cy = y; cy < y + actualDepth && !alreadyCovered; cy++) {
          if (covered.has(`${cx},${cy}`)) {
            alreadyCovered = true;
          }
        }
      }
      if (alreadyCovered) {
        skippedCells++;
        continue;
      }

      // Create temporary layout with new bins for validation
      const tempLayout: Layout = {
        ...layout,
        bins: [...layout.bins, ...newBins],
      };

      const result = canPlaceBin(
        { x, y, width: actualWidth, depth: actualDepth, height: layer.height },
        layerId,
        tempLayout
      );

      if (result.valid) {
        const newBin: Bin = {
          id: generateId(),
          layerId,
          x,
          y,
          width: actualWidth,
          depth: actualDepth,
          height: layer.height,
          category: categoryId,
          label: '',
          notes: '',
        };
        newBins.push(newBin);

        // Mark cells as covered
        for (let cx = x; cx < x + actualWidth; cx++) {
          for (let cy = y; cy < y + actualDepth; cy++) {
            covered.add(`${cx},${cy}`);
          }
        }
      } else {
        skippedCells++;
      }
    }
  }

  return { bins: newBins, skippedCells };
}

/**
 * Find empty cells on a layer.
 */
function findEmptyCells(layout: Layout, layerId: string): Set<string> {
  const empty = new Set<string>();
  const layer = layout.layers.find(l => l.id === layerId);
  if (!layer) return empty;

  // Initialize all cells as empty
  for (let x = 0; x < layout.drawer.width; x++) {
    for (let y = 0; y < layout.drawer.depth; y++) {
      empty.add(`${x},${y}`);
    }
  }

  // Remove occupied cells
  for (const bin of layout.bins) {
    if (bin.layerId === layerId) {
      for (let x = bin.x; x < bin.x + bin.width; x++) {
        for (let y = bin.y; y < bin.y + bin.depth; y++) {
          empty.delete(`${x},${y}`);
        }
      }
    }
  }

  // Remove blocked zones (we'd need to import getBlockedZones)
  // For now, validation will catch these

  return empty;
}

/**
 * Fill gaps with optimally-sized bins.
 * Tries to use bins that don't require splitting.
 */
export function fillGaps(
  layout: Layout,
  layerId: string,
  categoryId: string,
  maxPrintSize: number
): { bins: Bin[]; addedCount: number } {
  const layer = layout.layers.find(l => l.id === layerId);
  if (!layer) {
    return { bins: [], addedCount: 0 };
  }

  const newBins: Bin[] = [];
  let workingLayout = { ...layout };

  // Simple greedy approach: try progressively smaller sizes
  const sizes: Array<{ w: number; d: number }> = [];
  for (let w = maxPrintSize; w >= 1; w--) {
    for (let d = maxPrintSize; d >= 1; d--) {
      sizes.push({ w, d });
    }
  }
  // Sort by area descending
  sizes.sort((a, b) => (b.w * b.d) - (a.w * a.d));

  let changed = true;
  while (changed && newBins.length < CONSTRAINTS.QUICK_FILL_MAX_BINS) {
    changed = false;

    for (let y = 0; y < layout.drawer.depth && newBins.length < CONSTRAINTS.QUICK_FILL_MAX_BINS; y++) {
      for (let x = 0; x < layout.drawer.width && newBins.length < CONSTRAINTS.QUICK_FILL_MAX_BINS; x++) {
        // Try each size at this position
        for (const size of sizes) {
          const tempLayout: Layout = {
            ...workingLayout,
            bins: [...workingLayout.bins, ...newBins],
          };

          const result = canPlaceBin(
            { x, y, width: size.w, depth: size.d, height: layer.height },
            layerId,
            tempLayout
          );

          if (result.valid) {
            newBins.push({
              id: generateId(),
              layerId,
              x,
              y,
              width: size.w,
              depth: size.d,
              height: layer.height,
              category: categoryId,
              label: '',
              notes: '',
            });
            changed = true;
            break; // Move to next position
          }
        }
      }
    }
  }

  return { bins: newBins, addedCount: newBins.length };
}

/**
 * Get coverage percentage for a layer.
 */
export function getLayerCoverage(layout: Layout, layerId: string): number {
  const totalCells = layout.drawer.width * layout.drawer.depth;
  if (totalCells === 0) return 0;

  let coveredCells = 0;
  for (const bin of layout.bins) {
    if (bin.layerId === layerId) {
      coveredCells += bin.width * bin.depth;
    }
  }

  return Math.round((coveredCells / totalCells) * 100);
}
```

#### src/test/fill.test.ts
```typescript
import { describe, it, expect } from 'vitest';
import { fillAllWithSize, fillGaps, getLayerCoverage } from '../utils/fill';
import type { Layout } from '../types';

const createTestLayout = (): Layout => ({
  version: '1.0',
  name: 'Test',
  drawer: { width: 6, depth: 6, height: 9 },
  maxPrintSize: 4,
  categories: [{ id: 'cat1', name: 'Test', color: '#000' }],
  layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
  bins: [],
});

describe('fillAllWithSize', () => {
  it('fills empty layer with specified size', () => {
    const layout = createTestLayout();
    const result = fillAllWithSize(layout, 'layer1', 2, 2, 'cat1');

    // 6×6 grid with 2×2 bins = 9 bins
    expect(result.bins).toHaveLength(9);
    expect(result.skippedCells).toBe(0);
  });

  it('skips cells occupied by existing bins', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'existing', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];

    const result = fillAllWithSize(layout, 'layer1', 2, 2, 'cat1');

    // One position should be skipped
    expect(result.bins).toHaveLength(8);
  });

  it('handles non-divisible grid sizes', () => {
    const layout = createTestLayout();
    layout.drawer.width = 5;
    layout.drawer.depth = 5;

    const result = fillAllWithSize(layout, 'layer1', 2, 2, 'cat1');

    // Should create bins, some may be 1-wide at edges
    expect(result.bins.length).toBeGreaterThan(0);
  });
});

describe('fillGaps', () => {
  it('fills gaps with optimal sizes', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'existing', layerId: 'layer1', x: 0, y: 0, width: 4, depth: 4, height: 3, category: 'cat1', label: '', notes: '' },
    ];

    const result = fillGaps(layout, 'layer1', 'cat1', 4);

    // Should fill remaining space
    expect(result.bins.length).toBeGreaterThan(0);
  });

  it('returns empty array for full layer', () => {
    const layout = createTestLayout();
    layout.drawer.width = 2;
    layout.drawer.depth = 2;
    layout.bins = [
      { id: 'full', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];

    const result = fillGaps(layout, 'layer1', 'cat1', 4);

    expect(result.bins).toHaveLength(0);
  });
});

describe('getLayerCoverage', () => {
  it('returns 0 for empty layer', () => {
    const layout = createTestLayout();
    expect(getLayerCoverage(layout, 'layer1')).toBe(0);
  });

  it('calculates correct percentage', () => {
    const layout = createTestLayout();
    // 6×6 = 36 cells, 3×3 = 9 cells = 25%
    layout.bins = [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 3, depth: 3, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    expect(getLayerCoverage(layout, 'layer1')).toBe(25);
  });

  it('returns 100 for full layer', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'full', layerId: 'layer1', x: 0, y: 0, width: 6, depth: 6, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    expect(getLayerCoverage(layout, 'layer1')).toBe(100);
  });
});
```

**Acceptance:** All fill tests pass.

---

### 2F: Storage
**Executor:** Sub-agent
**Depends on:** Phase 1, 2C (validation)

#### src/utils/storage.ts
```typescript
import type { Layout } from '../types';
import { validateImport } from './validation';
import { generateId } from '../constants';

const STORAGE_KEY = 'gridfinity-layout-v1';

/**
 * Save layout to localStorage.
 */
export function saveLayout(layout: Layout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    console.error('Failed to save layout:', e);
    throw new Error('Storage full. Export your layout to save it.');
  }
}

/**
 * Load layout from localStorage.
 */
export function loadLayout(): Layout | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const validation = validateImport(parsed);

    if (!validation.valid) {
      console.error('Stored layout invalid:', validation.errors);
      return null;
    }

    return parsed as Layout;
  } catch (e) {
    console.error('Failed to load layout:', e);
    return null;
  }
}

/**
 * Clear stored layout.
 */
export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Export layout as JSON string.
 */
export function exportLayoutJSON(layout: Layout): string {
  return JSON.stringify(layout, null, 2);
}

/**
 * Import layout from JSON string.
 * Regenerates all IDs to prevent collisions.
 */
export function importLayoutJSON(json: string): { layout: Layout | null; errors: string[] } {
  try {
    const parsed = JSON.parse(json);
    const validation = validateImport(parsed);

    if (!validation.valid) {
      return { layout: null, errors: validation.errors };
    }

    // Regenerate all IDs
    const layout = parsed as Layout;
    const idMap = new Map<string, string>();

    // Regenerate layer IDs
    layout.layers = layout.layers.map(layer => {
      const newId = generateId();
      idMap.set(layer.id, newId);
      return { ...layer, id: newId };
    });

    // Regenerate category IDs
    layout.categories = layout.categories.map(cat => {
      const newId = generateId();
      idMap.set(cat.id, newId);
      return { ...cat, id: newId };
    });

    // Regenerate bin IDs and update references
    layout.bins = layout.bins.map(bin => ({
      ...bin,
      id: generateId(),
      layerId: bin.layerId === '__staging__' ? '__staging__' : (idMap.get(bin.layerId) || bin.layerId),
      category: idMap.get(bin.category) || bin.category,
    }));

    return { layout, errors: [] };
  } catch (e) {
    return { layout: null, errors: [`Parse error: ${(e as Error).message}`] };
  }
}

/**
 * Export print list as TSV for spreadsheet paste.
 */
export function exportPrintListTSV(rows: Array<{ size: string; height: number; binCount: number; totalPieces: number }>): string {
  const header = 'Size\tHeight\tBins\tPieces';
  const lines = rows.map(r => `${r.size}\t${r.height}u\t${r.binCount}\t${r.totalPieces}`);
  return [header, ...lines].join('\n');
}

/**
 * Get storage usage percentage.
 */
export function getStorageUsage(): number {
  try {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length * 2; // UTF-16
      }
    }
    // Assume 5MB limit
    return Math.round((total / (5 * 1024 * 1024)) * 100);
  } catch {
    return 0;
  }
}
```

**Acceptance:** Storage functions work correctly, import validates and regenerates IDs.

---

## Phase 3: State Management

### 3A: Layout Store
**Executor:** Sub-agent
**Depends on:** Phase 1, Phase 2 (validation, collision)

#### src/store/layout.ts
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Layout, Bin, Layer, Category, Drawer } from '../types';
import { createDefaultLayout, generateId, STAGING_ID, CONSTRAINTS } from '../constants';
import { canPlaceBin } from '../utils/validation';
import { loadLayout, saveLayout } from '../utils/storage';
import { fillAllWithSize, fillGaps } from '../utils/fill';

interface LayoutState {
  layout: Layout;

  // Bin operations
  addBin: (bin: Omit<Bin, 'id'>) => string | null;
  updateBin: (id: string, updates: Partial<Bin>) => void;
  deleteBin: (id: string) => void;
  moveBinToStaging: (id: string) => void;
  moveBinFromStaging: (id: string, layerId: string, x: number, y: number) => boolean;

  // Layer operations
  addLayer: () => string | null;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  deleteLayer: (id: string) => boolean;

  // Drawer operations
  updateDrawer: (updates: Partial<Drawer>) => void;

  // Category operations
  addCategory: (category: Omit<Category, 'id'>) => string;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => boolean;

  // Bulk operations
  fillLayer: (layerId: string, width: number, depth: number, categoryId: string) => number;
  fillLayerGaps: (layerId: string, categoryId: string) => number;
  clearLayer: (layerId: string) => number;

  // I/O
  importLayout: (layout: Layout) => void;
  reset: () => void;

  // Name
  setName: (name: string) => void;
}

export const useLayoutStore = create<LayoutState>()(
  immer((set, get) => ({
    layout: loadLayout() || createDefaultLayout(),

    addBin: (binData) => {
      const { layout } = get();
      const id = generateId();
      const bin: Bin = { ...binData, id };

      // Validate placement
      if (bin.layerId !== STAGING_ID) {
        const result = canPlaceBin(
          { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth, height: bin.height },
          bin.layerId,
          layout
        );
        if (!result.valid) return null;
      }

      set(state => {
        state.layout.bins.push(bin);
      });

      return id;
    },

    updateBin: (id, updates) => {
      set(state => {
        const bin = state.layout.bins.find(b => b.id === id);
        if (bin) {
          Object.assign(bin, updates);
        }
      });
    },

    deleteBin: (id) => {
      set(state => {
        state.layout.bins = state.layout.bins.filter(b => b.id !== id);
      });
    },

    moveBinToStaging: (id) => {
      set(state => {
        const bin = state.layout.bins.find(b => b.id === id);
        if (bin) {
          bin.layerId = STAGING_ID;
        }
      });
    },

    moveBinFromStaging: (id, layerId, x, y) => {
      const { layout } = get();
      const bin = layout.bins.find(b => b.id === id);
      if (!bin) return false;

      const layer = layout.layers.find(l => l.id === layerId);
      if (!layer) return false;

      const result = canPlaceBin(
        { x, y, width: bin.width, depth: bin.depth, height: layer.height },
        layerId,
        layout,
        id
      );

      if (!result.valid) return false;

      set(state => {
        const b = state.layout.bins.find(b => b.id === id);
        if (b) {
          b.layerId = layerId;
          b.x = x;
          b.y = y;
          b.height = layer.height;
        }
      });

      return true;
    },

    addLayer: () => {
      const { layout } = get();
      if (layout.layers.length >= CONSTRAINTS.LAYERS_MAX) return null;

      const totalHeight = layout.layers.reduce((sum, l) => sum + l.height, 0);
      const remaining = layout.drawer.height - totalHeight;
      if (remaining < 1) return null;

      const id = generateId();
      const newLayer: Layer = {
        id,
        name: `Layer ${layout.layers.length + 1}`,
        height: Math.min(remaining, 3),
      };

      set(state => {
        state.layout.layers.push(newLayer);
      });

      return id;
    },

    updateLayer: (id, updates) => {
      set(state => {
        const layer = state.layout.layers.find(l => l.id === id);
        if (layer) {
          // If height is changing, clamp it
          if (updates.height !== undefined) {
            const othersHeight = state.layout.layers
              .filter(l => l.id !== id)
              .reduce((sum, l) => sum + l.height, 0);
            const maxHeight = state.layout.drawer.height - othersHeight;
            updates.height = Math.max(1, Math.min(updates.height, maxHeight));
          }
          Object.assign(layer, updates);
        }
      });
    },

    deleteLayer: (id) => {
      const { layout } = get();
      if (layout.layers.length <= CONSTRAINTS.LAYERS_MIN) return false;

      set(state => {
        state.layout.layers = state.layout.layers.filter(l => l.id !== id);
        state.layout.bins = state.layout.bins.filter(b => b.layerId !== id);
      });

      return true;
    },

    updateDrawer: (updates) => {
      set(state => {
        const drawer = state.layout.drawer;

        // Apply updates with constraints
        if (updates.width !== undefined) {
          drawer.width = Math.max(CONSTRAINTS.GRID_MIN, Math.min(CONSTRAINTS.GRID_MAX, updates.width));
        }
        if (updates.depth !== undefined) {
          drawer.depth = Math.max(CONSTRAINTS.GRID_MIN, Math.min(CONSTRAINTS.GRID_MAX, updates.depth));
        }
        if (updates.height !== undefined) {
          const totalLayerHeight = state.layout.layers.reduce((sum, l) => sum + l.height, 0);
          drawer.height = Math.max(totalLayerHeight, updates.height);
        }

        // Move out-of-bounds bins to staging
        state.layout.bins = state.layout.bins.map(bin => {
          if (bin.layerId === STAGING_ID) return bin;

          if (bin.x + bin.width > drawer.width || bin.y + bin.depth > drawer.depth) {
            return { ...bin, layerId: STAGING_ID };
          }
          return bin;
        });
      });
    },

    addCategory: (categoryData) => {
      const id = generateId();
      set(state => {
        state.layout.categories.push({ ...categoryData, id });
      });
      return id;
    },

    updateCategory: (id, updates) => {
      set(state => {
        const cat = state.layout.categories.find(c => c.id === id);
        if (cat) {
          Object.assign(cat, updates);
        }
      });
    },

    deleteCategory: (id) => {
      const { layout } = get();

      // Can't delete if in use
      if (layout.bins.some(b => b.category === id)) return false;
      // Must have at least one
      if (layout.categories.length <= CONSTRAINTS.CATEGORIES_MIN) return false;

      set(state => {
        state.layout.categories = state.layout.categories.filter(c => c.id !== id);
      });

      return true;
    },

    fillLayer: (layerId, width, depth, categoryId) => {
      const { layout } = get();
      const result = fillAllWithSize(layout, layerId, width, depth, categoryId);

      if (result.bins.length > 0) {
        set(state => {
          state.layout.bins.push(...result.bins);
        });
      }

      return result.bins.length;
    },

    fillLayerGaps: (layerId, categoryId) => {
      const { layout } = get();
      const result = fillGaps(layout, layerId, categoryId, layout.maxPrintSize);

      if (result.bins.length > 0) {
        set(state => {
          state.layout.bins.push(...result.bins);
        });
      }

      return result.addedCount;
    },

    clearLayer: (layerId) => {
      const { layout } = get();
      const count = layout.bins.filter(b => b.layerId === layerId).length;

      set(state => {
        state.layout.bins = state.layout.bins.filter(b => b.layerId !== layerId);
      });

      return count;
    },

    importLayout: (layout) => {
      set({ layout });
    },

    reset: () => {
      set({ layout: createDefaultLayout() });
    },

    setName: (name) => {
      set(state => {
        state.layout.name = name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
      });
    },
  }))
);

// Auto-save subscription (will be moved to hook)
// useLayoutStore.subscribe((state) => saveLayout(state.layout));
```

**Acceptance:** Store handles all CRUD operations with validation.

---

### 3B: UI Store
**Executor:** Sub-agent (parallel with 3A)
**Depends on:** Phase 1

#### src/store/ui.ts
```typescript
import { create } from 'zustand';
import type { Interaction } from '../types';
import { CONSTRAINTS } from '../constants';

interface UIState {
  // Selection
  activeLayerId: string;
  selectedBinId: string | null;
  activeCategoryId: string;

  // View
  zoom: number;
  showOtherLayers: boolean;

  // Interaction
  interaction: Interaction | null;

  // Actions
  setActiveLayer: (id: string) => void;
  setSelectedBin: (id: string | null) => void;
  setActiveCategory: (id: string) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleShowOtherLayers: () => void;

  // Interaction actions
  setInteraction: (interaction: Interaction | null) => void;
  clearSelection: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeLayerId: '',
  selectedBinId: null,
  activeCategoryId: 'tools',
  zoom: 1,
  showOtherLayers: true,
  interaction: null,

  setActiveLayer: (id) => set({
    activeLayerId: id,
    selectedBinId: null // Clear selection on layer change (PRD: selection is layer-scoped)
  }),

  setSelectedBin: (id) => set({ selectedBinId: id }),

  setActiveCategory: (id) => set({ activeCategoryId: id }),

  setZoom: (zoom) => set({
    zoom: Math.max(CONSTRAINTS.ZOOM_MIN, Math.min(CONSTRAINTS.ZOOM_MAX, zoom))
  }),

  zoomIn: () => set(state => ({
    zoom: Math.min(CONSTRAINTS.ZOOM_MAX, state.zoom + CONSTRAINTS.ZOOM_STEP)
  })),

  zoomOut: () => set(state => ({
    zoom: Math.max(CONSTRAINTS.ZOOM_MIN, state.zoom - CONSTRAINTS.ZOOM_STEP)
  })),

  toggleShowOtherLayers: () => set(state => ({
    showOtherLayers: !state.showOtherLayers
  })),

  setInteraction: (interaction) => set({ interaction }),

  clearSelection: () => set({ selectedBinId: null, interaction: null }),
}));
```

**Acceptance:** UI store manages view state correctly.

---

### 3C: History Store
**Executor:** Sub-agent
**Depends on:** 3A (layout store)

#### src/store/history.ts
```typescript
import { create } from 'zustand';
import type { Layout } from '../types';
import { useLayoutStore } from './layout';
import { CONSTRAINTS } from '../constants';

interface HistoryState {
  past: Layout[];
  future: Layout[];

  canUndo: boolean;
  canRedo: boolean;

  push: (layout: Layout) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  push: (layout) => {
    set(state => {
      const newPast = [...state.past, layout];
      // Trim to limit
      if (newPast.length > CONSTRAINTS.UNDO_LIMIT) {
        newPast.shift();
      }
      return {
        past: newPast,
        future: [], // Clear future on new action
        canUndo: true,
        canRedo: false,
      };
    });
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;

    const current = useLayoutStore.getState().layout;
    const previous = past[past.length - 1];

    set(state => ({
      past: state.past.slice(0, -1),
      future: [current, ...state.future],
      canUndo: state.past.length > 1,
      canRedo: true,
    }));

    useLayoutStore.setState({ layout: previous });
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;

    const current = useLayoutStore.getState().layout;
    const next = future[0];

    set(state => ({
      past: [...state.past, current],
      future: state.future.slice(1),
      canUndo: true,
      canRedo: state.future.length > 1,
    }));

    useLayoutStore.setState({ layout: next });
  },

  clear: () => {
    set({ past: [], future: [], canUndo: false, canRedo: false });
  },
}));

/**
 * Hook to wrap layout actions with history tracking.
 * Use this instead of calling layout store directly for undoable actions.
 */
export function useUndoableAction() {
  const layout = useLayoutStore(state => state.layout);
  const push = useHistoryStore(state => state.push);

  return {
    /**
     * Execute an action and push current state to history.
     */
    execute: (action: () => void) => {
      // Deep clone current state before action
      push(JSON.parse(JSON.stringify(layout)));
      action();
    },
  };
}
```

#### src/store/index.ts
```typescript
export { useLayoutStore } from './layout';
export { useUIStore } from './ui';
export { useHistoryStore, useUndoableAction } from './history';
```

**Acceptance:** Undo/redo works correctly, respects 50-state limit.

---

## Phase 4: Hooks

> All Phase 4 tasks can run in parallel once Phase 3 is complete.

### 4A: useGridCoords
**Executor:** Sub-agent

#### src/hooks/useGridCoords.ts
```typescript
import { useCallback, RefObject } from 'react';
import type { Coord } from '../types';
import { useUIStore } from '../core/store';
import { useLayoutStore } from '../core/store';
import { BASE_CELL_SIZE } from '../constants';

/**
 * Convert mouse position to grid coordinates.
 */
export function useGridCoords(gridRef: RefObject<HTMLDivElement>) {
  const zoom = useUIStore(state => state.zoom);
  const drawer = useLayoutStore(state => state.layout.drawer);

  const cellSize = Math.round(BASE_CELL_SIZE * zoom);
  const gap = 1; // 1px gap between cells

  const getGridCoords = useCallback((clientX: number, clientY: number): Coord | null => {
    if (!gridRef.current) return null;

    const rect = gridRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    // Account for gap
    const x = Math.floor(relX / (cellSize + gap));
    // Y is inverted (0 at bottom in our coordinate system)
    const y = drawer.depth - 1 - Math.floor(relY / (cellSize + gap));

    return { x, y };
  }, [gridRef, cellSize, drawer.depth]);

  const clampCoords = useCallback((coord: Coord): Coord => ({
    x: Math.max(0, Math.min(coord.x, drawer.width - 1)),
    y: Math.max(0, Math.min(coord.y, drawer.depth - 1)),
  }), [drawer.width, drawer.depth]);

  const isInBounds = useCallback((coord: Coord): boolean => {
    return coord.x >= 0 && coord.x < drawer.width &&
           coord.y >= 0 && coord.y < drawer.depth;
  }, [drawer.width, drawer.depth]);

  return { getGridCoords, clampCoords, isInBounds, cellSize };
}
```

---

### 4B: useInteraction
**Executor:** Sub-agent
**Depends on:** 4A

#### src/hooks/useInteraction.ts
```typescript
import { useEffect, useCallback, RefObject } from 'react';
import type { Coord, Rect, ResizeHandle, Bin } from '../types';
import { useUIStore, useLayoutStore, useUndoableAction } from '../core/store';
import { useGridCoords } from './useGridCoords';
import { canPlaceBin } from '../utils/validation';

export function useInteraction(gridRef: RefObject<HTMLDivElement>) {
  const { getGridCoords, clampCoords } = useGridCoords(gridRef);
  const interaction = useUIStore(state => state.interaction);
  const setInteraction = useUIStore(state => state.setInteraction);
  const setSelectedBin = useUIStore(state => state.setSelectedBin);
  const activeLayerId = useUIStore(state => state.activeLayerId);
  const activeCategoryId = useUIStore(state => state.activeCategoryId);
  const layout = useLayoutStore(state => state.layout);
  const addBin = useLayoutStore(state => state.addBin);
  const updateBin = useLayoutStore(state => state.updateBin);
  const { execute } = useUndoableAction();

  // Start drawing a new bin
  const startDraw = useCallback((coord: Coord) => {
    setInteraction({
      type: 'draw',
      start: coord,
      current: coord,
    });
  }, [setInteraction]);

  // Start dragging an existing bin
  const startDrag = useCallback((binId: string, startCoord: Coord) => {
    const bin = layout.bins.find(b => b.id === binId);
    if (!bin) return;

    setSelectedBin(binId);
    setInteraction({
      type: 'drag',
      binId,
      startCoord,
      currentCoord: { x: bin.x, y: bin.y },
      valid: true,
    });
  }, [layout.bins, setSelectedBin, setInteraction]);

  // Start resizing a bin
  const startResize = useCallback((binId: string, handle: ResizeHandle) => {
    const bin = layout.bins.find(b => b.id === binId);
    if (!bin) return;

    setSelectedBin(binId);
    setInteraction({
      type: 'resize',
      binId,
      handle,
      startRect: { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth },
      currentRect: { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth },
      valid: true,
    });
  }, [layout.bins, setSelectedBin, setInteraction]);

  // Cancel current interaction
  const cancel = useCallback(() => {
    setInteraction(null);
  }, [setInteraction]);

  // Document-level mouse tracking
  useEffect(() => {
    if (!interaction) return;

    const handleMouseMove = (e: MouseEvent) => {
      const coords = getGridCoords(e.clientX, e.clientY);
      if (!coords) return;
      const clamped = clampCoords(coords);

      if (interaction.type === 'draw') {
        setInteraction({
          ...interaction,
          current: clamped,
        });
      } else if (interaction.type === 'drag') {
        const bin = layout.bins.find(b => b.id === interaction.binId);
        if (!bin) return;

        const newX = Math.max(0, Math.min(clamped.x, layout.drawer.width - bin.width));
        const newY = Math.max(0, Math.min(clamped.y, layout.drawer.depth - bin.depth));

        const result = canPlaceBin(
          { x: newX, y: newY, width: bin.width, depth: bin.depth, height: bin.height },
          activeLayerId,
          layout,
          bin.id
        );

        setInteraction({
          ...interaction,
          currentCoord: { x: newX, y: newY },
          valid: result.valid,
        });
      } else if (interaction.type === 'resize') {
        const bin = layout.bins.find(b => b.id === interaction.binId);
        if (!bin) return;

        const newRect = calculateResizeRect(
          interaction.startRect,
          interaction.handle,
          clamped,
          layout.drawer
        );

        const result = canPlaceBin(
          { ...newRect, height: bin.height },
          activeLayerId,
          layout,
          bin.id
        );

        setInteraction({
          ...interaction,
          currentRect: newRect,
          valid: result.valid,
        });
      }
    };

    const handleMouseUp = () => {
      if (interaction.type === 'draw') {
        const { start, current } = interaction;
        const x1 = Math.min(start.x, current.x);
        const y1 = Math.min(start.y, current.y);
        const x2 = Math.max(start.x, current.x);
        const y2 = Math.max(start.y, current.y);
        const width = x2 - x1 + 1;
        const depth = y2 - y1 + 1;

        const layer = layout.layers.find(l => l.id === activeLayerId);
        if (layer) {
          execute(() => {
            const binId = addBin({
              layerId: activeLayerId,
              x: x1,
              y: y1,
              width,
              depth,
              height: layer.height,
              category: activeCategoryId,
              label: '',
              notes: '',
            });
            if (binId) {
              setSelectedBin(binId);
            }
          });
        }
      } else if (interaction.type === 'drag' && interaction.valid) {
        const { binId, currentCoord, startCoord } = interaction;
        const bin = layout.bins.find(b => b.id === binId);

        if (bin && (bin.x !== currentCoord.x || bin.y !== currentCoord.y)) {
          const layer = layout.layers.find(l => l.id === activeLayerId);
          execute(() => {
            updateBin(binId, {
              x: currentCoord.x,
              y: currentCoord.y,
              layerId: activeLayerId,
              height: layer?.height || bin.height,
            });
          });
        }
      } else if (interaction.type === 'resize' && interaction.valid) {
        const { binId, currentRect, startRect } = interaction;

        if (
          startRect.x !== currentRect.x ||
          startRect.y !== currentRect.y ||
          startRect.width !== currentRect.width ||
          startRect.depth !== currentRect.depth
        ) {
          execute(() => {
            updateBin(binId, {
              x: currentRect.x,
              y: currentRect.y,
              width: currentRect.width,
              depth: currentRect.depth,
            });
          });
        }
      }

      setInteraction(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interaction, layout, activeLayerId, activeCategoryId, addBin, updateBin, setInteraction, setSelectedBin, getGridCoords, clampCoords, execute]);

  return {
    interaction,
    startDraw,
    startDrag,
    startResize,
    cancel,
  };
}

/**
 * Calculate new rectangle based on resize handle and cursor position.
 */
function calculateResizeRect(
  start: Rect,
  handle: ResizeHandle,
  cursor: Coord,
  drawer: { width: number; depth: number }
): Rect {
  let { x, y, width, depth } = start;

  if (handle.includes('e')) {
    width = Math.max(1, cursor.x - x + 1);
  }
  if (handle.includes('w')) {
    const newX = Math.min(cursor.x, x + width - 1);
    width = x + width - newX;
    x = newX;
  }
  if (handle.includes('n')) {
    depth = Math.max(1, cursor.y - y + 1);
  }
  if (handle.includes('s')) {
    const newY = Math.min(cursor.y, y + depth - 1);
    depth = y + depth - newY;
    y = newY;
  }

  // Clamp to drawer bounds
  x = Math.max(0, x);
  y = Math.max(0, y);
  if (x + width > drawer.width) width = drawer.width - x;
  if (y + depth > drawer.depth) depth = drawer.depth - y;
  width = Math.max(1, width);
  depth = Math.max(1, depth);

  return { x, y, width, depth };
}
```

---

### 4C: useKeyboard
**Executor:** Sub-agent

#### src/hooks/useKeyboard.ts
```typescript
import { useEffect, useCallback } from 'react';
import { useUIStore, useLayoutStore, useHistoryStore, useUndoableAction } from '../core/store';
import { canPlaceBin } from '../utils/validation';
import { SHORTCUTS } from '../constants';

export function useKeyboard() {
  const selectedBinId = useUIStore(state => state.selectedBinId);
  const setSelectedBin = useUIStore(state => state.setSelectedBin);
  const setInteraction = useUIStore(state => state.setInteraction);
  const activeLayerId = useUIStore(state => state.activeLayerId);
  const zoomIn = useUIStore(state => state.zoomIn);
  const zoomOut = useUIStore(state => state.zoomOut);

  const layout = useLayoutStore(state => state.layout);
  const deleteBin = useLayoutStore(state => state.deleteBin);
  const updateBin = useLayoutStore(state => state.updateBin);

  const undo = useHistoryStore(state => state.undo);
  const redo = useHistoryStore(state => state.redo);
  const canUndo = useHistoryStore(state => state.canUndo);
  const canRedo = useHistoryStore(state => state.canRedo);

  const { execute } = useUndoableAction();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if in input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const key = e.key;
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    // Delete
    if (SHORTCUTS.DELETE.includes(key) && selectedBinId) {
      e.preventDefault();
      execute(() => deleteBin(selectedBinId));
      setSelectedBin(null);
      return;
    }

    // Escape
    if (SHORTCUTS.ESCAPE.includes(key)) {
      e.preventDefault();
      setInteraction(null);
      setSelectedBin(null);
      return;
    }

    // Undo
    if (ctrlOrMeta && key.toLowerCase() === SHORTCUTS.UNDO && !e.shiftKey) {
      e.preventDefault();
      if (canUndo) undo();
      return;
    }

    // Redo (Ctrl+Y or Ctrl+Shift+Z)
    if (ctrlOrMeta && (key.toLowerCase() === SHORTCUTS.REDO || (key === SHORTCUTS.REDO_ALT && e.shiftKey))) {
      e.preventDefault();
      if (canRedo) redo();
      return;
    }

    // Zoom
    if (SHORTCUTS.ZOOM_IN.includes(key)) {
      e.preventDefault();
      zoomIn();
      return;
    }
    if (SHORTCUTS.ZOOM_OUT.includes(key)) {
      e.preventDefault();
      zoomOut();
      return;
    }

    // Arrow nudge
    if ([SHORTCUTS.NUDGE_UP, SHORTCUTS.NUDGE_DOWN, SHORTCUTS.NUDGE_LEFT, SHORTCUTS.NUDGE_RIGHT].includes(key) && selectedBinId) {
      e.preventDefault();
      const bin = layout.bins.find(b => b.id === selectedBinId);
      if (!bin || bin.layerId === '__staging__') return;

      let dx = 0, dy = 0;
      if (key === SHORTCUTS.NUDGE_UP) dy = 1;
      if (key === SHORTCUTS.NUDGE_DOWN) dy = -1;
      if (key === SHORTCUTS.NUDGE_LEFT) dx = -1;
      if (key === SHORTCUTS.NUDGE_RIGHT) dx = 1;

      const newX = bin.x + dx;
      const newY = bin.y + dy;

      const result = canPlaceBin(
        { x: newX, y: newY, width: bin.width, depth: bin.depth, height: bin.height },
        bin.layerId,
        layout,
        bin.id
      );

      if (result.valid) {
        execute(() => updateBin(selectedBinId, { x: newX, y: newY }));
      }
      return;
    }
  }, [selectedBinId, layout, activeLayerId, canUndo, canRedo, undo, redo, zoomIn, zoomOut, deleteBin, updateBin, setSelectedBin, setInteraction, execute]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

---

### 4D: useAutoSave
**Executor:** Sub-agent

#### src/hooks/useAutoSave.ts
```typescript
import { useEffect, useRef } from 'react';
import { useLayoutStore } from '../core/store';
import { saveLayout } from '../utils/storage';

const SAVE_DEBOUNCE_MS = 1000;

export function useAutoSave() {
  const layout = useLayoutStore(state => state.layout);
  const timeoutRef = useRef<number>();

  useEffect(() => {
    // Clear any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule save
    timeoutRef.current = window.setTimeout(() => {
      try {
        saveLayout(layout);
      } catch (e) {
        console.error('Auto-save failed:', e);
        // Could emit a toast notification here
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [layout]);
}
```

#### src/hooks/index.ts
```typescript
export { useGridCoords } from './useGridCoords';
export { useInteraction } from './useInteraction';
export { useKeyboard } from './useKeyboard';
export { useAutoSave } from './useAutoSave';
```

---

## Phase 5: Components

> Phase 5 has four parallel tracks: Grid, Sidebar, Other, and Modals.
> Each track can be assigned to a separate sub-agent.

### 5A: Grid Components
**Executor:** Sub-agent
**Files:** Grid/index.tsx, Grid/GridCanvas.tsx, Grid/Bin.tsx, Grid/Overlay.tsx

*Detailed implementation follows same pattern - full component code omitted for brevity but follows PRD specifications.*

**Key responsibilities:**
- `Grid/index.tsx`: Container with zoom controls, axis labels
- `Grid/GridCanvas.tsx`: Cell rendering, mouse event handling, interaction integration
- `Grid/Bin.tsx`: Single bin with selection ring, resize handles
- `Grid/Overlay.tsx`: Preview (draw/drag/resize), ghost bins, blocked zones

---

### 5B: Sidebar Components
**Executor:** Sub-agent (parallel with 5A)
**Files:** Sidebar/index.tsx, DrawerPanel, LayersPanel, CategoriesPanel, QuickFillPanel, BinPanel

**Key responsibilities:**
- `DrawerPanel.tsx`: Width/depth/height inputs, max print size
- `LayersPanel.tsx`: Layer list, add/delete, inline rename, height inputs, coverage %
- `CategoriesPanel.tsx`: Category swatches, active selection
- `QuickFillPanel.tsx`: Size inputs, Fill All, Fill Gaps, Clear Layer buttons
- `BinPanel.tsx`: Selected bin properties, category dropdown, delete/staging buttons

---

### 5C: Other Components
**Executor:** Sub-agent (parallel with 5A, 5B)
**Files:** Header.tsx, Staging.tsx, PrintList.tsx

---

### 5D: Modals
**Executor:** Sub-agent (parallel with 5A, 5B, 5C)
**Files:** modals/HelpModal.tsx, modals/ImportModal.tsx, modals/ConfirmDialog.tsx

---

## Phase 6: Integration

### 6A: App Assembly
**Executor:** Main agent (sequential)
**Depends on:** All Phase 5 complete

#### src/App.tsx
```typescript
import { useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Grid } from './components/Grid';
import { Staging } from './components/Staging';
import { PrintList } from './components/PrintList';
import { useLayoutStore, useUIStore } from './core/store';
import { useKeyboard, useAutoSave } from './hooks';

export default function App() {
  const layers = useLayoutStore(state => state.layout.layers);
  const activeLayerId = useUIStore(state => state.activeLayerId);
  const setActiveLayer = useUIStore(state => state.setActiveLayer);

  // Initialize active layer
  useEffect(() => {
    if (!activeLayerId && layers.length > 0) {
      setActiveLayer(layers[0].id);
    }
  }, [activeLayerId, layers, setActiveLayer]);

  // Global keyboard shortcuts
  useKeyboard();

  // Auto-save
  useAutoSave();

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 p-4">
      <Header />

      <div className="flex gap-4 mt-4">
        <Sidebar className="w-64 flex-shrink-0" />

        <div className="flex-1 space-y-4 min-w-0">
          <Grid />
          <Staging />
          <PrintList />
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 7: Polish

### 7A: Accessibility Pass
**Executor:** Sub-agent
- Add focus indicators (`:focus-visible`)
- Ensure all inputs have labels
- Verify color contrast
- Add aria-labels to icon buttons

### 7B: Edge Case Handling
**Executor:** Sub-agent
- Viewport warning for <1024px
- localStorage error handling
- Confirm dialogs for destructive actions

### 7C: Performance Check
**Executor:** Sub-agent
- Test with 30x20 grid, 100 bins
- Profile drag performance
- Add memoization if needed

---

## Parallelization Summary

```
Timeline (conceptual):

Phase 1: [====] Sequential (project setup)
         1A ────────→
                    1B ──→

Phase 2: [========] Highly Parallel
         2A ──→
         2B ─────→
         2C ─────→
         2D ────→
         2E ─────→
         2F ───→

Phase 3: [====] Mixed
         3A ─────→
         3B ────→  (parallel with 3A)
                3C ──→ (after 3A)

Phase 4: [====] Parallel
         4A ──→
         4B ───→
         4C ──→
         4D ─→

Phase 5: [========] Highly Parallel (4 tracks)
         5A ────────→ (Grid)
         5B ────────→ (Sidebar)
         5C ──────→   (Other)
         5D ─────→    (Modals)

Phase 6: [==] Sequential
         6A ────→

Phase 7: [====] Parallel
         7A ──→
         7B ──→
         7C ──→
```

**Maximum parallel agents at once: 6** (during Phase 2 or Phase 5)

---

## Agent Assignment Recommendations

| Phase | Task | Agent Type | Notes |
|-------|------|------------|-------|
| 1A | Project Setup | Main | Must be first |
| 1B | Types + Constants | engineer | Straightforward |
| 2B | collision.ts + tests | engineer | Math-heavy, needs tests |
| 2C | validation.ts + tests | engineer | Business logic |
| 2D | split.ts + tests | engineer | Algorithm from PRD |
| 2E | fill.ts + tests | engineer | Algorithm, depends on 2C |
| 2F | storage.ts | engineer | I/O utilities |
| 3A | layout store | engineer | Core state |
| 3B | ui store | engineer | Simple state |
| 3C | history store | engineer | Wraps 3A |
| 4A-4D | hooks | engineer | Can parallelize |
| 5A | Grid components | engineer | Complex UI |
| 5B | Sidebar components | engineer | Forms |
| 5C | Other components | engineer | Simpler UI |
| 5D | Modals | engineer | Dialogs |
| 6A | App assembly | Main | Integration |
| 7A-7C | Polish | engineer | Can parallelize |

---

## Success Criteria

### M1 Complete When:
- [ ] Can create bins by drawing on grid
- [ ] Can select, move, resize, delete bins
- [ ] 3D collision detection prevents invalid placement
- [ ] Blocked zones render for multi-layer bins
- [ ] Layers can be added/deleted/renamed
- [ ] Categories color-code bins
- [ ] Staging area holds displaced bins
- [ ] Import/export JSON works
- [ ] Undo/redo works (50 states)
- [ ] Keyboard shortcuts work
- [ ] All tests pass
