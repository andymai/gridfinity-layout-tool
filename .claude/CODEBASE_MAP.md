# Gridfinity Layout Tool - Codebase Map

> Quick reference for AI assistants. Use this instead of grepping the entire codebase.

**Stack:** React 19, TypeScript 5.9, Vite 7, Zustand 5 + Immer, Tailwind CSS 4, Three.js, Vitest, Playwright

---

## Directory Structure

```
src/
├── core/                    # Infrastructure layer
│   ├── api/                 # Vercel serverless client (share.ts)
│   ├── constants.ts         # App constraints, defaults, helpers
│   ├── result/              # Result<T,E> type system for error handling
│   ├── storage/             # Dual-write backend (IndexedDB + localStorage)
│   ├── store/               # Zustand stores (14 stores)
│   └── types.ts             # Core data model (Layout, Bin, Drawer, etc.)
│
├── features/                # Vertical feature slices (self-contained)
│   ├── bin-inspector/       # Bin details panel
│   ├── categories/          # Category management
│   ├── cloud-share/         # URL-based cloud sharing
│   ├── grid-editor/         # Main grid canvas + 3D preview
│   ├── inspiration-gallery/ # Template gallery
│   ├── labs/                # Feature flags UI
│   ├── layers/              # Layer management
│   ├── layout-library/      # Multi-layout management
│   ├── print-export/        # Print list & STL export
│   └── staging/             # Bin stash (off-grid)
│
├── shared/                  # Cross-cutting concerns
│   ├── analytics/           # ML telemetry (privacy-preserving)
│   ├── components/          # Reusable UI primitives
│   ├── contexts/            # React contexts
│   ├── hooks/               # Shared hooks
│   └── utils/               # Pure utility functions
│
├── components/              # App-level components
│   ├── BinList/             # Bin statistics UI
│   ├── Collab/              # Real-time collaboration UI
│   ├── Mobile/              # Mobile-specific (17 components)
│   ├── Modals/              # Modal dialogs
│   ├── Sidebar/             # Desktop sidebar panels
│   └── Tablet/              # Tablet overlay panels
│
├── hooks/                   # App-level hooks
│   └── interactions/        # Draw/drag/resize/paint modes
│
├── layouts/                 # Responsive layout shells
├── utils/                   # App-level utilities
└── App.tsx                  # Root component
```

---

## Core Data Model (`src/core/types.ts`)

```typescript
Layout → { drawer, categories[], layers[], bins[], printBedSize, gridUnitMm, heightUnitMm }
Drawer → { width, depth, height } // in grid units (1-50)
Bin    → { id, x, y, width, depth, height, layerId, category, label?, notes?, customProperties? }
Layer  → { id, name, height }
Category → { id, name, color }
```

**Critical:** Grid origin (0,0) is **bottom-left**. `layers[0]` is bottom layer. UI displays reversed.

---

## Zustand Stores (`src/core/store/`)

| Store | File | Purpose |
|-------|------|---------|
| **layout** | `layout.ts` | Layout data (bins, layers, categories, drawer). Returns `Result<T, LayoutError>` |
| **library** | `library.ts` | Multi-layout management, active layout, CRUD |
| **settings** | `settings.ts` | User preferences (localStorage: `gridfinity-settings-v1`) |
| **history** | `history.ts` | Undo/redo (max 50). Use `useUndoableAction()` hook |
| **selection** | `selection.ts` | Selected bin IDs, active layer/category |
| **view** | `view.ts` | Zoom, panel visibility, context menu |
| **interaction** | `interaction.ts` | Current mode (draw/drag/resize/paint), drop targets |
| **toast** | `toast.ts` | Toast notifications (max 3) |
| **halfBinMode** | `halfBinMode.ts` | Half-bin mode toggle (0.5 unit increments) |
| **mobile** | `mobile.ts` | Mobile panel state |
| **sharedPreview** | `sharedPreview.ts` | Shared layout preview |
| **labs** | `labs.ts` | Feature flags |

