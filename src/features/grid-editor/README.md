# Grid Editor

Core interactive layout editor using CSS Grid rendering (not Canvas).

## Key Files

| File                             | Purpose                                            |
| -------------------------------- | -------------------------------------------------- |
| `components/Grid/index.tsx`      | Main container, responsive breakpoints             |
| `components/Grid/GridCanvas.tsx` | CSS Grid cells, bin containers, event handling     |
| `components/Grid/Overlay.tsx`    | Real-time interaction previews                     |
| `components/Grid/Bin.tsx`        | Individual bin with selection ring, resize handles |
| `hooks/useInteraction.ts`        | Master dispatcher for 5 interaction modes          |
| `hooks/useGridCoords.ts`         | Pixel ↔ grid coordinate conversion                 |
| `utils/collision.ts`             | 3D collision detection, blocked zones              |

## Coordinate System (CRITICAL)

```
Grid origin (0,0) is BOTTOM-LEFT
Screen Y is inverted: gridY = drawer.depth - screenY - 1
layers[0] is BOTTOM layer (UI displays reversed)
```

## Interaction Modes

| Mode          | Trigger               | Throttled | Purpose                          |
| ------------- | --------------------- | --------- | -------------------------------- |
| `draw`        | Drag empty space      | No        | Create bin by dragging rectangle |
| `drag`        | Drag bin(s)           | RAF       | Move selected bins               |
| `resize`      | Drag handle           | RAF       | Resize with corner/edge handles  |
| `paint`       | Paint size set + drag | No        | Fill area with uniform bins      |
| `stagingDrag` | Drag from stash       | RAF       | Place bin from staging area      |

## Validation Flow

All modes call `canPlaceBin()` which checks:

1. **Bounds** - within drawer dimensions
2. **Height** - fits remaining drawer height
3. **Blocked zones** - no overlap with lower-layer protrusions
4. **Collisions** - 3D overlap (footprint + vertical range)

## Gotchas

1. **Y-axis inversion** - forget this and bins appear upside down
2. **Half-bin mode** - doubles visual grid (`HALF_BIN_SCALE = 2`)
3. **Fractional edges** - drawer 10.5 width = one narrow column
4. **Multi-select drag** - entire group stops if one bin blocked
5. **Ghost bins** - lower-layer bins shown semi-transparent

## Integration Points

- **Staging**: Bins with `layerId === STAGING_ID` are off-grid
- **Layers**: `getBlockedZones()` calculates protrusions from lower layers
- **Selection store**: `setSelectedBins()` for multi-select
- **Collab**: Cursor tracking via `updateCursor({ x, y })`
