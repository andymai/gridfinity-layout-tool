# brepjs API Enhancement Report

**Date:** 2026-03-04
**brepjs version:** 9.3.9
**Current API utilization:** ~30-40%

## Executive Summary

The gridfinity-layout-tool uses brepjs (OpenCascade WASM) for all 3D geometry generation, but leverages only a fraction of its API surface. This report identifies **10 enhancement opportunities** across code simplification, new capabilities, reliability improvements, and new export formats. Each opportunity includes before/after code examples, risk assessment, and effort estimates.

### Priority Matrix

| #   | Enhancement                                        | Impact | Effort | Risk   | Priority |
| --- | -------------------------------------------------- | ------ | ------ | ------ | -------- |
| 1   | `drill()` for magnet/screw holes                   | High   | Low    | Low    | P0       |
| 2   | `box()` / `cylinder()` primitives                  | Medium | Low    | Low    | P0       |
| 3   | `mirrorJoin()` for symmetric geometry              | Medium | Low    | Low    | P1       |
| 4   | `split()` / `slice()` for bin splitting            | High   | Medium | Medium | P1       |
| 5   | Face tagging (`tagFaces` / `findFacesByTag`)       | High   | Medium | Medium | P1       |
| 6   | Three.js helpers (`toBufferGeometryData`)          | Medium | Medium | Low    | P2       |
| 7   | `withScope()` memory management                    | Medium | Medium | Low    | P2       |
| 8   | `autoHeal()` for boolean reliability               | High   | Low    | Medium | P2       |
| 9   | 3MF export (`exportThreeMF`)                       | High   | Low    | Low    | P0       |
| 10  | Pattern APIs (`linearPattern` / `circularPattern`) | Medium | High   | Medium | P3       |

---

## 1. `drill()` for Magnet/Screw Holes

### Current Pattern

Magnet and screw holes are created manually: draw a circle, sketch it on a plane, extrude, clone a template, translate to each position, then batch-cut.

**socketBuilder.ts:201-231** (bin sockets)

```typescript
// Current: 30 lines of manual hole construction
const magnetCutout = withMagnet ? sketch(drawCircle(magnetRadius)).extrude(magnetDepth) : null;
const screwCutout = withScrew ? sketch(drawCircle(screwRadius)).extrude(SOCKET_HEIGHT) : null;

const cutout: Shape3D =
  magnetCutout && screwCutout
    ? unwrap(fuse(magnetCutout, screwCutout))
    : ((magnetCutout || screwCutout) as Shape3D);

const holeTools: Shape3D[] = [];
forEachCell(gridW, gridD, (cell) => {
  if (cell.widthUnits < 1 || cell.depthUnits < 1) return;
  for (const [dx, dy] of holeOffsets) {
    holeTools.push(
      translate(clone(cutout), [cell.centerX + dx, cell.centerY + dy, -SOCKET_HEIGHT])
    );
  }
});
if (holeTools.length > 0) {
  result = unwrap(cutAll(result, holeTools));
}
```

**baseplateGenerator.ts:216-245** (baseplate magnets)

```typescript
// Current: similar pattern repeated
const cutterZ = -SOCKET_HEIGHT + COPLANAR_MARGIN;
const cutterDepth = magnetDepth + COPLANAR_MARGIN;
const magnetTemplate = sketch(drawCircle(magnetRadius), 'XY', cutterZ).extrude(-cutterDepth);

const holes: Shape3D[] = [];
forEachCell(
  gridW,
  gridD,
  (cell) => {
    if (cell.widthUnits < 1 || cell.depthUnits < 1) return;
    for (const [dx, dy] of MAGNET_OFFSETS) {
      holes.push(translate(clone(magnetTemplate), [cell.centerX + dx, cell.centerY + dy, 0]));
    }
  },
  cellOpts
);
```

### Proposed: `drill()`

brepjs `drill()` combines circle creation, extrusion, positioning, and boolean subtraction in one call:

```typescript
import { drill } from 'brepjs';

// After: single call per hole
forEachCell(gridW, gridD, (cell) => {
  if (cell.widthUnits < 1 || cell.depthUnits < 1) return;
  for (const [dx, dy] of holeOffsets) {
    result = unwrap(
      drill(result, {
        at: [cell.centerX + dx, cell.centerY + dy, 0],
        radius: magnetRadius,
        depth: magnetDepth,
        axis: [0, 0, -1],
      })
    );
  }
});
```