**Pattern:** Use `useShallow` for multiple selections:
```typescript
const { drawer, bins } = useLayoutStore(useShallow(s => ({ drawer: s.layout.drawer, bins: s.layout.bins })));
```

---

## Key Hooks

### App-Level (`src/hooks/`)

| Hook | Purpose |
|------|---------|
| `useKeyboard` | Global keyboard shortcuts (WASD, Ctrl+Z, etc.) |
| `useLayoutSwitcher` | Switch between layouts |
| `useDrawerSettings` | Drawer dimension editing |
| `useFeatureFlag` | Check Labs feature flags |
| `useCollabMode` | Check if in collaborative editing mode |
| `useCollabSync` | Sync with Liveblocks real-time |
| `use3DPreviewKeyboard` | 3D preview camera controls (1-4, Space, V) |

### Interaction Hooks (`src/hooks/interactions/`)

| Hook | Purpose |
|------|---------|
| `useDrawInteraction` | Drag-select to create bins |
| `useDragInteraction` | Move selected bins |
| `useResizeInteraction` | Resize via corner/edge handles |
| `useStagingDragInteraction` | Drag from staging to grid |

### Grid Editor (`src/features/grid-editor/hooks/`)

| Hook | Purpose |
|------|---------|
| `useGridCoords` | Screen → grid coordinate conversion |
| `useGridZoom` | Zoom state & scroll handling |
| `useGridResize` | Drawer resize logic |
| `useInteraction` | Unified interaction dispatcher |
| `useGridNavigation` | Keyboard navigation (WASD/arrows) |

### Shared (`src/shared/hooks/`)

| Hook | Purpose |
|------|---------|
| `useResponsive` | Detect mobile/tablet/desktop |
| `useAutoSave` | Debounced storage persist |
| `useCrossTabSync` | Sync across browser tabs |

---

## Components Quick Reference

### Shared UI (`src/shared/components/`)

All have barrel exports: `Checkbox`, `CollapsibleSection`, `ConfirmDialog`, `ContextMenu*`, `DeferredNumberInput`, `StepperControl`, `ToastContainer`, `SectionHeader`, `SettingsRow`, `SelectDropdown`, `BulkIncrementControl`

### Grid Editor (`src/features/grid-editor/components/Grid/`)

| Component | Purpose |
|-----------|---------|
| `Grid/index.tsx` | Main grid container (orchestrates everything) |
| `GridCanvas.tsx` | CSS Grid canvas (NOT HTML Canvas) |
| `Overlay.tsx` | Interactive bin layer with handles |
| `Bin.tsx` | Individual bin DOM element |
| `ResizeHandles.tsx` | Resize handle collection |
| `GridToolbar.tsx` | Quick actions toolbar |
| `IsometricPreview/` | **3D Preview** (Three.js, lazy-loaded) |

### Bin Inspector (`src/features/bin-inspector/components/Inspector/`)

`SingleBinInspector`, `MultiBinInspector`, `CustomPropertiesEditor`, `SplitWarning`, `EmptyState`

### Layout Library (`src/features/layout-library/components/LayoutManagerModal/`)

`LayoutManagerModal`, `LayoutList`, `LayoutListItem`, `SharedWithMeList`, `ImportView`

### Mobile (`src/components/Mobile/`)

`MobileHeader`, `BottomNavBar`, `BottomSheet`, `MobileLayersPanel`, `MobileInspector`, `MobileSettingsPanel`, `MobileLayoutsPanel`, `MobileGridToolbar`

### Modals (`src/components/Modals/`)

`BinListModal`, `SettingsModal`, `HelpModal`, `ImportModal`, `HalfBinModeBlockedModal`

---

## Storage Layer (`src/core/storage/`)

### Atomic Operations (Preferred)

