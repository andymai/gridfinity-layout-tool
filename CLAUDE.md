# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gridfinity Layout Tool is a React + TypeScript web application for designing storage layouts for 3D-printed drawer organizers (Gridfinity system). Features multi-layer support, drag-and-drop bin placement, 3D isometric preview (react-three-fiber), print optimization with filament estimation, cloud sharing, and responsive design (desktop, tablet, mobile).

**Tech Stack:**
- React 19 + TypeScript 5.9
- Vite 7 (build/dev server)
- Zustand 5 + Immer (state management)
- Tailwind CSS 4 (styling)
- Three.js + @react-three/fiber (3D preview)
- Vitest (unit tests) + Playwright (e2e tests)
- PWA support (vite-plugin-pwa)
- Vercel Blob + Redis (cloud sharing backend)
- PostHog (analytics)
- Deployed via Vercel (auto-deploy on push to `main`)

## Git Workflow

**Main branch is protected.** All changes must go through pull requests - never commit directly to `main`.

1. Create a feature branch: `git checkout -b feature/description`
2. Make changes and commit
3. Push and create PR: `gh pr create`
4. Merge via PR (squash preferred)

Pre-commit hooks enforce lint, build, and test coverage locally before each commit.

## Commands

```bash
npm run dev          # Start Vite dev server with HMR
npm run build        # TypeScript compile + Vite production build (tsc -b && vite build)
npm run preview      # Preview production build locally

# Testing
npm run test         # Run Vitest in watch mode
npm run test:run     # Run Vitest once (CI mode)
npm run test:coverage # Run tests with coverage (enforced in pre-commit)
npm run test:e2e     # Run Playwright e2e tests
npm run test:e2e:ui  # Run Playwright with UI mode

npm run lint         # ESLint check

# Bundle analysis
npm run size         # Check bundle sizes
npm run size:check   # Verify against size limits
```

## Code Style (Pre-commit Enforced)

Husky + lint-staged runs ESLint on staged `.ts/.tsx` files. Code must pass with zero warnings.

**Pre-commit checks:** lint-staged → build → test:coverage

## Test Coverage (Pre-commit Enforced)

Coverage thresholds are enforced on every commit. If coverage drops below thresholds, the commit will fail.

**Current thresholds (configured in `vitest.config.ts`):**
- Lines: 60%
- Branches: 43%
- Functions: 57%
- Statements: 59%

**When adding new code:**
1. Write tests for new utilities, hooks, and store logic
2. Run `npm run test:coverage` before committing to verify thresholds pass
3. If coverage drops, add tests until thresholds are met

**Coverage priorities** (focus testing effort here):
- `src/utils/` - Pure functions, high coverage expected (currently ~90%)
- `src/store/` - State management logic (currently ~87%)
- `src/hooks/` - Custom hooks with business logic (currently ~73%)
- UI components - Lower priority, covered by Playwright e2e tests

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