### Considerations

- `drill()` applies one boolean per call. The current batch approach (`cutAll` with all holes at once) is likely **faster** for large grids because it avoids N sequential boolean operations.
- **Recommended approach:** Use `drill()` only when there are few holes (e.g., 4 per cell). For grids with many cells, the current batch `cutAll` approach is more performant.
- Alternative: keep the template-clone-translate pattern but use `cylinder()` primitive instead of `drawCircle().sketchOnPlane().extrude()`.

### Risk: Low

`drill()` is a thin wrapper around `cut(shape, cylinder(...))`. Same underlying OCCT operations.

### Effort: Low (1-2 hours)

Replace hole construction in `socketBuilder.ts` and `baseplateGenerator.ts`.

---

## 2. `box()` / `cylinder()` Solid Primitives

### Current Pattern

Simple rectangular and cylindrical solids are built via `drawRectangle().sketchOnPlane().extrude()` — a 3-step process.

**splitConnectorBuilder.ts:236-254** (prisms)

```typescript
// Current: 3 steps for a box
function buildPrism(cutAxis, sketchPos, extrudeLen, width, height, bottomZ, edgeOffset) {
  const rect = drawRectangle(width, height);
  const sketchPlane = cutAxis === 'x' ? 'YZ' : 'XZ';
  const prism = sketch(rect, sketchPlane, sketchPos).extrude(extrudeLen);
  return translate(prism, [
    cutAxis === 'x' ? 0 : edgeOffset,
    cutAxis === 'y' ? 0 : edgeOffset,
    bottomZ + height / 2,
  ]);
}
```

**socketBuilder.ts:201-202** (hole cylinders)

```typescript
// Current: 3 steps for a cylinder
const magnetCutout = sketch(drawCircle(magnetRadius)).extrude(magnetDepth);
```

### Proposed: `box()` / `cylinder()` Primitives

```typescript
import { box, cylinder } from 'brepjs';

// After: one call
const prism = box(width, height, extrudeLen, { at: [x, y, z] });

// After: one call for cylinder
const magnetCutout = cylinder(magnetRadius, magnetDepth, { at: [0, 0, 0] });
```

### Considerations

- `box()` creates axis-aligned boxes (W along X, D along Y, H along Z). The connector builder needs boxes on different planes, so `box()` would need a `rotate()` afterward — potentially less clear than the current `sketchOnPlane('YZ')` approach.
- `cylinder()` is a clear win for magnet/screw hole templates — eliminates the draw-sketch-extrude chain.
- The `{ at, centered }` options in `box()` can eliminate some `translate()` calls.

### Where to Apply

| Location                    | Current                                           | Proposed                              | Savings |
| --------------------------- | ------------------------------------------------- | ------------------------------------- | ------- |
| `socketBuilder.ts:201-202`  | `sketch(drawCircle(r)).extrude(d)`                | `cylinder(r, d)`                      | 1 line  |
| `baseplateGenerator.ts:228` | `sketch(drawCircle(r), 'XY', z).extrude(-d)`      | `cylinder(r, d, { at: [0,0,z] })`     | 1 line  |
| `slotBuilder.ts:98-99`      | `sketch(drawRectangle(w, d), 'XY').extrude(h)`    | `box(w, d, h)`                        | 1 line  |
| `binGenerator.ts:461`       | `sketch(drawPolysides(r, n), 'XY').extrude(d)`    | Keep as-is (no `polysides` primitive) | —       |
| `binGenerator.ts:708`       | `sketch(drawRectangle(w, d), 'XY', z).extrude(h)` | `box(w, d, h, { at: [cx, cy, z] })`   | 1 line  |

### Risk: Low

Direct primitive replacement. Same OCCT geometry underneath.

### Effort: Low (1-2 hours)

Find-and-replace pattern across 4-5 files.

---

## 3. `mirrorJoin()` for Symmetric Geometry

### Current Pattern

The slot builder creates mirrored pairs of cutters manually, duplicating geometry construction:

**slotBuilder.ts:82-116** (mirrored slot cutters)

