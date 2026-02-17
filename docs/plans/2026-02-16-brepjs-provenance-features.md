# brepjs Provenance Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add feature-colored 3D preview, multi-color 3MF export, and `applyMatrix` cleanup using brepjs 8.3.0's face origin provenance tracking.

**Architecture:** The generation worker tags each modeling step with a `FeatureTag`. After meshing, `faceGroups[].origin` values are mapped to tags and sent through the worker bridge as `FaceGroupData[]`. The bin-designer preview uses `BufferGeometry.addGroup()` with a material array for per-feature coloring. The 3MF exporter emits `<basematerials>` with per-triangle `pid`/`p1` attributes.

**Tech Stack:** brepjs 8.3.0 (face provenance, `applyMatrix`), Three.js (multi-material mesh), 3MF spec (basematerials extension), Zustand (settings toggle)

**Design doc:** `docs/plans/2026-02-16-brepjs-provenance-features-design.md`

---

### Task 1: Feature Tag System

**Files:**

- Create: `src/features/generation/worker/generators/featureTags.ts`
- Test: `src/features/generation/worker/generators/featureTags.test.ts`

**Step 1: Write the test**

```typescript
// featureTags.test.ts
import { describe, it, expect } from 'vitest';
import { FeatureTag, featureTagName, FEATURE_TAG_COLORS } from './featureTags';

describe('featureTags', () => {
  it('assigns unique numeric values to each tag', () => {
    const values = Object.values(FeatureTag).filter((v) => typeof v === 'number');
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('featureTagName returns human-readable name for known tags', () => {
    expect(featureTagName(FeatureTag.SCOOP)).toBe('Scoop');
    expect(featureTagName(FeatureTag.BASE)).toBe('Base');
  });

  it('featureTagName returns "Unknown" for unrecognized tags', () => {
    expect(featureTagName(254 as number)).toBe('Unknown');
  });

  it('FEATURE_TAG_COLORS has an entry for every tag', () => {
    for (const value of Object.values(FeatureTag)) {
      if (typeof value === 'number') {
        expect(FEATURE_TAG_COLORS[value]).toBeDefined();
      }
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/generation/worker/generators/featureTags.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// featureTags.ts
/**
 * Feature tags for face provenance tracking.
 *
 * Each tag identifies the modeling step that created a face.
 * Used for feature-colored preview and multi-color 3MF export.
 */
export const FeatureTag = {
  BASE: 0,
  SHELL: 1,
  SCOOP: 2,
  LABEL_TAB: 3,
  SOCKET: 4,
  LIP: 5,
  WALL_CUTOUT: 6,
  DIVIDER: 7,
  SLOT: 8,
  INSERT: 9,
  CUTOUT: 10,
  UNKNOWN: 255,
} as const;

export type FeatureTag = (typeof FeatureTag)[keyof typeof FeatureTag];

const TAG_NAMES: Record<number, string> = {
  [FeatureTag.BASE]: 'Base',
  [FeatureTag.SHELL]: 'Shell',
  [FeatureTag.SCOOP]: 'Scoop',
  [FeatureTag.LABEL_TAB]: 'Label Tab',
  [FeatureTag.SOCKET]: 'Socket',
  [FeatureTag.LIP]: 'Lip',
  [FeatureTag.WALL_CUTOUT]: 'Wall Cutout',
  [FeatureTag.DIVIDER]: 'Divider',
  [FeatureTag.SLOT]: 'Slot',
  [FeatureTag.INSERT]: 'Insert',
  [FeatureTag.CUTOUT]: 'Cutout',
  [FeatureTag.UNKNOWN]: 'Unknown',
};

/** Human-readable name for a feature tag. */
export function featureTagName(tag: number): string {
  return TAG_NAMES[tag] ?? 'Unknown';
}

/**
 * Colors for feature tags (accessible, colorblind-friendly palette).
 * Hex strings for use in Three.js materials and 3MF export.
 */
export const FEATURE_TAG_COLORS: Record<number, string> = {
  [FeatureTag.BASE]: '#9CA3AF',
  [FeatureTag.SHELL]: '#64748B',
  [FeatureTag.SCOOP]: '#3B82F6',
  [FeatureTag.LABEL_TAB]: '#22C55E',
  [FeatureTag.SOCKET]: '#F97316',
  [FeatureTag.LIP]: '#A855F7',
  [FeatureTag.WALL_CUTOUT]: '#EF4444',
  [FeatureTag.DIVIDER]: '#14B8A6',
  [FeatureTag.SLOT]: '#EAB308',
  [FeatureTag.INSERT]: '#EC4899',
  [FeatureTag.CUTOUT]: '#F59E0B',
  [FeatureTag.UNKNOWN]: '#6B7280',
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/generation/worker/generators/featureTags.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/generation/worker/generators/featureTags.ts src/features/generation/worker/generators/featureTags.test.ts
git commit -m "feat(generation): add FeatureTag system for face provenance tracking"
```

