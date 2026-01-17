# CLAUDE.md

Gridfinity Layout Tool: React + TypeScript web app for 3D-printed drawer organizer layouts. Multi-layer support, drag-and-drop, 3D preview (react-three-fiber), print optimization, cloud sharing, responsive design.

**Stack:** React 19, TypeScript 5.9, Vite 7, Zustand 5 + Immer, Tailwind CSS 4, Three.js, Vitest, Playwright, PWA, Vercel Blob + Redis, PostHog analytics.

## Git Workflow

**Main branch is protected.** All changes via PRs - never commit directly to `main`.

Pre-commit hooks enforce lint, build, and test coverage (Lines: 86%, Branches: 74%, Functions: 85%, Statements: 85%). Run `npm run test:coverage` before committing. Focus testing on `src/utils/` (~90%), `src/core/store/` (~87%), `src/hooks/` (~73%).

## Code Style (Enforced)

**Required:**
- `import type` for type-only imports
- Explicit types (never `any`, use `unknown`)
- Prefix unused params with `_`
- Strict equality (`===` not `==`)
- `useShallow` when selecting multiple store values

**Prohibited:** `any`, `console.log`, `var`, `==`, non-null assertions (`!`)

## Architecture

### State Management (Zustand + Immer)

Six stores in `src/core/store/`:
- **layout.ts** - Layout data (bins, layers, categories, drawer). Returns `Result<T, LayoutError>`.
- **library.ts** - Multi-layout library management. Tracks `activeLayoutId`, CRUD for layouts, generates thumbnails via `computePreview()`.
- **ui.ts** - UI state (selection, zoom, panels, interaction mode, paint mode, context menu, isometric preview, keyboard nav, half-bin mode)
- **history.ts** - Undo/redo (max 50). Wrap mutations with `useUndoableAction()`.
- **toast.ts** - Toast notifications (max 3)
- **settings.ts** - Persisted user preferences (localStorage: `gridfinity-settings-v1`)

**Pattern:** Use `useShallow` for multiple selections:
```typescript
const { drawer, bins } = useLayoutStore(useShallow((state) => ({
  drawer: state.layout.drawer,
  bins: state.layout.bins
})));
```

**Undo pattern:**
```typescript
const { execute } = useUndoableAction();
execute(() => addBin({ ... }));
```

### Core Data Model (`src/types.ts`)

```
Layout → Drawer, Categories[], Layers[], Bins[], printBedSize, gridUnitMm, heightUnitMm
Drawer → width, depth, height (grid units), fractionalEdgeX?, fractionalEdgeY?
Bin → position (x,y), size (w,d,h), layerId, category, label, notes, clearanceHeight?, customProperties?
Layer → id, name, height
Category → id, name, color

LayoutLibrary → activeLayoutId, settings, LayoutEntry[]
LayoutEntry → id, name, timestamps, preview, cloudShare?
```

**Critical Gotchas:**

1. **Coordinate System**: Grid origin (0,0) is **bottom-left**. `layers[0]` is bottom layer. UI displays layers reversed via `getDisplayLayers()` in `collision.ts`.

2. **Staging Area**: Bins with `layerId === STAGING_ID` (`'__staging__'`) are in stash (off-grid). Bins auto-move here when displaced by drawer resize or when duplication can't find space.

3. **Half-Bin Mode**: Supports 0.5 unit increments. Use helpers from `constants.ts`:
   - `snapToHalf(value)`, `snapToGrid(value, halfBinMode)`, `isFractional(value)`, `hasFractionalDimensions(rect)`
   - Validation in `halfBinConstraints.ts` prevents disabling mode when fractional bins exist.
   - `HALF_BIN_SCALE = 2` - Grid rendered at 2x for 0.5 support

4. **Multi-Layout Storage**: Each layout stored separately by UUID (`gridfinity-layout-{uuid}`). Library index (`gridfinity-library-v1`) tracks metadata without loading full data.

5. **Custom Properties**: Bins support arbitrary key-value metadata (max 50 properties, keys max 32 chars, values max 256 chars). Reserved keys (id, layerId, etc.) prohibited.

### Result Type System (`src/result/`)

Use `Result<T, E>` for operations that can fail (storage, API, validation):

```typescript
import { ok, err, isOk, isErr } from './result';
import type { Result, LayoutError } from './result';

function loadData(): Result<Layout, StorageError> {
  try {
    const data = localStorage.getItem('key');
    if (!data) return err(storageError('NOT_FOUND', 'Data not found'));
    return ok(JSON.parse(data));
  } catch {
    return err(storageError('PARSE_ERROR', 'Invalid JSON'));
  }
}

const result = loadData();
if (isOk(result)) {
  console.log(result.value); // Layout
} else {
  console.error(result.error); // StorageError
}
```

Error types: `LayoutError`, `ValidationError`, `StorageError`, `ApiError` with structured codes and user-friendly messages via `getUserMessage()`.

