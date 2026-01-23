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
- **All 302 tests passing** across 20 test files (unit + component)
- **Responsive:** Basic responsive layout in `DesignerPage.tsx`

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

```
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

src/features/generation/            # CAD engine layer
  bridge/GenerationBridge.ts        # Main thread ↔ Worker
  worker/generation.worker.ts       # Web Worker entry
  worker/generators/binGenerator.ts # Orchestrates mesh generation
  worker/generators/baseGenerator.ts # Base profile geometry
  worker/generators/geometry.ts     # Primitives (box, cylinder, etc.)
  export/stlExporter.ts             # Binary STL output
```

---

## Implementation Phases

### Phase 2A: Save/Load & History (Foundation)

Prerequisite for all later features. Enables persistent designs and undo.

- [ ] **2A.1** Add IndexedDB storage for designs (`gridfinity-designer-v1`)
  - Create `src/features/bin-designer/storage/designerStorage.ts`
  - Store interface: `SavedDesign { id, name, params, thumbnail, createdAt, updatedAt }`
  - Use `idb` library (already in project) or raw IndexedDB
  - Operations: `saveDesign()`, `loadDesign()`, `listDesigns()`, `deleteDesign()`
  - Tests: Mock IndexedDB (fake-indexeddb already in test setup)

- [ ] **2A.2** Implement auto-save (debounced 1s after param change)
  - Create `src/features/bin-designer/hooks/useAutoSave.ts`
  - Debounce params changes, save to IndexedDB
  - Add save status indicator to UI (`saved` / `saving` / `error`)
  - First save creates new design, subsequent saves update

- [ ] **2A.3** Implement design list / management UI
  - Add "My Designs" panel or dialog accessible from header
  - List saved designs with thumbnails, names, dates
  - Load, rename, duplicate, delete operations
  - "New Design" creates fresh params with defaults

- [ ] **2A.4** Wire up undo/redo (store already has `history` field)
  - Store already has `DesignerHistory { past, future }` and `undo()`/`redo()`
  - Wire `pushHistory()` calls before each param change
  - Connect to Ctrl+Z / Ctrl+Shift+Z shortcuts (already registered)
  - Add undo/redo buttons to header bar
  - Max 50 history states (match Layout Planner)

- [ ] **2A.5** Generate thumbnails from 3D preview
  - Create `src/features/bin-designer/utils/thumbnailRenderer.ts`
  - Capture OffscreenCanvas render or use existing Three.js renderer
  - 128x128 PNG data URL for storage
  - Generate on save (debounced with auto-save)

### Phase 2B: Insert Templates (Electronics)

Add parametric insert cavities to bins for organizing small items.

- [ ] **2B.1** Define insert types and template data structure
  - Add to `types/index.ts`: `Insert`, `InsertTemplate`, `InsertShape`, `ConfigurableParam`
  - Add `inserts: Insert[]` field to `BinParams` (currently not present)
  - Migration: existing saved designs get `inserts: []` default

- [ ] **2B.2** Implement insert geometry generation
  - Add `src/features/generation/worker/generators/insertGenerator.ts`
  - Support cavity types: rectangle, circle, hexagon, rounded-rect
  - Integrate into `binGenerator.ts` pipeline (subtract from interior)
  - Each insert becomes a subtracted cavity in the bin floor

- [ ] **2B.3** Create electronics template definitions
  - Add `src/features/bin-designer/templates/electronics.ts`
  - Templates: AA, AAA, 9V, CR2032, SD Card, MicroSD, USB-A
  - Each has configurable params (count, orientation)
  - Dimensions from PRD appendix (with clearances)

- [ ] **2B.4** Build template browser UI
  - Add `src/features/bin-designer/components/TemplateLibrary.tsx`
  - Grid of template cards with icons/thumbnails
  - Category filter tabs
  - Click to select → show configurable params below
  - "Add to Bin" button

- [ ] **2B.5** Build insert placement UI (2D floor plan view)
  - Add `src/features/bin-designer/components/InsertEditor.tsx`
  - 2D top-down view of bin interior
  - Show placed inserts as shapes
  - Drag to reposition, handles to resize
  - Grid snapping (0.5mm increments)
  - Delete selected inserts

- [ ] **2B.6** Integrate inserts into 3D preview
  - Show insert cavities in the 3D mesh
  - Update generation to include insert subtraction
  - Real-time preview updates on insert changes

### Phase 2C: Design Presets

Quick-start configurations for common use cases.

- [ ] **2C.1** Define built-in presets
  - Add `src/features/bin-designer/constants/presets.ts`
  - Built-in: "Heavy Duty Base", "Quick Print", "Workshop Bin", "Vase Mode Light"
  - Each is a `Partial<BinParams>` with description