```typescript
import { saveLayoutWithMetadata, createLayoutEntry, deleteLayoutWithEntry, switchActiveLayout } from '@/core/storage';
```

### Legacy CRUD

```typescript
// Async (runtime)
saveLayoutAsync(), loadLayoutAsync(), deleteLayoutAsync()

// Result-based
saveLayoutResult(), loadLayoutResult()

// Sync (init only)
saveLayoutSync(), loadLayoutSync()
```

### Import/Export

```typescript
exportLayoutJSON(), importLayoutJSON(), encodeLayoutForURL(), decodeLayoutFromURL()
```

### Storage Keys

- Layout: `gridfinity-layout-{uuid}`
- Library: `gridfinity-library-v1`
- Settings: `gridfinity-settings-v1`

---

## Result Type System (`src/core/result/`)

```typescript
import { ok, err, isOk, isErr, getUserMessage } from '@/core/result';
import type { Result, StorageError, ValidationError, LayoutError, ApiError } from '@/core/result';

// Pattern
const result = loadLayoutResult(id);
if (isOk(result)) {
  console.log(result.value); // Layout
} else {
  console.error(getUserMessage(result.error)); // User-friendly message
}
```

---

## Key Utilities

### Shared (`src/shared/utils/`)

| File | Exports |
|------|---------|
| `validation.ts` | `canPlaceBin()`, `isValidDrawer()`, `validateImport()` |
| `compression.ts` | `compressLayout()`, `decompressLayout()` |
| `color.ts` | `getContrastColor()`, `getBinTextColors()` |
| `uuid.ts` | `generateUUID()`, `generateLayoutId()` |
| `bins.ts` | `getVisibleBins()`, `getGridBins()`, `getStagingBins()` |

### Grid Editor (`src/features/grid-editor/utils/`)

| File | Exports |
|------|---------|
| `collision.ts` | Collision detection, `getDisplayLayers()` |
| `fill.ts` | `fillAllWithSize()`, `fillGaps()` |

### App-Level (`src/utils/`)

| File | Exports |
|------|---------|
| `split.ts` | `splitBinSize()`, `generatePrintList()` |
| `halfBinConstraints.ts` | Validate half-bin mode toggle |
| `stlSearch.ts` | Gridfinity STL file search helpers |

---

## Constants (`src/core/constants.ts`)

### Constraints

| Constraint | Value |
|------------|-------|
| Grid units | 0.5-50 |
| Layers | 1-10 |
| Categories | 1-20 |
| Layouts | 100 max |
| Undo states | 50 |
| Zoom | 0.25-4.0 |
| Custom properties | 50/bin max |

### Special Values

- `STAGING_ID = '__staging__'` - Bins in staging area
- `HALF_BIN_SCALE = 2` - Grid scale for 0.5 support
- `BASE_CELL_SIZE = 32` - Default cell size in pixels

### Helpers

- `snapToHalf(value)` - Snap to 0.5 increments
- `snapToGrid(value, halfBinMode)` - Snap to grid
- `calcMaxGridUnits(printBedSizeMm, gridUnitMm)` - Max bin dimensions for printer

---

## API Endpoints (`api/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/share` | POST | Create share (Vercel Blob) |
| `/api/share/[id]` | GET/PUT/DELETE | CRUD share |
| `/api/report/[id]` | POST | Report content |
| `/api/liveblocks-auth` | POST | Liveblocks auth |
| `/api/ml-telemetry` | POST | ML telemetry aggregation |

Rate limits: 10 shares/hour, 100 reads/hour (Redis)

---

## Feature Flags (`src/features/labs/`)

```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
const isEnabled = useFeatureFlag('collaborative_editing');
```

Current flags:
- `collaborative_editing` - Real-time collaboration (experimental)
- `layout_to_print` - STL export (coming soon)

---

## Import Patterns

