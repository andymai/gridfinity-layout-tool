# Bin Designer

Parametric 3D Gridfinity bin generator with brepjs geometry engine.

```mermaid
graph TB
    subgraph UI
        DP[DesignerPage] --> PP[ParameterPanel] & PC[PreviewCanvas]
    end
    subgraph State
        DS[(designer store)] --> MCM[meshCacheManager]
        CBR[(customBinRegistry)]
    end
    subgraph Generation
        UG[useGeneration] --> GB[GenerationBridge] --> Worker
        Worker -->|MeshData| PC
    end
    subgraph Persistence
        UAS[useAutoSave] --> IDB[(IndexedDB)]
        CBR --> LS[(localStorage)]
    end
    PP --> DS
    PC --> UG
```

## Key Files

- `components/DesignerPage.tsx` — main UI entry point
- `components/ParameterPanel.tsx` — parameter editing sidebar with collapsible sections
- `components/PreviewCanvas.tsx` — 3D preview with Three.js (renders bin + optional lid + explode slider)
- `components/CutoutWorkspace` — dedicated 3D editor for floor/wall cutouts
- `components/panel/ShapeSection/` — "Custom shape" toggle + paint-style half-bin grid editor
  (L/T/U presets, reset-to-rectangle link, O-shape-capable cellMask painting)
- `components/panel/LidSection/` — click-lock lid toggle, fit pills, magnet/grid toggles, thickness sliders
- `components/panel/ColorsSection/` — multi-color zone editor: per-zone rows, picker, palette CRUD, eyedropper + swap entry points
- `components/PreviewCanvas/ColorToolOverlay.tsx` — banner + click-anchored ColorPicker for the eyedropper tool, ESC-to-exit
- `utils/zoneResolver.ts` — pure raycast triangle → ColorZone mapping (reused across hit-test, preview, and 3MF export gating)
- `utils/zoneLabels.ts` — ColorZone → i18n key + flat `updateFeatureColors` patch helpers
- `hooks/useSwapZoneWithToast.ts` — wraps `pickSwapZone` with a localized success toast
- `components/preview/LidMesh/` — renders the lid mesh in the preview, with explode-aware
  positioning, opacity interpolation, and mutual hover highlight pairing with `BinMesh`
- `components/preview/LidGuideLine/` — visual cue connecting bin and lid in exploded views
- `components/preview/LidExplodeSlider/` — slider that lifts the lid off the bin (replaces view-mode pills)
- `store/designer.ts` — design state and parameter mutations (composed from slices)
- `store/customBinRegistry.ts` — syncs saved designs to layout planner palette
- `store/cutoutSelection.ts` — cutout editor selection state
- `hooks/useGeneration.ts` — triggers geometry regeneration via bridge (bin + optional companion lid)
- `storage/DesignerStorage.ts` — IndexedDB persistence for saved designs
- `constants/` — Gridfinity geometry constants, default params, designer constraints
- `types/` — TypeScript types for designer state, cutouts, compartments, lid config
- `utils/` — validation, print estimates, file naming, design JSON serialization

## Critical Concepts