```typescript
function createMirroredCutters(primaryDim, crossDim, height, halfSpan, crossPos, z, axis) {
  const extDim = primaryDim + SLOT_EXTENSION;
  const centerOffset = halfSpan + primaryDim / 2;

  const rectW = axis === 'x' ? extDim : crossDim;
  const rectD = axis === 'x' ? crossDim : extDim;

  // Two separate solids built and positioned manually
  const negSolid = sketch(drawRectangle(rectW, rectD), 'XY').extrude(height);
  const posSolid = sketch(drawRectangle(rectW, rectD), 'XY').extrude(height);

  const negCenter = -(centerOffset - SLOT_EXTENSION / 2);
  const posCenter = centerOffset - SLOT_EXTENSION / 2;

  if (axis === 'x') {
    return [
      translate(negSolid, [negCenter, crossPos, z]),
      translate(posSolid, [posCenter, crossPos, z]),
    ];
  }
  return [
    translate(negSolid, [crossPos, negCenter, z]),
    translate(posSolid, [crossPos, posCenter, z]),
  ];
}
```

### Proposed: `mirrorJoin()`

```typescript
import { mirrorJoin } from 'brepjs';

// Build one side, mirror to get both
function createMirroredCutters(primaryDim, crossDim, height, halfSpan, crossPos, z, axis) {
  const extDim = primaryDim + SLOT_EXTENSION;
  const centerOffset = halfSpan + primaryDim / 2;
  const rectW = axis === 'x' ? extDim : crossDim;
  const rectD = axis === 'x' ? crossDim : extDim;

  const oneSide = sketch(drawRectangle(rectW, rectD), 'XY').extrude(height);
  const posCenter = centerOffset - SLOT_EXTENSION / 2;

  const positioned = translate(
    oneSide,
    axis === 'x' ? [posCenter, crossPos, z] : [crossPos, posCenter, z]
  );

  // mirrorJoin creates the solid + its mirror, fused together
  const normal = axis === 'x' ? [1, 0, 0] : [0, 1, 0];
  return unwrap(mirrorJoin(positioned, { normal, at: [0, 0, 0] }));
}
```

### Considerations

- `mirrorJoin()` returns a **single fused solid** (original + mirror). The current code returns `[Shape3D, Shape3D]` as separate cutter tools. If they need to remain separate (for individual boolean ops), use `mirror()` instead of `mirrorJoin()`.
- Since all slot cutters are eventually fused together via `fuseAll(slots)` anyway (slotBuilder.ts:257), `mirrorJoin()` would work — it pre-fuses the pair.
- The lip cutters also follow this mirrored pattern (slotBuilder.ts:125-158), so the same optimization applies.

### Risk: Low

`mirrorJoin()` = `fuse(shape, mirror(shape))`. Same operations, fewer lines.

### Effort: Low (1-2 hours)

Refactor `createMirroredCutters()` and `createMirroredLipCutters()` in slotBuilder.ts.

---

## 4. `split()` / `slice()` for Bin Splitting

### Current Pattern

Splitting a bin into pieces uses a manual cutting-box intersection approach:

**binGenerator.ts:636-766** (split logic)

```typescript
// Current: build a 500mm-tall cutting box per piece, intersect with full solid
const CUTTING_BOX_HEIGHT = 500;

for (let col = 0; col < xBounds.length - 1; col++) {
  for (let row = 0; row < yBounds.length - 1; row++) {
    // Compute margins to avoid coplanar faces at outer edges
    const marginL = col === 0 ? EDGE_MARGIN : 0;
    const marginR = col === xBounds.length - 2 ? EDGE_MARGIN : 0;
    // ... 15 lines of margin/offset computation ...

    const cuttingBox = sketch(drawRectangle(boxW, boxD), 'XY', -250).extrude(500);
    const translatedBox = translate(cuttingBox, [boxCenterX, boxCenterY, 0]);

    let piece = unwrap(intersect(clone(bodySolid), translatedBox));
    // ... lip splitting, connector application ...
  }
}
```

### Proposed: `split()` or `slice()`

brepjs provides purpose-built splitting APIs:

```typescript
import { split, slice } from 'brepjs';

// Option A: split() with plane tools
// split(shape, tools) → splits shape into disconnected pieces
const xPlanes = cutPlanesX.map((x) => ({ origin: [x, 0, 0], normal: [1, 0, 0] }));
const yPlanes = cutPlanesY.map((y) => ({ origin: [0, y, 0], normal: [0, 1, 0] }));
const allPlanes = [...xPlanes, ...yPlanes].map((p) => sectionToFace(bodySolid, p));
const pieces = unwrap(split(bodySolid, allPlanes));

// Option B: slice() with plane array
// slice(shape, planes) → returns array of pieces
const planes = [
  ...cutPlanesX.map((x) => ({ origin: [x, 0, 0], normal: [1, 0, 0] })),
  ...cutPlanesY.map((y) => ({ origin: [0, y, 0], normal: [0, 1, 0] })),
];
const pieces = unwrap(slice(bodySolid, planes));
```

