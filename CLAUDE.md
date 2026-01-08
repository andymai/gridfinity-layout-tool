# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gridfinity Layout Tool is a React + TypeScript web application for designing storage layouts for 3D-printed drawer organizers (Gridfinity system). Features multi-layer support, drag-and-drop bin placement, and print optimization.

## Commands

```bash
npm run dev          # Start Vite dev server with HMR
npm run build        # TypeScript compile + Vite production build (tsc -b && vite build)
npm run test         # Run Vitest in watch mode
npm run test:run     # Run Vitest once (CI mode)
npm run lint         # ESLint check
```

## Architecture

### State Management (Zustand + Immer)

Four stores in `src/store/`:
- **layout.ts** - Layout data (bins, layers, categories, drawer settings). Uses Immer for immutable updates.
- **ui.ts** - UI state (selection, zoom, panel visibility, current interaction mode)
- **history.ts** - Undo/redo stack (max 50 states)
- **toast.ts** - Toast notification state

Wrap layout mutations with `useUndoableAction()` for undo support:
```typescript
const { execute } = useUndoableAction();
execute(() => addBin({ ... }));
```

### Core Data Model (`src/types.ts`)

```
Layout → Drawer, Categories[], Layers[], Bins[]
Bin → position (x,y), size (width,depth,height), layerId, category, label
Layer → id, name, height (minimum bin height for this layer)
```

**Coordinate System**: Grid origin (0,0) is bottom-left. `layers[0]` is bottom layer. UI displays layers reversed via `getDisplayLayers()` in `collision.ts`.

**Staging Area**: Bins with `layerId === STAGING_ID` (`'__staging__'`) are in the stash, not on the grid. Bins auto-move here when displaced by drawer resize or when duplication can't find adjacent space.

### Component Structure

- **Grid/** - CSS Grid rendering (`GridCanvas.tsx` - named "Canvas" but uses CSS Grid, not HTML Canvas) + DOM overlay for interactive bins (`Overlay.tsx`)
- **Sidebar/** - Left panel: layers, categories, bin palette
- **RightPanel.tsx** - Selection inspector and actions
- **mobile/** and **tablet/** - Responsive variants with distinct layouts

**Zustand Pattern**: Use `useShallow` from `zustand/shallow` when selecting multiple values to prevent unnecessary re-renders:
```typescript
const { drawer, bins } = useLayoutStore(useShallow((state) => ({ drawer: state.layout.drawer, bins: state.layout.bins })));
```

### Key Hooks

- `useInteraction.ts` - Handles all grid interactions (see Interaction Types below)
- `useGridCoords.ts` - Mouse/touch → grid coordinate conversion
- `useResponsive.ts` - Breakpoint detection (isMobile, isTablet)
- `useAutoSave.ts` - Debounced localStorage persistence

### Interaction Types (`types.ts`)

Five interaction modes tracked via `Interaction` union type:
- **draw** - Creating new bin by drag-selecting area
- **drag** - Moving one or more selected bins
- **resize** - Resizing bins via corner/edge handles
- **stagingDrag** - Dragging bin from stash onto grid
- **paint** - Fill mode: drag area to fill with uniform-sized bins

### Utilities (`src/utils/`)

- `validation.ts` - `canPlaceBin()` checks bounds, height, collisions
- `collision.ts` - Collision detection, blocked zones, layer Z calculations
- `fill.ts` - Bulk operations (fillAllWithSize, fillGaps)
- `split.ts` - Print optimization: `splitBinSize()` recursively splits oversized bins, `generatePrintList()` creates print manifest
- `storage.ts` - LocalStorage persistence (key: `gridfinity-layout-v1`), import with ID regeneration to prevent collisions

## Styling

Tailwind CSS 4 with semantic color tokens defined in `src/index.css`:
- Surface: `bg-surface`, `bg-surface-secondary`, `bg-surface-elevated`
- Content: `text-content`, `text-content-secondary`, `text-content-tertiary`
- Stroke: `border-stroke`, `border-stroke-subtle`
- Semantic: `text-success`, `bg-error`, `bg-warning-muted`, etc.

Dark theme by default. Use Tailwind classes, not inline styles.

## Constants

Key values in `src/constants.ts`:
- Grid: 1-50 units, BASE_CELL_SIZE = 32px
- Layers: 1-10 max
- Zoom: 0.25-4.0 range
- Default: 10×8 drawer, 42mm grid units, 7mm height units

**Print Bed Constraints**: `calcMaxGridUnits(printBedSizeMm, gridUnitMm)` computes maximum bin dimensions that fit on the printer with 10mm gaps between bins. Used for print list warnings and gap-fill operations.

**Keyboard Shortcuts** (in `SHORTCUTS` constant, handled by `useKeyboard.ts`):
- Delete/Backspace: Delete selected bins
- Ctrl+Z / Ctrl+Y: Undo/Redo
- Ctrl+D: Duplicate selection
- Arrow keys: Nudge selected bins
- +/-: Zoom in/out
- Escape: Clear selection, exit paint mode
- ?: Toggle help modal

## Testing

Tests in `src/test/` use Vitest with jsdom environment. Focus on pure utility functions (validation, collision, fill, split algorithms). Tests use `createTestLayout()` factory helper pattern.

```bash
npx vitest run src/test/validation.test.ts  # Single file
npm run test:run                             # All tests (CI)
```