---

### Task 2: Extend Worker Bridge Types with FaceGroupData

**Files:**

- Modify: `src/features/generation/bridge/types.ts`
- Test: `src/features/generation/bridge/GenerationBridge.test.ts` (existing, add assertion)

**Step 1: Write the failing test**

Add a test case to the existing bridge test that asserts `MeshResultResponse` accepts `faceGroups`:

```typescript
it('MeshResultResponse supports optional faceGroups', () => {
  const response: MeshResultResponse = {
    type: 'MESH_RESULT',
    requestId: 'test',
    vertices: new Float32Array(0),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
    edgeVertices: new Float32Array(0),
    triangleCount: 0,
    timingMs: 10,
    faceGroups: [{ start: 0, count: 3, tag: 0 }],
  };
  expect(response.faceGroups).toHaveLength(1);
  expect(response.faceGroups![0].tag).toBe(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/generation/bridge/GenerationBridge.test.ts`
Expected: FAIL — `faceGroups` not assignable

**Step 3: Add types to bridge**

In `src/features/generation/bridge/types.ts`, add:

```typescript
/** Per-face-group feature tag for provenance-based coloring. */
export interface FaceGroupData {
  /** Starting index offset into the triangles/indices array. */
  readonly start: number;
  /** Number of indices in this group. */
  readonly count: number;
  /** FeatureTag identifying the modeling step that created these faces. */
  readonly tag: number;
}
```

And add to `MeshResultResponse`:

```typescript
export interface MeshResultResponse {
  // ... existing fields ...
  /** Optional per-face feature groups for provenance-based coloring. */
  readonly faceGroups?: readonly FaceGroupData[];
}
```

Also add to `MeshData`:

```typescript
export interface MeshData {
  // ... existing fields ...
  readonly faceGroups?: readonly FaceGroupData[];
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/generation/bridge/GenerationBridge.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/generation/bridge/types.ts src/features/generation/bridge/GenerationBridge.test.ts
git commit -m "feat(bridge): add FaceGroupData type to worker bridge protocol"
```

---

### Task 3: Provenance Origin Mapping in generateBin

This is the core task: after meshing, map `shapeMesh.faceGroups[].origin` to `FeatureTag` values.

**Files:**

- Modify: `src/features/generation/worker/generators/binGenerator.ts` (lines 537-545: mesh + return)
- Modify: `src/features/generation/worker/generators/generatorTypes.ts` (`toIndexedMeshData`)
- Test: `src/features/generation/worker/generators/binGenerator.scenario.integration.test.ts` (add provenance test)

**Step 1: Write the failing test**

Add to `binGenerator.scenario.integration.test.ts`:

```typescript
it('generateBin returns faceGroups with provenance tags', () => {
  const result = generateBin(defaultParams, undefined, false);
  expect(result.faceGroups).toBeDefined();
  expect(result.faceGroups!.length).toBeGreaterThan(0);
  // Each group should have valid start, count, and a known tag
  for (const group of result.faceGroups!) {
    expect(group.start).toBeGreaterThanOrEqual(0);
    expect(group.count).toBeGreaterThan(0);
    expect(group.tag).toBeGreaterThanOrEqual(0);
  }
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/generation/worker/generators/binGenerator.scenario.integration.test.ts`
Expected: FAIL — `faceGroups` undefined

**Step 3: Implement provenance mapping**

The approach: brepjs `mesh()` already returns `faceGroups` with `origin` values. Each origin is an integer identifying the OCCT face's topological lineage. We don't need to do incremental tagging — we can use a simpler approach:

**Strategy:** Track which `origin` values existed at key checkpoints during generation. After each boolean op, new origins that weren't present before belong to that feature.

