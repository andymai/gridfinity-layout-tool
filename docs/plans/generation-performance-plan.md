# Bin Generation Performance Improvement Plan

## Executive Summary

Current generation times range from 200ms (1x1 bin) to 2000+ms (8x8 bin with features). This plan identifies optimizations across three categories:

1. **Actual Performance** - Make generation faster
2. **Perceived Performance** - Make it feel faster through better UX
3. **Architecture** - Long-term improvements

## Current Bottlenecks

| Bottleneck                           | Impact                    | Location                               |
| ------------------------------------ | ------------------------- | -------------------------------------- |
| Tessellation (fixed 0.1mm tolerance) | 30-50% of gen time        | replicadBin.ts:700                     |
| Sequential boolean operations        | O(cells) complexity       | buildBaseSocket, buildCompartmentWalls |
| No intermediate caching              | Full rebuild every change | Entire pipeline                        |
| Unused progress feedback             | No granular UX feedback   | useGeneration.ts:82-84                 |

## Phase 1: Quick Wins (Low Effort, Medium Impact)

### 1.1 Dynamic Tessellation Tolerance

**Estimated improvement: 20-40% for large bins**

Currently hardcoded at 0.1mm for all bins. Scale based on bin size:

```typescript
// replicadBin.ts - calculate adaptive tolerance
const maxDimension = Math.max(outerW, outerD, wallHeight);
const previewTolerance = Math.max(0.1, maxDimension / 500); // ~0.1-0.3mm
const previewAngular = 20; // degrees (currently 15)

const shapeMesh = bin.mesh({
  tolerance: previewTolerance,
  angularTolerance: previewAngular,
});
```

**Files:** `src/features/generation/worker/generators/replicadBin.ts`

### 1.2 Display Progress Stages

**Estimated improvement: Perceived only, but significant UX win**

Progress callbacks are wired but unused. Display them:

```typescript
// useGeneration.ts - consume progress
const result = await bridge.generate(currentParams, (stage, progress) => {
  setGenerationProgress({ stage, progress }); // Add to store
});
```

Show in corner spinner: "Building base..." → "Adding features..." → "Finalizing..."

**Files:**

- `src/features/bin-designer/hooks/useGeneration.ts`
- `src/features/bin-designer/components/PreviewCanvas.tsx`
- `src/features/bin-designer/store/designer.ts`

### 1.3 Increase Debounce Cap for Complex Bins

**Estimated improvement: Reduces wasted generations**

Current 300ms cap causes request stacking for slow bins:

```typescript
// adaptiveDebounce.ts
const MAX_DELAY = 500; // Increase from 300ms
```

**Files:** `src/features/generation/bridge/adaptiveDebounce.ts`

---

## Phase 2: Boolean Operation Optimization (Medium Effort, High Impact)

### 2.1 Batch Magnet/Screw Hole Cuts

**Estimated improvement: 15-30% for bins with magnets**

Currently: N individual cut operations (4 holes × cells)
Optimized: Create compound of all holes, single cut

```typescript
// Current (slow)
for (const center of cellCenters) {
  base = base.cut(magnetHole.translate(...));
  base = base.cut(screwHole.translate(...));
}

// Optimized (fast)
const allHoles: Shape3D[] = [];
for (const center of cellCenters) {
  allHoles.push(magnetHole.clone().translate(...));
  allHoles.push(screwHole.clone().translate(...));
}
const holeCompound = compoundShapes(allHoles);
base = base.cut(holeCompound);
```

**Files:** `src/features/generation/worker/generators/replicadBin.ts` (buildBaseSocket)

### 2.2 Batch Compartment Wall Fusion

**Estimated improvement: 20-40% for complex compartments**

Currently: O(cols × rows) individual fuse operations
Optimized: Collect walls, fuse once

```typescript
// Current (slow) - lines 388-423
for (let col = 1; col < cols; col++) {
  for (let row = 0; row < rows; row++) {
    dividers = dividers ? dividers.fuse(wall) : wall;
  }
}

// Optimized (fast)
const allWalls: Shape3D[] = [];
// ... collect walls ...
const dividers = fuseAll(allWalls); // Single operation
```

**Files:** `src/features/generation/worker/generators/replicadBin.ts` (buildCompartmentWalls)

### 2.3 Batch Cell Socket Fusion

**Estimated improvement: 30-50% for large bins**

Currently: Fuse sockets one-by-one in decomposeCells loop
Optimized: Collect all cell sockets, compound and fuse

**Files:** `src/features/generation/worker/generators/replicadBin.ts` (buildBaseSocket)

---

## Phase 3: Stage Caching (Medium Effort, High Impact)

### 3.1 Parameter-Based Cache Keys

**Estimated improvement: 40-70% when only features change**

