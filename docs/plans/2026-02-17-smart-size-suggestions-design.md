# Smart Size Suggestions ("Next Bin") Design

**Date:** 2026-02-17
**Status:** Approved
**Labs Feature ID:** `size-suggestions`

## Overview

Tetris-style "Next Bin" feature that predicts the best bin size and position based on community ML telemetry data. A floating preview panel shows the suggested size, while a ghost overlay on the grid shows where it would be placed. Clicking the preview (or pressing `N`) auto-places the bin. The next suggestion immediately appears, creating a rapid Tetris-like layout flow.

Shipped as an experimental Labs feature (opt-in).

## Architecture

### API Endpoint

**`POST /api/size-suggest`**

Request body:

```json
{
  "drawer": "6x4",
  "prev": "2x1",
  "labels": ["abc123", "def456"],
  "occupied": [
    [0, 0, 1, 1],
    [2, 0, 2, 2]
  ]
}
```

| Field      | Required | Description                                                    |
| ---------- | -------- | -------------------------------------------------------------- |
| `drawer`   | Yes      | Drawer size `WxD`                                              |
| `prev`     | No       | Last placed bin size for transition matrix                     |
| `labels`   | No       | Label hashes for label→size lookup                             |
| `occupied` | Yes      | Array of `[x, y, width, depth]` tuples (current bin positions) |

Response:

```json
{
  "suggestions": [
    {
      "size": "2x1",
      "score": 0.82,
      "position": { "x": 2, "y": 0 },
      "positionSource": "edge_usage+spatial_pattern"
    }
  ],
  "source": "transition+drawer+label"
}
```

### Size Scoring Algorithm

```
score(size) =
    0.3 * normalize(drawer_freq[drawer][size])
  + 0.4 * normalize(transition_freq[prev][size])     // skip if no prev
  + 0.2 * normalize(label_freq[labels][size])         // skip if no labels
  - 0.1 * normalize(correction_freq[size])            // penalty
```

Weights redistribute when optional signals are absent. Returns top 3, client uses #1.

### Position Algorithm

1. Get suggested size from scoring above
2. Query `ml:edge_usage` for spatial tendencies (left-edge, corner, center)
3. Query `ml:cooccur:{label_hashes}` for adjacency patterns
4. From `occupied`, compute valid positions for the suggested size
5. Rank valid positions by:
   - Spatial pattern match (where do bins of this size usually go?)
   - Edge usage correlation
   - Gap-fit efficiency (prefer tight fits)
   - Adjacency to similar labels/categories
6. **Fallback** (cold start / sparse data): bottom-left first valid position

### Caching & Rate Limiting

- Response cached in Redis with `SETEX`, 60s TTL, keyed on hash of request body
- Rate limit: reuse existing CRUD limiter (100/min)

### Redis Keys Queried

| Key                      | Purpose                       |
| ------------------------ | ----------------------------- |
| `ml:drawer:{size}`       | Size priors by drawer         |
| `ml:trans:{prev}`        | Transition matrix (prev→next) |
| `ml:label_hash:{hash}`   | Label→size mapping            |
| `ml:neg:corrected_sizes` | Correction penalty            |
| `ml:edge_usage`          | Position spatial patterns     |
| `ml:cooccur:{hash}`      | Label adjacency               |

## Client-Side

### Feature Directory

```
src/features/size-suggestions/
├── README.md
├── index.ts
├── store/
│   └── index.ts                    # Zustand store
├── hooks/
│   ├── useSizeSuggestions.ts       # Fetch + lifecycle hook
│   └── index.ts
├── components/
│   ├── NextBinPreview/
│   │   ├── NextBinPreview.tsx      # Floating preview panel
│   │   ├── NextBinPreview.test.tsx
│   │   └── index.ts
│   ├── SuggestionGhost/
│   │   ├── SuggestionGhost.tsx     # Ghost overlay on grid
│   │   ├── SuggestionGhost.test.tsx
│   │   └── index.ts
│   └── index.ts
└── utils/
    ├── formatSize.ts               # "2x1" → { width: 2, depth: 1 }
    └── index.ts
```

