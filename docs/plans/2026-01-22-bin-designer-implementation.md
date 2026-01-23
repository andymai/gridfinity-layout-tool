# Bin Designer — Implementation Plan

**Created:** 2026-01-22
**Status:** In Progress
**Reference Docs:** `docs/drawer-to-print/BIN-DESIGNER-{PRD,ARCHITECTURE,DRD,IMPLEMENTATION}.md`

---

## Context for New Sessions

### What's Already Done (Phase 1 Alpha — PRs #304-#310)

The Bin Designer alpha is fully functional with:

- **Route & feature flag:** `/designer` route, gated by `bin_designer` Labs toggle
- **Types & store:** `src/features/bin-designer/types/`, `store/designer.ts` (Zustand + Immer)
- **Generation engine:** `src/features/generation/` — custom procedural mesh geometry in a Web Worker (`GenerationBridge` + `generation.worker.ts`). Generates triangle meshes directly (NOT replicad/WASM).
- **3D preview:** Three.js canvas with orbit controls, wireframe toggle, camera presets (1-4 keys)
- **Parameter UI:** Full `ParameterPanel` with sections: Dimensions, Base, Style, Features (dividers/scoop/label), Walls
- **STL export:** Binary STL download with descriptive/compact naming, print estimates
- **Keyboard shortcuts:** `useDesignerKeyboard.ts` — view presets, wireframe, escape
- **439 bin-designer tests passing** across 35 test files
- **Responsive:** Full mobile/tablet/desktop layouts with tabbed UI, touch hints, and export FAB
- **Presets:** 5 built-in + user-created presets (save/delete, localStorage)

### Architecture Decisions

| Decision | Choice | Notes |
|----------|--------|-------|
| CAD engine | Custom triangle mesh | Fast, no WASM loading, works offline. STEP export deferred. |
| Preview | Three.js (BufferGeometry from Float32Arrays) | Reuses project's existing Three.js dep |
| State | Zustand store (`useDesignerStore`) | Matches Layout Planner patterns |
| Worker comms | `GenerationBridge` class (postMessage) | Cancellable via request ID tracking |
| Routing | `useDesignerRouting` hook (pushState) | No react-router, matches existing app |
| Feature flag | `bin_designer` in Labs | Manual opt-in, no percentage rollout |

### Key Files

```text
src/features/bin-designer/          # UI layer
  components/DesignerPage.tsx       # Main page, responsive layout
  components/ParameterPanel.tsx     # Left sidebar controls
  components/PreviewCanvas.tsx      # Three.js 3D preview
  components/ExportDialog.tsx       # STL export modal
  store/designer.ts                 # Zustand state
  types/index.ts                    # BinParams, GenerationResult, etc.
  hooks/useGeneration.ts            # Bridge integration hook
  hooks/useExport.ts                # Export flow orchestration
  hooks/useDesignerKeyboard.ts      # Keyboard shortcuts
  constants/gridfinity.ts           # Gridfinity spec dimensions
  utils/validation.ts               # Parameter validation
  utils/fileNaming.ts               # Export filename generation
  utils/printEstimates.ts           # Filament/time estimates

src/features/bin-designer/
  templates/electronics.ts          # 8 electronics insert templates
  templates/index.ts                # Template registry (ALL_TEMPLATES, getById, byCategory)
  components/parameters/InsertsSection.tsx    # Placed inserts list + controls
  components/parameters/TemplateBrowser.tsx   # Category-filtered template grid
  components/parameters/InsertFloorPlan.tsx   # 2D SVG drag-to-position editor
  components/parameters/PresetSelector.tsx    # Built-in + user presets with save/delete
  components/MobileParameterTabs.tsx          # Tabbed UI for mobile/tablet (4 tabs)
  constants/presets.ts              # 5 built-in DesignPresets
  storage/presetStorage.ts          # localStorage CRUD for user presets

src/features/generation/            # CAD engine layer
  bridge/GenerationBridge.ts        # Main thread ↔ Worker
  worker/generation.worker.ts       # Web Worker entry
  worker/generators/binGenerator.ts # Orchestrates mesh generation
  worker/generators/baseGenerator.ts # Base profile geometry
  worker/generators/insertGenerator.ts # Insert pocket wall geometry
  worker/generators/geometry.ts     # Primitives (box, cylinder, etc.)
  export/stlExporter.ts             # Binary STL output
```