Instead of caching WASM objects (which get GC'd), cache based on parameter hashes and regenerate only changed stages:

```typescript
interface GenerationCache {
  baseHash: string; // hash of width, depth, base params
  shellHash: string; // hash of height, wallThickness, style
  assemblyHash: string; // hash of stackingLip

  // Don't cache Shape3D - regenerate from params
  // But skip stages if hash unchanged
}

function generateBin(params, cache?) {
  const baseHash = hashParams(extractBaseParams(params));

  if (cache?.baseHash === baseHash) {
    // Base params unchanged - but we still rebuild (no WASM caching)
    // This is just for future optimization
  }
  // ... build base ...
}
```

**Note:** True WASM object caching is unreliable due to GC. This tracks what COULD be cached for future optimization.

**Files:**

- `src/features/generation/worker/generators/replicadBin.ts`
- New: `src/features/generation/worker/paramHash.ts`

---

## Phase 4: Perceived Performance UX (Low-Medium Effort, High Perceived Impact)

### 4.1 Progressive Ghost Wireframe

**Impact: Significantly better perceived speed**

Enhance ghost to show generation progress:

- Animate edges appearing as stages complete
- Subtle pulse while generating
- Color shift from gray to target color

```typescript
// GhostWireframe.tsx
const { stage, progress } = generationProgress;
const edgeOpacity = stage === 'base' ? progress : 1;
// Reveal edges progressively based on stage
```

**Files:** `src/features/bin-designer/components/preview/GhostWireframe.tsx`

### 4.2 Generation Time Prediction

**Impact: User knows what to expect**

Based on adaptive debounce history + param complexity:

```typescript
const predictedTime = estimateGenerationTime(params, recentTimings);
// Show "~2s remaining" for long generations
```

**Files:**

- `src/features/generation/bridge/adaptiveDebounce.ts`
- `src/features/bin-designer/components/PreviewCanvas.tsx`

### 4.3 Complexity Warning

**Impact: User understands why it's slow**

For slow generations (>1.5s), show hint:

```
"Complex design - generation may take a moment"
"Tip: Reduce compartments for faster preview"
```

**Files:** `src/features/bin-designer/components/PreviewCanvas.tsx`

---

## Phase 5: Architecture Improvements (High Effort, High Impact)

### 5.1 Coarse Preview + Fine Export

**Estimated improvement: 50-70% faster interactive preview**

Use different tessellation for preview vs export:

| Context | Tolerance | Angular | Triangle Count |
| ------- | --------- | ------- | -------------- |
| Preview | 0.3-0.5mm | 25°     | ~5,000         |
| Export  | 0.01mm    | 5°      | ~50,000        |

Already partially implemented for export; extend to preview.

**Files:** `src/features/generation/worker/generators/replicadBin.ts`

### 5.2 Manifold for Preview (Long-term)

**Estimated improvement: 10-100x faster for preview**

Manifold is a mesh-based boolean library that's dramatically faster than OpenCascade. Could use for:

- Interactive preview (mesh-based booleans)
- Keep OpenCascade for STEP export (exact B-Rep)

**Trade-off:** Adds second library, more complexity, mesh vs B-Rep quality differences.

**Research:** https://github.com/elalish/manifold

### 5.3 Custom OpenCascade.js Build

**Estimated improvement: 45% faster + smaller WASM**

Build with:

- `-sDISABLE_EXCEPTION_CATCHING=1` (~45% perf boost)
- Dead code elimination
- Only needed APIs

Current WASM: ~11MB
Custom build: ~3-4MB (estimated)

**Trade-off:** Build complexity, maintenance burden.

### 5.4 Worker Pool for Batch Export

**Impact: Faster multi-bin export**

For exporting multiple bins (e.g., print layouts), use worker pool:

```typescript
const workerPool = new WorkerPool(navigator.hardwareConcurrency);
await Promise.all(bins.map((bin) => workerPool.generate(bin)));
```

**Files:** New worker pool infrastructure

---

## Implementation Priority

### Immediate (This Week)

1. [x] ~~Fix ghost wireframe timing~~ (already done)
2. [ ] Display progress stages in UI (Phase 1.2)
3. [ ] Dynamic tessellation tolerance (Phase 1.1)

### Short-term (Next 2 Weeks)

4. [ ] Batch magnet hole cuts (Phase 2.1)
5. [ ] Batch compartment wall fusion (Phase 2.2)
6. [ ] Progressive ghost animation (Phase 4.1)

### Medium-term (Next Month)

7. [ ] Batch cell socket fusion (Phase 2.3)
8. [ ] Generation time prediction (Phase 4.2)
9. [ ] Complexity warning (Phase 4.3)

### Long-term (Future)

10. [ ] Evaluate Manifold for preview (Phase 5.2)
11. [ ] Custom OpenCascade.js build (Phase 5.3)
12. [ ] Worker pool for batch export (Phase 5.4)

---

## Success Metrics

| Metric                        | Current              | Target             |
| ----------------------------- | -------------------- | ------------------ |
| 2x2 bin generation            | 500-800ms            | 250-400ms          |
| 8x8 bin generation            | 2000+ms              | 800-1200ms         |
| Time to first visual feedback | ~50ms (ghost)        | ~50ms (maintained) |
| Progress visibility           | None                 | Stage + percentage |
| User-perceived wait           | Full generation time | Feels 50% shorter  |

---

## Files Reference

**Core Generation:**

- `src/features/generation/worker/generators/replicadBin.ts`
- `src/features/generation/worker/generation.worker.ts`
- `src/features/generation/bridge/GenerationBridge.ts`
- `src/features/generation/bridge/adaptiveDebounce.ts`

**UI/UX:**

- `src/features/bin-designer/hooks/useGeneration.ts`
- `src/features/bin-designer/components/preview/GhostWireframe.tsx`
- `src/features/bin-designer/components/preview/PreviewCanvas.tsx`
- `src/features/bin-designer/store/designer.ts`

**Types:**

- `src/features/bin-designer/types/index.ts`
- `src/features/generation/bridge/types.ts`