- **Epoch pattern**: `store.setParam()` increments epoch → triggers regeneration. Cosmetic cutout mutations (lock/hide/z-reorder/showAllCutouts) call `pushHistoryEntry(state, { affectsGeometry: false })` so undo still works but the worker doesn't re-run — only properties the worker reads (everything except `locked`/`hidden`/`zIndex`) bump the epoch
- **Mesh cache**: 100MB budget, attached to history for instant undo
- **Custom bin registry**: Syncs to localStorage for Layout Planner palette
- **Ghost overlays**: Lightweight Three.js primitives render during `generationStatus === 'generating'` for instant visual feedback before BREP mesh completes. Components: `GhostDividers`, `GhostWireframe`, `GhostCompartmentPreview`, `GhostLabelTabs`, `GhostScoops`, `GhostCutouts`, `GhostWallCutouts`, `GhostSlotLines`, `GhostDividerPieces`
- **cellMask**: Non-rectangular footprint carried in `params.cellMask`. Always
  stored at **half-bin resolution** (`MASK_CELLS_PER_UNIT = 2`, so a `W × D`
  bin has a `2W × 2D` mask), row-major with **row 0 = bottom** (matches the
  generator's coordinate system; the UI inverts via `flex-col-reverse`).
  A fully-filled mask is normalised to `undefined` by `setCellMask` so the
  rectangle **fast-path** (shared by `isAllFilled` / `isPartialMask` /
  `drawRoundedRectangle` in the generator) stays active — custom shapes only
  pay the polygon cost when they actually differ from a rectangle.
  `validateMask` accepts enclosed empty cells (O-shape / ring topology); the
  generator builds those via `buildMaskHoleDrawings` and a 3D boolean cut,
  and the stacking-lip loft wraps each hole as well.
- **Shape editor state** (`ui.shapeEditorOpen` + `ui.halfGridMode`): normalised
  from the loaded params by `loadDesign` and `restoreHistoryEntry` via
  `paramsNeedHalfGridMode` (fractional dimensions OR `hasHalfBinDetail(mask)`),
  so reopening a design or undoing past a dimension change never leaves the
  UI toggles out of sync with the underlying shape.
- **Click-lock lid**: optional companion piece generated alongside the bin
  when `params.lid.enabled && params.base.stackingLip`. Source of truth lives
  in the worker (`generation/worker/generators/lidBuilder.ts` +
  `lidConstants.ts` + `lidOrchestrator.ts`); the result rides back as
  `lidMesh` on the same `MESH_RESULT` payload. The lid is rendered in
  preview with explode-aware Z and opacity (`LidMesh.tsx`); when exporting,
  STL/3MF emit it as a separate piece in the ZIP and STEP folds it into a
  compound assembly translated to its mated position. `LidSection` exposes
  fit (`tight`/`standard`/`loose` → fit-clearance table in `types/lid.ts`),
  toggles for stack grid + magnets, and floor/wall thickness.
- **Cutout Pathfinder / `GroupOp`**: cutouts in the same `groupId` share an
  optional `groupOp` ∈ `'union' | 'subtract' | 'intersect' | 'exclude'`
  (missing = `'union'` so pre-Pathfinder designs are unchanged). The worker's
  `cutoutGroupOps.combineGroupSolids` fuses, carves, or XORs the group's
  member solids into a single cut tool; **Subtract uses the highest-zIndex
  member as the cutter** against the union of the rest (Illustrator "Minus
  Front"). The 2D editor preview mirrors the same semantics via
  `polygon-clipping` in `panel/CutoutsSection/booleanGeometry.ts`, so the
  live editor matches the exported mesh. **Exclude is computed as `union −
intersection`, not XOR** — they coincide for 2 members but diverge for
  3+ (a region in 2 of 3 members survives `union − intersection` but is
  stripped by symmetric-difference). Scoop fillets are restricted to union
  groups; the other ops can produce holes or disjoint topologies the
  adaptive fillet can't reason about. Empty results (e.g. Intersect of
  disjoint shapes) raise a toast so silent no-ops are debuggable.

## Gotchas

1. **Compartment cells must form rectangles** - `isRectangularSelection()` validates
2. **Min compartment size is 5mm** - smaller cells skip wall generation
3. **Auto-save only for saved designs** - "Untitled" bins don't persist
4. **Half-cells get no magnet holes** - only full 1×1 unit cells
5. **Solid style skips shell** - `keepFull` bypasses `.shell()`, so wallThickness is irrelevant
6. **Label tabs skip solid bins** - both generation and ghost overlay guard against `style === 'solid'`. Tabs default to `edges: 'back'` (legacy); `'front'` and `'both'` enable tuck-under ledges (#1898). `inset` (mm) slides the tab inward from its anchor wall for shorter coverage. In `'both'` mode the front tab silently drops when `2·depth + 2·inset > compartmentDepth` and the panel surfaces an inline warning.
7. **cellMask dimensions must track width × depth** - `cols` must equal
   `Math.round(width × MASK_CELLS_PER_UNIT)` and `rows` the depth equivalent.
   `paramSlice.setCellMask` rejects mismatched masks outright. When the bin
   is resized, `reshapeOrClearMask` (in `paramSlice`) grows/crops the stored
   mask to the new dimensions — if the result would be empty or invalid it
   falls back to `undefined` (rectangle fast-path).
8. **Custom shapes disable most features** - `FeatureGate` (`inert`
   - visual de-emphasis) blocks pattern/cutouts/handle/compartments/label
     tabs/scoop on `isPartialMask(cellMask)`. Wall thickness and stacking
     lip still work for any footprint.
9. **Lid requires a stacking lip** — `params.lid.enabled` is gated on
   `params.base.stackingLip` at every layer (orchestrator, export handler,
   `useLidSection`). The mating cavity wraps the lip; without a lip there is
   nothing for the lid to clip onto, so the lid is silently skipped.
10. **Two-piece export** — when `hasLid`, the `EXPORT_COMBINED` flow emits the
    lid as its own labeled piece for STL/3MF (main thread ZIPs them) and
    folds it into the STEP compound. The STEP path must `translate()` the
    lid solid by `totalHeight - lidAnchorZ(...)`; the lid is built in
    lid-local coordinates (Z=0 = lid floor top).
11. **`lidAnchorZ` is duplicated across the worker boundary** — the canonical
    formula lives in `generation/worker/generators/lidConstants.ts`; the
    main-thread copy in `LidMesh.tsx` mirrors it because the worker module
    isn't importable here. **Update both in lockstep** — silent drift causes
    the preview to misalign vs. the exported geometry.
12. **SVG import unit contract** — `svgImport/svgParser.ts` treats user units
    as mm 1:1 unless the SVG declares a physical `width`/`height`
    (mm/cm/in/pt/pc/Q) **and** carries an explicit `viewBox`. Without a real
    viewBox the fallback parses width/height with `parseFloat` (drops unit
    suffixes), so scaling is skipped to avoid producing wildly wrong sizes.
    Genuinely non-square aspect ratios (sx/sy diverge > 0.5%) also fall back
    to identity — a single uniform scalar would distort circles and rotated
    shapes. Path bounds use `getPathBounds` (flattened bezier) so curves that
    bow outward beyond their anchors aren't clipped.
13. **Physical-units print bed is dual-axis** — the section uses the shared
    `PrintBedInput`, so width and depth round-trip independently when the
    link toggle is off. The linked state is encoded by
    `settings.defaultPrintBedDepth === undefined` (`undefined` = "follow
    width", not "0" or "missing"). `usePhysicalUnitsSection.handlePrintBedChange`
    must call the setter with `depth: undefined` when relinking — otherwise
    a stale depth lingers in localStorage and the bed silently stays
    non-square on the next load.
14. **`BinMesh` multi↔single material switch needs distinct keys** — the
    multi-color branch passes `material` as a `<mesh>` **prop** (array of
    `MeshStandardMaterial`), the single-color branch declares the material as
    a `<meshStandardMaterial>` **child**. Without keys, R3F (9.x) reuses the
    same `THREE.Mesh` across the toggle and the post-order commit clobbers
    the freshly attached child material: child-attach runs first, then the
    parent's prop-diff resets the removed `material` prop to a memoized
    `new Mesh()` default (`MeshBasicMaterial`) via `diffProps`. The
    user-visible symptom is a mesh with no emissive glow whose color picker
    no longer takes. Don't remove the `key="multi-color"` /
    `key="single-color"` props — and if you add a third branch (e.g. a new
    material strategy) give it its own key too.
15. **Split connectors have two independent joints** — two sibling toggles in
    `SplitOptionsSection`, gated separately (neither is a child of the other):
    - **Alignment connectors** (`splitConnectors.enabled`) — a 45° floor scarf lap.
    - **Wall connectors** (`splitConnectors.wallConnector`, a `WallConnectorStyle`:
      `'none'` | `'key'`, **default `'none'`**, #1869) — a connector on the
      **exterior perimeter walls only**. The `'key'` style is a straight
      (non-undercut) tongue/groove so the halves **press together horizontally**
      — an undercut dovetail would force a vertical drop-in, impossible past the
      partial-height groove and the stacking lip. The protruding tongue has a 45°
      chamfered underside (self-supporting), and the key is **anchored a fixed skin
      behind the outer face** so the groove can't breach the exterior wall (see
      `wallKeyGeometry`). Stops below the rim so the lip is untouched.

    Either toggle works with the other off — the call site in `splitBinBuilder.ts`
    runs the connector pass when _either_ is on, and `addConnectors` self-gates each
    feature. **Thicker walls add no extra material:** the key is reinforced by an
    inward pilaster _only when the wall is too thin to host it_. Because `perpInset`
    is anchored to a fixed outer skin (not the wall thickness), a thicker wall
    envelops the key and `addKeyConnectors` drops the pilaster entirely.
    **Adding a connector type:** extend `WallConnectorStyle`, add a `case` to the
    exhaustive `addWallConnectors` switch in
    `generation/worker/generators/splitConnectorBuilder.ts` (the compiler flags it
    until handled), reuse `perimeterWalls()` for placement, and add it to the UI.

## Thumbnail Pipeline

Two paths produce design thumbnails, written to IndexedDB and surfaced in the design-list modal:

1. **Live-canvas capture** (`utils/thumbnail.ts` → `captureThumbnailAtPreset`) — used by `useAutoSave` and `useThumbnailCapture`. Reuses the main `PreviewCanvas`'s WebGL context: saves camera state, moves to the isometric preset, renders one frame, captures via `drawImage`, restores. Requires the designer to be mounted.
2. **Offscreen regenerator** (`utils/thumbnailRegenerator.ts`) — used by `useThumbnailRegeneration` (modal-open fallback) and `useBackgroundThumbnailRegen` (boot scan). Creates its own `THREE.WebGLRenderer`, acquires the shared bridge, generates mesh, renders one frame, disposes everything. Works without the designer being mounted.

**Boot-time scan** (`hooks/useBackgroundThumbnailRegen.ts`, mounted in `App.tsx`) runs once per page load to regenerate stale thumbnails before the user opens the modal. It schedules itself on `requestIdleCallback`, waits for sync to settle for authenticated sessions, pauses while the designer's `generationStatus === 'generating'` or the tab is hidden, and acquires the bridge once for the whole batch. Emits a single `bin_designer_bg_thumbnail_regen` PostHog event on completion. The modal-open hook stays as an in-session safety net for designs that appear after the boot scan (imports, freshly created bins).

Both paths feed the same `THUMBNAIL_VERSION` invariant: any thumbnail saved is stamped with the current version. The modal hook re-flags any design whose stored version trails the current constant, so bumping `THUMBNAIL_VERSION` (in `types/index.ts`) forces an organic regeneration on next modal open.

**Bump policy:** increment `THUMBNAIL_VERSION` whenever the _rendered output_ changes meaningfully — bug fixes that produce a different image, lighting changes, camera framing changes, lid/edge handling changes. Don't bump for code-internal refactors that produce byte-identical output.

**Indexed-mesh contract:** the worker emits an indexed mesh (deduplicated vertices + `Uint32Array` indices). Both render paths MUST call `geometry.setIndex(new THREE.BufferAttribute(indices, 1))` — without it Three.js draws random triangles between consecutive vertices and produces visually-corrupted "spaghetti" thumbnails. The shared `useMeshGeometry` hook handles this for the live canvas; the offscreen regenerator handles it inline.

## Integration

- `?placeBin=WxDxH` URL param places bin at (0,0) in Layout Planner
- Uses `generation` feature for WASM tessellation