---

## Implementation Phases

### Phase 2A: Save/Load & History (Foundation) ✅

Prerequisite for all later features. Enables persistent designs and undo.

- [x] **2A.1** Add IndexedDB storage for designs (`gridfinity-designer-v1`)
  - Create `src/features/bin-designer/storage/designerStorage.ts`
  - Store interface: `SavedDesign { id, name, params, thumbnail, createdAt, updatedAt }`
  - Use `idb` library (already in project) or raw IndexedDB
  - Operations: `saveDesign()`, `loadDesign()`, `listDesigns()`, `deleteDesign()`
  - Tests: Mock IndexedDB (fake-indexeddb already in test setup)

- [x] **2A.2** Implement auto-save (debounced 1s after param change)
  - Create `src/features/bin-designer/hooks/useAutoSave.ts`
  - Debounce params changes, save to IndexedDB
  - Add save status indicator to UI (`saved` / `saving` / `error`)
  - First save creates new design, subsequent saves update

- [x] **2A.3** Implement design list / management UI
  - Add "My Designs" panel or dialog accessible from header
  - List saved designs with thumbnails, names, dates
  - Load, rename, duplicate, delete operations
  - "New Design" creates fresh params with defaults

- [x] **2A.4** Wire up undo/redo (store already has `history` field)
  - Store already has `DesignerHistory { past, future }` and `undo()`/`redo()`
  - Wire `pushHistory()` calls before each param change
  - Connect to Ctrl+Z / Ctrl+Shift+Z shortcuts (already registered)
  - Add undo/redo buttons to header bar
  - Max 50 history states (match Layout Planner)

- [x] **2A.5** Generate thumbnails from 3D preview
  - Created `src/features/bin-designer/utils/thumbnail.ts`
  - Uses `preserveDrawingBuffer` on the existing Three.js canvas
  - 96x96 JPEG data URL (center-cropped, 0.7 quality) for compact storage
  - Captured on each auto-save via `captureThumbnail()` utility

### Phase 2B: Insert Templates (Electronics) ✅

Add parametric insert cavities to bins for organizing small items.

- [x] **2B.1** Define insert types and template data structure
  - Added `Insert`, `InsertTemplate`, `InsertShape`, `ConfigurableParam`, `TemplateCategory` to types
  - Added `inserts: Insert[]` to `BinParams` with `migrateParams()` for forward compatibility
  - Store actions: `addInsert`, `removeInsert`, `updateInsert`, `clearInserts` (all with undo)

- [x] **2B.2** Implement insert geometry generation
  - `src/features/generation/worker/generators/insertGenerator.ts`
  - Shapes: rectangle (4 box walls), circle (ring), hexagon (6-seg ring), rounded-rect (walls + quarter rings), slot
  - Additive geometry approach: pocket walls on bin floor, no CSG needed
  - POCKET_WALL_THICKNESS = 1.2mm, CIRCLE_SEGMENTS = 24
  - 12 tests covering all shapes, positioning, clamping, rotation

- [x] **2B.3** Create electronics template definitions
  - `src/features/bin-designer/templates/electronics.ts` (8 templates)
  - AA, AAA, 9V, CR2032, SD Card, MicroSD, USB-A, USB-C Cable Coil
  - 0.5mm clearance applied to component dimensions
  - Each has configurable params (depth, rotation, coil diameter)
  - 10 tests covering IDs, categories, shapes, dimensions, clearances

- [x] **2B.4** Build template browser UI
  - `InsertsSection` component in ParameterPanel with placed inserts list + remove/clear controls
  - `TemplateBrowser` component with category tabs (All/Electronics) and template card grid
  - Auto-positioning: places new inserts left-to-right with 2mm gap, wraps rows
  - 16 tests covering add/remove/filter/position/dimensions

