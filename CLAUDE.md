# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Gridfinity Layout Tool: React + TypeScript web app for 3D-printed drawer organizer layouts. Multi-layer support, drag-and-drop, 3D preview (react-three-fiber), print optimization, cloud sharing, real-time collaboration, responsive design.

**Stack:** React 19, TypeScript 5.9, Vite 7, Zustand 5 + Immer, Tailwind CSS 4, Three.js, Vitest, Playwright, PWA, Vercel Blob + Redis, Liveblocks (real-time), PostHog analytics.

## Git Workflow

**Main branch is protected.** All changes via PRs - never commit directly to `main`.

Pre-commit hooks enforce lint, build, and test coverage. Run `npm run test:coverage` before committing.

**Coverage Thresholds:** Lines: 83%, Branches: 71%, Functions: 83%, Statements: 82%

Focus testing on `src/shared/utils/` (~90%), `src/core/store/` (~87%), `src/hooks/` (~73%).

## Code Style (Enforced)

**Required:**
- `import type` for type-only imports
- Explicit types (never `any`, use `unknown`)
- Prefix unused params with `_`
- Strict equality (`===` not `==`)
- `useShallow` when selecting multiple store values
- Use `@/` path alias for imports (e.g., `@/core/store`)

**Prohibited:** `any`, `console.log`, `var`, `==`, non-null assertions (`!`)

## Directory Structure

```
src/
├── core/                    # Infrastructure
│   ├── api/                 # API client (share service)
│   ├── constants.ts         # App-wide constants
│   ├── result/              # Result<T,E> type system
│   ├── storage/             # Storage layer (IndexedDB + localStorage)
│   ├── store/               # Zustand stores
│   └── types.ts             # Core data types
├── features/                # Feature modules (vertical slices)
│   ├── bin-inspector/       # Bin details panel
│   ├── categories/          # Category management
│   ├── cloud-share/         # Cloud sharing UI
│   ├── grid-editor/         # Main grid canvas & editing
│   │   ├── components/Grid/ # Grid rendering, overlay, 3D preview
│   │   ├── hooks/           # Grid-specific hooks
│   │   └── utils/           # collision.ts, fill.ts
│   ├── labs/                # Experimental feature flags
│   ├── layers/              # Layer management
│   ├── layout-library/      # Multi-layout management
│   ├── print-export/        # Print list & export
│   └── staging/             # Staging area (bin stash)
├── shared/                  # Cross-cutting concerns
│   ├── components/          # Reusable UI (Toast, ContextMenu, etc.)
│   ├── contexts/            # React contexts
│   ├── hooks/               # Shared hooks
│   └── utils/               # validation.ts, compression, color, etc.
├── components/              # App-level components
│   ├── Collab/              # Collaboration cursors/indicators
│   ├── Mobile/              # Mobile-specific components
│   ├── Modals/              # Modal dialogs
│   ├── Sidebar/             # Desktop sidebar panels
│   └── Tablet/              # Tablet-specific panels
├── hooks/                   # App-level hooks
│   └── interactions/        # Interaction state hooks
├── layouts/                 # Responsive layout shells
├── utils/                   # App-level utilities
├── liveblocks.config.ts     # Real-time collaboration config
└── App.tsx                  # Main app component
```

## Architecture

### State Management (Zustand + Immer)

Stores in `src/core/store/`:

| Store | Purpose |
|-------|---------|
| `layout.ts` | Layout data (bins, layers, categories, drawer). Returns `Result<T, LayoutError>` |
| `library.ts` | Multi-layout library. Tracks `activeLayoutId`, CRUD, thumbnails via `computePreview()` |
| `settings.ts` | Persisted user preferences (localStorage: `gridfinity-settings-v1`) |
| `history.ts` | Undo/redo (max 50). Wrap mutations with `useUndoableAction()` |
| `toast.ts` | Toast notifications (max 3) |
| `selection.ts` | Selected bin IDs, active layer/category |
| `view.ts` | Zoom, panels, context menu state |
| `interaction.ts` | Current interaction mode, drop targets, paint mode |
| `halfBinMode.ts` | Half-bin mode toggle state |
| `mobile.ts` | Mobile panel state, touch interactions |
| `sharedPreview.ts` | Shared layout preview state |

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

### Core Data Model (`src/core/types.ts`)

```
Layout → Drawer, Categories[], Layers[], Bins[], printBedSize, gridUnitMm, heightUnitMm
Drawer → width, depth, height (grid units), fractionalEdgeX?, fractionalEdgeY?
Bin → position (x,y), size (w,d,h), layerId, category, label, notes, clearanceHeight?, customProperties?
Layer → id, name, height
Category → id, name, color

LayoutLibrary → activeLayoutId, settings, LayoutEntry[]
LayoutEntry → id, name, timestamps, preview, cloudShare?
SharedWithMeEntry → sourceShareId, name, permission, status
```

**Critical Gotchas:**

1. **Coordinate System**: Grid origin (0,0) is **bottom-left**. `layers[0]` is bottom layer. UI displays layers reversed via `getDisplayLayers()`.

