# Size Suggestions

Tetris-style "Next Bin" predictions based on community ML telemetry data.

```mermaid
graph TB
    subgraph API
        EP[/api/size-suggest] --> SC[scoreSizes] & RP[rankPositions]
        SC --> Redis[(ml: telemetry)]
    end
    subgraph Client
        FH[useSizeSuggestions] -->|POST| EP
        SS[(suggestion store)] --> NBP[NextBinPreview] & SG[SuggestionGhost]
    end
    subgraph Integration
        INT[useSizeSuggestionsIntegration] --> FH & NBP & SG
        INT -->|renders in| Grid
    end
    FH --> SS
```

## Key Files

- `types.ts` — `SizeSuggestion`, `SizeSuggestResponse` interfaces
- `store/index.ts` — Zustand store for suggestions, loading, dismiss state
- `hooks/useSizeSuggestions.ts` — Fetch hook with debounce, dedup, abort, auto-refresh
- `components/NextBinPreview/` — Floating "Next" panel with mini grid preview
- `components/SuggestionGhost/` — Dashed overlay at suggested position
- `../../hooks/useSizeSuggestionsIntegration.tsx` — App-level cross-feature orchestration

## API

`POST /api/size-suggest` — accepts drawer size, last bin placed, occupied grid positions, optional label hash. Returns ranked size + position suggestions. Redis-cached (60s TTL).

## Labs

Feature flag: `size-suggestions` (experimental, opt-in via Labs panel).