### Considerations

- The current approach has **significant edge case handling**: EDGE_MARGIN expansion to avoid coplanar boolean failures at outer bin walls, separate lip splitting to avoid OCCT crashes at lip-wall junctions, and per-piece connector application.
- `split()` returns a `Compound` of all pieces — you'd need to extract individual solids and identify which piece is which (by position/bounding box).
- `slice()` returns `AnyShape[]` — each element is one slice. Order may not be predictable for grid splits (X×Y).
- The lip-splitting workaround (generating body without lip, splitting separately, fusing per-piece) may still be needed if `split()`/`slice()` hits the same OCCT bug.
- **This is the highest-impact but also highest-risk change.** The current code works around several OCCT issues that may or may not apply to `split()`/`slice()`.

### Risk: Medium

OCCT's split/slice may handle the coplanar edge cases differently (better or worse) than the current intersect approach. Needs testing with edge cases: fractional dimensions, thick walls + lip, etc.

### Effort: Medium (4-6 hours)

Replace `splitSolidIntoPieces()` logic, test all edge cases, handle piece identification.

---

## 5. Face Tagging (`tagFaces` / `findFacesByTag`)

### Current Pattern

Feature coloring uses a manual origin-tracking system. A low-fidelity mesh is generated for each feature tool to collect `faceGroups[].origin` IDs, which are mapped to `FeatureTag` values:

**binGenerator.ts:84-92** (origin collection)

```typescript
// Current: mesh the shape at low quality just to discover face origin IDs
function collectOrigins(shape: Shape3D, tag: FeatureTag, map: Map<number, number>): void {
  const m = mesh(shape, { tolerance: 5, angularTolerance: 45 });
  for (const fg of m.faceGroups) {
    const origin = (fg as { origin?: number }).origin;
    if (origin !== undefined && !map.has(origin)) {
      map.set(origin, tag);
    }
  }
}
```

This is called **6+ times** per generation (once per feature type: box, socket, lip, dividers, inserts, slots, label tabs, scoops, wall cutouts). Each call performs a full tessellation just to read metadata.

### Proposed: `tagFaces()` / `findFacesByTag()`

```typescript
import { tagFaces, findFacesByTag, getFaceTags } from 'brepjs';

// After: tag faces directly on the BREP solid (no tessellation needed)
const taggedBox = tagFaces(box, 'base');
const taggedSocket = tagFaces(base, 'socket');
const taggedLip = tagFaces(top, 'lip');

// After boolean operations, retrieve tags on the final solid
const baseFaces = findFacesByTag(bin, 'base');
const socketFaces = findFacesByTag(bin, 'socket');

// Or get all tags at once
const allTags: Map<number, string> = getFaceTags(bin);
```

### Considerations

