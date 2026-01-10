# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gridfinity Layout Tool is a React + TypeScript web application for designing storage layouts for 3D-printed drawer organizers (Gridfinity system). Features multi-layer support, drag-and-drop bin placement, 3D isometric preview (react-three-fiber), print optimization with filament estimation, and responsive design (desktop, tablet, mobile).

**Tech Stack:**
- React 19 + TypeScript 5.9
- Vite 7 (build/dev server)
- Zustand 5 + Immer (state management)
- Tailwind CSS 4 (styling)
- Three.js + @react-three/fiber (3D preview)
- Vitest (unit tests) + Playwright (e2e tests)
- PWA support (vite-plugin-pwa)

## Commands

```bash
npm run dev          # Start Vite dev server with HMR
npm run build        # TypeScript compile + Vite production build (tsc -b && vite build)
npm run preview      # Preview production build locally

# Testing
npm run test         # Run Vitest in watch mode
npm run test:run     # Run Vitest once (CI mode)
npm run test:e2e     # Run Playwright e2e tests
npm run test:e2e:ui  # Run Playwright with UI mode

npm run lint         # ESLint check
```

## Code Style (Pre-commit Enforced)

Husky + lint-staged runs ESLint on staged `.ts/.tsx` files. Code must pass with zero warnings.

**Required patterns:**
```typescript
// Use 'import type' for type-only imports
import type { Bin, Layer } from '../types';
import { someFunction } from '../utils';

// Use explicit types, never 'any'
function process(data: Layout): ValidationResult { ... }

// Prefix unused params with underscore
function handler(_event: MouseEvent, value: number) { ... }

// Use strict equality
if (value === null) { ... }  // not ==
```

**Prohibited:**
- `any` type → use `unknown` or specific types
- `console.log` → use `console.warn` or `console.error` if needed
- `var` → use `const` or `let`
- `==` / `!=` → use `===` / `!==`
- Non-null assertions (`!`) → avoid or handle null explicitly

**React patterns:**
- All hooks rules enforced (no conditional hooks, proper deps arrays)
- Use `useShallow` when selecting multiple store values

## Architecture

### State Management (Zustand + Immer)

Four stores in `src/store/`:
- **layout.ts** - Layout data (bins, layers, categories, drawer settings). Uses Immer for immutable updates. Operations return `OperationResult<T>` for error handling.
- **ui.ts** - UI state (selection, zoom, panel visibility, interaction mode, paint mode, context menu, isometric preview state, keyboard navigation)
- **history.ts** - Undo/redo stack (max 50 states). Use `useUndoableAction()` hook to wrap mutations.
- **toast.ts** - Toast notification state (success/error/info, max 3 toasts)

Wrap layout mutations with `useUndoableAction()` for undo support:
```typescript
const { execute } = useUndoableAction();
execute(() => addBin({ ... }));
```

**Zustand Pattern**: Use `useShallow` from `zustand/shallow` when selecting multiple values to prevent unnecessary re-renders:
```typescript
const { drawer, bins } = useLayoutStore(useShallow((state) => ({
  drawer: state.layout.drawer,
  bins: state.layout.bins
})));
```

### Core Data Model (`src/types.ts`)

```
Layout → Drawer, Categories[], Layers[], Bins[], printBedSize, gridUnitMm, heightUnitMm
Drawer → width, depth, height (all in grid units)
Bin → position (x,y), size (width,depth,height), layerId, category, label, notes, clearanceHeight?
Layer → id, name, height (minimum bin height for this layer)
Category → id, name, color (hex)
```

**Coordinate System**: Grid origin (0,0) is bottom-left. `layers[0]` is bottom layer. UI displays layers reversed via `getDisplayLayers()` in `collision.ts`.

**Staging Area**: Bins with `layerId === STAGING_ID` (`'__staging__'`) are in the stash, not on the grid. Bins auto-move here when displaced by drawer resize or when duplication can't find adjacent space.

**Operation Results**: Use `OperationResult<T>` type for operations that can fail:
```typescript
type OperationResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };
```

### Component Structure (`src/components/`)

**Core:**
- `App.tsx` - Main app with responsive layout detection (mobile/tablet/desktop)
- `Header.tsx` - Top navigation bar
- `Staging.tsx` - Stash area for displaced bins

