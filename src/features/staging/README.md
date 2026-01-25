# Staging

Off-grid bin stash (holding area) for bins not placed on the layout grid.

## Key Files

| File                     | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `components/Staging.tsx` | Stash panel UI with bin thumbnails, drag source |

## Purpose

Bins with `layerId === STAGING_ID` (`'__staging__'`) are stored here:

- Displaced bins (drawer resize clips them)
- Duplicated bins when no grid space available
- User-moved bins (drag to stash icon)

## Data Flow

```
Bin displaced → moveBinToStaging(id) → layerId = STAGING_ID
Drag from stash → stagingDrag interaction → moveBinFromStaging(id, layerId, x, y)
```

## Integration

- **grid-editor**: `stagingDrag` interaction mode handles placement
- **layout store**: `moveBinToStaging()`, `moveBinFromStaging()` mutations
- **cloud-share**: Staging bins excluded from sync fingerprint

## Gotchas

1. **STAGING_ID is magic string** - `'__staging__'`, not a real layer
2. **Bins here don't count** toward print list until placed
3. **Drag preview** uses `stagingDrag` mode in grid-editor
