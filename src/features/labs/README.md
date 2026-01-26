# Labs

Experimental feature flags for opt-in preview features.

```mermaid
graph TB
    LBtn[LabsButton] --> LD[LabsDrawer] --> FC[FeatureCard]
    FC -->|toggle| LS[(labs store)] --> LOCAL[(localStorage)]
    LS --> UFF[useFeatureFlag]
    UFF --> CS[cloud-share] & BD[bin-designer]
```

## Infrastructure Location

- **Definitions**: `@/core/labs/features.ts`
- **Store**: `@/core/store/labs`
- **Hook**: `@/hooks/useFeatureFlag`

## Current Flags

| Flag                    | Purpose                     |
| ----------------------- | --------------------------- |
| `bin_designer`          | Parametric bin generator    |
| `collaborative_editing` | Real-time Liveblocks collab |
| `layout_to_print`       | STL export from layout      |

## Usage

```typescript
const isEnabled = useFeatureFlag('collaborative_editing');
```

## Gotchas

1. **Flags persisted in localStorage** - survives refresh
2. **Some flags require page reload** - noted in UI
3. **Feature definitions in core/labs** - not in this feature module