- [x] **2B.5** Build insert placement UI (2D floor plan view)
  - `InsertFloorPlan` SVG component showing bin interior with draggable shapes
  - Shape rendering: rect, ellipse, polygon (hex), rounded rect with proper SVG elements
  - Click-to-select, drag-to-reposition with boundary clamping (0.1mm precision)
  - Coordinate system: Y-flipped (SVG Y-down → bin Y-up), auto-scaled to sidebar width
  - 11 tests covering shapes, selection, drag, multi-insert

- [x] **2B.6** Integrate inserts into 3D preview
  - Wired into `binGenerator.ts` step 3b: generates insert walls when `params.inserts.length > 0`
  - Full pipeline: store params → useGeneration → bridge → worker → mesh → Three.js renderer
  - Real-time preview: adding/moving inserts triggers automatic regeneration

### Phase 2C: Design Presets ✅

Quick-start configurations for common use cases.

- [x] **2C.1** Define built-in presets
  - `src/features/bin-designer/constants/presets.ts` - 5 presets: Heavy Duty, Quick Print, Workshop Bin, Vase Mode, Divider Grid
  - `DesignPreset` interface with id, name, description, icon, `Partial<BinParams>` overrides
  - `getPresetById()` utility, non-destructive merge via `Object.assign`

- [x] **2C.2** Build preset selector UI
  - `components/parameters/PresetSelector.tsx` - grid of preset buttons with SVG icons
  - Added as CollapsibleSection in ParameterPanel (defaultExpanded=false)
  - Shows preset name + tooltip description, applies via `setParams()`

- [x] **2C.3** User-created presets (save current as preset)
  - `storage/presetStorage.ts` - localStorage-based CRUD for user presets
  - Save form in PresetSelector with name/description inputs
  - User presets shown in "My Presets" section with delete buttons
  - MAX_USER_PRESETS = 20, saves style params only (not dimensions/inserts)

### Phase 2D: Mobile & Tablet Polish ✅

Make the designer fully usable on touch devices.

- [x] **2D.1** Tablet layout (768-899px)
  - Stacked: 3D preview top (50vh) + tabbed parameter panel below
  - `MobileParameterTabs.tsx` - 4 tabs: Shape, Base, Features, Presets
  - Touch-friendly tab targets (min-height 44px)

- [x] **2D.2** Mobile layout (<768px)
  - Stacked: 3D preview (40vh) + same tabbed panel below
  - Floating action button (FAB) for export with safe-area-inset-bottom
  - Header condensed: hidden labels on mobile, design name on sm+

- [x] **2D.3** Touch interactions for 3D preview
  - OrbitControls already handles: single-finger orbit, two-finger pan, pinch zoom
  - Added `TouchHint` component: dismissible help overlay on first visit
  - Stored in localStorage (`gridfinity-designer-touch-hint-dismissed`)

### Phase 3A: Sharing ✅

Share designs via short codes (reuses existing Vercel Blob backend with type discriminator).

- [x] **3A.1** Create share payload type + server validation
  - Created `api/lib/designerValidation.ts` - full BinParams validation (dimensions, styles, inserts, etc.)
  - Extended `api/share.ts` to branch on `type === 'designer'` with separate validation path
  - `DesignerSharePayload { type: 'designer', version: 1, params: BinParams }`
  - Share URLs use `/d/{id}` for designer (vs `/l/{id}` for layouts)

- [x] **3A.2** Create client-side sharing hook
  - Created `src/features/bin-designer/hooks/useDesignerSharing.ts`
  - `createDesignerShare(params)` → Result<DesignerShareResponse, DesignerShareError>
  - `fetchDesignerShare(id)` → Result<BinParams, DesignerShareError>
  - `useDesignerSharing()` hook with status/shareUrl/error state

- [x] **3A.3** Build share dialog UI + wire into page
  - Created `ShareDialog.tsx` with two sections: Create Share Link + Load Shared Design
  - Added Share button to DesignerPage header (next to Export)
  - Copy-to-clipboard with fallback, URL/ID extraction from load input
  - Error/loading/success states