2. **Staging Area**: Bins with `layerId === STAGING_ID` (`'__staging__'`) are in stash (off-grid). Bins auto-move here when displaced by drawer resize or when duplication can't find space.

3. **Half-Bin Mode**: Supports 0.5 unit increments. Use helpers from `@/core/constants`:
   - `snapToHalf(value)`, `snapToGrid(value, halfBinMode)`, `isFractional(value)`, `hasFractionalDimensions(rect)`
   - Validation in `halfBinConstraints.ts` prevents disabling mode when fractional bins exist.
   - `HALF_BIN_SCALE = 2` - Grid rendered at 2x for 0.5 support

4. **Multi-Layout Storage**: Each layout stored separately by UUID (`gridfinity-layout-{uuid}`). Library index (`gridfinity-library-v1`) tracks metadata without loading full data.

5. **Custom Properties**: Bins support arbitrary key-value metadata (max 50 properties, keys max 32 chars, values max 256 chars). Reserved keys (id, layerId, etc.) prohibited.

### Result Type System (`src/core/result/`)

Use `Result<T, E>` for operations that can fail (storage, API, validation):

```typescript
import { ok, err, isOk, isErr } from '@/core/result';
import type { Result, StorageError } from '@/core/result';

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
- Mobile (<768px): `Mobile/` components, lazy-loaded `MobileLayout.tsx`
- Tablet (768-900px): `Tablet/` overlay panels
- Desktop (>=900px): Standard sidebar layout

**3D Preview:** `features/grid-editor/components/Grid/IsometricPreview/` - Three.js scene (lazy loaded). Camera controlled via `use3DPreviewKeyboard.ts` (keys 1-4 for presets, Space to expand).

### Storage Layer (`src/core/storage/`)

Service-layer architecture with dual-write backend (IndexedDB + localStorage):

**Atomic Operations (Preferred):**
- `saveLayoutWithMetadata()` - Atomic layout + library save
- `createLayoutEntry()` - Create new layout with entry
- `deleteLayoutWithEntry()` - Delete layout and entry atomically
- `switchActiveLayout()` - Switch and update library

**Legacy CRUD:**
- Async (runtime): `saveLayoutAsync()`, `loadLayoutAsync()`, `deleteLayoutAsync()`
- Sync (init only): `saveLayoutSync()`, `loadLayoutSync()`, `deleteLayoutSync()`
- Result-based: `saveLayoutResult()`, `loadLayoutResult()`, `deleteLayoutResult()`

**Other:**
- Library: `saveLibrary()`, `loadLibrary()`, `initializeLayoutLibrary()`
- Share: `exportLayoutJSON()`, `importLayoutJSON()`, `encodeLayoutForURL()`, `decodeLayoutResult()`
- SharedWithMe: `saveSharedWithMe()`, `loadSharedWithMe()` - Track layouts shared by others
- Migration: `isMigrationNeeded()`, `migrateAllLayoutsToIndexedDB()`

Import from `@/core/storage` (public API facade).

### Interaction System (`src/hooks/interactions/`)

Five interaction modes (union type):
- **draw** - Drag-select to create bin
- **drag** - Move selected bins
- **resize** - Corner/edge handles
- **stagingDrag** - Drag from stash to grid
- **paint** - Fill mode: drag area to fill with uniform bins

### Real-Time Collaboration (`src/liveblocks.config.ts`)

Experimental feature using Liveblocks. Enable via Labs settings.

**Presence data:**
- Cursor position (normalized 0-1 coords)
- User name and color
- Interaction hints (drawing, dragging, resizing)
- Selected bin IDs (for Figma-style selection rings)

**Storage sync:**
- Layout data synchronized in real-time
- Owner permissions (view/edit) enforced
- Schema versioning for migrations

**Key hooks:**
- `useCollabMode()` - Check/enable collab mode
- `useCollabSync()` - Sync local <-> Liveblocks state
- `useCollabPresence()` - Update presence data
- `useInterpolatedPresence()` - Smooth cursor animations

### Labs / Feature Flags (`src/features/labs/`)

Experimental features can be toggled in settings:

```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

