# Staging

Off-grid bin stash for displaced bins.

```mermaid
graph TB
    subgraph Sources
        Resize[Drawer resize]
        Dup[Duplicate no space]
        Manual[User drag]
        LayerDel[Layer deletion]
    end
    Sources --> MTS[moveBinToStaging] --> LAY[(layout)]
    LAY -->|layerId = __staging__| ST[Staging.tsx]
    ST -->|drag| SDM[stagingDrag mode] --> MFS[moveBinFromStaging] --> LAY
```

## Key Files

- `components/Staging.tsx` — staging area UI with drag-out support

## Key Concept

Bins with `layerId === '__staging__'` are stored here, not on any layer.

## Gotchas

1. **STAGING_ID is magic string** - `'__staging__'`, not a real layer
2. **Bins don't count in print list** until placed
3. **Cloud-share excludes staging** - filtered from sync fingerprint