- [x] **3A.4** Handle `?share=` URL param
  - On page load, checks for `share` query param in DesignerPage
  - Loads shared design params via `fetchDesignerShare` + `migrateParams`
  - Cleans URL immediately (replaces history state)
  - Extracted `migrateParams` to `constants/defaults.ts` for shared use

### Phase 3B: Batch Export ✅

Queue multiple designs for single ZIP download.

- [x] **3B.1** Add cart state to store
  - Created `src/features/bin-designer/store/cart.ts` - Zustand store with localStorage persistence
  - `CartItem` type with params snapshot, thumbnail, addedAt
  - `addToCart()`, `removeFromCart()`, `clearCart()` with duplicate prevention
  - MAX_CART_ITEMS = 50

- [x] **3B.2** Build cart UI
  - Created `CartDialog.tsx` - modal with scrollable item list
  - Shows thumbnails, names, dimensions, style, filament estimates per item
  - Remove individual items (group-hover X button), clear cart button
  - Footer with total estimates (filament, time, cost)

- [x] **3B.3** Implement ZIP generation
  - Created `src/features/bin-designer/utils/batchExport.ts`
  - Uses `fflate` (zipSync) for synchronous ZIP creation
  - Sequential GenerationBridge.generateImmediate() per item (no debounce)
  - Includes `manifest.json` with file details and aggregate estimates
  - AbortSignal support for cancellation

- [x] **3B.4** Batch export flow
  - "Download ZIP" button in cart dialog
  - Progress bar with item name and count during generation
  - Cancel button shown during export
  - "Add to Cart" button in DesignerPage header
  - Cart badge shows item count (hidden when empty)
  - Skips failed items with error summary

### Phase 3C: Layout Planner Integration ✅

Connect Designer to the main Layout Planner workflow.

- [x] **3C.1** Navigation between tools
  - "Bin Designer" button in Layout Planner sidebar (desktop) and MobileLayoutsPanel (mobile)
  - Button gated behind `bin_designer` feature flag
  - Fixed `useDesignerRouting` to dispatch `PopStateEvent` after `pushState` — ensures all hook instances sync
  - "Back to Planner" button in Designer header (already existed)
  - Tests: 8 tests in `useDesignerRouting.test.ts`

- [x] **3C.2** Custom bin library sync
  - `store/customBinRegistry.ts` — localStorage registry at key `gridfinity-custom-bins-v1`
  - `CustomBinRef: { id, name, width, depth, height, thumbnail, updatedAt }`
  - `upsertRegistryEntry()` called on every auto-save success
  - `removeRegistryEntry()` called on design deletion
  - `useCustomBins()` hook for planner to read available designs
  - Tests: 14 registry tests + 4 hook tests

- [x] **3C.3** Place designer bin in layout
  - "Use in Layout" button in Designer header
  - `navigateToPlaceInLayout(w, d, h, name)` — sets `?placeBin=WxDxH&binName=...` URL params
  - `usePlaceBinFromURL()` hook in App.tsx — reads params, creates bin at (0,0) on active layer
  - Fallback: if grid placement fails (collision/size), adds to staging area instead
  - Cleans URL params after processing, shows toast with placement result
  - Tests: 13 tests (4 navigation + 9 placement)

### Phase 3D: Hardware & Tools Templates ✅

Expand template library beyond electronics.

- [x] **3D.1** Hardware templates (18 templates)
  - `src/features/bin-designer/templates/hardware.ts`
  - M3-M8 socket head cap screws (circle shape, ISO 4762 head diameters)
  - M3-M8 hex nut pockets (hexagon shape, ISO 4032 across-flats)
  - M4-M6 washer stacks (circle shape, ISO 7089 outer diameter)
  - Hex key holders: 2.5mm, 4mm, 6mm (hexagon shape, upright)
  - ¼" driver bit holders: standard 25mm + long 50mm (hexagon shape)
  - 0.5mm clearance for snug FDM fit