const isEnabled = useFeatureFlag('collaborative_editing');
```

Current flags:
- `collaborative_editing` - Real-time collaboration (experimental)
- `layout_to_print` - STL export (coming soon)

### Key Utilities

**Validation & Collision (`src/shared/utils/`, `src/features/grid-editor/utils/`):**
- `validation.ts` - `canPlaceBin()` checks bounds, height, collisions; `validateImport()` for imports
- `collision.ts` - Collision detection, blocked zones, layer Z calculations, `getDisplayLayers()`
- `halfBinConstraints.ts` - Validates half-bin mode toggle

**Bulk Operations:**
- `fill.ts` - `fillAllWithSize()`, `fillGaps()`
- `split.ts` - `splitBinSize()` recursively splits oversized bins, `generatePrintList()` creates manifest with filament estimates
- `printEstimates.ts` - Filament cost/spool calculations
- **Print Bed Constraints:** `calcMaxGridUnits(printBedSizeMm, gridUnitMm)` computes max bin dimensions for printer.

**Other utilities:**
- `compression.ts` - LZ-string compression for URL sharing
- `guestNames.ts` - Random guest name generation for collab
- `throttle.ts` - Throttle/debounce for presence updates
- `stlSearch.ts` - Gridfinity STL file search helpers

### API (Vercel Serverless)

**Backend** (`api/`):
- `share.ts` - POST: Create share (Vercel Blob)
- `share/[id].ts` - GET/PUT/DELETE share
- `report/[id].ts` - POST: Report content
- `liveblocks-auth.ts` - Liveblocks authentication
- `lib/rateLimit.ts` - Redis rate limiting (10 shares/hour, 100 reads/hour)
- `lib/validation.ts` - 500KB max, 2500 bins max

**Client** (`src/core/api/share.ts`):
- `createShare()`, `updateShare()`, `fetchShare()`, `deleteShare()`, `reportShare()`
- Types: `ShareResponse`, `ShareErrorResponse`, `ShareResult<T>`

### ML Telemetry (`src/shared/analytics/`, `api/ml-telemetry.ts`)

Privacy-preserving telemetry for training bin size prediction models. No PII stored - only aggregate counts in Redis.

**Event Types:**
- `bin_placed` - Size, position, label hash, drawer context, placement method
- `layout_snapshot` - Triggered on save/export/share with size distributions
- `bin_resized`, `bin_deleted`, `bin_moved` - User corrections (negative signals)
- `placement_rejected`, `undo`, `quick_correction` - Strong negative signals

**Client** (`src/shared/analytics/useMLTracking.ts`):
```typescript
import { mlTracking } from '@/shared/analytics/useMLTracking';

mlTracking.trackPlacement(bin, 'draw');
mlTracking.trackDeletion(bin, 'key', batchSize);
mlTracking.recordCreation(binId, 'draw', '2x3x6'); // For quick-correction detection
```

Events are batched (20 events or 30s) and sent to `/api/ml-telemetry`. Redis keys prefixed with `ml:` for positive signals, `ml:neg:` for negative signals.

## Constants (`src/core/constants.ts`)

**Constraints:**
- Grid: 0.5-50 units (half-unit increments supported)
- Layers: 1-10, Categories: 1-20, Layouts: 100 max (warn at 80)
- Undo: 50 states, Zoom: 0.25-4.0
- Quick fill max: 2500 bins (confirm at 100+)
- Print gap: 10mm, Custom properties: max 50/bin

**Defaults:**
- Cell: 32px (`BASE_CELL_SIZE`), Drawer: 10x8x12 units
- Grid unit: 42mm, Height unit: 7mm, Print bed: 256mm

**Breakpoints:** TINY_PHONE: 375px, SM: 640px, MD: 768px (mobile/tablet), LG: 900px (tablet/desktop), XL: 1280px

**Keyboard Shortcuts:** See `SHORTCUTS` object - includes navigation (WASD/arrows), 3D preview (1-4, Space, V), undo/redo (Ctrl+Z/Y), duplicate (Ctrl+D), rotate (R), half-bin (H), layout manager (Ctrl+O).

## Testing

**Unit tests** (`src/test/`): Vitest + jsdom. Focus on utils/store/hooks. Use `createTestLayout()` factory from `testUtils.ts`. Run `npm run test:coverage` before commit.

**E2E tests** (`e2e/`): Playwright. Full user flows. Run `npm run test:e2e` (headless) or `npm run test:e2e:ui` (interactive).

**Test setup** (`src/test/setup.ts`):
- fake-indexeddb for storage tests
- Mocked pointer capture, matchMedia
- Auto-cleanup after each test

## Build Config

**Vite** (`vite.config.ts`):
- Code splitting: `three` (lazy), `react-three`, `react-vendor`, `state` (Zustand + Immer)
- Bundle limits: Main 126 kB gzip, Total 690 kB gzip
- Path alias: `@/` -> `src/`

**ESLint:** Strict TypeScript + React hooks rules. Relaxed for test files (allow `any`, non-null assertions).

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # TypeScript check + production build
npm run lint         # ESLint check
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:coverage # Run tests with coverage
npm run test:e2e     # Run Playwright E2E tests
npm run test:e2e:ui  # Run E2E with interactive UI
npm run size         # Check bundle sizes
```

## Environment Variables

Vercel backend (set in Vercel dashboard):
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob access
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` - Vercel KV (Redis)
- `TOKEN_SALT` - Delete token hashing

Optional (for Liveblocks):
- `VITE_LIVEBLOCKS_PUBLIC_KEY` - Client-side Liveblocks key
- `LIVEBLOCKS_SECRET_KEY` - Server-side auth (if using auth endpoint)

## Claude Code Hooks (`.claude/hooks/`)

Pre-configured hooks for quality checks:
- `pre-pr-review.sh` - Runs before PR creation (lint, build, test coverage)
- `post-edit-test.sh` - Runs affected tests after file edits
- `coverage-check.sh` - Validates coverage thresholds
- `a11y-check.sh` - Accessibility audit for component changes
