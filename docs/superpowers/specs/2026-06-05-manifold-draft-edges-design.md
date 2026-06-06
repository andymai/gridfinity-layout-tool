# Design: Match manifold draft edge lines to OCCT

**Date:** 2026-06-05
**Status:** Approved (pending spec review)
**Goal:** Make the draft→final geometry swap less noticeable by bringing the manifold
draft's edge lines closer to the occt-wasm final. Does not need to be perfect — the
target is "the jump is hard to notice," not pixel-identical edges.

## Background

The bin designer renders two geometry backends:

- **Final / exact** — `occt-wasm` kernel. Edges come from a real B-rep
  `EdgeMeshExtractor` (clean analytic silhouette/feature curves), transferred to the
  client as `edgeVertices` and rendered directly.
- **Draft / preview** — `manifold` kernel in a separate worker. Fast, build-time
  tessellation. Manifold has **no B-rep topology**.

Both run the same generation pipeline (`binOrchestrator` → `tessellateStage`); only the
active kernel differs. The draft is best-effort and only exists when the
`manifold_preview` Labs feature is on (it is graduated/always-on in practice, but the
no-draft path must still behave).

### Why the current swap is noticeable

- `tessellateStage` calls `meshEdges(solid)`. For manifold this returns the **entire
  triangle wireframe** (every unique mesh edge), which is noise.
- `BinMesh` therefore _suppresses_ draft edges (`edgeVertices: isDraft ? null`) and falls
  back to `THREE.EdgesGeometry(geometry, 35°)` — main-thread crease detection — on **every
  draft tick**.
- At finalize, those crease-detected edges are replaced by OCCT's analytic B-rep edges.
  The two differ in completeness and (on coarse curves) in facet noise, so the swap "pops."

## Investigation findings that shaped this design

1. **`faceGroups.faceId` is the wrong signal.** It maps to manifold's `runOriginalID`,
   which is **per construction-op**, not per-face. A `Manifold.cube()` is one run → one id
   for all 6 faces, so "edge where adjacent triangles differ in face id" emits **zero**
   edges for a closed primitive. The face-id approach is rejected.
2. **The real per-face id (`MeshGL.faceID`) doesn't help either.** A cylinder side is many
   non-coplanar facets, each a distinct `faceID` → emitting at faceID boundaries repaints
   the full curve wireframe. And smooth **tangent fillet edges** are indistinguishable from
   facet boundaries in mesh-only data — a fundamental limit, not an implementation gap.
3. **Dihedral crease detection is the correct algorithm** — the same thing
   `THREE.EdgesGeometry` already does. The dominant lever for matching OCCT on curves is
   **tessellation fineness + threshold match**, not face ids.
4. **A two-layer crossfade is over-engineered and slightly harmful** for near-coincident
   black lines: mid-fade darkening pulse, z-fighting at equal depth, and a geometry-disposal
   hazard (the shared hook disposes the old `edgesGeometry` on dependency change). A single
   fade-in is simpler and looks the same or better.

## Approach

Compute clean dihedral crease edges **in the worker** for the manifold path, render them
directly on the client (no more suppression, no per-tick main-thread `EdgesGeometry`), and
soften the finalize swap with a single short fade-in.

### Component 1 — Worker: crease-edge extractor (new)

`src/features/generation/worker/generators/utils/creaseEdges.ts`

- Input: `vertices`, `triangles` (and the precomputed per-vertex `normals` if convenient).
- **Weld vertices by quantized position** so adjacency is robust to manifold's split
  vertices. Build an edge → adjacent-triangles map.
- For each shared edge, emit a line segment when the angle between the two adjacent
  **face normals** exceeds the crease threshold. Also emit naked boundary edges (an edge
  with a single adjacent triangle).
- Threshold = the same 35° used by `CREASE_ANGLE` in `useMeshGeometry`, exported as a shared
  constant so draft edges and the final's normal-split creases stay consistent.
- Output: `Float32Array` of line-segment vertices — identical format to today's
  `edgeVertices`, so nothing downstream changes.
- Unit tests (`creaseEdges.test.ts`): cube → exactly 12 edges; a coarse cylinder above the
  segment count where facet steps < threshold → 2 cap-rim loops and **no** longitudinal
  lines; a filleted box → expected rim loops; degenerate/empty input → empty output.

### Component 2 — Worker: branch in `tessellateStage.ts`

- Detect the build-time kernel via `getKernelCapabilities().tessellationModel === 'build-time'`
  (manifold) vs `'extract-time'` (occt). No dependency on the `workerContext` handler.
- On the manifold branch, replace `meshEdges(solid)` with `creaseEdges(shapeMesh)`.
- Apply the same treatment to the **deferred socket** mesh (`ctx.deferredSolid`) and
  concatenate, exactly as the current `meshEdges` socket path does. Flat bins have no socket.
- OCCT path is untouched (its native extractor is better).

### Component 3 — Worker: modest draft tessellation bump (tunable)

- Nudge the manifold draft circular-segment / angular tolerance so curved silhouettes keep
  facet steps under the crease threshold (clean rims, no longitudinal lines). Kept small to
  protect draft latency; final value tuned by eye. This is the knob that most affects how
  "OCCT-like" curves read.

### Component 4 — Client: `BinMesh.tsx`

- **Stop suppressing draft edges**: `edgeVertices: isDraft ? null : edgeVertices` →
  `edgeVertices`. Drafts now render the worker's clean crease edges directly; the main-thread
  `EdgesGeometry` fallback no longer runs per draft tick.
- **Transition**: keep a single `<lineSegments>`; repoint its `geometry` on finalize.
  Replace the current first-appearance fade trigger (which, once drafts have edges, would
  mis-fire on the first draft tick and leave the final swap un-faded) with a **finalize-edge
  trigger**: a short (~150–200 ms) single-material fade-in fired only on the `isDraft`
  true→false transition, reusing the existing `useFrame` + `invalidate()` loop.
- **No two-layer crossfade.** No retained/cloned geometry.
- Behavior to preserve: `!wireframe` guard on edges; xray untouched; multicolor untouched;
  Labs-off (no draft) path falls through to the existing single first-load fade with no
  spurious finalize animation.

## Edge cases / correctness checklist

- Labs `manifold_preview` off → no draft → `isDraft` stays false → no finalize trigger.
- New generation starting mid-fade → fade loop must reset cleanly (no zombie/stuck fade).
- Deferred socket on non-flat bins → crease edges computed and concatenated for it too.
- Empty/degenerate draft mesh → extractor returns empty, render guards already handle null.

## Testing

- `creaseEdges.test.ts` geometry validation (counts, no-noise-on-curve, no NaN/Infinity,
  correct coordinate system) per the project's post-generation validation requirement.
- Existing bin scenario tests must stay green.
- Manual: scrub bin params and watch draft↔final — the edge set should look continuous, with
  curves clean at the chosen draft quality.

## Scope

Mostly the manifold branch of the shared `tessellateStage` plus the bin-designer `BinMesh`
transition. The OCCT/final path and other `useMeshGeometry` consumers are untouched.

## Explicitly out of scope / non-goals

- Pixel-identical edges. Tangent fillet edges that OCCT shows but mesh data can't recover are
  accepted as a known, minor difference.
- Any change to the OCCT/final edge pipeline.
- faceID/face-boundary extraction (rejected — see findings 1–2).