```typescript
// Core
import { useLayoutStore, useSelectionStore, useHistoryStore } from '@/core/store';
import type { Layout, Bin, Drawer } from '@/core/types';
import { CONSTRAINTS, STAGING_ID, snapToGrid } from '@/core/constants';
import { ok, err, isOk, getUserMessage } from '@/core/result';
import { saveLayoutWithMetadata, loadLayoutResult } from '@/core/storage';

// Shared
import { getContrastColor, compressLayout, generateUUID } from '@/shared/utils';
import { useResponsive } from '@/shared/hooks';
import { ToastContainer, Checkbox, ConfirmDialog } from '@/shared/components';

// Features
import { Grid } from '@/features/grid-editor';
import { LayoutManagerModal } from '@/features/layout-library';
import { SingleBinInspector } from '@/features/bin-inspector';

// App-level
import { useKeyboard, useLayoutSwitcher } from '@/hooks';
```

---

## Responsive Breakpoints

| Mode | Width | Components |
|------|-------|------------|
| Mobile | <768px | `src/components/Mobile/*`, `MobileLayout.tsx` |
| Tablet | 768-900px | `src/components/Tablet/*` overlay panels |
| Desktop | ≥900px | Standard sidebar layout |

Hook: `const { isMobile, isTablet, isDesktop } = useResponsive();`

---

## Testing

- **Unit:** Vitest + jsdom, focus on `src/shared/utils/`, `src/core/store/`, `src/hooks/`
- **E2E:** Playwright in `e2e/`
- **Coverage:** Lines 83%, Branches 71%, Functions 83%, Statements 82%
- **Test utils:** `src/test/testUtils.ts` → `createTestLayout()` factory

```bash
npm run test:coverage  # Before commit
npm run test:e2e       # Playwright headless
```

---

## Common Tasks Quick Reference

### Add a new bin programmatically
```typescript
const { addBin } = useLayoutStore.getState();
const { execute } = useUndoableAction();
execute(() => addBin({ x: 0, y: 0, width: 2, height: 2, depth: 6, layerId, category }));
```

### Switch layouts
```typescript
const { switchLayout } = useLayoutSwitcher();
await switchLayout(layoutId);
```

### Check collision
```typescript
import { canPlaceBin } from '@/shared/utils/validation';
const isValid = canPlaceBin(newBin, existingBins, drawer);
```

### Get visible bins (current layer)
```typescript
import { getVisibleBins } from '@/shared/utils/bins';
const visibleBins = getVisibleBins(bins, activeLayerId);
```

### Show toast
```typescript
const { addToast } = useToastStore.getState();
addToast({ message: 'Saved!', type: 'success' });
```

---

## Analytics & Scripts

### PostHog Integration

See **`.claude/POSTHOG_API_GUIDE.md`** for comprehensive PostHog API documentation including:
- Authentication setup
- HogQL query examples
- Dashboard/insight creation
- Preset queries for common analyses

### Useful Scripts

| Script | Purpose |
|--------|---------|
| `scripts/posthog-query.ts` | Query PostHog data, list dashboards/insights |
| `scripts/setup-posthog-dashboards.ts` | Create standard dashboards (run once) |
| `scripts/audit-ml-telemetry.sh` | Audit ML telemetry data in Redis |

```bash
# Query PostHog (requires POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID)
npx tsx scripts/posthog-query.ts --preset errors
npx tsx scripts/posthog-query.ts --dashboards
npx tsx scripts/posthog-query.ts "SELECT event, count() FROM events GROUP BY event"
```

### Feature Tracking

Track feature adoption with `markFeatureUsed()`:
```typescript
import { markFeatureUsed } from '@/utils/analytics';

// Called automatically at feature trigger points:
// - 'half_bins', 'multi_layer', 'fill', '3d_preview', 'cloud_share', 'custom_categories', 'labels'
markFeatureUsed('feature_name');
```

Error tracking via `captureException()` in error boundaries.