In `binGenerator.ts`, modify the mesh + return section (around line 537):

1. After `const shapeMesh = mesh(bin, { tolerance, angularTolerance });`, read `shapeMesh.faceGroups`.
2. Map each `faceGroup.origin` → `FeatureTag.UNKNOWN` as default (since we need to verify origin propagation behavior first).
3. Pass faceGroups through `toIndexedMeshData`.

For the initial implementation, pass through the raw face groups with `UNKNOWN` tags. This proves the plumbing works end-to-end. Task 4 will add the actual origin-to-tag mapping.

Modify `toIndexedMeshData` in `generatorTypes.ts` to accept and pass through faceGroups:

```typescript
export function toIndexedMeshData(
  meshResult: {
    vertices: ArrayLike<number>;
    normals: ArrayLike<number>;
    triangles: ArrayLike<number>;
    faceGroups?: ReadonlyArray<{ start: number; count: number; faceId: number; origin: number }>;
  },
  skipNormals = false,
  edgeVertices?: ArrayLike<number>,
  originToTag?: Map<number, number>
): MeshData {
  const faceGroups = meshResult.faceGroups?.map((g) => ({
    start: g.start,
    count: g.count,
    tag: originToTag?.get(g.origin) ?? 255, // FeatureTag.UNKNOWN
  }));

  return {
    // ... existing fields unchanged ...
    faceGroups,
  };
}
```

In `binGenerator.ts` at line 545, change:

```typescript
return toIndexedMeshData(shapeMesh, !useHighQuality, edgeVertices);
```

to:

```typescript
return toIndexedMeshData(shapeMesh, !useHighQuality, edgeVertices, undefined);
```

