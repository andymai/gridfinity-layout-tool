# Labs

Experimental feature flags for opt-in preview features.

## Key Files

| File                           | Purpose                             |
| ------------------------------ | ----------------------------------- |
| `components/LabsPanel.tsx`     | Settings UI with feature toggles    |
| `components/WhatsNewBadge.tsx` | "New" indicator for recent features |

## Infrastructure Location

Core labs infrastructure lives elsewhere:

- **Types & definitions**: `@/core/labs` (LabFeature, FEATURES array)
- **Store**: `@/core/store/labs` (useLabsStore)
- **Hook**: `@/hooks/useFeatureFlag`

## Current Flags

| Flag                    | Purpose                     | Status       |
| ----------------------- | --------------------------- | ------------ |
| `collaborative_editing` | Real-time Liveblocks collab | Experimental |
| `layout_to_print`       | STL export from layout      | Coming soon  |

## Usage Pattern

```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

const isEnabled = useFeatureFlag('collaborative_editing');
if (isEnabled) {
  // Show collab-specific UI
}
```

## Gotchas

1. **Flags persisted in localStorage** - survives refresh
2. **Some flags require page reload** - noted in UI
3. **Feature definitions in core/labs** - not in this feature module

## Integration

- **cloud-share**: `collaborative_editing` enables edit permission
- **settings**: Labs section links to this panel
