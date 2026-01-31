# Bin Designer

Parametric 3D Gridfinity bin generator with Replicad geometry engine.

```mermaid
graph TB
    subgraph UI
        DP[DesignerPage] --> PP[ParameterPanel] & PC[PreviewCanvas]
    end
    subgraph State
        DS[(designer store)] --> MCM[meshCacheManager]
        CS[(cart store)]
        CBR[(customBinRegistry)]
    end
    subgraph Generation
        UG[useGeneration] --> GB[GenerationBridge] --> Worker
        Worker -->|MeshData| PC
    end
    subgraph Persistence
        UAS[useAutoSave] --> IDB[(IndexedDB)]
        CBR --> LS[(localStorage)]
    end
    PP --> DS
    PC --> UG
```

## Key Files

- `components/DesignerPage.tsx` — main UI entry point
- `components/ParameterPanel.tsx` — parameter editing sidebar
- `components/PreviewCanvas.tsx` — 3D preview with Three.js
- `store/designer.ts` — design state and parameter mutations
- `store/cart.ts` — batch export cart
- `store/customBinRegistry.ts` — syncs saved designs to layout planner palette
- `hooks/useGeneration.ts` — triggers geometry regeneration via bridge
- `storage/DesignerStorage.ts` — IndexedDB persistence for saved designs

## Critical Concepts

- **Epoch pattern**: `store.setParam()` increments epoch → triggers regeneration
- **Mesh cache**: 100MB budget, attached to history for instant undo
- **Custom bin registry**: Syncs to localStorage for Layout Planner palette
- **Ghost overlays**: Lightweight Three.js primitives (`GhostDividers`, `GhostWireframe`, `GhostCompartmentPreview`, `GhostLabelTabs`) render during `generationStatus === 'generating'` for instant visual feedback before BREP mesh completes

## Gotchas

1. **Compartment cells must form rectangles** - `isRectangularSelection()` validates
2. **Min compartment size is 5mm** - smaller cells skip wall generation
3. **Auto-save only for saved designs** - "Untitled" bins don't persist
4. **Half-cells get no magnet holes** - only full 1×1 unit cells
5. **Solid style skips shell** - `keepFull` bypasses `.shell()`, so wallThickness is irrelevant
6. **Label tabs skip solid bins** - both generation and ghost overlay guard against `style === 'solid'`

## Integration

- `?placeBin=WxDxH` URL param places bin at (0,0) in Layout Planner
- Uses `generation` feature for WASM tessellation
- Cart enables batch export with quantities