**Grid (CSS Grid-based, not HTML Canvas):**
- `Grid/index.tsx` - Main grid container
- `Grid/GridCanvas.tsx` - CSS Grid cell rendering (named "Canvas" but uses CSS Grid)
- `Grid/Overlay.tsx` - DOM overlay for interactive bins with drag handles
- `Grid/Bin.tsx` - Individual bin component
- `Grid/QuickLabelPopover.tsx` - Quick label editing (double-click or L key)
- `Grid/IsometricPreview.tsx` - 3D preview entry point (lazy loaded)
- `Grid/IsometricPreview/` - Three.js 3D scene components (Scene, BinMesh, FloorGrid, etc.)

**Panels:**
- `Sidebar/` - Left panel: layer management, category picker
- `RightPanel.tsx` - Selection inspector and actions
- `inspector/` - Bin inspector components (single/multi selection)
- `PrintList/` - Print list summary and split preview

**Responsive:**
- `mobile/` - Mobile-specific layouts (BottomSheet, BottomNavBar, MobileHeader, etc.)
- `tablet/` - Tablet overlay panels (TabletPanelOverlay, TabletPanelTriggers)
- `MobileLayout.tsx` - Complete mobile layout (lazy loaded)

**Modals:**
- `modals/HelpModal.tsx` - Keyboard shortcuts help
- `modals/ImportModal.tsx` - Layout import dialog
- `modals/ConfirmDialog.tsx` - Generic confirmation dialog

**Utilities:**
- `Toast.tsx` - Toast notification container
- `LiveRegion.tsx` - ARIA live region for screen reader announcements
- `ErrorBoundary.tsx`, `PanelErrorBoundary.tsx` - Error boundaries
- `DropZones.tsx` - Drag-and-drop targets (trash, staging)
- `DragPreview.tsx` - Floating drag preview

### Key Hooks (`src/hooks/`)

- `useInteraction.ts` - Handles all grid interactions (draw, drag, resize, paint, stagingDrag)
- `useGridCoords.ts` - Mouse/touch → grid coordinate conversion
- `useResponsive.ts` - Breakpoint detection (isMobile, isTablet, layoutMode)
- `useAutoSave.ts` - Debounced localStorage persistence
- `useKeyboard.ts` - Global keyboard shortcuts (delete, undo/redo, zoom, etc.)
- `useKeyboardDrag.ts` - Keyboard-based bin dragging
- `useKeyboardResize.ts` - Keyboard-based bin resizing
- `useGridNavigation.ts` - Keyboard navigation between bins
- `use3DPreviewKeyboard.ts` - 3D preview camera shortcuts
- `usePrintList.ts` - Print list calculation and filtering
- `useAdvancedLayerMode.ts` - Layer view mode toggle

### Interaction Types (`types.ts`)

Five interaction modes tracked via `Interaction` union type:
- **draw** - Creating new bin by drag-selecting area
- **drag** - Moving one or more selected bins
- **resize** - Resizing bins via corner/edge handles
- **stagingDrag** - Dragging bin from stash onto grid
- **paint** - Fill mode: drag area to fill with uniform-sized bins

### Utilities (`src/utils/`)

- `validation.ts` - `canPlaceBin()` checks bounds, height, collisions; `validateImport()` for layout imports
- `collision.ts` - Collision detection, blocked zones calculation, layer Z calculations, `getDisplayLayers()`
- `fill.ts` - Bulk operations (`fillAllWithSize`, `fillGaps`)
- `split.ts` - Print optimization: `splitBinSize()` recursively splits oversized bins, `generatePrintList()` creates print manifest with filament estimates
- `storage.ts` - LocalStorage persistence (key: `gridfinity-layout-v1`), import with ID regeneration
- `selection.ts` - Multi-selection utilities (box select, shift-click range)
- `entity.ts` - Entity ID utilities
- `navigation.ts` - Keyboard navigation helpers
- `color.ts` - Color utilities for bin display
- `isometric.ts` - 3D preview math helpers
- `printEstimates.ts` - Filament cost/spool calculations
- `printListOperations.ts` - Print list sorting/filtering
- `lazyWithRetry.ts` - Lazy loading with retry for chunk load failures

## Styling

