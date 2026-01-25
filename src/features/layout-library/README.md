# Layout Library

Multi-layout management with thumbnails and metadata.

## Key Files

| File                                | Purpose                    |
| ----------------------------------- | -------------------------- |
| `components/LayoutManagerModal.tsx` | Full layout browser dialog |
| `hooks/useLayoutRouting.ts`         | URL-based layout loading   |

## Note on useLayoutSwitcher

Main switching logic moved to `@/hooks/useLayoutSwitcher` (re-exported here for backward compatibility).

## Core Concepts

- **Library**: Index of `LayoutEntry` objects (metadata only)
- **Layouts**: Stored separately by UUID in IndexedDB
- **Active layout**: Currently loaded in editor
- **Preview**: Thumbnail + stats (binCount, layerCount, dimensions)

## Data Flow

```
createNewLayout() → generates UUID, saves empty layout, adds entry
switchLayout(id) → saves current, loads target, updates activeLayoutId
duplicateLayout(id) → copies layout data, new UUID, "(copy)" suffix
deleteLayout(id) → removes from IndexedDB + library entry
```

## Storage Keys

- Library index: `gridfinity-library-v1` (localStorage)
- Individual layouts: `gridfinity-layout-{uuid}` (IndexedDB)

## Gotchas

1. **Can't delete last layout** - minimum 1 required
2. **Max 100 layouts** - warning at 80
3. **Preview computed on save** - `computePreview()` generates thumbnail data
4. **Switching saves current first** - prevents data loss

## Integration

- **storage**: Atomic operations (saveLayoutWithMetadata, switchActiveLayout)
- **library store**: Entry CRUD, activeLayoutId tracking
- **layout store**: setActiveLayoutId syncs with library
