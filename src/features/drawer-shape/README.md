# Drawer Shape

Authoring surfaces for non-rectangular drawers (issue #2528). All surfaces
write ONE field — `Drawer.outline`
(closed CCW loop of line segments + arcs, drawer-local mm) — via the
`drawer.setOutline` command; everything downstream (placement gating,
hatching, baseplate generation/splitting) derives from it.

Consumers never read the stored outline directly for gating or rendering:
they go through `@/shared/utils/outlineFrame` (#3157), which composes the
plate's lattice registration with the user's manual grid shift
(`Drawer.gridShiftX/Y`, ±half pitch) into one translation both the layout and
the baseplate apply. Authoring surfaces are the exception — the editors show
the shape at its raw authored anchor, and the stored outline is never mutated
by the frame (#3149).

## Key Files

- `components/DrawerShapeSection` — Sidebar entry: toggle on opens the editor;
  toggle off resets to a rectangle after a confirm. Uses the shared
  `ToggleRow` (a `Checkbox`), **not** `FeatureToggle` — the sidebar's boolean
  rows are checkboxes, and this sits directly under Half-grid mode. Takes
  `variant` so the mobile settings sheet gets `lg` hit areas.
- `components/DrawerShapeActionsMenu` — the row's `trailing` control: one
  ghost `IconButton` opening a `Menu.Root` of the three authoring routes.
  Built on the `Menu` primitive rather than a bare `Popover` of buttons — the
  menu/menuitem roles promise arrow traversal, Home/End and focus landing in
  the list on open, and `Menu` is what implements that. Corner cuts and the
  pen stay reachable with no outline (they build one from the plain
  rectangle); the cell editor needs one first.
  It is a `trailing` slot rather than a child of the row because `ToggleRow`
  puts `role="checkbox"` on an inset overlay — Children Presentational would
  drop a nested button from the accessibility tree.
- `@/shared/components/GridAlignmentControls` — grid↔perimeter alignment:
  X/Y mm steppers writing `drawer.gridShiftX/Y` through `drawer.update`
  (undoable, displaces newly-outside bins), a reset, and a hint reporting the
  effective frame translation whenever it is non-zero. Hidden when the plate
  does not sync with the layout — there is no shared frame to align then.
  Shared because the baseplate panel offers it too: on a synced shaped plate
  the outer size comes from the drawer, so moving the grid is the only way to
  distribute the slack between shape and cells.
- `components/ShapeEditorDialog` — cell-paint editor. Whole drawer cells
  (plus the fractional-edge cell of an x.5 drawer) toggle in/out; drag paints
  with the state of the first cell touched via ONE container pointer handler
  (`elementFromPoint` under pointer capture). "Trace bin layout" seeds the
  grid from the union of non-staged bin footprints.
- `utils/drawerMask.ts` — editor grid ↔ outline conversion. The grid maps to
  the bin designer's half-resolution `CellMask` so `maskToPolygon` traces the
  boundary; the outer loop scales by the per-axis grid pitch (`gridUnitMm` /
  `gridUnitMmY`, issue #2733) into outline mm. Enclosed holes are filled
  (single-loop model); empty/disconnected grids error.
- `components/PenShapeDialog` — freeform perimeter editor. Drag corners and bow
  segments into arcs; per-corner rounding comes from `@/shared/utils/filletOutline`
  and is baked into the stored vertices, so every consumer sees the same shape.
  Sketch state lives in `usePenSketch`, which owns the `radii` parallel array —
  inserting and deleting are hook methods precisely so no call site can shift
  vertex indices without moving the radii with them.
  Points may sit **past the current grid** (issue #3092): every clamp allows up
  to `CONSTRAINTS.GRID_MAX × pitch` rather than the drawer extent, `usePenView`
  frames the union of the drawer rect and the sketch bbox so out-of-bounds
  handles stay grabbable, and **Apply grows the drawer** to the smallest
  half-unit grid that holds the shape — `updateDrawer` then `setDrawerOutline`
  in one `batch()`, relying on the synchronous command bus so the outline
  validates against the enlarged drawer (one undo step). The live `validateOutline`
  runs against those post-grow bounds so a growable overflow never disables Apply.
- `utils/outlineImport/` — SVG/DXF file → perimeter. Both parsers land on the
  same shape (closed loops of `OutlineVertex` in mm, Y-up), so loop selection,
  fitting and simplification are written once. DXF group code 42 **is**
  `OutlineVertex.bulge` (same `tan(sweep/4)` convention), so a CAD arc imports
  as an arc. Routing is by content, not by extension — the two formats are
  trivially distinguishable and a renamed drawing is still what it is. Curves
  can close a loop in two vertices (a circle is two half-arcs), below the
  model's floor, so `ensureMinVertices` subdivides arcs until it clears.
  Loaded through a dynamic `import()` from `useOutlineImport` —
  `DrawerShapeSection` is eager, so a static import would put both parsers in
  the eager bundle.
- `utils/traceBinFootprint.ts` — bins → editor grid (all layers, staging
  excluded).

## Gotchas

1. **Row 0 is the drawer FRONT** — the editor renders rows reversed so the
   grid reads like the layout canvas.
2. Applying a shape may displace bins to staging; the dialog precomputes the
   count with the same `computeDisplacedBins` the command uses and toasts it.
3. Reopening the editor rasterizes the stored outline back to cells with the
   same `classifyRect` predicate placement uses — a cell is filled iff bins
   may occupy it.
4. **Rounding is stored as geometry, not as a parameter** — so the pen editor
   reopens a saved shape through `unfilletOutline`, which collapses each tangent
   arc back to the corner it was built from plus its radius. That inverse is
   what keeps a radius adjustable without persisting a second copy of the shape
   alongside the outline. A hand-drawn arc is not tangent to its neighbours, so
   it survives as drawn.
5. **An import is never silently rescaled** — true scale is the point of
   importing a drawer measured in CAD, so an oversized perimeter raises
   `PenImportNotice` and the user picks between scaling it down and growing the
   drawer. The grow target is the max of the file's size and the current
   drawer per axis (growing never shrinks — the #3149 clamp would refuse it),
   and the loop is fitted against that same target, so the prompt, the resize
   and the outline all land consistently. Loops dropped and points thinned
   are always toasted, never silent.
6. **The outline never changes implicitly** (#3149) — `drawer.update` clamps a
   shrink to the shape's bounding half-unit grid (`minDrawerUnitsForOutline`)
   and keeps the outline byte-identical on grow; the old crop/weld adaptation
   is gone. That floor is per axis and only applies where the grid is what
   holds the shape: what the read-side normalizer clips against is
   `outlineExtentMm`, so an axis whose recorded measurement already contains
   the perimeter has no floor at all (`drawerSizeFloors`, `gridPitchFloors`)
   and the grid is free to shrink inside it as `outlineOverhang`. The cell editor warns (`drawerShape.editor.replacesDrawnShape`)
   when the stored perimeter would not survive rasterization
   (`isOutlineCellRepresentable`), since applying a cell paint replaces it.
7. The corner-cut vertex geometry lives in
   `@/shared/utils/cornerCutOutline` (not here) so the baseplate's
   `buildFullParams` can re-inscribe the same cuts on the padded plate
   rectangle (issue #2612). `cornersToOutline` is a thin wrapper that adds
   the `authoring` echo; that echo is only trusted downstream after
   `cornerCutsMatchVertices` proves it reproduces the stored vertices.
