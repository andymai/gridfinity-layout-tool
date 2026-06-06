# Manifold Draft Edge Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the manifold draft's edge lines look close enough to the occt-wasm final that switching draft→final is hard to notice.

**Architecture:** Replace manifold's full-triangle-wireframe `meshEdges()` with a **dihedral crease-edge extractor** that runs in the generation worker (manifold branch only), so drafts ship clean edges the client renders directly — no more main-thread `EdgesGeometry` per draft tick. A modest bump to the manifold draft's circular tessellation makes curve rims read round, and the bin-designer renderer stops suppressing draft edges and softens the finalize swap with a single fade (no two-layer crossfade).

**Tech Stack:** TypeScript, brepjs (manifold + occt-wasm kernels), Three.js / React Three Fiber, Vitest, Zustand.

**Environment note:** This repo requires **Node 22** for pnpm and the husky pre-commit hooks. Before committing, run `nvm use 22` (default Node 20 breaks pnpm). If a commit's pre-commit hook fails with a `node:sqlite`/pnpm error, you're on the wrong Node version.

**Background (read before starting):** The full design rationale — including why the originally-considered `faceId`/face-boundary approach is broken and why the crossfade was dropped — is in `docs/superpowers/specs/2026-06-05-manifold-draft-edges-design.md`. Read it first.

**Key invariant:** The manifold draft's per-facet circular angle MUST stay below the crease threshold (35°). If a curve's facet step exceeds the threshold, dihedral extraction emits a line at every facet → longitudinal wireframe noise. Task 1 encodes this coupling as a guarded constant.

---

## File Structure

| File                                                                                    | Responsibility                                                                 | Task |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- |
| `src/shared/constants/tessellation.ts` (new)                                            | Shared crease threshold + draft circular angle, with the coupling invariant    | 1    |
| `src/shared/constants/tessellation.test.ts` (new)                                       | Lock the constants + invariant                                                 | 1    |
| `src/shared/components/preview/useMeshGeometry.ts` (modify)                             | Use the shared crease constant instead of local literals                       | 1    |
| `src/features/generation/worker/generators/utils/creaseEdges.ts` (new)                  | Pure dihedral crease-edge extractor (weld → adjacency → threshold)             | 2    |
| `src/features/generation/worker/generators/utils/creaseEdges.test.ts` (new)             | Unit tests for the extractor                                                   | 2    |
| `src/features/generation/worker/generators/pipeline/stages/tessellateStage.ts` (modify) | Branch to `creaseEdges` on the build-time (manifold) kernel, for body + socket | 3    |
| `src/features/bin-designer/components/preview/BinMesh/edgeFade.ts` (new)                | Pure "which fade to start" decision helper                                     | 4    |
| `src/features/bin-designer/components/preview/BinMesh/edgeFade.test.ts` (new)           | Unit tests for the fade decision                                               | 4    |
| `src/features/bin-designer/components/preview/BinMesh/BinMesh.tsx` (modify)             | Stop suppressing draft edges; finalize-aware single fade                       | 4    |
| `src/features/generation/worker/wasmInstantiator.ts` (modify)                           | Bump manifold draft circular angle                                             | 5    |

---

## Task 1: Shared crease/tessellation constants

**Files:**

- Create: `src/shared/constants/tessellation.ts`
- Test: `src/shared/constants/tessellation.test.ts`
- Modify: `src/shared/components/preview/useMeshGeometry.ts:19` and `:103`

- [ ] **Step 1: Write the failing test**

Create `src/shared/constants/tessellation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CREASE_ANGLE_DEG, CREASE_ANGLE_RAD, DRAFT_MIN_CIRCULAR_ANGLE_DEG } from './tessellation';

describe('tessellation constants', () => {
  it('exposes the crease threshold in degrees and radians', () => {
    expect(CREASE_ANGLE_DEG).toBe(35);
    expect(CREASE_ANGLE_RAD).toBeCloseTo((35 * Math.PI) / 180, 10);
  });

  it('keeps the draft circular angle below the crease threshold', () => {
    // Invariant: a draft facet step at/above the crease angle would make the
    // worker emit a line at every curve facet (longitudinal wireframe noise).
    expect(DRAFT_MIN_CIRCULAR_ANGLE_DEG).toBeLessThan(CREASE_ANGLE_DEG);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test:run -- src/shared/constants/tessellation.test.ts`
