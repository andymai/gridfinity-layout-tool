# Drawer Shape

Authoring surfaces for non-rectangular drawers (issue #2528). All surfaces
write ONE field — `Drawer.outline`
(closed CCW loop of line segments + arcs, drawer-local mm) — via the
`drawer.setOutline` command; everything downstream (placement gating,
hatching, baseplate generation/splitting) derives from it.

## Key Files

- `components/DrawerShapeSection` — Sidebar `FeatureToggle` entry: toggle
  on opens the editor; toggle off resets to a rectangle after a confirm.
- `components/ShapeEditorDialog` — cell-paint editor. Whole drawer cells
  (plus the fractional-edge cell of an x.5 drawer) toggle in/out; drag paints
  with the state of the first cell touched via ONE container pointer handler
  (`elementFromPoint` under pointer capture). "Trace bin layout" seeds the
  grid from the union of non-staged bin footprints.
- `utils/drawerMask.ts` — editor grid ↔ outline conversion. The grid maps to
  the bin designer's half-resolution `CellMask` so `maskToPolygon` traces the
  boundary; the outer loop scales by `gridUnitMm` into outline mm. Enclosed
  holes are filled (single-loop model); empty/disconnected grids error.
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
