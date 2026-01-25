# Generation

BREP-based 3D geometry engine running in Web Worker with OpenCascade WASM.

## Key Files

| File                               | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `bridge/GenerationBridge.ts`       | Main-thread API: lifecycle, debouncing, cancellation |
| `bridge/adaptiveDebounce.ts`       | 50-300ms delay based on recent timings               |
| `worker/generation.worker.ts`      | Entry: WASM init, message dispatch                   |
| `worker/generators/replicadBin.ts` | Core geometry (1000+ lines)                          |
| `worker/stageCache.ts`             | Intermediate BREP shape caching                      |
| `export/stlExporter.ts`            | Binary STL (50 bytes/triangle)                       |
| `export/threemfExporter.ts`        | 3MF ZIP with XML mesh + metadata                     |

## Generation Pipeline

```
Stage 1: Base Socket → [cached: baseShape]
Stage 2: Shell Box   → [cached: shellShape]
Stage 3: Assembly    → [cached: assemblyShape]
Stage 4: Features (dividers, scoops, cutouts, inserts) → always rebuilt
Stage 5: Translate Z by SOCKET_HEIGHT
Stage 6: Tessellate → MeshData {vertices, normals}
```

## Worker Protocol

```
INIT → worker loads WASM (2-4s, 11MB)
GENERATE → tessellation + progress callbacks
EXPORT → STL/3MF (main-thread) or STEP (worker)
CANCEL → silently aborts current request
```

Each request tagged with `requestId`; cancelled requests ignored.

## Export Formats

| Format | Size                       | Use Case                       |
| ------ | -------------------------- | ------------------------------ |
| STL    | ~50 bytes/tri              | Fast, portable 3D printing     |
| 3MF    | ~30 bytes/tri (compressed) | Rich metadata, slicer settings |
| STEP   | ~500KB+                    | Lossless CAD interchange       |

## Gotchas

1. **Half-cells decompose separately** - 1.5 width = [1.0, 0.5] cells
2. **Magnet holes only in full (1×1) cells** - half cells remain solid
3. **Features fail silently** - tiny cells → scoop skipped with warning
4. **Stacking lip fusion can fail** - falls back to base+shell only
5. **WASM heap refs can't transfer threads** - cache only valid in worker

## Performance

| Stage           | Typical (2×2 bin) |
| --------------- | ----------------- |
| WASM init       | 2-4s (first load) |
| Full generation | 1-3s (warm cache) |
| Features only   | 0.2-0.5s          |
| Tessellation    | 0.5-1s            |

Adaptive debounce: fast gens → 50ms delay, slow gens → 300ms delay
