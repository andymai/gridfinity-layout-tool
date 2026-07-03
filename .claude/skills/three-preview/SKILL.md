---
name: three-preview
description: The 3D render systems (layout IsometricPreview vs worker-mesh bin-designer/baseplate previews), view store, camera, disposal/memory rules. Load when touching IsometricPreview.tsx, Scene.tsx, BinMesh.tsx, PreviewCanvas.tsx, useBinGeometry.ts, view.ts, or debugging z-fighting/flicker, GPU memory growth, a preview frozen until you orbit, wrong scene scale (42x off), theme-wrong scene colors, or bins replaying drop animations on every edit.
---

# 3D Preview Systems

## When to use

- Adding/altering anything rendered in a Three.js scene (bins, indicators, camera, lights, view modes).
- Debugging preview symptoms: flicker while orbiting, tab GPU memory growth, stale frame on `frameloop="demand"` canvases, wrong colors per theme, unwanted bin animations.
- Changing `src/core/store/view.ts` (rotation, layer view mode, exploded/expanded flags).

## Mental model

There are THREE separate preview systems. Never mix their conventions.

| System                   | Geometry source                                                            | Units            | Frameloop  | Entry file                                                                       |
| ------------------------ | -------------------------------------------------------------------------- | ---------------- | ---------- | -------------------------------------------------------------------------------- |
| Layout isometric preview | Procedural `createBinGeometry()` from layout store, never the worker       | grid units, Z-up | continuous | `src/features/grid-editor/components/Grid/IsometricPreview/IsometricPreview.tsx` |
| Bin-designer preview     | Worker `MeshData` Float32Arrays via designer store `state.generation.mesh` | mm               | `demand`   | `src/features/bin-designer/components/PreviewCanvas/PreviewCanvas.tsx`           |
| Baseplate preview        | Worker `MeshData`, same `useMeshGeometry` pipeline                         | mm               | `demand`   | `src/features/baseplate/components/BaseplatePreview/BaseplatePreview.tsx`        |

Facts you cannot derive from types:

- **Isometric scene is Z-up in grid units.** `Scene.tsx` does `camera.up.set(0, 0, 1)`; x = grid x, y = grid depth, z = height where `z = heightUnits * (heightUnitMm / gridUnitMm)` (7/42). Designer/baseplate scenes are also Z-up (`src/shared/components/preview/CameraRig.tsx` forces `up=[0,0,1]` on both cameras) but in mm (`PreviewCanvas.tsx` CameraRig `initialPosition={[100, -100, 80]}`). A value correct in one scene is ~42x off in the other.
- **Worker meshes flow only through stores**: `GenerationBridge.generate()` (`src/features/generation/bridge/GenerationBridge.ts`) → `MeshData` (`src/features/generation/bridge/types.ts`) → designer store `state.generation.mesh` → `BinMesh` → `useMeshGeometry`. No direct worker→scene wiring. Mesh production itself is the geometry-generation skill.
- **Non-selected layout bins are ONE merged mesh** (`MergedBinMeshes/MergedBinMeshes.tsx`): `mergeGeometries`, not InstancedMesh, because dimensions differ per bin and shading is baked as per-face vertex colors in `createBinGeometry` (`src/shared/hooks/useBinGeometry.ts`). It applies `deferredBins[0]?.opacity` to the whole merged mesh — per-bin opacity in the flat path silently won't work.
- **Painter's sort assumes the front-right camera** at (X+, Y−, Z+): `useBinsToRender.ts` sorts by z then `(x - y)` and bumps z by `index * 0.0002` grid units against z-fighting. Change the default camera quadrant in `Scene.tsx` and transparent depth ordering silently breaks.
- **`useMeshGeometry` output may be non-indexed**: its precomputed-normals path runs `toCreasedNormals`, which drops the index — never assume `geo.index` exists downstream. Worker-supplied `edgeVertices` take precedence over the main-thread `EdgesGeometry` fallback, and direct-mesh drafts ship worker-computed crease edges on purpose so draft and BREP edge overlays match — suppress neither path (`src/shared/components/preview/useMeshGeometry.ts`).
- **Every imperatively created BufferGeometry/Material must be disposed.** Patterns to copy: prev-ref + unmount cleanup in `MergedBinMeshes.tsx`; dispose-on-change in `src/shared/components/preview/useMeshGeometry.ts`; LRU eviction + `clearGeometryCache()` in `MergedBinMeshes/geometryCache.ts` (max 100, key `w|d|h|color` with `toFixed(2)`).
- **Scene colors come from `THREE_COLORS`** in `src/shared/hooks/useThemeEffect.ts` via `useThreeColors()`. CSS variables do not exist inside WebGL. New colors go in BOTH dark and light palettes.
- **Bin transition identity is `bin.id`** (`useBinTransitions.ts`, `useSyncExternalStore`). Regenerated IDs read as remove-all+add-all; the <20%-ID-overlap heuristic suppresses animation only on layout switches. Preserve bin IDs across edits.
- **OrbitControls azimuth syncs to the view store only on interaction end** (`Scene.tsx` `handleEnd` → `setIsometricRotation`, degrees normalized 0–360). Mid-drag readers see a stale value by design. `snapToIsometric()` in `view.ts` is store-only — no UI caller today.

