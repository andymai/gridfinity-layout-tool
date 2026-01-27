# Generation

Replicad-based 3D geometry engine running in Web Worker.

```mermaid
graph TB
    subgraph MainThread
        BD[bin-designer] -->|params| GB[GenerationBridge]
        GB --> AD[adaptiveDebounce]
    end
    subgraph Worker
        AD -->|debounced| GW[generation.worker]
        GW --> RB[replicadBin]
        RB --> WASM[Replicad WASM]
    end
    subgraph Export
        MD[MeshData] --> STL & TMF[3MF]
    end
    RB -->|tessellate| MD -->|transfer| GB
```

## Pipeline Stages

1. **Base Socket** → built fresh
2. **Shell Box** → built fresh
3. **Assembly** → built fresh
4. **Features** (dividers, inserts) → built fresh
5. **Tessellate** → MeshData {vertices, normals}

## Worker Protocol

| Message  | Purpose                 |
| -------- | ----------------------- |
| INIT     | Load WASM (~11MB, 2-4s) |
| GENERATE | Tessellation + progress |
| CANCEL   | Abort current request   |

Requests tagged with `requestId`; cancelled requests ignored.

## Gotchas

1. **Half-cells decompose separately** - 1.5 width = [1.0, 0.5] cells
2. **Magnet holes only in full cells** - half cells remain solid
3. **Features fail silently** - tiny cells → feature skipped
4. **WASM objects are ephemeral** - replicad GC invalidates refs unpredictably

## Adaptive Debounce

Fast generations → 50ms delay, slow generations → 300ms delay