Tailwind CSS 4 with semantic color tokens defined in `src/index.css`:
- Surface: `bg-surface`, `bg-surface-secondary`, `bg-surface-elevated`
- Content: `text-content`, `text-content-secondary`, `text-content-tertiary`
- Stroke: `border-stroke`, `border-stroke-subtle`
- Semantic: `text-success`, `bg-error`, `bg-warning-muted`, etc.
- Grid: `bg-grid-bg`, `bg-grid-cell`, `bg-grid-cell-hover`
- Selection: `ring-selection-ring`, `bg-selection-bg`

Dark theme by default. Use Tailwind classes, not inline styles.

## Constants (`src/constants.ts`)

**Constraints:**
- Grid: 1-50 units
- Layers: 1-10 max
- Categories: 1-20 max
- Undo limit: 50 states
- Zoom: 0.25-4.0 range
- Quick fill max: 2500 bins (confirmation at 100+)
- Print gap: 10mm between bins on print bed

**Defaults:**
- Grid cell size: 32px (BASE_CELL_SIZE)
- Drawer: 10×8 units, 12 height
- Grid unit: 42mm
- Height unit: 7mm
- Print bed: 256mm

**Print Bed Constraints**: `calcMaxGridUnits(printBedSizeMm, gridUnitMm)` computes maximum bin dimensions that fit on the printer. Used for print list warnings and gap-fill operations.

**Breakpoints:**
- TINY_PHONE: 375px
- SM: 640px (small phones)
- MD: 768px (mobile/tablet boundary)
- LG: 900px (tablet/desktop boundary)
- XL: 1280px (full desktop)

**Keyboard Shortcuts** (in `SHORTCUTS` constant, handled by `useKeyboard.ts`):
- Delete/Backspace: Delete selected bins
- Ctrl+Z / Ctrl+Y: Undo/Redo
- Ctrl+D: Duplicate selection
- Arrow keys: Nudge selected bins
- +/-: Zoom in/out
- W/S: Layer up/down
- A/D: Select prev/next bin
- [/]: Previous/next category
- L: Quick label edit
- V: Toggle 3D preview
- Space: Expand 3D preview
- 1-4: Camera presets (isometric, top, front, side)
- Escape: Clear selection, exit paint mode
- ?: Toggle help modal

## Testing

**Unit Tests** (`src/test/`):
Use Vitest with jsdom environment. Focus on pure utility functions and store logic. Tests use `createTestLayout()` factory helper pattern.

```bash
npx vitest run src/test/validation.test.ts  # Single file
npm run test:run                             # All tests (CI)
```

Test files cover:
- `validation.test.ts` - Bin placement validation
- `collision.test.ts` - Collision detection
- `fill.test.ts` - Fill algorithms
- `split.test.ts` - Print optimization splitting
- `storage.test.ts` - Import/export
- `store/*.test.ts` - Zustand store operations
- `hooks/*.test.ts` - Hook behavior
- `components/*.test.tsx` - Component rendering

**E2E Tests** (`e2e/`):
Use Playwright for browser automation. Tests cover full user flows.

```bash
npm run test:e2e          # Headless
npm run test:e2e:ui       # Interactive UI
```

E2E test files:
- `add-bins.spec.ts`, `drag-bins.spec.ts`, `resize-bins.spec.ts` - Bin operations
- `layers.spec.ts`, `categories.spec.ts` - Management panels
- `multi-select.spec.ts` - Multi-selection behavior
- `keyboard-navigation.spec.ts` - Accessibility/keyboard
- `undo-redo.spec.ts` - History operations
- `print-list.spec.ts` - Print list features
- `3d-preview.spec.ts` - 3D preview
- `mobile.spec.ts` - Mobile-specific flows
- `accessibility.spec.ts` - ARIA/a11y compliance

**Test setup** (`src/test/setup.ts`):
- Mocks pointer capture methods (not in jsdom)
- Mocks `matchMedia` for responsive tests

## Build Configuration

**Vite** (`vite.config.ts`):
- React plugin with fast refresh
- Tailwind CSS plugin
- PWA plugin with auto-update, workbox caching
- Manual chunks for code splitting:
  - `three` - Three.js (lazy loaded for 3D preview)
  - `react-three` - @react-three/fiber + drei
  - `react-vendor` - React runtime
  - `state` - Zustand + Immer

**TypeScript** (project references):
- `tsconfig.app.json` - App source
- `tsconfig.node.json` - Node config (vite.config.ts)

**ESLint** (`eslint.config.js`):
- Strict TypeScript rules
- React hooks rules
- Relaxed rules for test files (`any` and non-null assertions allowed)