### Component Architecture

**Grid rendering:** CSS Grid-based (NOT HTML Canvas), despite `GridCanvas.tsx` naming. DOM overlay (`Overlay.tsx`) handles interactive bins with drag/resize handles.

**Responsive:** Three layout modes detected via `useResponsive.ts`:
- Mobile (<768px): `mobile/` components, lazy-loaded `MobileLayout.tsx`
- Tablet (768-900px): `tablet/` overlay panels
- Desktop (≥900px): Standard sidebar layout

**3D Preview:** `Grid/IsometricPreview/` - Three.js scene (lazy loaded). Camera controlled via `use3DPreviewKeyboard.ts` (keys 1-4 for presets, Space to expand).

### Storage Layer (`src/storage/`)

Service-layer architecture with dual-write backend (IndexedDB + localStorage):

**Key Functions:**
- Async (runtime): `saveLayoutAsync()`, `loadLayoutAsync()`, `deleteLayoutAsync()`
- Sync (init only): `saveLayoutSync()`, `loadLayoutSync()`, `deleteLayoutSync()`
- Result-based: `saveLayoutResult()`, `loadLayoutResult()`, `deleteLayoutResult()` - **Use these for explicit error handling**
- Library: `saveLibrary()`, `loadLibrary()`, `initializeLayoutLibrary()`
- Share: `exportLayoutJSON()`, `importLayoutJSON()`, `encodeLayoutForURL()`, `decodeLayoutResult()`
- Migration: `isMigrationNeeded()`, `migrateAllLayoutsToIndexedDB()`

Import from `src/storage` (public API facade).

### Interaction System (`useInteraction.ts`)

Five interaction modes (union type):
- **draw** - Drag-select to create bin
- **drag** - Move selected bins
- **resize** - Corner/edge handles
- **stagingDrag** - Drag from stash to grid
- **paint** - Fill mode: drag area to fill with uniform bins

### Key Utilities

**Validation & Collision:**
- `validation.ts` - `canPlaceBin()` checks bounds, height, collisions; `validateImport()` for imports
- `collision.ts` - Collision detection, blocked zones, layer Z calculations, `getDisplayLayers()`
- `halfBinConstraints.ts` - Validates half-bin mode toggle

**Bulk Operations:**
- `fill.ts` - `fillAllWithSize()`, `fillGaps()`
- `split.ts` - `splitBinSize()` recursively splits oversized bins, `generatePrintList()` creates manifest with filament estimates
- `printEstimates.ts` - Filament cost/spool calculations
- **Print Bed Constraints:** `calcMaxGridUnits(printBedSizeMm, gridUnitMm)` in `constants.ts` computes max bin dimensions for printer.

### API (Vercel Serverless)

**Backend** (`api/`):
- `share.ts` - POST: Create share (Vercel Blob)
- `share/[id].ts` - GET/PUT/DELETE share
- `report/[id].ts` - POST: Report content
- `lib/rateLimit.ts` - Redis rate limiting (10 shares/hour, 100 reads/hour)
- `lib/validation.ts` - 500KB max, 2500 bins max

**Client** (`src/api/share.ts`):
- `createShare()`, `updateShare()`, `fetchShare()`, `deleteShare()`, `reportShare()`
- Types: `ShareResponse`, `ShareErrorResponse`, `ShareResult<T>`

## Constants (`src/constants.ts`)

**Constraints:**
- Grid: 0.5-50 units (half-unit increments supported)
- Layers: 1-10, Categories: 1-20, Layouts: 100 max (warn at 80)
- Undo: 50 states, Zoom: 0.25-4.0
- Quick fill max: 2500 bins (confirm at 100+)
- Print gap: 10mm, Custom properties: max 50/bin

**Defaults:**
- Cell: 32px (`BASE_CELL_SIZE`), Drawer: 10×8×12 units
- Grid unit: 42mm, Height unit: 7mm, Print bed: 256mm

**Breakpoints:** TINY_PHONE: 375px, SM: 640px, MD: 768px (mobile/tablet), LG: 900px (tablet/desktop), XL: 1280px

## Testing

**Unit tests** (`src/test/`): Vitest + jsdom. Focus on utils/store/hooks. Use `createTestLayout()` factory. Run `npm run test:coverage` before commit.

**E2E tests** (`e2e/`): Playwright. Full user flows. Run `npm run test:e2e` (headless) or `npm run test:e2e:ui` (interactive).

## Build Config

**Vite** (`vite.config.ts`):
- Code splitting: `three` (lazy), `react-three`, `react-vendor`, `state` (Zustand + Immer)
- Bundle limits: Main 106 kB gzip, Total 690 kB gzip

**ESLint:** Strict TypeScript + React hooks rules. Relaxed for test files (allow `any`, non-null assertions).

## Environment Variables

Vercel backend (set in Vercel):
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob access
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` - Vercel KV (Redis)
- `TOKEN_SALT` - Delete token hashing