- **Face tags may not survive boolean operations reliably.** OCCT boolean operations can split, merge, or create new faces. The `origin` tracking in `mesh()` output already handles this (it's computed by OCCT during meshing), but explicit `tagFaces()` relies on face identity persistence through booleans.
- Need to verify: does `tagFaces()` set metadata that survives `fuse()`/`cut()`/`cutAll()`? If OCCT tracks face provenance through booleans (which it does for the `origin` field), then tags should also persist.
- If tags DO survive booleans, this eliminates **6+ unnecessary low-quality mesh operations per generation** — a significant performance win.
- The mapping from string tags to `FeatureTag` enum values would need a conversion step at tessellation time.

### Risk: Medium

Tag persistence through booleans is the key uncertainty. Needs empirical testing with the actual geometry pipeline.

### Effort: Medium (3-4 hours)

Replace `collectOrigins()` with `tagFaces()` calls, update `toIndexedMeshData()` to read tags instead of origins.

---

## 6. Three.js Helpers (`toBufferGeometryData`)

### Current Pattern

Custom `toIndexedMeshData()` converts brepjs mesh output to the app's `MeshData` format:

**generatorTypes.ts:342-373**

```typescript
export function toIndexedMeshData(
  meshResult: { vertices; normals; triangles; faceGroups? },
  skipNormals,
  edgeVertices?,
  originToTag?
): MeshData {
  const faceGroups = meshResult.faceGroups?.map((g) => ({
    start: g.start,
    count: g.count,
    tag: (g.origin !== undefined ? originToTag?.get(g.origin) : undefined) ?? 255,
  }));

  const toFloat32Array = (data) => (data instanceof Float32Array ? data : new Float32Array(data));
  const toUint32Array = (data) => (data instanceof Uint32Array ? data : new Uint32Array(data));

  return {
    vertices: toFloat32Array(meshResult.vertices),
    normals: skipNormals ? new Float32Array(0) : toFloat32Array(meshResult.normals),
    indices: toUint32Array(meshResult.triangles),
    edgeVertices: edgeVertices ? toFloat32Array(edgeVertices) : new Float32Array(0),
    triangleCount: meshResult.triangles.length / 3,
    faceGroups,
  };
}
```

### Proposed: `toBufferGeometryData()` / `toGroupedBufferGeometryData()`

```typescript
import { toBufferGeometryData, toGroupedBufferGeometryData, toLineGeometryData } from 'brepjs';

// brepjs built-in: converts mesh directly to Three.js BufferGeometry format
const geoData = toBufferGeometryData(shapeMesh);
// geoData.position: Float32Array, geoData.normal: Float32Array, geoData.index: Uint32Array

// Grouped variant includes face material groups (for per-face coloring)
const groupedData = toGroupedBufferGeometryData(shapeMesh);
// groupedData.groups: { start, count, materialIndex }[]

// Edge lines
const lineData = toLineGeometryData(edgeMesh);
// lineData.position: Float32Array
```

### Considerations

- The custom `toIndexedMeshData()` does more than just format conversion — it also maps `origin` IDs to `FeatureTag` values via the `originToTag` map. The brepjs helper doesn't do this mapping.
- The custom function also has `skipNormals` logic for large bin previews (GPU flat shading) and `edgeVertices` bundling. These would need to remain as post-processing steps.
- `toGroupedBufferGeometryData()` uses `materialIndex` (integer) per group, which maps well to `FeatureTag` values — but the mapping logic would still need to happen.
- **Net assessment:** The brepjs helpers could replace the type conversion boilerplate (Float32Array/Uint32Array casting), but the app-specific logic (origin→tag mapping, skipNormals, edge bundling) would still need a wrapper. The savings are modest.

### Risk: Low

Format conversion is straightforward. Main risk is ensuring the output format matches what `GenerationBridge` and Three.js expect.

### Effort: Medium (2-3 hours)

Replace type casting with brepjs helpers, keep app-specific logic in a thin wrapper.

---

## 7. `withScope()` Memory Management

### Current Pattern

WASM memory management relies on manual `clone()` discipline and cache eviction:

**shapeCache.ts** (clone-on-read/write)

```typescript
// Every cache read returns a clone to prevent mutation of cached BREP
function getSocketCache(key: string): Shape3D | undefined {
  const cached = socketCache.get(key);
  return cached ? clone(cached) : undefined;
}
```

Intermediate shapes created during generation (e.g., sketch objects, temporary boolean results) are not explicitly freed — they rely on garbage collection of the JS wrapper, which eventually triggers WASM deallocation.

### Proposed: `withScope()`

```typescript
import { withScope, withScopeResult } from 'brepjs';

// Automatically frees intermediate WASM objects when scope exits
const result = withScope((scope) => {
  const base = buildBaseSocket(/*...*/); // scope tracks this
  const box = buildBinBox(/*...*/); // scope tracks this
  const top = buildTopShape(/*...*/); // scope tracks this
  const assembled = unwrap(fuse(base, box)); // scope tracks this
  const final = unwrap(fuse(assembled, top)); // scope tracks this

  // Only `final` escapes the scope; base, box, top, assembled are freed
  return final;
});
```

### Considerations

- brepjs shapes use `Symbol.dispose` (TC39 Explicit Resource Management). The project already polyfills this (`symbolDisposePolyfill.ts`), confirming that WASM objects need explicit lifecycle management.
- `withScope()` is most valuable in the generation pipeline where many intermediate solids are created: sketches → extrusions → booleans → final solid. Without scoping, all intermediates persist until GC runs (which may never happen in a long-running worker).
- The main risk is accidentally capturing a shape that should survive the scope (e.g., cached shapes). The scope would need to be applied at the right granularity — per-stage, not per-generation.
- `withScopeResult()` returns `Result<T>` which integrates with the existing error handling pattern.

### Risk: Low

`withScope()` is additive — it frees objects that would otherwise leak until GC. The main risk is premature disposal of shapes that are stored in caches.

### Effort: Medium (3-4 hours)

Wrap generation stages in `withScope()`, ensure cached shapes are excluded from scope tracking. Need to understand how `withScope` interacts with shapes stored in external data structures (caches).

---

## 8. `autoHeal()` for Boolean Reliability

### Current Pattern

The split connector builder has manual bounding-box validation to detect silent boolean failures:

**splitConnectorBuilder.ts:146-188**

```typescript
// Current: manual result validation after each boolean
function applyBooleans(piece, targets, op, expectedExtent) {
  let result = piece;
  for (const target of targets) {
    try {
      const candidate = unwrap(op(result, target));
      if (isResultValid(candidate, expectedExtent)) {
        result = candidate;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      // Boolean failed — skip this feature
    }
  }
  return result;
}

function isResultValid(shape, expectedExtent) {
  const bounds = getBounds(shape);
  const extent = [bounds.xMax - bounds.xMin, ...];
  for (let i = 0; i < 3; i++) {
    if (expectedExtent[i] > 1 && extent[i] < expectedExtent[i] * 0.8) {
      return false; // Shape shrank — OCCT returned garbage
    }
  }
  return true;
}
```

### Proposed: `autoHeal()` Post-Processing

```typescript
import { autoHeal } from 'brepjs';

// After problematic boolean operations, heal the result
function applyBooleans(piece, targets, op, expectedExtent) {
  let result = piece;
  for (const target of targets) {
    try {
      let candidate = unwrap(op(result, target));

      // Heal after each boolean to fix topology issues
      const healed = autoHeal(candidate, {
        fixWires: true,
        fixFaces: true,
        fixSolids: true,
      });
      if (isOk(healed)) {
        candidate = healed.value.shape;
        // healed.value.report describes what was fixed
      }

      if (isResultValid(candidate, expectedExtent)) {
        result = candidate;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
    }
  }
  return result;
}
```

### Considerations

- `autoHeal()` is computationally expensive. Running it after **every** boolean operation would significantly slow down generation.
- **Better approach:** Use `autoHeal()` as a **recovery strategy** — only when `isResultValid()` returns false, attempt healing before giving up.
- Could also apply `autoHeal()` once on the final solid before export, catching accumulated topology issues.
- The `HealingReport` returned by `autoHeal()` could be logged for debugging silent failures.

### Recommended Usage Pattern

```typescript
// Use healing as a fallback, not a default
let candidate = unwrap(op(result, target));
if (!isResultValid(candidate, expectedExtent)) {
  // Try healing before discarding
  const healed = autoHeal(candidate);
  if (isOk(healed) && isResultValid(healed.value.shape, expectedExtent)) {
    candidate = healed.value.shape;
  } else {
    continue; // Skip this feature
  }
}
```

### Risk: Medium

Healing modifies geometry — it may change dimensions or introduce unexpected topology. Need to validate that healed shapes still meet Gridfinity spec tolerances.

### Effort: Low (1-2 hours)

Add `autoHeal()` as a fallback in `applyBooleans()` and optionally before export.

---

## 9. 3MF Export (`exportThreeMF`)

### Current Pattern

Only STL and STEP export are supported:

**binGenerator.ts:127-162** (export)

```typescript
export type ExportFormat = 'stl' | 'step';

if (format === 'step') {
  const blob = unwrap(exportSTEP(solid));
  // ...
}
const blob = unwrap(exportSTL(solid, { tolerance, angularTolerance, binary: true }));
```

### Proposed: Add 3MF Export

```typescript
import { exportThreeMF, mesh } from 'brepjs';

// 3MF export from mesh data
export type ExportFormat = 'stl' | 'step' | '3mf';

if (format === '3mf') {
  const shapeMesh = mesh(solid, { tolerance, angularTolerance });
  const data = exportThreeMF(shapeMesh, {
    title: `gridfinity-${params.width}x${params.depth}x${params.height}`,
    // Optional: per-face colors from feature tags
  });
  return { data, fileName: `${name}.3mf` };
}
```

### Why 3MF?

- **3MF is the modern 3D printing format.** PrusaSlicer, Cura, BambuStudio, and OrcaSlicer all support it natively.
- Unlike STL, 3MF supports:
  - **Per-face colors** — feature-tagged faces (sockets, walls, inserts) could render in different colors in the slicer
  - **Multi-part assemblies** — split bin pieces could be exported as a single 3MF with multiple objects
  - **Build plate placement** — metadata for auto-orientation in slicers
  - **Exact geometry** — no tessellation artifacts like STL's triangle approximation
- **3MF is a ZIP archive** containing XML + mesh data. brepjs's `exportThreeMF()` returns an `ArrayBuffer`.

### Integration Points

1. Add `'3mf'` to `ExportFormat` type in `bridge/types.ts`
2. Add export handler in `binGenerator.ts:exportBin()`
3. Add UI option in the export dialog
4. For split exports: could bundle all pieces into a single 3MF (multi-object)

### Risk: Low

`exportThreeMF()` operates on mesh data (same as STL), just in a different container format. No BREP-level risk.

### Effort: Low (2-3 hours)

Add format option, wire up export handler, add UI button. The mesh → 3MF conversion is handled by brepjs.

---

## 10. Pattern APIs (`linearPattern` / `circularPattern` / `rectangularPattern`)

### Current Pattern

Grid cell iteration uses `forEachCell()` + `clone()` + `translate()`:

**socketBuilder.ts:169-187**

```typescript
// Current: manual grid iteration with clone+translate
const cellSockets: Shape3D[] = [];
forEachCell(gridW, gridD, (cell) => {
  const cellSocket = translate(
    forExport
      ? buildSingleCellSocket(cellW_mm, cellD_mm)
      : buildSimplifiedCellSocket(cellW_mm, cellD_mm),
    [cell.centerX, cell.centerY, 0]
  );
  cellSockets.push(cellSocket);
});
let result = unwrap(fuseAll(cellSockets, { optimisation: 'commonFace' }));
```

**binGenerator.ts:465-493** (wall patterns)

```typescript
// Current: template + composeTransforms + transformCopy loop
for (const wall of wallDescriptors) {
  for (const center of wall.centers) {
    const ops: TransformOp[] = [
      { type: 'translate', v: [center.x, center.y, -halfDepth] },
      { type: 'rotate', angle: 90, axis: [1, 0, 0] },
      // ... optional Z rotation ...
      { type: 'translate', v: [wall.translateX, wall.translateY, wall.translateZ] },
    ];
    const trsf = composeTransforms(ops);
    try {
      cutTargets.push(transformCopy(shapeTemplate, trsf));
    } finally {
      trsf.cleanup();
    }
  }
}
```

### Proposed: `rectangularPattern()` / `linearPattern()`

```typescript
import { rectangularPattern, linearPattern } from 'brepjs';

// For socket grid: rectangular pattern
const socketCell = buildSingleCellSocket(cellW_mm, cellD_mm);
const socketGrid = unwrap(
  rectangularPattern(socketCell, {
    xDir: [1, 0, 0],
    xCount: Math.floor(gridW),
    xSpacing: SIZE,
    yDir: [0, 1, 0],
    yCount: Math.floor(gridD),
    ySpacing: SIZE,
  })
);

// For wall patterns: linear pattern along wall
const cutouts = unwrap(linearPattern(shapeTemplate, wallDir, count, spacing));
```

### Considerations

- **Half-bin mode breaks the pattern:** When `gridW=1.5`, the grid decomposes to `[1.0, 0.5]` units — different cell sizes that can't be expressed as a single rectangular pattern. The `forEachCell()` approach handles heterogeneous cell sizes; `rectangularPattern()` requires uniform spacing and identical shapes.
- **Wall patterns are already optimized** with `composeTransforms()` + `transformCopy()` (avoiding N separate BREP constructions). `linearPattern()` might be cleaner but is functionally equivalent.
- The pattern APIs return a **fused compound** (all copies already unioned), which is what the codebase does anyway via `fuseAll()`.

### Applicability Assessment

| Use Case                   | Fits Pattern API? | Why / Why Not                                                    |
| -------------------------- | :---------------: | ---------------------------------------------------------------- |
| Socket grid (integer dims) |        Yes        | Uniform cells, regular spacing                                   |
| Socket grid (fractional)   |        No         | Mixed cell sizes (1.0 + 0.5)                                     |
| Magnet holes (4 per cell)  |        No         | Irregular positions (±13mm offsets)                              |
| Wall hex patterns          |     Partially     | Regular within one wall, but 4 walls with different orientations |
| Slot cutters               |        No         | Mirrored pairs at variable positions                             |

### Risk: Medium

Pattern APIs are higher-level and may not handle all the edge cases (fractional grids, irregular positions). Would require maintaining both paths (pattern for simple cases, manual for complex).

### Effort: High (4-6 hours)

Limited applicability due to half-bin mode and irregular geometries. Best saved for last.

---

## Additional Opportunities (Lower Priority)

### A. `chamfer()` — Edge Beveling

Currently unused. Could complement `fillet()` for features like the connector prism tapers (currently done via loft). However, the loft approach gives more control over the taper profile.

### B. `section()` / `sectionToFace()` — Cross-Sections

Could be used for debugging/visualization: show cross-section views of bins to verify wall thickness, feature placement, etc. Not a code simplification but a potential feature addition.

### C. Assembly API (`createAssemblyNode`)

Could enable multi-part STEP export where split bin pieces are individual parts in an assembly. Currently each piece is exported as a separate STL file.

### D. `importSTEP()` / `importSTL()` — Geometry Import

Could allow users to import custom bin inserts or accessories. Major new feature, not a simplification.

### E. `drawText()` — Text Geometry

Could enable embossed/engraved text labels on bins. Currently labels are 2D only (print CSS).

### F. 2D Boolean Operations (`fuse2D`, `cut2D`)

The stacking lip profile already uses 2D Drawing operations (`.intersect()`, `.cut()`). These are the Drawing class methods, not the standalone `fuse2D()`/`cut2D()` functions. The Drawing methods are already the right abstraction here.

### G. `colorFaces()` / `colorShape()` — BREP Coloring

Could embed colors directly in STEP exports so CAD tools show feature-colored models. Currently only the web preview has coloring (via FeatureTags → Three.js materials).

### H. `exportGlb()` — glTF Binary Export

Could enable AR/3D web viewing of bins without Three.js. Lower priority than 3MF.

---

## Implementation Roadmap

### Phase 1: Quick Wins (P0) — ~1 day

1. **3MF export** — Add `exportThreeMF` format option (highest user value)
2. **`cylinder()` primitive** — Replace `drawCircle().sketchOnPlane().extrude()` for hole templates
3. **`box()` primitive** — Replace `drawRectangle().sketchOnPlane().extrude()` for simple boxes

### Phase 2: Code Simplification (P1) — ~2 days

4. **`mirrorJoin()`** — Simplify slot builder mirrored cutter creation
5. **Face tagging** — Replace `collectOrigins()` with `tagFaces()` (if tags survive booleans — needs testing)
6. **`split()`/`slice()`** — Investigate replacing manual cutting-box intersection (needs careful testing)

### Phase 3: Infrastructure (P2) — ~2 days

7. **`autoHeal()` fallback** — Add healing as recovery strategy in `splitConnectorBuilder`
8. **`withScope()`** — Wrap generation stages for explicit WASM memory management
9. **Three.js helpers** — Evaluate `toBufferGeometryData()` as replacement for custom conversion

### Phase 4: Exploration (P3) — ~1 day

10. **Pattern APIs** — Test `rectangularPattern()` for integer-dimension socket grids

---

## Testing Strategy

Each change should be validated with:

1. **Unit tests:** Run `npm run test:run -- src/features/generation/`
2. **Scenario tests:** Run `npm run test:run -- src/features/generation/worker/generators/binGenerator.scenario`
3. **Visual regression:** Generate bins with various configurations and compare meshes
4. **Export validation:** Import exported STL/STEP/3MF in a slicer and verify geometry
5. **Performance:** Compare generation times before/after (especially for face tagging and pattern changes)

Key test configurations to verify:

- Integer dimensions (2×3×3) — standard case
- Fractional dimensions (1.5×2.5×2) — half-bin mode
- All base styles (flat, socket, magnet, screw, magnet_and_screw)
- With/without stacking lip
- With/without compartment walls, inserts, slots
- Split bins (2×2, 3×3 cuts)
- Large bins (6×4) — performance sensitive
