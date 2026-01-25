# Layers

Vertical stacking system for multi-height drawer organization.

## Key Files

| File                              | Purpose                                 |
| --------------------------------- | --------------------------------------- |
| `components/LayerPanel.tsx`       | Full layer list with add/delete/reorder |
| `components/ActiveLayerPanel.tsx` | Compact current layer indicator         |
| `hooks/useLayerHeight.ts`         | Z-axis calculations for layer stacking  |

## Core Concepts

- **layers[0] is BOTTOM** - array order = physical stack order
- **UI displays reversed** - via `getDisplayLayers()` for top-to-bottom visual
- **Z-start calculated** - cumulative height of layers below

## Data Flow

```
addLayer() → new layer at top of stack
setActiveLayer(id) → selection store updates
reorderLayers(from, to) → validates no collision conflicts
deleteLayer(id) → bins move to staging, can't delete last layer
```

## Layer Z Calculations

```typescript
getLayerZStart(layerId, layers):
  sum of heights of all layers with index < targetIndex

getLayerZEnd(layerId, layers):
  zStart + layer.height
```

## Gotchas

1. **Bottom-left coordinate system** - Y=0 is bottom, layers[0] is bottom
2. **Blocked zones** - bins from lower layers protrude into higher layers
3. **Reorder validation** - checks for vertical collisions before allowing
4. **Can't delete last layer** - minimum 1 layer required

## Integration

- **grid-editor**: Ghost bins show lower layers, blocked zones hatched
- **collision.ts**: `checkLayerReorderCollisions()` validates moves
- **layout store**: Layer CRUD operations with Result types