- [ ] **2C.2** Build preset selector UI
  - Dropdown or card selector in ParameterPanel header
  - Shows preset name, description, affected parameters
  - Applying preset merges with current params (non-destructive)

- [ ] **2C.3** User-created presets (save current as preset)
  - "Save as Preset" action in preset dropdown
  - Name + description input
  - Stored in IndexedDB alongside designs
  - List user presets in selector with edit/delete

### Phase 2D: Mobile & Tablet Polish

Make the designer fully usable on touch devices.

- [ ] **2D.1** Tablet layout (768-899px)
  - Preview takes top 50vh
  - Tabbed parameter panel below
  - Touch-friendly slider targets (min 44px)

- [ ] **2D.2** Mobile layout (<768px)
  - Stacked layout: preview 40vh, bottom tabs
  - Category tabs: Dims, Base, Features, Export
  - "Show Advanced" toggle for less-common options
  - Floating action button for export

- [ ] **2D.3** Touch interactions for 3D preview
  - Single-finger orbit, two-finger pan, pinch zoom
  - Verify these work with @react-three/drei OrbitControls
  - Add touch-specific help overlay on first visit

### Phase 3A: Sharing

Share designs via short codes (reuses existing backend).

- [ ] **3A.1** Create share payload type
  - Extend `api/share.ts` validation to accept `type: 'designer'`
  - `DesignerSharePayload { type: 'designer', version: 1, params: BinParams }`
  - Validate BinParams schema server-side

- [ ] **3A.2** Create client-side sharing hook
  - Add `src/features/bin-designer/hooks/useDesignerSharing.ts`
  - `createShareCode(params)` → 8-char code
  - `loadFromShareCode(code)` → BinParams
  - Error handling for expired/invalid codes

- [ ] **3A.3** Build share dialog UI
  - Share button in header bar
  - Shows generated URL + copy button
  - "Load from code" input field
  - Success/error states

- [ ] **3A.4** Handle `?share=` URL param
  - On page load, check for `share` query param
  - Load shared design params into store
  - Show toast: "Loaded shared design"
  - Clear URL param after loading

### Phase 3B: Batch Export

Queue multiple designs for single ZIP download.

- [ ] **3B.1** Add cart state to store
  - `cart: SavedDesign[]` already in types but not wired
  - Add cart actions: `addToCart()`, `removeFromCart()`, `clearCart()`
  - Cart persists in localStorage (lightweight metadata only)

- [ ] **3B.2** Build cart UI
  - Slide-out panel or dialog
  - Shows design thumbnails, names, estimates
  - Remove individual items
  - Total estimates (filament, time, cost)

- [ ] **3B.3** Implement ZIP generation
  - Add `src/features/generation/export/zipExporter.ts`
  - Use `fflate` or `jszip` library for ZIP creation
  - Generate STL for each design in sequence
  - Include `manifest.json` with design details
  - Progress indicator during generation

- [ ] **3B.4** Batch export flow
  - "Download ZIP" button in cart
  - Sequential STL generation with progress
  - ZIP file auto-downloads on completion
  - Option to clear cart after successful export

### Phase 3C: Layout Planner Integration

Connect Designer to the main Layout Planner workflow.

- [ ] **3C.1** Navigation between tools
  - "Create Custom Bin" button in Layout Planner sidebar
  - "Back to Planner" button in Designer header
  - Navigation preserves both tools' state
  - Optional: pass selected bin dimensions as starting point

- [ ] **3C.2** Custom bin library sync
  - When design is saved, create lightweight ref in Layout Planner storage
  - Ref: `{ id, name, width, depth, height, thumbnail, designerId }`
  - Layout Planner shows Designer bins in bin palette
  - Stored in `localStorage` as `gridfinity-custom-bin-{id}`

- [ ] **3C.3** Place designer bin in layout
  - "Use in Layout" button in Designer
  - Navigates to Planner with `?place={binId}` param
  - Planner enters draw mode with custom bin dimensions
  - Bin metadata links back to Designer design

### Phase 3D: Hardware & Tools Templates

Expand template library beyond electronics.

- [ ] **3D.1** Hardware templates
  - Add `src/features/bin-designer/templates/hardware.ts`
  - M2-M8 screw slots, hex nut pockets, washer stacks
  - Hex key holder (angled slots), bit holder

- [ ] **3D.2** Tools templates
  - Add `src/features/bin-designer/templates/tools.ts`
  - Screwdriver slot, pliers cradle, marker holder
  - Tape measure pocket, utility knife slot

- [ ] **3D.3** Template search & filter
  - Search input in template browser
  - Filter by category, sort by popularity (later)
  - Show result count

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

```
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
