# Bin Designer

Parametric 3D Gridfinity bin generator with WASM-based geometry engine.

## Key Files

| File                               | Purpose                                                             |
| ---------------------------------- | ------------------------------------------------------------------- |
| `store/designer.ts`                | Zustand store: params, generation state, undo/redo history (max 50) |
| `store/meshCacheManager.ts`        | Memory budget (100MB) for cached meshes in history                  |
| `store/customBinRegistry.ts`       | Lightweight localStorage index for Layout Planner palette           |
| `hooks/useGeneration.ts`           | Bridge lifecycle, epoch-based auto-regeneration                     |
| `hooks/useAutoSave.ts`             | 1s debounced save for existing designs                              |
| `hooks/useExport.ts`               | STL/3MF/STEP export lifecycle                                       |
| `components/DesignerPage.tsx`      | Main layout, responsive (desktop/tablet/mobile)                     |
| `components/CompartmentEditor.tsx` | Visual grid for merge/split cells                                   |

## Data Flow

```
User edits params → store.setParam() → epoch++ → useGeneration detects
→ GenerationBridge.generate(params) → Worker tessellates mesh
→ setGenerationResult() → PreviewCanvas renders Three.js mesh
```

## Architecture

- **Generation runs in Web Worker** (can't access DOM)
- **OpenCascade WASM** is ~11MB, lazy-loaded on first use
- **Epoch pattern**: Increment signals regeneration; unchanged = cache hit (instant undo)
- **Pending mesh cache**: Module-level variable, attached to history on next edit

## Gotchas

1. **Compartment cells must form rectangles** - `isRectangularSelection()` validates
2. **Min compartment size is 5mm** - smaller cells silently skip wall generation
3. **Auto-save only for saved designs** - unsaved "Untitled" bins don't persist
4. **Half-cells get no magnet holes** - only full 1×1 unit cells
5. **Solid style ignores wallThickness** - hardcoded to 1.6mm

## Integration Points

- **Layout Planner**: `?placeBin=WxDxH` URL param places custom bin at (0,0)
- **Custom bin registry**: localStorage sync for planner's "Custom Bins" palette
- **Export**: Uses shared `exportSTL()`, `export3MF()` from generation feature

## Constants

- Grid: 42mm/unit, Height: 7mm/unit, Socket: 5mm deep
- Dimensions: 0.5-8 units (0.5 increments)
- History: 50 states, Cache: 100MB budget
