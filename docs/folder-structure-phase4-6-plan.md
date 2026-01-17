# Folder Structure Redesign: Phases 4-6 Plan

**Status:** Deferred
**Created:** 2026-01-17
**Context:** Continuation of folder structure redesign (Phases 1-3 completed in PRs #189, #190, #191)

---

## Completed Phases

### Phase 1: core/ (PR #189) ✅
- `src/store/` → `src/core/store/`
- `src/types.ts` → `src/core/types/`
- `src/constants.ts` → `src/core/constants.ts`
- `src/result/` → `src/core/result/`
- `src/labs/` → `src/core/labs/`
- `src/api/` → `src/core/api/`
- `src/storage/` → `src/core/storage/`

### Phase 2: shared/ (PR #190) ✅
- Components: ContextMenu, Toast, ConfirmDialog, CollapsibleSection, StepperControl, DeferredNumberInput, Checkbox
- Hooks: useAutoSave, useResponsive, useCrossTabSync, usePWAUpdate, useKeyboard
- Contexts: MutationsContext, PresenceContext
- Utils: color, compression, uuid, throttle, idle

### Phase 3: layouts/ (PR #191) ✅
- `src/components/MobileLayout.tsx` → `src/layouts/MobileLayout.tsx`

---

## Remaining Phases

### Phase 4: features/grid-editor/

**Goal:** Create self-contained grid editing feature with its own components, hooks, and utils.

**Target Structure:**
```
src/features/grid-editor/
├── components/
│   └── Grid/           ← Move from src/components/Grid/
│       ├── index.tsx
│       ├── Bin.tsx
│       ├── GridCanvas.tsx
│       ├── GridToolbar.tsx
│       ├── GridAxisLabels.tsx
│       ├── Overlay.tsx
│       ├── ResizeHandle.tsx
│       ├── ResizeHandles.tsx
│       ├── DrawerResizeHandles.tsx
│       ├── IsometricPreview.tsx
│       ├── IsometricPreview/
│       └── QuickLabelPopover.tsx
├── hooks/
│   ├── index.ts
│   ├── useGridCoords.ts
│   ├── useGridZoom.ts
│   ├── useGridResize.ts
│   ├── useGridAxisLabels.ts
│   ├── useGridFirstUseHints.ts
│   ├── useGridNavigation.ts
│   ├── useGridRowColumnSelection.ts
│   ├── useGridTemplate.ts
│   └── useInteraction.ts
├── utils/
│   ├── index.ts
│   ├── collision.ts
│   ├── validation.ts
│   └── fill.ts
└── index.ts            ← Barrel export
```

**Files to Move:**
1. `src/components/Grid/` → `src/features/grid-editor/components/Grid/`
2. Grid hooks from `src/hooks/`:
   - useGridCoords.ts
   - useGridZoom.ts
   - useGridResize.ts
   - useGridAxisLabels.ts
   - useGridFirstUseHints.ts
   - useGridNavigation.ts
   - useGridRowColumnSelection.ts
   - useGridTemplate.ts
   - useInteraction.ts
3. Grid utils from `src/utils/`:
   - collision.ts
   - validation.ts
   - fill.ts

**Import Updates Required (~50+ files):**

The Grid components use relative imports like `../../core/store` which will break when moved deeper. Need to update:

1. **Internal imports** (within moved files):
   - `../../core/store` → `../../../core/store`
   - `../../core/types` → `../../../core/types`
   - `../../core/constants` → `../../../core/constants`
   - `../../shared/components` → `../../../shared/components`
   - `../../shared/hooks` → `../../../shared/hooks`
   - `../../shared/utils` → `../../../shared/utils`
   - `../../hooks/` → `../../../hooks/` (for non-grid hooks)
   - `../../utils/` → `../../../utils/` (for non-grid utils)

2. **External imports** (files that import from Grid):
   - `src/App.tsx` - imports Grid
   - `src/layouts/MobileLayout.tsx` - imports Grid
   - `src/components/Staging.tsx` - may import grid utils
   - `src/components/Sidebar/LayerPanel.tsx` - imports collision.ts
   - `src/components/Mobile/MobileLayersPanel/LayersTab.tsx` - imports collision.ts
   - `src/components/Modals/ImportModal.tsx` - imports validation.ts
   - `src/components/Modals/LayoutManagerModal/ImportView.tsx` - imports validation.ts
   - `src/core/storage/LayoutManager.ts` - imports validation.ts
   - `src/core/storage/LayoutService.ts` - imports validation.ts
   - `src/core/storage/ShareService.ts` - imports validation.ts
   - `src/core/store/layout.ts` - imports validation.ts, fill.ts, collision.ts
   - `src/core/store/view.ts` - imports validation.ts
   - `src/hooks/useBinInspector.ts` - imports validation.ts
   - `src/hooks/useKeyboardDrag.ts` - imports validation.ts
   - `src/hooks/useKeyboardResize.ts` - imports validation.ts
   - `src/hooks/useLayoutRouting.ts` - imports validation.ts
   - `src/shared/hooks/useCrossTabSync.ts` - imports validation.ts
   - `src/shared/hooks/useKeyboard.ts` - imports validation.ts, useGridNavigation
   - `src/utils/rotation.ts` - imports validation.ts
   - `src/utils/selection.ts` - imports validation.ts
   - Multiple test files

3. **Test file mocks** - Need to update vi.mock paths in:
   - `src/test/components/Bin.test.tsx`
   - `src/test/components/GridCanvas.test.tsx`
   - `src/test/hooks/useInteraction.test.ts`
   - `src/test/hooks/useGridCoords.test.ts`
   - `src/test/collision.test.ts`
   - `src/test/validation.test.ts`
   - `src/test/fill.test.ts`
   - And others...

**Backward Compatibility Strategy:**
Create re-export files at old locations:
```typescript
// src/components/Grid/index.ts (re-export)
export * from '../../features/grid-editor/components/Grid';

// src/hooks/useGridCoords.ts (re-export)
export * from '../features/grid-editor/hooks/useGridCoords';

// src/utils/collision.ts (re-export)
export * from '../features/grid-editor/utils/collision';
```

This allows gradual migration without breaking all imports at once.

---

### Phase 5: Remaining Features

**Goal:** Create feature directories for other major features.

**Features to Extract:**

1. **features/bin-inspector/** (Right panel bin editing)
   - `src/components/Inspector/` → `src/features/bin-inspector/components/`
   - `src/hooks/useBinInspector.ts` → `src/features/bin-inspector/hooks/`

2. **features/layers/** (Layer management)
   - `src/components/Sidebar/LayerPanel.tsx`
   - `src/components/Sidebar/ActiveLayerPanel.tsx`

3. **features/categories/** (Category management)
   - `src/components/Sidebar/CategoriesPanel.tsx`

4. **features/print-export/** (Print list & STL)
   - `src/components/Modals/PrintModal.tsx`
   - `src/components/Print/`
   - `src/components/Modals/BinListModal/`
   - `src/hooks/usePrintList.ts`
   - `src/utils/printEstimates.ts`
   - `src/utils/split.ts`

5. **features/cloud-share/** (Sharing & collaboration)
   - `src/components/Share/`
   - `src/components/Collab/`
   - `src/hooks/useCloudShare.ts`
   - `src/hooks/useCollabMode.ts`
   - `src/hooks/useOwnedShareSync.ts`
   - `src/hooks/useSharedWithMe.ts`

6. **features/3d-preview/** (Isometric view)
   - `src/components/Grid/IsometricPreview/`
   - `src/components/Grid/IsometricPreview.tsx`
   - `src/hooks/use3DPreviewKeyboard.ts`

7. **features/staging/** (Stash/staging area)
   - `src/components/Staging.tsx`

8. **features/labs/** (Feature flags UI)
   - `src/components/Labs/`

9. **features/layout-library/** (Multi-layout management)
   - `src/components/Modals/LayoutManagerModal/`
   - `src/hooks/useLayoutSwitcher.ts`

**Note:** Each feature extraction follows the same pattern as Phase 4.

---

### Phase 6: Cleanup

**Goal:** Remove backward compatibility re-exports and finalize structure.

**Tasks:**
1. Remove re-export files created for backward compatibility
2. Update all remaining imports to use feature paths directly
3. Delete empty directories
4. Update `src/hooks/index.ts` to only export non-feature hooks
5. Update `src/utils/index.ts` to only export shared utilities
6. Verify all tests pass
7. Verify build succeeds
8. Run e2e tests

---

## Recommended Approach

### Option A: Gradual Migration (Recommended)
1. Move files to feature directory
2. Create re-export at old location for backward compatibility
3. Update imports in batches (by directory)
4. Remove re-exports once all imports updated
5. One feature at a time, one PR per feature

**Pros:** Lower risk, easier to review, can pause anytime
**Cons:** More PRs, temporary re-export clutter

### Option B: Big Bang Migration
1. Move all files at once
2. Update all imports in single PR
3. No backward compatibility layer

**Pros:** Clean, single PR
**Cons:** High risk, large PR, harder to review, all-or-nothing

### Option C: Automated with Codemod
1. Use jscodeshift or ts-morph to automate import updates
2. Script the entire migration

**Pros:** Fast, consistent
**Cons:** Setup time, may miss edge cases

---

## Estimated Effort

| Phase | Files Moved | Import Updates | Test Updates | PRs |
|-------|-------------|----------------|--------------|-----|
| 4     | ~25         | ~50            | ~15          | 1-2 |
| 5     | ~40         | ~30            | ~20          | 4-5 |
| 6     | cleanup     | ~20            | ~10          | 1   |

**Total:** ~65 files moved, ~100 import updates, ~45 test updates, 6-8 PRs

---

## Prerequisites

Before starting:
1. Ensure main branch is stable
2. All tests passing
3. No pending PRs that touch affected files
4. Consider creating a tracking issue in GitHub

---

## Notes from Phase 4 Attempt

When Phase 4 was attempted, moving Grid components broke 100+ type errors due to:
1. Relative import paths changing depth (../../ → ../../../)
2. Grid components importing from core/, shared/, hooks/, utils/
3. Many external files importing Grid utils (validation.ts used by 15+ files)

The validation.ts utility is particularly problematic as it's used across:
- Core storage layer
- Core store layer
- Multiple hooks
- Multiple components
- Shared hooks

Consider whether validation.ts should stay in shared/utils/ rather than moving to features/grid-editor/utils/.