Six stores in `src/store/`:
- **layout.ts** - Layout data (bins, layers, categories, drawer settings). Uses Immer for immutable updates. Operations return `OperationResult<T>` for error handling.
- **library.ts** - Multi-layout library management (layout entries, metadata, previews, cloud share info). Tracks `activeLayoutId` and provides CRUD for layout entries. Uses `computePreview()` to generate thumbnail data.
- **ui.ts** - UI state (selection, zoom, panel visibility, interaction mode, paint mode, context menu, isometric preview state, keyboard navigation, half-bin mode)
- **history.ts** - Undo/redo stack (max 50 states). Use `useUndoableAction()` hook to wrap mutations.
- **toast.ts** - Toast notification state (success/error/info, max 3 toasts)
- **settings.ts** - User preferences that persist across sessions (default drawer sizes, zoom, panel state). Stored in `gridfinity-settings-v1`.

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
Drawer → width, depth, height (all in grid units), fractionalEdgeX?, fractionalEdgeY?
Bin → position (x,y), size (width,depth,height), layerId, category, label, notes, clearanceHeight?
Layer → id, name, height (minimum bin height for this layer)
Category → id, name, color (hex)
```

**Coordinate System**: Grid origin (0,0) is bottom-left. `layers[0]` is bottom layer. UI displays layers reversed via `getDisplayLayers()` in `collision.ts`.

**Multi-Layout Library**: The app supports multiple layouts via `LayoutLibrary`:
```
LayoutLibrary → activeLayoutId, settings, LayoutEntry[]
LayoutEntry → id, name, timestamps, preview, cloudShare?
CloudShareInfo → id, deleteToken, sharedAt, expiresAt
```
Each layout is stored separately in localStorage by UUID. The library index tracks metadata without loading full layout data.

**Staging Area**: Bins with `layerId === STAGING_ID` (`'__staging__'`) are in the stash, not on the grid. Bins auto-move here when displaced by drawer resize or when duplication can't find adjacent space.

**Half-Bin Mode**: Supports 0.5 unit increments for finer positioning. Controlled by `halfBinMode` in UI store. Use helper functions from `constants.ts`:
- `snapToHalf(value)` - Snap to nearest 0.5
- `snapToGrid(value, halfBinMode)` - Snap based on mode
- `isFractional(value)` - Check if at 0.5 position
- `hasFractionalDimensions(rect)` - Check if any dimension is fractional
Validation in `halfBinConstraints.ts` prevents disabling half-bin mode when fractional bins exist.

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
- `Grid/ResizeHandles.tsx`, `Grid/ResizeHandle.tsx` - Bin resize interaction
- `Grid/QuickLabelPopover.tsx` - Quick label editing (double-click or L key)
- `Grid/IsometricPreview.tsx` - 3D preview entry point (lazy loaded)
- `Grid/IsometricPreview/` - Three.js 3D scene components (Scene, BinMesh, FloorGrid, MergedBinMeshes, etc.)

**Panels:**
- `Sidebar/` - Left panel: layer management, category picker, active layer panel
- `RightPanel.tsx` - Selection inspector and actions
- `inspector/` - Bin inspector components (single/multi selection, split warning)
- `PrintList/` - Print list summary and split preview
- `BinList/` - Bin statistics with category breakdown chart

**Context Menu:**
- `contextMenu/` - Reusable context menu framework (ContextMenuContainer, ContextMenuItem, ContextMenuDivider)

**Cloud Sharing:**
- `CloudShareTab.tsx` - Share/update/delete cloud share UI
- `SharedLayoutBanner.tsx` - Banner showing shared layout info
- `SharedLayoutImporter.tsx` - Import shared layouts from URL

**Responsive:**
- `mobile/` - Mobile-specific layouts (BottomSheet, BottomNavBar, MobileHeader, BinContextMenu, etc.)
- `tablet/` - Tablet overlay panels (TabletPanelOverlay, TabletPanelTriggers)
- `MobileLayout.tsx` - Complete mobile layout (lazy loaded)

**Modals:**
- `modals/LayoutManagerModal.tsx` - Multi-layout management (create, switch, rename, delete, duplicate)
- `modals/HelpModal.tsx` - Keyboard shortcuts help
- `modals/ImportModal.tsx` - Layout import dialog
- `modals/ConfirmDialog.tsx` - Generic confirmation dialog

**Utilities:**
- `Toast.tsx` - Toast notification container
- `LiveRegion.tsx` - ARIA live region for screen reader announcements
- `ErrorBoundary.tsx`, `PanelErrorBoundary.tsx` - Error boundaries
- `DropZones.tsx` - Drag-and-drop targets (trash, staging)
- `DragPreview.tsx` - Floating drag preview
- `LayoutThumbnail.tsx` - Layout preview thumbnails
- `CollapsibleSection.tsx`, `CollapsiblePanel.tsx` - Collapsible UI containers
- `DeferredNumberInput.tsx` - Number input with deferred updates

### Key Hooks (`src/hooks/`)

**Interaction:**
- `useInteraction.ts` - Handles all grid interactions (draw, drag, resize, paint, stagingDrag)
- `useGridCoords.ts` - Mouse/touch → grid coordinate conversion
- `useContextMenu.ts` - Context menu state management

**Navigation & Keyboard:**
- `useKeyboard.ts` - Global keyboard shortcuts (delete, undo/redo, zoom, rotate, etc.)
- `useKeyboardDrag.ts` - Keyboard-based bin dragging
- `useKeyboardResize.ts` - Keyboard-based bin resizing
- `useGridNavigation.ts` - Keyboard navigation between bins
- `use3DPreviewKeyboard.ts` - 3D preview camera shortcuts

**Data & Persistence:**
- `useAutoSave.ts` - Debounced localStorage persistence for active layout
- `useLayoutSwitcher.ts` - Switch between layouts (save current, load new, update library)
- `useCrossTabSync.ts` - Synchronize library state across browser tabs
- `useLayoutRouting.ts` - URL-based layout routing (handles `/s/{shareId}` URLs)

**Cloud Sharing:**
- `useCloudShare.ts` - Cloud share state and operations (share, update, delete, copyUrl)

**UI & Analytics:**
- `useResponsive.ts` - Breakpoint detection (isMobile, isTablet, layoutMode)
- `usePrintList.ts` - Print list calculation and filtering
- `useBinList.ts` - Bin list panel data
- `useAdvancedLayerMode.ts` - Layer view mode toggle
- `usePWAUpdate.ts` - PWA service worker update handling
- `useAnalytics.ts` - PostHog analytics tracking

### Interaction Types (`types.ts`)

Five interaction modes tracked via `Interaction` union type:
- **draw** - Creating new bin by drag-selecting area
- **drag** - Moving one or more selected bins
- **resize** - Resizing bins via corner/edge handles
- **stagingDrag** - Dragging bin from stash onto grid
- **paint** - Fill mode: drag area to fill with uniform-sized bins

### Utilities (`src/utils/`)

**Validation & Collision:**
- `validation.ts` - `canPlaceBin()` checks bounds, height, collisions; `validateImport()` for layout imports
- `collision.ts` - Collision detection, blocked zones calculation, layer Z calculations, `getDisplayLayers()`
- `rotation.ts` - `validateRotation()` for bin rotation validation
- `halfBinConstraints.ts` - Validation for half-bin mode toggle

**Bulk Operations:**
- `fill.ts` - Bulk operations (`fillAllWithSize`, `fillGaps`)
- `split.ts` - Print optimization: `splitBinSize()` recursively splits oversized bins, `generatePrintList()` creates print manifest with filament estimates

**Storage & Sharing:**
- `storage.ts` - LocalStorage persistence with multi-layout support:
  - Library index: `gridfinity-library-v1`
  - Per-layout data: `gridfinity-layout-{uuid}`
  - Functions: `saveLayoutById()`, `loadLayoutById()`, `deleteLayoutById()`, `initializeLayoutLibrary()`, `copyToClipboard()`
- `cloudShare.ts` - Cloud sharing utilities
- `uuid.ts` - UUID generation

**Selection & Navigation:**
- `selection.ts` - Multi-selection utilities (box select, shift-click range)
- `entity.ts` - Entity ID utilities
- `navigation.ts` - Keyboard navigation helpers
- `binLocation.ts` - Bin location helpers

**UI Helpers:**
- `color.ts` - Color utilities for bin display
- `isometric.ts` - 3D preview math helpers
- `handlePositioning.ts` - Resize handle positioning calculations
- `lazyWithRetry.ts` - Lazy loading with retry for chunk load failures
- `throttle.ts` - Throttling utility
- `idle.ts` - Idle detection for deferred operations
- `url.ts` - URL manipulation

**Print & Analytics:**
- `printEstimates.ts` - Filament cost/spool calculations
- `printListOperations.ts` - Print list sorting/filtering
- `binListOperations.ts` - Bin list panel operations
- `analytics.ts` - PostHog analytics integration

### API (Vercel Serverless Functions)

Cloud sharing backend in `api/`:
- `share.ts` - POST: Create new share (Vercel Blob storage)
- `share/[id].ts` - GET: Fetch share, PUT: Update share, DELETE: Delete share
- `report/[id].ts` - POST: Report inappropriate content

**Supporting libraries** (`api/lib/`):
- `rateLimit.ts` - Redis-based rate limiting (10 shares/hour, 100 reads/hour)
- `validation.ts` - Layout validation (500KB max, 2500 bins max)
- `contentFilter.ts` - Content filtering for labels/notes

**Client API** (`src/api/share.ts`):
- `createShare()`, `updateShare()`, `fetchShare()`, `deleteShare()`, `reportShare()`
- `getErrorMessage()` - User-friendly error messages
- Types: `ShareResponse`, `ShareErrorResponse`, `ShareResult<T>`

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
- Grid: 0.5-50 units (supports half-unit increments)
- Layers: 1-10 max
- Categories: 1-20 max
- Layouts: 100 max (warning at 80)
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

**Half-Bin Mode:**
- `HALF_BIN_SCALE = 2` - Grid rendered at 2x for 0.5 unit support
- `snapToHalf()`, `snapToGrid()`, `isFractional()`, `hasFractionalDimensions()`

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
- Ctrl+O: Open layout manager
- R: Rotate bin (swap width/depth)
- H: Toggle half-bin mode
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
- ? or /: Toggle help modal

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
- `add-bins.spec.ts`, `drag-bins.spec.ts`, `resize-bins.spec.ts`, `rotate-bins.spec.ts` - Bin operations
- `layers.spec.ts`, `categories.spec.ts` - Management panels
- `multi-select.spec.ts` - Multi-selection behavior
- `keyboard-navigation.spec.ts` - Accessibility/keyboard
- `undo-redo.spec.ts` - History operations
- `print-list.spec.ts` - Print list features
- `3d-preview.spec.ts` - 3D preview
- `mobile.spec.ts` - Mobile-specific flows
- `accessibility.spec.ts` - ARIA/a11y compliance
- `staging.spec.ts` - Staging area behavior
- `drawer-settings.spec.ts` - Drawer configuration
- `create-layout.spec.ts` - Layout creation flow
- `zoom.spec.ts` - Zoom functionality
- `edge-cases.spec.ts` - Edge case handling
- `verify-isolation.spec.ts` - Test isolation verification

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

**Bundle Size Limits** (via size-limit):
- Main bundle (gzip): 105 kB
- Total JS (gzip): 690 kB

**TypeScript** (project references):
- `tsconfig.app.json` - App source
- `tsconfig.node.json` - Node config (vite.config.ts)

**ESLint** (`eslint.config.js`):
- Strict TypeScript rules
- React hooks rules
- Relaxed rules for test files (`any` and non-null assertions allowed)

## Environment Variables

For cloud sharing backend (set in Vercel):
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob access token
- `KV_REST_API_URL` - Vercel KV (Redis) URL
- `KV_REST_API_TOKEN` - Vercel KV access token
- `TOKEN_SALT` - Salt for hashing delete tokens