## Recipes

### Add a visual element to the layout scene

1. New component folder under `src/features/grid-editor/components/Grid/IsometricPreview/` (patterns: `ScaleIndicator/`, `BananaScale/`, `DrawerDimensions/`) with a sibling `.test.tsx` — pre-commit blocks component files without one.
2. Position in Z-up grid units: floor z=0, drawer spans `[0, drawer.width] × [0, drawer.depth]`.
3. Colors via `useThreeColors()`; add entries to both palettes in `useThemeEffect.ts`.
4. Mount in `Scene/Scene.tsx` (static chrome) or `IsometricPreview.tsx` (bin-dependent). If bin-dependent, decide whether it hides while exploded, as `BinOverlayGroup.tsx` and `BatchedCornerMarkers/` do — offset layers desync overlay positions.
5. Imperative geometry/material → dispose on change and unmount (copy `useMeshGeometry.ts`).
6. Keep imports inside the lazy boundary: `IsometricPreview` is lazy-loaded via `lazyWithRetry` in `Grid.tsx`; importing from `IsometricPreview/` into eager grid code drags Three.js into the main bundle (`pnpm run size` fails).

### Change how layout bins look

1. Edit `createBinGeometry` in `src/shared/hooks/useBinGeometry.ts` — it feeds all layout render paths (merged, selected, animated) at once.
2. Shading is per-face vertex colors via `adjustColor` (6 vertices per quad); new faces need color pushes matching position pushes.
3. New geometry-affecting parameter → add it to the cache key in `geometryCache.ts`, or visually identical bins share the wrong cached geometry.
4. Visually check merged (deselected), selected, and entering/exiting bins all match.

### Add a preview mode/toggle (exploded-view pattern)

1. Add state + action to `src/core/store/view.ts` and `INITIAL_VIEW_STATE`; define interaction with `layerViewMode` explicitly (`setLayerViewMode` force-disables `isExplodedView` outside `'all'`). Tests in `src/core/store/view.test.ts`.
2. Wire the control in `IsometricPreviewControls.tsx` (props from `IsometricPreview.tsx`); optional keybinding in `src/shared/hooks/use3DPreviewKeyboard.ts` (guard on `isPreviewVisible`).
3. If it moves bins: per-group offsets in a hook (`src/shared/hooks/useExplodedLayerView.ts`, `EXPLODE_GAP = 2.5` grid units), lerp in `useFrame`, and keep groups MOUNTED during exit (`isExplodeExiting` timer in `IsometricPreview.tsx`) or layers teleport.
4. To survive PWA update reloads, add to `src/shared/utils/ephemeralState.ts` + capture/restore in `src/shared/hooks/usePWAUpdate.ts` (view store is otherwise unpersisted, but `isometricRotation` already rides this path).
5. Labels need i18n keys: `en.ts` first, then locale JSONs — see the i18n-changes skill.

### Change camera behavior

