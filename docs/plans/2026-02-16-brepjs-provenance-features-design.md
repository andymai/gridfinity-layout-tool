# brepjs 8.3.0 Provenance-Powered Features

**Date:** 2026-02-16
**Status:** Draft
**Depends on:** brepjs 8.2.0 (`applyMatrix`), brepjs 8.3.0 (face origin provenance)

## Summary

Leverage brepjs 8.3.0's face origin provenance tracking and 8.2.0's `applyMatrix` to add:

1. **Feature-colored 3D preview** — faces colored by feature type (base, scoop, label tab, etc.)
2. **Multi-color 3MF export** — per-feature colors in 3MF for multi-material slicer support
3. **Interactive face inspection** — hover/click to see which feature created a face
4. **Performance: matrix-based instancing** — `applyMatrix` for cleaner socket/pattern transforms

## brepjs API Surface

### Face Provenance (8.3.0)

`mesh()` returns `ShapeMesh` with `faceGroups`:

```typescript
faceGroups: {
  start: number; // index offset into triangles array
  count: number; // number of indices in this group
  faceId: number; // stable topological face ID
  origin: number; // operation that created this face (NEW in 8.3.0)
}
[];
```

The `origin` field is a numeric ID corresponding to the boolean/modeling operation that produced the face. Faces created by the same operation share the same `origin`.

### applyMatrix (8.2.0)

```typescript
function applyMatrix<T extends AnyShape>(shape: Shapeable<T>, matrix: MatrixInput): T;

type MatrixInput = Matrix4x4 | MatrixTransform;
type Matrix4x4 = [[n, n, n, n], [n, n, n, n], [n, n, n, n], [n, n, n, n]]; // row-major
```

Uses fast `gp_Trsf` for orthogonal matrices, general `gp_GTrsf` for non-orthogonal (shear, non-uniform scale).

### Three.js Helpers

brepjs already provides `GroupedBufferGeometryData` with `BufferGeometryGroup` containing `faceId` and `materialIndex` — designed for `THREE.BufferGeometry.addGroup()`.

## Design

### Feature Tag System

Define a stable enum of feature types used across preview and export:

```typescript
// src/features/generation/worker/generators/featureTags.ts
export const FeatureTag = {
  BASE: 0, // box floor + outer walls
  SHELL: 1, // shelled interior
  SCOOP: 2, // front scoop ramp
  LABEL_TAB: 3, // label tab solid + bracket
  SOCKET: 4, // gridfinity socket/magnet hole
  LIP: 5, // stacking lip
  WALL_CUTOUT: 6, // wall pattern cutouts
  DIVIDER: 7, // internal dividers
  SLOT: 8, // card/divider slots
  INSERT: 9, // custom inserts
  UNKNOWN: 255,
} as const;
export type FeatureTag = (typeof FeatureTag)[keyof typeof FeatureTag];
```

### Mapping origin → FeatureTag

During `generateBin()`, each modeling step is sequential and deterministic. We build an `originMap: Map<number, FeatureTag>` by recording the `origin` values from the shapes _before and after_ each boolean operation:

**Approach A (recommended): Incremental tracking.** After each major step (box, shell, scoop, etc.), mesh the intermediate shape, collect new `origin` values, and tag them. This is expensive in debug/dev builds but precise.

**Approach B: Post-hoc heuristic.** After final mesh, classify faces by geometry (normals, Z-position, bounding box) into feature types. Fragile but zero overhead in the generation pipeline.

**Approach C: Dual-solid tagging.** Before each boolean, tag the tool shape's faces. After the boolean, faces derived from the tool inherit the tag via `origin`. This is the most natural fit if brepjs's `origin` propagates through booleans — needs verification.

**Recommendation:** Start with Approach C. If `origin` propagation is insufficient, fall back to A.

### Worker Bridge Changes

Extend `MeshResultResponse` to include face group data:

```typescript
// bridge/types.ts
export interface MeshResultResponse {
  readonly type: 'MESH_RESULT';
  readonly requestId: string;
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
  readonly timingMs: number;
  // NEW
  readonly faceGroups?: readonly FaceGroupData[];
}

export interface FaceGroupData {
  readonly start: number;
  readonly count: number;
  readonly tag: number; // FeatureTag
}
```

`faceGroups` is optional — omitted when feature coloring is disabled (zero overhead).

### 3D Preview Coloring

In the Three.js preview component:

1. Create a `BufferGeometry` with indexed vertices (current approach)
2. When `faceGroups` is present, call `geometry.addGroup(start, count, materialIndex)` for each group
3. Create a material array: `[baseMat, shellMat, scoopMat, ...]` mapped by `FeatureTag`
4. Use `THREE.Mesh(geometry, materialArray)`
5. Toggle via user setting in `settings.ts` (default: off)

Color palette (accessible, colorblind-friendly):

| Feature     | Color  | Hex       |
| ----------- | ------ | --------- |
| Base        | Gray   | `#9CA3AF` |
| Shell       | Slate  | `#64748B` |
| Scoop       | Blue   | `#3B82F6` |
| Label Tab   | Green  | `#22C55E` |
| Socket      | Orange | `#F97316` |
| Lip         | Purple | `#A855F7` |
| Wall Cutout | Red    | `#EF4444` |
| Divider     | Teal   | `#14B8A6` |
| Slot        | Yellow | `#EAB308` |
| Insert      | Pink   | `#EC4899` |

### Interactive Face Inspection

On hover over the 3D preview:

1. Raycast to find the intersected triangle index
2. Look up which `faceGroup` contains that index
3. Show a tooltip: "Scoop" / "Label Tab" / etc.

On click: highlight all faces in that group (set emissive or outline).

This is a separate, lower-priority feature — can ship preview coloring first.

### Multi-Color 3MF Export

Extend `buildModelXML()` in `threemfExporter.ts`:

1. Add `<basematerials id="1">` resource with one `<base>` per feature color
2. On each `<triangle>`, add `pid="1" p1="<materialIndex>"` attribute
3. The `faceGroups` from the worker provide the triangle-to-tag mapping

```xml
<basematerials id="1">
  <base name="Base" displaycolor="#9CA3AF" />
  <base name="Scoop" displaycolor="#3B82F6" />
  ...
</basematerials>
...
<triangle v1="0" v2="1" v3="2" pid="1" p1="2" />
```

PrusaSlicer, OrcaSlicer, and Bambu Studio all support this — each color becomes a separate filament assignment.

New option:

```typescript
export interface ThreeMFOptions {
  // existing...
  readonly featureColors?: boolean; // default: false
}
```

### Performance: applyMatrix for Socket/Pattern Instancing

Replace the `composeTransforms` + `transformCopy` pattern in `binGenerator.ts:424-446` with direct `applyMatrix` calls where transforms are pure translations (sockets, simple patterns):

```typescript
// Before
const trsf = composeTransforms(ops);
try {
  cutTargets.push(transformCopy(shapeTemplate, trsf));
} finally {
  trsf.cleanup();
}

// After (for translation-only cases)
cutTargets.push(
  applyMatrix(clone(shapeTemplate), [
    [1, 0, 0, tx],
    [0, 1, 0, ty],
    [0, 0, 1, tz],
    [0, 0, 0, 1],
  ])
);
```

**Benefit:** Eliminates the `ComposedTransform` lifecycle (`cleanup()` call). Simpler code for translation-only cases.

**Keep `composeTransforms`** for the rotation+translation combos (wall cutout patterns) where it's already clean.

## Scope & Priority

| Feature                  | Priority | Effort | Depends On      |
| ------------------------ | -------- | ------ | --------------- |
| Feature tag system       | P0       | S      | —               |
| Worker bridge faceGroups | P0       | S      | Tag system      |
| Feature-colored preview  | P1       | M      | Bridge changes  |
| Multi-color 3MF          | P1       | M      | Bridge changes  |
| Interactive face inspect | P2       | M      | Colored preview |
| Printability hinting     | P3       | L      | Face inspection |
| applyMatrix instancing   | P2       | S      | —               |

## Out of Scope

- Selective feature export (separate STL per feature) — future work
- Face coloring in STL export (STL has no material support)
- STEP export coloring (STEP supports it but complex — future work)

## Testing Strategy

- **Unit:** Verify `originMap` tagging produces correct `FeatureTag` for each face group using existing scenario test fixtures
- **Snapshot:** Extend `binGenerator.scenario.snapshots.test.ts` to assert faceGroup counts and tags
- **3MF:** Extend `threemfExporter.test.ts` to verify `<basematerials>` and `pid`/`p1` attributes in output XML
- **Visual:** Manual verification in PrusaSlicer/OrcaSlicer for 3MF color correctness