Expected: FAIL — cannot resolve `./tessellation`.

- [ ] **Step 3: Write minimal implementation**

Create `src/shared/constants/tessellation.ts`:

```typescript
/**
 * Tessellation / edge constants shared by the generation worker (draft crease
 * edge extraction) and the client renderer (normal splitting + edge fallback).
 *
 * COUPLING: the manifold draft tessellates curves into flat facets. The worker
 * extracts edges wherever the angle between adjacent face normals exceeds
 * CREASE_ANGLE_DEG. So the draft's per-facet circular angle MUST stay below
 * CREASE_ANGLE_DEG — otherwise every curve facet becomes an edge (longitudinal
 * wireframe noise). Keep DRAFT_MIN_CIRCULAR_ANGLE_DEG comfortably under it.
 */

/** Dihedral/crease threshold (degrees). Catches lip chamfers (~45°) and curve
 *  rims (90°) while leaving sub-threshold facets smooth. */
export const CREASE_ANGLE_DEG = 35;

/** Same threshold in radians (for THREE normal splitting). */
export const CREASE_ANGLE_RAD = (CREASE_ANGLE_DEG * Math.PI) / 180;

/** Manifold draft min circular angle (degrees per facet). Lower = rounder
 *  curves, slower draft. MUST stay below CREASE_ANGLE_DEG (see COUPLING). */
export const DRAFT_MIN_CIRCULAR_ANGLE_DEG = 20;

// Cheap load-time guard so a future edit can't silently reintroduce curve noise.
if (DRAFT_MIN_CIRCULAR_ANGLE_DEG >= CREASE_ANGLE_DEG) {
  throw new Error(
    `DRAFT_MIN_CIRCULAR_ANGLE_DEG (${DRAFT_MIN_CIRCULAR_ANGLE_DEG}) must be < CREASE_ANGLE_DEG (${CREASE_ANGLE_DEG})`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test:run -- src/shared/constants/tessellation.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Refactor `useMeshGeometry.ts` to use the shared constant**

In `src/shared/components/preview/useMeshGeometry.ts`:

Replace the local constant (line ~19):

```typescript
const CREASE_ANGLE = (35 * Math.PI) / 180;
```

with an import at the top of the file (add near the other imports, after line 11):

```typescript
import { CREASE_ANGLE_DEG, CREASE_ANGLE_RAD } from '@/shared/constants/tessellation';
```

and update the two usages:

- Line ~70: `toCreasedNormals(geo, CREASE_ANGLE)` → `toCreasedNormals(geo, CREASE_ANGLE_RAD)`
- Lines ~103-104: replace

```typescript
const CREASE_ANGLE_DEGREES = 35;
return new THREE.EdgesGeometry(geometry, CREASE_ANGLE_DEGREES);
```

with

```typescript
return new THREE.EdgesGeometry(geometry, CREASE_ANGLE_DEG);
```

(Delete the now-unused local `CREASE_ANGLE` declaration.)

- [ ] **Step 6: Verify the renderer hook still typechecks and its tests pass**

Run: `pnpm run typecheck`
Expected: no errors.

Run: `pnpm run test:run -- src/features/bin-designer/components/preview/BinMesh/BinMesh.test.tsx`
Expected: PASS (existing tests still green — the EdgesGeometry mock ignores the angle arg).

- [ ] **Step 7: Commit**

```bash
nvm use 22
git add src/shared/constants/tessellation.ts src/shared/constants/tessellation.test.ts src/shared/components/preview/useMeshGeometry.ts
git commit -m "feat(tessellation): shared crease-angle constant with draft-angle invariant"
```

---

## Task 2: Dihedral crease-edge extractor (pure util)

**Files:**

- Create: `src/features/generation/worker/generators/utils/creaseEdges.ts`
- Test: `src/features/generation/worker/generators/utils/creaseEdges.test.ts`

This is pure array math — no brepjs/WASM, no special vitest environment. It welds vertices by quantized position (manifold can emit split vertices at face boundaries, so index-only adjacency is unsafe), builds an edge→adjacent-triangles map, and emits a segment where adjacent face normals diverge past the threshold (plus naked boundary edges).

- [ ] **Step 1: Write the failing test**

Create `src/features/generation/worker/generators/utils/creaseEdges.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { creaseEdges } from './creaseEdges';

/** Count line segments (each segment = 2 points = 6 floats). */
const segCount = (out: Float32Array): number => out.length / 6;