### Store

```typescript
interface SizeSuggestion {
  size: string; // "2x1"
  score: number; // 0.0-1.0
  position: { x: number; y: number };
  positionSource: string;
}

interface SizeSuggestionState {
  suggestions: SizeSuggestion[];
  isLoading: boolean;
  isDismissed: boolean;
  lastFetchParams: string | null; // dedup key
}
```

### Fetching

- Triggers: layout load, bin placed, label changed, drawer resized
- Debounced 2s after bin placement
- Deduplicates via `lastFetchParams` hash
- Gated: `useLabsStore.getState().isFeatureEnabled('size-suggestions')`
- Error handling: silent fail, clear suggestions

### UI — NextBinPreview

Small floating panel at top-right of grid area:

```
┌──────────────┐
│  Next    ✕   │
│ ┌────┬────┐  │
│ │    │    │  │
│ └────┴────┘  │
│    2 × 1     │
└──────────────┘
```

- Mini-grid rendering of suggested shape using active category color
- Click → `addBin()` at suggested position, then re-fetch
- Dismiss (×) → hidden for session
- Hidden during active interactions, paint mode, or when no suggestions

### UI — SuggestionGhost

Ghost overlay on the grid at the suggested position:

- Dashed border, low-opacity fill in category color
- Updates when suggestion changes
- Hidden during active draw/drag/resize interactions

### Keyboard Shortcut

`N` key → accept current suggestion (place bin). Registered in `useKeyboard`, gated behind labs flag.

## Accessibility

- Preview panel: `role="complementary"`, `aria-label="Suggested next bin"`
- Preview button: `"Use suggested size: 2 by 1"`
- Dismiss: `aria-label="Dismiss next bin suggestion"`
- Ghost: purely visual (no aria role needed, redundant with preview panel)
- Screen reader announcement on suggestion change via `aria-live="polite"`

## i18n Keys

```
sizeSuggestion.next          → "Next"
sizeSuggestion.useSize       → "Use suggested size: {size}"
sizeSuggestion.dismiss       → "Dismiss"
sizeSuggestion.ghost.ariaLabel → "Suggested placement for {size} bin"
```

Added to `en.ts` first, then all locale JSONs.

## Telemetry

### New Placement Method

Add `'suggestion'` to `PlacementMethod` type in ML telemetry.

### New Tracking Events

| Event                                               | Purpose                |
| --------------------------------------------------- | ---------------------- |
| `trackSuggestionShown(size, position, score)`       | Impression             |
| `trackSuggestionAccepted(size, position)`           | Click-through          |
| `trackSuggestionDismissed()`                        | Explicit dismiss       |
| `trackSuggestionIgnored(suggestedSize, actualSize)` | User chose differently |

These enable measuring acceptance rate per drawer size to identify weak predictions.

## Labs Registration

```typescript
{
  id: 'size-suggestions',
  name: 'Smart Size Suggestions',
  description: 'Tetris-style "Next Bin" predictions based on community usage patterns. Shows a suggested bin size and position — click to auto-place.',
  status: 'experimental',
  defaultEnabled: false,
}
```

## Data Flow

```
User opens layout
       │
       ▼
  Labs enabled? ──no──▶ (nothing)
       │yes
       ▼
  POST /api/size-suggest
  { drawer, prev: null, labels, occupied }
       │
       ▼
  Redis: score sizes → rank positions → return top suggestion
       │
       ▼
  Client store updates
       │
       ├─▶ NextBinPreview (size visual)
       └─▶ SuggestionGhost (position on grid)
              │
              ▼
        User clicks preview or presses N
              │
              ▼
        addBin() at suggested position
        mlTracking.trackPlacement(bin, 'suggestion')
        mlTracking.trackSuggestionAccepted(size, position)
              │
              ▼
        Re-fetch with updated prev + occupied
              │
              ▼
        Next suggestion appears (loop)
```

## Cold Start / Fallback

When Redis data is sparse:

- Size: fall back to most common sizes globally (`ml:sizes`)
- Position: fall back to bottom-left first valid gap
- If no valid position exists (grid full): hide suggestion