- [x] **3D.2** Tools templates (13 templates)
  - `src/features/bin-designer/templates/tools.ts`
  - Screwdrivers: small (6mm), medium (8mm) upright + lying flat (slot shape)
  - Pliers: needle-nose (25mm) + standard (35mm) in rounded-rect
  - Markers: fine (10mm), Sharpie (12mm), thick (18mm) upright circles
  - Tape measures: compact 3m (65mm) + standard 5m (80mm) in rounded-rect
  - Utility knives: standard (18×150mm) + compact (12×100mm)
  - Scissors: standard (25×180mm)
  - 1.0mm clearance for easy tool extraction

- [x] **3D.3** Template search & filter
  - Search input with magnifying glass icon in TemplateBrowser
  - `searchTemplates(query)` searches name, description, and label (case-insensitive)
  - Search combines with category filter (AND logic)
  - Result count shown when filtering ("X of Y templates")
  - Empty state shows descriptive "No templates matching" message
  - Tests: 64 template data tests + 20 TemplateBrowser UI tests

  Total templates: 8 electronics + 18 hardware + 13 tools = 39 templates
  Total tests: 4843 across 196 test files

### Phase 4: Polish & Enhancement

Ongoing improvements after public launch.

- [ ] **4.1** 3MF export (mesh + metadata in ZIP format)
  - Embed mesh as 3D model XML
  - Include thumbnail PNG
  - Add suggested print settings as metadata comments
  - No replicad needed — can use mesh data directly

- [ ] **4.2** Browser history integration
  - Each saved design gets a history entry
  - Back/forward navigates between designs
  - URL updates to `/designer?id={designId}`

- [ ] **4.3** WASM engine upgrade (replicad) — DEFERRED
  - Replace custom geometry with replicad for precision
  - Enables STEP export, proper fillets, text embossing
  - ~3MB WASM lazy load with progress UI
  - Significant rework — defer until validated need

- [ ] **4.4** Accessibility improvements
  - Screen reader text alternative for 3D preview
  - ARIA live regions for generation status
  - Focus management in dialogs
  - High contrast mode for preview

- [ ] **4.5** Advanced insert editor
  - Multi-select (Shift+click, drag box)
  - Copy/paste inserts (Ctrl+C/V)
  - Rotation (15-degree increments)
  - Smart snapping (to other inserts, center lines)

- [ ] **4.6** Community features
  - User-submitted templates (via share backend)
  - Browse community templates
  - Attribution / fork tracking

---

## Task Dependencies

```text
Phase 2A (Foundation) ─────────────────────────────┐
  ├── 2A.1 Storage ──→ 2A.2 Auto-save ──→ 2A.5 Thumbnails
  │                        └──→ 2A.3 Design list
  └── 2A.4 Undo/Redo (independent)
                                                    │
Phase 2B (Inserts) ─── requires 2A.1 ──────────────┤
  ├── 2B.1 Types ──→ 2B.2 Geometry ──→ 2B.6 Preview
  │              └──→ 2B.3 Templates ──→ 2B.4 Browser
  └── 2B.5 Editor (requires 2B.1 + 2B.2)
                                                    │
Phase 2C (Presets) ─── requires 2A.1 ──────────────┤
Phase 2D (Mobile) ─── independent ─────────────────┤
                                                    │
Phase 3A (Sharing) ─── independent ─────────────────┤
Phase 3B (Batch) ─── requires 2A.1 + 2A.5 ─────────┤
Phase 3C (Integration) ─── requires 2A.1 ───────────┤
Phase 3D (More Templates) ─── requires 2B.* ────────┘
```

## Testing Expectations

- Each task should include unit tests for new logic
- Component tests for new UI (render, interactions)
- Coverage thresholds: Lines 83%, Branches 71%, Functions 83%
- Run `npm run test:coverage` before committing
- Run `npm run build` to verify no type errors

## How to Resume in a New Session

1. Read this plan: `docs/plans/2026-01-22-bin-designer-implementation.md`
2. Check which boxes are checked (completed tasks)
3. Read the "Key Files" section for orientation
4. The relevant feature dirs: `src/features/bin-designer/` and `src/features/generation/`
5. Run tests: `npx vitest run src/features/bin-designer src/features/generation`
6. Pick the next unchecked task and implement it

## Commit Convention

All bin-designer commits should follow: `feat(bin-designer): <description>` or `fix(bin-designer): <description>`