describe('creaseEdges', () => {
  it('returns empty for empty input', () => {
    const out = creaseEdges({ vertices: new Float32Array(0), triangles: new Uint32Array(0) });
    expect(out.length).toBe(0);
  });

  it('emits only boundary edges for a flat (coplanar) quad', () => {
    // Two coplanar triangles sharing the diagonal. The diagonal is coplanar
    // (no crease) → not emitted; the 4 outer edges are naked boundaries.
    const vertices = new Float32Array([
      0,
      0,
      0, // 0
      1,
      0,
      0, // 1
      1,
      1,
      0, // 2
      0,
      1,
      0, // 3
    ]);
    const triangles = new Uint32Array([0, 1, 2, 0, 2, 3]);
    const out = creaseEdges({ vertices, triangles });
    expect(segCount(out)).toBe(4); // 4 boundary edges, shared diagonal suppressed
  });

  it('emits the ridge of a 90° fold (above threshold)', () => {
    // Two triangles meeting at a 90° fold along the shared edge (0,0,0)-(1,0,0).
    const vertices = new Float32Array([
      0,
      0,
      0, // 0  shared
      1,
      0,
      0, // 1  shared
      0,
      1,
      0, // 2  triangle A (in XY plane)
      0,
      0,
      1, // 3  triangle B (in XZ plane)
    ]);
    const triangles = new Uint32Array([0, 1, 2, 0, 1, 3]);
    const out = creaseEdges({ vertices, triangles });
    // 1 ridge crease + 4 naked boundary edges = 5 segments.
    expect(segCount(out)).toBe(5);
  });

  it('does NOT emit a shared edge folded below the threshold', () => {
    // ~15° fold (< 35°): represents a curve facet that must stay smooth.
    const angle = (15 * Math.PI) / 180;
    const vertices = new Float32Array([
      0,
      0,
      0, // 0 shared
      1,
      0,
      0, // 1 shared
      0,
      1,
      0, // 2 triangle A (flat)
      0,
      Math.cos(angle),
      Math.sin(angle), // 3 triangle B tilted 15°
    ]);
    const triangles = new Uint32Array([0, 1, 2, 0, 1, 3]);
    const out = creaseEdges({ vertices, triangles });
    // Only the 4 boundary edges; the sub-threshold fold is suppressed.
    expect(segCount(out)).toBe(4);
  });

  it('detects creases across SPLIT (duplicated-position) vertices', () => {
    // Manifold may give each triangle its own vertex copies. The shared 90°
    // ridge must still be found by position-welding, not index identity.
    const vertices = new Float32Array([
      // Triangle A: indices 0,1,2
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      // Triangle B: indices 3,4,5 — re-uses positions of 0 and 1 as 3 and 4
      0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
    const triangles = new Uint32Array([0, 1, 2, 3, 4, 5]);
    const out = creaseEdges({ vertices, triangles });
    // After welding, the (0,0,0)-(1,0,0) edge is shared at 90° → 1 ridge,
    // plus 4 boundary edges = 5.
    expect(segCount(out)).toBe(5);
  });

  it('produces finite coordinates only', () => {
    const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const triangles = new Uint32Array([0, 1, 2, 0, 1, 3]);
    const out = creaseEdges({ vertices, triangles });
    for (const n of out) expect(Number.isFinite(n)).toBe(true);
  });

  it('emits exactly 12 edges for a unit cube', () => {
    // 8 corners, 12 triangles (2 per face). Each true cube edge is shared by
    // two perpendicular faces (90°) → 12 creases; face diagonals are coplanar.
    const v = new Float32Array([
      0,
      0,
      0, // 0
      1,
      0,
      0, // 1
      1,
      1,
      0, // 2
      0,
      1,
      0, // 3
      0,
      0,
      1, // 4
      1,
      0,
      1, // 5
      1,
      1,
      1, // 6
      0,
      1,
      1, // 7
    ]);
    const t = new Uint32Array([
      0,
      2,
      1,
      0,
      3,
      2, // bottom (z=0)
      4,
      5,
      6,
      4,
      6,
      7, // top (z=1)
      0,
      1,
      5,
      0,
      5,
      4, // front (y=0)
      1,
      2,
      6,
      1,
      6,
      5, // right (x=1)
      2,
      3,
      7,
      2,
      7,
      6, // back (y=1)
      3,
      0,
      4,
      3,
      4,
      7, // left (x=0)
    ]);
    const out = creaseEdges({ vertices: v, triangles: t });
    expect(segCount(out)).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test:run -- src/features/generation/worker/generators/utils/creaseEdges.test.ts`
Expected: FAIL — cannot resolve `./creaseEdges`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/generation/worker/generators/utils/creaseEdges.ts`:

```typescript
/**
 * Dihedral crease-edge extractor for build-time (manifold) draft meshes.
 *
 * Manifold has no B-rep topology and its meshEdges() returns the full triangle
 * wireframe. This recovers OCCT-style feature edges from the mesh alone:
 * weld vertices by position (manifold may split them at face boundaries), then
 * emit a segment wherever two adjacent triangles' face normals diverge past the
 * crease threshold — plus any naked boundary edge. Sub-threshold folds (curve
 * facets) stay smooth, so curves render as clean rims, not wireframe.
 */

import { CREASE_ANGLE_DEG } from '@/shared/constants/tessellation';

export interface CreaseEdgeMesh {
  readonly vertices: ArrayLike<number>;
  readonly triangles: ArrayLike<number>;
}

/** Weld resolution: 1e-4 model units (sub-micron at mm scale). */
const WELD_SCALE = 1e4;

export function creaseEdges(
  mesh: CreaseEdgeMesh,
  thresholdDeg: number = CREASE_ANGLE_DEG
): Float32Array {
  const { vertices, triangles } = mesh;
  const triCount = Math.floor(triangles.length / 3);
  if (triCount === 0) return new Float32Array(0);

  const vertCount = Math.floor(vertices.length / 3);

  // 1. Weld vertices by quantized position → stable welded id per position.
  const weld = new Map<string, number>();
  const remap = new Int32Array(vertCount);
  const idToVert: number[] = [];
  const q = (n: number): number => Math.round(n * WELD_SCALE);
  for (let v = 0; v < vertCount; v++) {
    const key = `${q(vertices[v * 3])},${q(vertices[v * 3 + 1])},${q(vertices[v * 3 + 2])}`;
    let id = weld.get(key);
    if (id === undefined) {
      id = weld.size;
      weld.set(key, id);
      idToVert[id] = v;
    }
    remap[v] = id;
  }

  // 2. Per-triangle face normals from original positions.
  const faceNormals = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    const a = triangles[t * 3];
    const b = triangles[t * 3 + 1];
    const c = triangles[t * 3 + 2];
    const ax = vertices[a * 3];
    const ay = vertices[a * 3 + 1];
    const az = vertices[a * 3 + 2];
    const ux = vertices[b * 3] - ax;
    const uy = vertices[b * 3 + 1] - ay;
    const uz = vertices[b * 3 + 2] - az;
    const vx = vertices[c * 3] - ax;
    const vy = vertices[c * 3 + 1] - ay;
    const vz = vertices[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    faceNormals[t * 3] = nx / len;
    faceNormals[t * 3 + 1] = ny / len;
    faceNormals[t * 3 + 2] = nz / len;
  }

  // 3. Edge (welded id pair) → adjacent triangle indices.
  const edgeMap = new Map<number, number[]>();
  const edgeKey = (i: number, j: number): number => {
    const lo = i < j ? i : j;
    const hi = i < j ? j : i;
    return lo * weld.size + hi;
  };
  const addEdge = (i: number, j: number, t: number): void => {
    const key = edgeKey(i, j);
    const arr = edgeMap.get(key);
    if (arr) arr.push(t);
    else edgeMap.set(key, [t]);
  };
  for (let t = 0; t < triCount; t++) {
    const a = remap[triangles[t * 3]];
    const b = remap[triangles[t * 3 + 1]];
    const c = remap[triangles[t * 3 + 2]];
    addEdge(a, b, t);
    addEdge(b, c, t);
    addEdge(c, a, t);
  }

  // 4. Emit creases (dihedral past threshold) and naked boundary edges.
  const cosThreshold = Math.cos((thresholdDeg * Math.PI) / 180);
  const size = weld.size;
  const out: number[] = [];
  const pushVert = (id: number): void => {
    const v = idToVert[id];
    out.push(vertices[v * 3], vertices[v * 3 + 1], vertices[v * 3 + 2]);
  };
  for (const [key, tris] of edgeMap) {
    let emit = false;
    if (tris.length === 1) {
      emit = true; // naked boundary edge
    } else {
      for (let i = 0; i < tris.length && !emit; i++) {
        for (let j = i + 1; j < tris.length && !emit; j++) {
          const ti = tris[i] * 3;
          const tj = tris[j] * 3;
          const dot =
            faceNormals[ti] * faceNormals[tj] +
            faceNormals[ti + 1] * faceNormals[tj + 1] +
            faceNormals[ti + 2] * faceNormals[tj + 2];
          if (dot < cosThreshold) emit = true;
        }
      }
    }
    if (emit) {
      pushVert(Math.floor(key / size));
      pushVert(key % size);
    }
  }

  return new Float32Array(out);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test:run -- src/features/generation/worker/generators/utils/creaseEdges.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
nvm use 22
git add src/features/generation/worker/generators/utils/creaseEdges.ts src/features/generation/worker/generators/utils/creaseEdges.test.ts
git commit -m "feat(generation): dihedral crease-edge extractor for draft meshes"
```

---

## Task 3: Wire crease edges into the tessellate stage (manifold only)

**Files:**

- Modify: `src/features/generation/worker/generators/pipeline/stages/tessellateStage.ts`

The OCCT (`extract-time`) path keeps using brepjs `meshEdges` (its native B-rep extractor is better). Only the build-time (manifold) draft swaps to `creaseEdges`, for both the body mesh and the deferred socket mesh.

- [ ] **Step 1: Add imports**

In `tessellateStage.ts`, update the brepjs import (line 11) and add the new imports:

```typescript
import { mesh, meshEdges, getKernelCapabilities } from 'brepjs';
```

Add below the existing relative imports (after line 15):

```typescript
import { creaseEdges } from '../../utils/creaseEdges';
```

- [ ] **Step 2: Branch the body-edge computation**

Replace the current body-edge block (lines ~37-42):

```typescript
const edgeAngular = angularTolerance * 0.5;
let shapeMesh = mesh(solid, { tolerance, angularTolerance });
let edgeLines: ArrayLike<number> = meshEdges(solid, {
  tolerance,
  angularTolerance: edgeAngular,
}).lines;
```

with:

```typescript
const edgeAngular = angularTolerance * 0.5;
let shapeMesh = mesh(solid, { tolerance, angularTolerance });

// Build-time kernels (manifold draft) have no B-rep topology, so their
// meshEdges() returns the full triangle wireframe. Recover clean feature
// edges from the mesh via dihedral crease detection. Extract-time kernels
// (occt) keep their native analytic edge extractor.
const buildTime = getKernelCapabilities().tessellationModel === 'build-time';
let edgeLines: ArrayLike<number> = buildTime
  ? creaseEdges(shapeMesh)
  : meshEdges(solid, { tolerance, angularTolerance: edgeAngular }).lines;
```

- [ ] **Step 3: Branch the socket-edge computation**

Replace the deferred-socket edge line inside the `if (deferredSolid)` block (line ~53):

```typescript
const socketEdges = meshEdges(deferredSolid, { tolerance, angularTolerance: edgeAngular });
edgeLines = concatFloat32(edgeLines, socketEdges.lines);
```

with:

```typescript
const socketEdges = buildTime
  ? creaseEdges(socketMesh)
  : meshEdges(deferredSolid, { tolerance, angularTolerance: edgeAngular }).lines;
edgeLines = concatFloat32(edgeLines, socketEdges);
```

Note: `socketMesh` is already computed on the line above (`const socketMesh = mesh(deferredSolid, { tolerance, angularTolerance });`). `concatFloat32` accepts `ArrayLike<number>`, so passing the `creaseEdges` `Float32Array` or the `.lines` array both work.

- [ ] **Step 4: Typecheck**

Run: `pnpm run typecheck`
Expected: no errors. (If brepjs's `getKernelCapabilities` is reported missing, confirm the export with `rg "getKernelCapabilities" node_modules/.pnpm/brepjs@*/node_modules/brepjs/dist/index.d.ts` — it is re-exported from `./kernel/index.js`.)

- [ ] **Step 5: Run the generator scenario tests (occt path must stay green)**

Run: `pnpm run test:run -- src/features/generation/worker/generators/binGenerator.scenario`
Expected: PASS. These run under the occt kernel (`extract-time`), exercising the unchanged branch — they confirm the refactor didn't disturb the final path. Also verify edge output is non-empty and finite for a representative bin (the scenario assertions already cover geometry sanity; if any edge-specific assertion exists, it should still pass).

- [ ] **Step 6: Commit**

```bash
nvm use 22
git add src/features/generation/worker/generators/pipeline/stages/tessellateStage.ts
git commit -m "feat(generation): use crease edges for manifold draft tessellation"
```

---

## Task 4: Render draft edges + finalize-aware fade (no crossfade)

**Files:**

- Create: `src/features/bin-designer/components/preview/BinMesh/edgeFade.ts`
- Test: `src/features/bin-designer/components/preview/BinMesh/edgeFade.test.ts`
- Modify: `src/features/bin-designer/components/preview/BinMesh/BinMesh.tsx`

Two changes: (1) stop suppressing draft edges so the worker's clean crease edges render directly; (2) replace the "edges first appeared" fade trigger with a small decision helper that handles both first-appearance (fade from 0) and the draft→final finalize (gentle fade from a floor, so the already-visible edges never blink to invisible).

- [ ] **Step 1: Write the failing test for the fade decision**

Create `src/features/bin-designer/components/preview/BinMesh/edgeFade.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { nextEdgeFade } from './edgeFade';

describe('nextEdgeFade', () => {
  it('fades in when edges first appear from nothing', () => {
    expect(
      nextEdgeFade({ prevHadEdges: false, hasEdges: true, prevIsDraft: false, isDraft: false })
    ).toBe('appear');
  });

  it('gently fades on the draft→final finalize', () => {
    expect(
      nextEdgeFade({ prevHadEdges: true, hasEdges: true, prevIsDraft: true, isDraft: false })
    ).toBe('finalize');
  });

  it('does nothing on a draft→draft update (edges already present)', () => {
    expect(
      nextEdgeFade({ prevHadEdges: true, hasEdges: true, prevIsDraft: true, isDraft: true })
    ).toBe(null);
  });

  it('does nothing when edges are unchanged on the final', () => {
    expect(
      nextEdgeFade({ prevHadEdges: true, hasEdges: true, prevIsDraft: false, isDraft: false })
    ).toBe(null);
  });

  it('does nothing when there are no edges', () => {
    expect(
      nextEdgeFade({ prevHadEdges: false, hasEdges: false, prevIsDraft: true, isDraft: false })
    ).toBe(null);
  });

  it('treats first appearance as appear even at finalize (covers no-draft first load)', () => {
    // Labs off: no draft ever; first mesh is final. prevIsDraft was false.
    expect(
      nextEdgeFade({ prevHadEdges: false, hasEdges: true, prevIsDraft: false, isDraft: false })
    ).toBe('appear');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test:run -- src/features/bin-designer/components/preview/BinMesh/edgeFade.test.ts`
Expected: FAIL — cannot resolve `./edgeFade`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/bin-designer/components/preview/BinMesh/edgeFade.ts`:

```typescript
/**
 * Decides which edge fade (if any) to start on a render.
 *
 * - 'appear'   — edges showed up from nothing (first load, or the first draft
 *                tick of a new generation). Fade opacity 0 → 1.
 * - 'finalize' — the draft→final swap, with edges already on screen. Fade from
 *                a floor → 1 so the near-coincident edges never blink to black.
 * - null       — no change worth animating (draft→draft, steady final, no edges).
 */
export type EdgeFadeKind = 'appear' | 'finalize' | null;

export interface EdgeFadeInput {
  readonly prevHadEdges: boolean;
  readonly hasEdges: boolean;
  readonly prevIsDraft: boolean;
  readonly isDraft: boolean;
}

export function nextEdgeFade(input: EdgeFadeInput): EdgeFadeKind {
  const { prevHadEdges, hasEdges, prevIsDraft, isDraft } = input;
  if (!hasEdges) return null;
  if (!prevHadEdges) return 'appear';
  if (prevIsDraft && !isDraft) return 'finalize';
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test:run -- src/features/bin-designer/components/preview/BinMesh/edgeFade.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Stop suppressing draft edges in `BinMesh.tsx`**

Replace the `edgeVertices` arg passed to `useMeshGeometry` (lines ~123-126):

```typescript
    // Manifold drafts have only triangulated mesh edges (not clean B-rep edges),
    // which render as wireframe noise — suppress them; the exact result restores
    // real edges when it supersedes the draft.
    edgeVertices: isDraft ? null : edgeVertices,
```

with:

```typescript
    // Drafts now ship clean dihedral crease edges from the worker (see
    // creaseEdges.ts), so render them directly instead of suppressing and
    // recomputing EdgesGeometry on the main thread every draft tick.
    edgeVertices,
```

- [ ] **Step 6: Replace the fade trigger with the finalize-aware decision**

Add the import near the other local imports (after line 28):

```typescript
import { nextEdgeFade } from './edgeFade';
```

Add a floor constant next to `EDGE_FADE_MS` (after line 34):

```typescript
/** Finalize fade starts from this opacity (not 0) so already-visible draft
 *  edges never blink to invisible when the final swaps in. */
const EDGE_FINALIZE_FADE_FLOOR = 0.55;
```

Replace the fade `useLayoutEffect` (lines ~138-149):

```typescript
useLayoutEffect(() => {
  const hasEdges = edgesGeometry !== null;
  if (hasEdges && !hadEdgesRef.current) {
    edgeFadeStartRef.current = performance.now();
    if (edgeMatRef.current) {
      edgeMatRef.current.transparent = true;
      edgeMatRef.current.opacity = 0;
    }
    invalidate();
  }
  hadEdgesRef.current = hasEdges;
}, [edgesGeometry, invalidate]);
```

with:

```typescript
const prevIsDraftRef = useRef(false);
const fadeFromRef = useRef(0);
useLayoutEffect(() => {
  const hasEdges = edgesGeometry !== null;
  const kind = nextEdgeFade({
    prevHadEdges: hadEdgesRef.current,
    hasEdges,
    prevIsDraft: prevIsDraftRef.current,
    isDraft,
  });
  if (kind !== null) {
    fadeFromRef.current = kind === 'finalize' ? EDGE_FINALIZE_FADE_FLOOR : 0;
    edgeFadeStartRef.current = performance.now();
    if (edgeMatRef.current) {
      edgeMatRef.current.transparent = true;
      edgeMatRef.current.opacity = fadeFromRef.current;
    }
    invalidate();
  }
  hadEdgesRef.current = hasEdges;
  prevIsDraftRef.current = isDraft;
}, [edgesGeometry, isDraft, invalidate]);
```

- [ ] **Step 7: Make the fade loop honor the floor start**

Replace the `useFrame` body (lines ~150-162):

```typescript
useFrame(() => {
  const start = edgeFadeStartRef.current;
  const mat = edgeMatRef.current;
  if (start === null || !mat) return;
  const t = Math.min(1, (performance.now() - start) / EDGE_FADE_MS);
  mat.opacity = t * (2 - t); // ease-out
  if (t >= 1) {
    edgeFadeStartRef.current = null;
    mat.transparent = false;
    mat.opacity = 1;
  }
  invalidate();
});
```

with:

```typescript
useFrame(() => {
  const start = edgeFadeStartRef.current;
  const mat = edgeMatRef.current;
  if (start === null || !mat) return;
  const t = Math.min(1, (performance.now() - start) / EDGE_FADE_MS);
  const eased = t * (2 - t); // ease-out
  const from = fadeFromRef.current;
  mat.opacity = from + (1 - from) * eased;
  if (t >= 1) {
    edgeFadeStartRef.current = null;
    mat.transparent = false;
    mat.opacity = 1;
  }
  invalidate();
});
```

- [ ] **Step 8: Run BinMesh tests + typecheck**

Run: `pnpm run typecheck`
Expected: no errors.

Run: `pnpm run test:run -- src/features/bin-designer/components/preview/BinMesh/`
Expected: PASS (existing BinMesh.test.tsx + new edgeFade.test.ts). The existing tests use `edgeVertices: new Float32Array(0)`, which `useMeshGeometry` treats as "no precomputed edges" → EdgesGeometry fallback, so removing the suppression doesn't change their outcome.

- [ ] **Step 9: Commit**

```bash
nvm use 22
git add src/features/bin-designer/components/preview/BinMesh/edgeFade.ts src/features/bin-designer/components/preview/BinMesh/edgeFade.test.ts src/features/bin-designer/components/preview/BinMesh/BinMesh.tsx
git commit -m "feat(bin-designer): render draft crease edges with finalize-aware fade"
```

---

## Task 5: Bump manifold draft circular tessellation

**Files:**

- Modify: `src/features/generation/worker/wasmInstantiator.ts:155`

Manifold's `setQuality('draft')` sets the per-facet circular angle to 30° (~12-segment circles), which reads as a polygon on curve rims. Drop it to `DRAFT_MIN_CIRCULAR_ANGLE_DEG` (20°, ~18 segments) for rounder rims that still stay below the 35° crease threshold (so no longitudinal noise). This is mostly an empirical/visual change — verified by eye, not a unit test.

- [ ] **Step 1: Add the import**

In `src/features/generation/worker/wasmInstantiator.ts`, add to the imports near the top:

```typescript
import { DRAFT_MIN_CIRCULAR_ANGLE_DEG } from '@/shared/constants/tessellation';
```

- [ ] **Step 2: Override the draft circular angle**

Replace line ~155:

```typescript
getKernel('manifold').setQuality?.('draft');
```

with:

```typescript
const manifoldKernel = getKernel('manifold');
manifoldKernel.setQuality?.('draft');
// setQuality('draft') sets a 30° min circular angle (~12-gon circles). Tighten
// it for rounder curve rims, staying below CREASE_ANGLE_DEG so the worker's
// crease extractor doesn't emit longitudinal facet lines. The raw manifold
// module is exposed as `.oc`.
const manifoldModule = (manifoldKernel as { oc?: { setMinCircularAngle?: (deg: number) => void } })
  .oc;
manifoldModule?.setMinCircularAngle?.(DRAFT_MIN_CIRCULAR_ANGLE_DEG);
```

- [ ] **Step 3: Typecheck + wasmInstantiator tests**

Run: `pnpm run typecheck`
Expected: no errors.

Run: `pnpm run test:run -- src/features/generation/worker/wasmInstantiator.test.ts`
Expected: PASS. (The test mocks brepjs; `getKernel` returns a mock. The optional-chained `.oc?.setMinCircularAngle?.()` is a no-op when absent, so the mock won't break. If the test asserts exact `getKernel` call shapes and fails, update the mock to return an object with an optional `oc` — do NOT weaken the production guard.)

- [ ] **Step 4: Manual visual verification**

Run: `nvm use 22 && pnpm run dev`

In the bin designer:

1. Create/edit a bin with a **rounded** feature (curved base, scoop, or fillet) and a **cylinder-like** feature if available.
2. Scrub a parameter (e.g. height) to force rapid draft regeneration, then let it finalize.
3. Confirm: (a) the **draft** shows clean edges — cap rims/creases present, **no** longitudinal wireframe lines along curves; (b) the **draft→final swap** is hard to notice (no edge pop, no blink); (c) curve rims look acceptably round, not obviously polygonal.

If longitudinal lines appear on curves, the draft angle is at/above the crease threshold — lower `DRAFT_MIN_CIRCULAR_ANGLE_DEG` (e.g. to 15) in `tessellation.ts` and re-check. If drafts feel sluggish during scrubbing, raise it slightly (must stay < 35).

- [ ] **Step 5: Commit**

```bash
nvm use 22
git add src/features/generation/worker/wasmInstantiator.ts
git commit -m "feat(generation): round out manifold draft curve tessellation"
```

---

## Final verification

- [ ] **Run the full quality gate**

```bash
nvm use 22
pnpm run typecheck
pnpm run lint
pnpm run test:run
```

Expected: all green. Investigate any failure before opening a PR. (Pre-existing `src/design-system/` failures from a missing `class-variance-authority` dep are unrelated to this work — see project notes.)

- [ ] **Open the PR** (main is protected; this branch is `feat/manifold-draft-edge-lines`)

```bash
git push -u origin feat/manifold-draft-edge-lines
gh pr create --fill
```

---

## Notes for the implementer

- **Why dihedral, not face ids:** manifold's `faceGroups.faceId` is per-construction-op (a whole cube = one id), and its true per-face `MeshGL.faceID` repaints curve facets as wireframe. Dihedral crease detection on the welded mesh is the only mesh-only signal that matches OCCT's look. See the spec for the full investigation.
- **Why no crossfade:** two near-coincident black line sets crossfading produce a mid-fade darkening pulse, z-fighting, and a geometry-disposal hazard (the shared hook disposes the old `edgesGeometry` on dependency change). A single material with a floor-start fade is simpler and looks the same or better.
- **Tangent fillet edges** that OCCT draws but the mesh can't distinguish from facet boundaries are an accepted, minor difference — not a bug to chase.

```

```
