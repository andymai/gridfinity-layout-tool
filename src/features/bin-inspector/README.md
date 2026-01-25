# Bin Inspector

Details panel for viewing and editing selected bin properties.

## Key Files

| File                          | Purpose                             |
| ----------------------------- | ----------------------------------- |
| `components/BinInspector.tsx` | Main panel showing bin details      |
| `hooks/useBinInspector.ts`    | Selected bin data and edit handlers |

## Features

- View/edit bin dimensions (width, depth, height)
- View/edit label and notes
- Category assignment dropdown
- Custom properties editor (key-value pairs)
- Delete button with confirmation

## Data Flow

```
Selection store → selectedBinIds → useBinInspector
  → derives bin data from layout store
  → edit handlers call layout store mutations
```

## Editable Fields

| Field        | Constraint                              |
| ------------ | --------------------------------------- |
| Label        | Max 64 chars                            |
| Notes        | Max 256 chars                           |
| Category     | From available categories               |
| Custom props | Max 50, key: 32 chars, value: 256 chars |

## Gotchas

1. **Multi-select shows summary** - can't edit dimensions of multiple bins
2. **Custom properties have reserved keys** - id, layerId, category blocked
3. **Height changes validate** - must fit in layer + drawer height

## Integration

- **selection store**: Reads `selectedBinIds`
- **layout store**: Calls `updateBin()` for edits
- **undo**: Edits wrapped in `useUndoableAction`
