# Drawer Shape

Authoring surfaces for non-rectangular drawers (issue #2528). All surfaces
write ONE field — `Drawer.outline`
(closed CCW loop of line segments + arcs, drawer-local mm) — via the
`drawer.setOutline` command; everything downstream (placement gating,
hatching, baseplate generation/splitting) derives from it.

## Key Files

- `components/DrawerShapeSection` — Sidebar entry: toggle on opens the editor;
  toggle off resets to a rectangle after a confirm. Uses the shared
  `ToggleRow` (a `Checkbox`), **not** `FeatureToggle` — the sidebar's boolean
  rows are checkboxes, and this sits directly under Half-grid mode. Corner
  cuts stay reachable with no outline: they build one from the plain
  rectangle. Takes `variant` so the mobile settings sheet gets `lg` hit areas.
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
   drawer. The grow path fits the loop against the drawer it is _about_ to
   have, so the resize and the outline land in one commit instead of racing.
   Loops dropped and points thinned are always toasted, never silent.
6. The corner-cut vertex geometry lives in
   `@/shared/utils/cornerCutOutline` (not here) so the baseplate's
   `buildFullParams` can re-inscribe the same cuts on the padded plate
   rectangle (issue #2612). `cornersToOutline` is a thin wrapper that adds
   the `authoring` echo; that echo is only trusted downstream after
   `cornerCutsMatchVertices` proves it reproduces the stored vertices.
