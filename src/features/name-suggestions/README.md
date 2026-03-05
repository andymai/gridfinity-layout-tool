# Name Suggestions

Intelligent layout name suggestions using local algorithms + optional LLM enhancement.

```mermaid
graph TB
    UST[useSuggestionTrigger] -->|5+ bins, untitled| GS[generateSuggestions]
    GS --> Labels & Purpose & Categories & Dimensions
    GS --> NSS[(store)]
    UST -->|parallel| API[/api/suggest-name]
    API -->|LLM suggestions| NSS
    NSS --> NFH[NameFieldHighlight] --> SP[SuggestionPopover]
    UNS[useNameSuggestions] --> NSS
    SP -->|accept| LIB[(library store)]
    SP -->|dismiss| LIB
```

## Key Files

- `components/SuggestionPopover.tsx` — suggestion dropdown UI
- `components/NameFieldHighlight.tsx` — pulsing highlight wrapper
- `hooks/useNameSuggestions.ts` — UI hook (accept/dismiss/telemetry)
- `hooks/useSuggestionTrigger.ts` — auto-trigger + dual-path generation
- `store/index.ts` — Zustand store (state + persistent dismissal)
- `utils/generateSuggestions.ts` — local name generation (lazy-loaded)
- `utils/stringUtils.ts` — hashName, editDistance for telemetry
- `api-types.ts` — shared client/server types for LLM API
- `types.ts` — core suggestion types

## Architecture

### Dual-Path Generation

1. **Local** (instant): `generateSuggestions()` analyzes bin data using:
   - `namingData.ts` for domain detection, vocabulary, and purpose inference
   - Category names, drawer dimensions
2. **LLM** (parallel): `/api/suggest-name` generates culturally-localized names (5s timeout)

Results merge in store. Local suggestions show immediately; LLM suggestions enhance alternatives.

### State Management

- **Store**: `useNameSuggestionStore` (Zustand) tracks current suggestions, expand/collapse, loading state
- **Persistence**: Dismissal state saved per-layout in `library.entries[].nameSuggestionState`
- **Telemetry**: Tracks shown/accepted/edited/dismissed events with hashed names (privacy-preserving)

## Trigger Conditions

- 5+ bins have labels (on-grid only)
- Layout name is "Untitled layout"
- Not dismissed for this layout (persists across sessions)

## Entry Points

- **Auto-trigger** — Pulsing highlight on Header name field
- **Command Palette** — "Suggest Layout Name" (bypasses dismissal)
- **Layout Manager** — "Suggest Name" menu item (bypasses dismissal)

## Usage

```tsx
<NameFieldHighlight>
  <button>{layoutName}</button>
</NameFieldHighlight>
```