1. All camera logic is in `Scene/Scene.tsx`: `calculateFitZoom`, preset memos, `setPreset`.
2. Preset transitions interpolate in spherical coordinates around the target — Cartesian lerp cuts through the model. Cancel any in-flight `animationFrameRef` first.
3. After moving the camera programmatically: `controlsRef.current.update()`, then `getAzimuthalAngle()` → degrees → `setIsometricRotation`.
4. Fit-zoom fires only on mount and on the size change right after expand/collapse (`pendingFitZoomRef`). Do not "fix" it to refit on drawer resize — that stomps user zoom owned by OrbitControls.
5. Change the default quadrant → also update the `(x - y)` sort in `useBinsToRender.ts`.

## Verification

```bash
pnpm run test:run src/features/grid-editor/components/Grid/IsometricPreview
pnpm run test:run src/shared/hooks/useBinGeometry src/core/store/view
pnpm run typecheck
pnpm run size
pnpm run dev
```

No headless test catches lighting/ordering/theme issues — in `pnpm run dev`, orbit the camera in BOTH themes, expand/collapse the preview (camera must persist), and toggle exploded view. `pnpm run test:visual` (`test:visual:update` to accept) for Playwright component snapshots when visuals changed.

## Traps

| Symptom                                                     | Cause                                                                                                                                                                                      | Fix                                                                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Bins shimmer on coplanar tops while orbiting                | z-offset/sort lost in `useBinsToRender.ts`, or new mesh at an existing z                                                                                                                   | Keep z-primary, `(x-y)`-secondary sort + per-index bump; for overlay lines use `polygonOffset` as designer `BinMesh.tsx` does |
| GPU memory climbs during drag/resize until crash            | Geometry path without disposal                                                                                                                                                             | Copy `prevGeometryRef` pattern from `MergedBinMeshes.tsx`; dispose merge inputs after `mergeGeometries`                       |
| Designer/baseplate preview updates only when orbited        | `frameloop="demand"` and no `invalidate()`                                                                                                                                                 | `const { invalidate } = useThree()`; call in an effect keyed on the changing value (~6 examples in designer `BinMesh.tsx`)    |
| New element rotated 90°, floating, or 42x wrong size        | Y-up assumption or mm/grid-unit mix                                                                                                                                                        | Isometric scene: Z-up grid units, `z = heightUnits * (7/42)`; never reuse designer mm constants                               |
| Camera resets on expand, or black canvas after refactor     | Canvas remounted — moved in JSX across corner/expanded modes                                                                                                                               | Single Canvas location; switch via wrapper className `'contents'` vs `'fixed inset-0 ...'` (`IsometricPreview.tsx` ~line 448) |
| Every edit replays the drop animation on all bins           | Mutation regenerated bin IDs                                                                                                                                                               | Preserve IDs across edits; regeneration acceptable only on import/switch (<20% overlap suppresses)                            |
| Scene color wrong in one theme                              | Single-theme hardcode or CSS var                                                                                                                                                           | Both palettes in `THREE_COLORS`, read via `useThreeColors()`                                                                  |
| Designer glow breaks after toggling multi-color             | Reused `<mesh>` lets R3F reset `material` to a memoized default                                                                                                                            | Keep distinct `key="multi-color"` / `key="single-color"` on the mesh variants (`BinMesh.tsx`)                                 |
| Undone designer edit shows a mesh that doesn't match params | Params mutated outside history; undo restores cached mesh without regeneration (`restoreHistoryEntry` in `src/features/bin-designer/store/helpers.ts` leaves epoch unchanged on cache hit) | Route param changes through the history mechanism so epoch bumps on cache miss                                                |
| Live status text crashes React under page translators       | `translate="no"` removed from `PreviewCanvas.tsx` container                                                                                                                                | Keep it when restructuring the wrapper                                                                                        |

Expensive per-frame helpers: copy the `ContactShadows` `frames={isInteracting ? 0 : Infinity}` pattern in `Scene.tsx` and keep OrbitControls `onStart`/`onEnd` wired. Never add per-frame React state — mutate refs in `useFrame` (`AnimatedBinMesh/AnimatedBinMesh.tsx`).

Cross-scope: worker mesh generation/parity → geometry-generation skill; preview-vs-export divergence triage → geometry-debugging skill; 2D canvas interactions → grid-editor skill; designer compartment model/epoch sync → bin-designer skill.