This threads faceGroups through with all-UNKNOWN tags. We prove the plumbing works.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/generation/worker/generators/binGenerator.scenario.integration.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/generation/worker/generators/binGenerator.ts src/features/generation/worker/generators/generatorTypes.ts src/features/generation/worker/generators/binGenerator.scenario.integration.test.ts
git commit -m "feat(generation): thread faceGroups through mesh pipeline"
```

---

### Task 4: Origin-to-FeatureTag Mapping

Build the actual `originToTag` map by tracking origins through the generation pipeline.

**Files:**

- Modify: `src/features/generation/worker/generators/binGenerator.ts`
- Test: `src/features/generation/worker/generators/binGenerator.scenario.integration.test.ts`

**Step 1: Write the failing test**

```typescript
it('faceGroups include non-UNKNOWN tags for a bin with features', () => {
  const paramsWithFeatures = {
    ...defaultParams,
    scoop: { enabled: true, radius: 5, grouped: false },
    label: { enabled: true, style: 'solid', depth: 10, angle: 45, count: 'per-compartment' },
  };
  const result = generateBin(paramsWithFeatures, undefined, false);
  const tags = new Set(result.faceGroups!.map((g) => g.tag));
  // Should have at least BASE and not be all UNKNOWN
  expect(tags.has(255)).toBe(false); // No UNKNOWN if mapping works
  expect(tags.size).toBeGreaterThan(1); // Multiple feature types
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL — all tags are 255 (UNKNOWN)

**Step 3: Implement origin tracking**

The key insight: `mesh()` returns `faceGroups[].origin` where `origin` is a hash of the OCCT face's topological history. Faces from the same original shape share origins. After a `fuse(base, socket)`, faces from the socket retain their original origins, and faces from the base retain theirs.

**Implementation approach:** After building each component (socket, box, lip) but before fusing, mesh the component to collect its origin values. Store these in a `Map<number, FeatureTag>`. After final assembly, the origin values persist through boolean operations.

Add a helper to `binGenerator.ts`:

```typescript
import { FeatureTag } from './featureTags';

/** Collect face origins from a shape and tag them. */
function collectOrigins(shape: Shape3D, tag: FeatureTag, map: Map<number, number>): void {
  // Quick low-fidelity mesh just to read face origins
  const m = mesh(shape, { tolerance: 5, angularTolerance: 45 });
  for (const fg of m.faceGroups) {
    if (!map.has(fg.origin)) {
      map.set(fg.origin, tag);
    }
  }
}
```

Insert `collectOrigins` calls at strategic points in `generateBin`:

- After `buildBaseSocket()` → `FeatureTag.SOCKET`
- After `buildBinBox()` → `FeatureTag.BASE`
- After `buildTopShape()` → `FeatureTag.LIP`
- After `buildCompartmentWalls()` → `FeatureTag.DIVIDER`
- After `buildLabelTabs()` → `FeatureTag.LABEL_TAB`
- After `buildScoopRamps()` → `FeatureTag.SCOOP`
- After `buildWallCutoutCuts()` → `FeatureTag.WALL_CUTOUT`
- After `buildInsertCuts()` → `FeatureTag.INSERT`
- After `buildSlotCuts()` → `FeatureTag.SLOT`
- After `buildCutoutCuts()` → `FeatureTag.CUTOUT`

Then pass the map to `toIndexedMeshData`:

```typescript
return toIndexedMeshData(shapeMesh, !useHighQuality, edgeVertices, originToTag);
```

**Important:** The `collectOrigins` calls use coarse tessellation (tolerance=5, angular=45) so they're very cheap — just reading the face topology, not producing visual-quality meshes.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/generation/worker/generators/binGenerator.scenario.integration.test.ts`
Expected: PASS

**Step 5: Run full scenario tests to ensure no regressions**

Run: `npx vitest run src/features/generation/worker/generators/binGenerator.scenario`
Expected: All passing

**Step 6: Commit**

```bash
git add src/features/generation/worker/generators/binGenerator.ts src/features/generation/worker/generators/binGenerator.scenario.integration.test.ts
git commit -m "feat(generation): map face origins to FeatureTag via collectOrigins"
```

---

### Task 5: Worker Bridge — Pass faceGroups Through

**Files:**

- Modify: `src/features/generation/worker/generation.worker.ts` (line 162-180: response + transfer)
- Modify: `src/features/generation/bridge/GenerationBridge.ts` (line 392-407: MESH_RESULT handler)

**Step 1: Modify worker to include faceGroups in MESH_RESULT**

In `generation.worker.ts`, around line 162, update the response construction:

```typescript
const response: WorkerResponse = {
  type: 'MESH_RESULT',
  requestId,
  vertices: meshData.vertices,
  normals: meshData.normals,
  indices: meshData.indices,
  edgeVertices: meshData.edgeVertices,
  triangleCount: meshData.triangleCount,
  timingMs,
  faceGroups: meshData.faceGroups,
};
```

No transfer change needed — `faceGroups` is a plain array of objects (not a TypedArray), so it's structured-cloned automatically.

**Step 2: Modify bridge to forward faceGroups in GenerationResult**

In `GenerationBridge.ts`, around line 397, update the resolve:

```typescript
resolve({
  mesh: {
    vertices: response.vertices,
    normals: response.normals,
    indices: response.indices,
    edgeVertices: response.edgeVertices,
    triangleCount: response.triangleCount,
    faceGroups: response.faceGroups,
  },
  timingMs: response.timingMs,
});
```

**Step 3: Run the bridge tests**

Run: `npx vitest run src/features/generation/bridge/GenerationBridge.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/generation/worker/generation.worker.ts src/features/generation/bridge/GenerationBridge.ts
git commit -m "feat(bridge): forward faceGroups through worker bridge"
```

---

### Task 6: Settings Toggle for Feature Coloring

**Files:**

- Modify: `src/core/store/settings.ts` (add `featureColorPreview` to `UserSettings`)
- Modify: `src/i18n/locales/en.ts` (add label)

**Step 1: Add setting**

In `src/core/store/settings.ts`, add to `UserSettings` interface:

```typescript
/**
 * Show feature-colored preview in the bin designer.
 * Colors faces by their modeling step (scoop, label tab, etc.).
 */
featureColorPreview: boolean;
```

Add to `DEFAULT_SETTINGS`:

```typescript
featureColorPreview: false,
```

**Step 2: Add i18n key**

In `src/i18n/locales/en.ts`, add under the appropriate section:

```typescript
'settings.featureColorPreview': 'Feature-colored preview',
'settings.featureColorPreviewDescription': 'Color bin faces by feature type in the 3D preview',
```

**Step 3: Run typecheck**

Run: `node node_modules/typescript/bin/tsc -b --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/store/settings.ts src/i18n/locales/en.ts
git commit -m "feat(settings): add featureColorPreview toggle"
```

---

### Task 7: Feature-Colored BinMesh in Bin Designer

**Files:**

- Modify: `src/features/bin-designer/components/preview/BinMesh/BinMesh.tsx`
- Modify: `src/features/bin-designer/components/preview/BinMesh/BinMesh.test.tsx`

**Step 1: Write the failing test**

```typescript
it('applies multi-material groups when faceGroups are present and featureColorPreview is enabled', () => {
  // Mock mesh data with faceGroups
  // Mock settings with featureColorPreview: true
  // Assert geometry.groups is populated
  // Assert materials array has multiple entries
});
```

Exact test structure depends on how the existing test mocks the designer store. Follow the existing pattern in `BinMesh.test.tsx`.

**Step 2: Implement multi-material rendering**

In `BinMesh.tsx`, when `faceGroups` is present and `featureColorPreview` setting is enabled:

1. Import `FEATURE_TAG_COLORS` from `featureTags.ts`
2. Import `useSettingsStore` for the toggle
3. In the geometry `useMemo`, after setting position/indices/normals, add groups:

```typescript
if (faceGroups && featureColorPreview) {
  for (const group of faceGroups) {
    geo.addGroup(group.start, group.count, group.tag);
  }
}
```

4. Create material array:

```typescript
const materials = useMemo(() => {
  if (!featureColorPreview || !faceGroups) return null;
  // Build sparse material array indexed by tag
  const maxTag = Math.max(...faceGroups.map((g) => g.tag));
  const mats: THREE.Material[] = [];
  for (let i = 0; i <= maxTag; i++) {
    const hex = FEATURE_TAG_COLORS[i] ?? FEATURE_TAG_COLORS[255];
    mats.push(
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.45,
        metalness: 0,
        side: THREE.DoubleSide,
        flatShading: !hasPrecomputedNormals,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
    );
  }
  return mats;
}, [faceGroups, featureColorPreview, hasPrecomputedNormals]);
```

5. In JSX, conditionally use material array:

```tsx
<mesh geometry={geometry} material={materials ?? undefined} position={[0, 0, 0.1]}>
  {!materials && (
    <meshStandardMaterial color={color} ... />
  )}
</mesh>
```

**Step 3: Run tests**

Run: `npx vitest run src/features/bin-designer/components/preview/BinMesh/BinMesh.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/bin-designer/components/preview/BinMesh/BinMesh.tsx src/features/bin-designer/components/preview/BinMesh/BinMesh.test.tsx
git commit -m "feat(preview): feature-colored bin mesh with per-face materials"
```

---

### Task 8: Multi-Color 3MF Export

**Files:**

- Modify: `src/features/generation/export/threemfExporter.ts`
- Modify: `src/features/generation/export/threemfExporter.test.ts`

**Step 1: Write the failing test**

```typescript
describe('multi-color 3MF', () => {
  it('includes basematerials and per-triangle pid when featureColors is true', () => {
    const vertices = new Float32Array([
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1,
      0, // triangle 1
      1,
      0,
      0,
      1,
      1,
      0,
      0,
      1,
      0, // triangle 2
    ]);
    const normals = new Float32Array(vertices.length);
    const faceGroups = [
      { start: 0, count: 3, tag: 0 }, // BASE
      { start: 3, count: 3, tag: 2 }, // SCOOP
    ];

    const buffer = build3MFBuffer(vertices, normals, {
      name: 'test',
      featureColors: true,
      faceGroups,
    });

    // Decompress and check XML
    const zip = unzipSync(buffer);
    const model = strFromU8(zip['3D/3dmodel.model']);
    expect(model).toContain('<basematerials');
    expect(model).toContain('displaycolor="#9CA3AF"'); // BASE color
    expect(model).toContain('displaycolor="#3B82F6"'); // SCOOP color
    expect(model).toContain('pid="1"');
    expect(model).toContain('p1=');
  });

  it('omits basematerials when featureColors is false', () => {
    const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const normals = new Float32Array(vertices.length);

    const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
    const zip = unzipSync(buffer);
    const model = strFromU8(zip['3D/3dmodel.model']);
    expect(model).not.toContain('<basematerials');
  });
});
```

Note: `unzipSync` and `strFromU8` from `fflate` (already a dependency).

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/generation/export/threemfExporter.test.ts`
Expected: FAIL — `featureColors` not a valid option

**Step 3: Implement multi-color 3MF**

Extend `ThreeMFOptions`:

```typescript
export interface ThreeMFOptions {
  // ... existing ...
  /** Enable per-feature face coloring via 3MF basematerials. */
  readonly featureColors?: boolean;
  /** Face group data from generation (required when featureColors is true). */
  readonly faceGroups?: readonly FaceGroupData[];
}
```

Import `FaceGroupData` from bridge types and `FEATURE_TAG_COLORS`, `featureTagName` from featureTags.

In `buildModelXML`, after the `<resources>` opening tag and before the `<object>`, conditionally emit basematerials:

```typescript
if (options.featureColors && options.faceGroups?.length) {
  // Collect unique tags
  const uniqueTags = [...new Set(options.faceGroups.map((g) => g.tag))].sort((a, b) => a - b);
  const tagToMatIndex = new Map<number, number>();

  xml += '    <basematerials id="1">\n';
  uniqueTags.forEach((tag, index) => {
    tagToMatIndex.set(tag, index);
    const color = FEATURE_TAG_COLORS[tag] ?? FEATURE_TAG_COLORS[255];
    const name = featureTagName(tag);
    xml += `      <base name="${escapeXml(name)}" displaycolor="${color}" />\n`;
  });
  xml += '    </basematerials>\n';

  // Build triangle-to-tag lookup
  // ... (see below)
}
```

For triangles, build a lookup from triangle index → tag using faceGroups. The faceGroups `start` and `count` refer to indices in the indexed mesh, so each group covers `count/3` triangles starting at `start/3`.

When emitting triangles, add `pid="1" p1="${materialIndex}"`:

```typescript
// In the triangles loop
const matIndex = triangleTagMap.get(triIndex);
if (matIndex !== undefined) {
  xml += `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="1" p1="${matIndex}" />\n`;
} else {
  xml += `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" />\n`;
}
```

**Important:** The current `deduplicateVertices` converts from flat vertex arrays to indexed format. The `faceGroups` from brepjs are already in indexed format (indices into the triangles array). The 3MF exporter receives flat vertex arrays from the STL path, so there's a mismatch. We need to map faceGroups to the deduplicated triangle indices.

Solution: The `faceGroups[].start` is an index-buffer offset (not byte offset). After `deduplicateVertices`, the triangle order is preserved 1:1, so the mapping is direct: triangle at flat position `tri * 9` in the vertex array maps to `triangles[tri]` in the indexed output.

But wait — the 3MF exporter currently receives flat vertices (STL-style, 9 floats per triangle) while `faceGroups` from the worker use index-buffer offsets. These are different representations. The faceGroups need to be remapped.

**Simpler approach:** Pass faceGroups as triangle-index ranges. Each group's `start` is `start / 3` (triangle index) and `count` is `count / 3` (triangle count). This maps directly to the sequential triangle output in 3MF.

Actually — looking more carefully at the code, the flat vertex arrays and the indexed arrays go through different paths. The 3MF exporter receives flat STL-style arrays. The mesh from brepjs is indexed. The conversion happens in `toIndexedMeshData` which currently keeps indexed format.

Let me re-examine: `MeshData` uses indexed format (separate `vertices`, `indices`). But `export3MF` receives flat vertex arrays (9 floats per triangle). So there are two paths:

1. Preview: `MeshData` with indexed format → Three.js BufferGeometry
2. Export: Re-generate with `forExport=true`, then the exporter gets vertices from... let me check.

The 3MF export is triggered from the print-export feature. Check how it calls the exporter.

For this task, the simplest approach: make `build3MFBuffer` accept an optional `faceGroups` parameter where `start`/`count` reference flat-vertex triangle indices (i.e., `start` = triangle index, not byte offset). The caller is responsible for converting.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/generation/export/threemfExporter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/generation/export/threemfExporter.ts src/features/generation/export/threemfExporter.test.ts
git commit -m "feat(export): multi-color 3MF with per-feature basematerials"
```

---

### Task 9: Wire 3MF Export to Use Feature Colors

**Files:**

- Modify: the print-export feature component that calls `export3MF`
- This task wires the feature coloring into the actual export UI

**Step 1: Find the export call site**

Search for `export3MF` usage. The export path likely goes:

1. User clicks export button
2. Worker generates solid + mesh
3. Flat vertices sent to `export3MF`

Add `featureColors: true` and `faceGroups` to the options when the user has the feature enabled.

**Step 2: The worker needs to return faceGroups for the export path too**

Currently `exportBin` generates full-fidelity geometry but only returns STL/STEP binary data — no mesh data flows back. For 3MF, the flat vertex path goes through the main thread's `export3MF` function.

The cleanest approach: add a new export format `'3mf-color'` that includes faceGroups in the export pipeline. Or, generate faceGroups during the 3MF export path on the main thread.

This task needs investigation of the exact 3MF export path. Mark as needs-investigation and implement after understanding the print-export feature's data flow.

**Step 3: Commit investigation notes**

```bash
git commit --allow-empty -m "chore: investigate 3MF export path for faceGroups wiring"
```

---

### Task 10: applyMatrix Cleanup for Socket Translation

**Files:**

- Modify: `src/features/generation/worker/generators/binGenerator.ts` (lines 424-446)
- Test: Run existing scenario tests for regression

This is independent of the provenance work and can be done in parallel.

**Step 1: Identify translation-only cases**

In `binGenerator.ts:424-446`, the wall pattern loop uses `composeTransforms` with translate + rotate ops. For sockets (which are the other main transform site), check `socketBuilder.ts` for simpler translate-only cases.

**Step 2: Replace translate-only transforms with applyMatrix**

Add `applyMatrix` to the imports from `brepjs`:

```typescript
import {
  // ... existing ...
  applyMatrix,
} from 'brepjs';
```

For any cases that are pure translations (no rotation), replace:

```typescript
const trsf = composeTransforms([{ type: 'translate', v: [tx, ty, tz] }]);
try {
  result = transformCopy(template, trsf);
} finally {
  trsf.cleanup();
}
```

with:

```typescript
result = applyMatrix(clone(template), [
  [1, 0, 0, tx],
  [0, 1, 0, ty],
  [0, 0, 1, tz],
  [0, 0, 0, 1],
]);
```

**Keep the existing `composeTransforms` approach** for the wall pattern loop (lines 424-446) since those transforms include rotations and the current code is clean.

**Step 3: Run scenario tests**

Run: `npx vitest run src/features/generation/worker/generators/binGenerator.scenario`
Expected: All passing, no snapshot changes

**Step 4: Commit**

```bash
git add src/features/generation/worker/generators/binGenerator.ts
git commit -m "refactor(generation): use applyMatrix for translation-only transforms"
```

---

### Task 11: i18n — Add Keys for All Locales

**Files:**

- Modify: all locale JSON files in `src/i18n/locales/` (de, es, fr, nb, nl, pt-BR)

**Step 1: Add translated keys**

Add the `settings.featureColorPreview` and `settings.featureColorPreviewDescription` keys to each locale file. Use English as fallback for initial commit, then get proper translations.

**Step 2: Run i18n check**

Run: `npm run check:i18n`
Expected: PASS

**Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "chore(i18n): add featureColorPreview keys to all locales"
```

---

### Task 12: Typecheck + Lint + Full Test Suite

**Files:** None (validation only)

**Step 1: Typecheck**

Run: `node node_modules/typescript/bin/tsc -b --noEmit`
Expected: No errors

**Step 2: Lint**

Run: `npm run lint`
Expected: No errors

**Step 3: Full test suite**

Run: `npm run test:coverage`
Expected: All passing

**Step 4: Bundle size**

Run: `npm run size`
Expected: No significant increase (featureTags.ts is tiny)

---

## Dependency Graph

```
Task 1 (FeatureTag) ──────┐
                           ├──▶ Task 3 (origin mapping) ──▶ Task 4 (origin→tag) ──▶ Task 5 (bridge) ──┐
Task 2 (bridge types) ────┘                                                                            │
                                                                                                       ├──▶ Task 7 (preview) ──▶ Task 12
Task 6 (settings) ────────────────────────────────────────────────────────────────────────────────────┘ │
                                                                                                       ├──▶ Task 8 (3MF) ──▶ Task 9 (wire) ──▶ Task 12
Task 10 (applyMatrix) ── independent ──────────────────────────────────────────────────────────────────┘
Task 11 (i18n) ── after Task 6 ──▶ Task 12
```

Tasks 1-2 can be done in parallel. Task 10 is fully independent. Tasks 3-5 are sequential. Tasks 7, 8 can be done in parallel after Task 5.
