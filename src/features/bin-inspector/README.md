# Bin Inspector

Selected bin details panel with edit capabilities.

```mermaid
graph TB
    SEL[(selection store)] -->|selectedBinIds| UBI[useBinInspector]
    LAY[(layout store)] -->|bin data| UBI
    UBI --> SI[SingleBinInspector] & MI[MultiBinInspector] & ES[EmptyState]
    SI -->|edits| UA[useUndoableAction] --> LAY
```

## Key Files

- `components/Inspector/SingleBinInspector.tsx` — single bin edit panel
- `components/Inspector/MultiBinInspector.tsx` — multi-select summary
- `components/Inspector/BinLabelField.tsx` — smart label combobox (see below)
- `components/Inspector/CustomPropertiesEditor.tsx` — custom key-value property editor
- `labelSuggest/` — pure, on-device ranking engine for label suggestions
- `hooks/useLabelSuggestions.ts` — memoized adapter feeding the engine from the active layout
- `components/Inspector/SplitWarning.tsx` — print bed size warning indicator
- `components/Inspector/EmptyState.tsx` — no selection state
- `hooks/useBinInspector.ts` — selection resolution and bin data. Also exposes `applySuggestedSize` (single-`updateBin` resize for one-step undo) and `canApplySuggestedSize` (fit check), both built on a shared `resolveSuggestedRect` so the size-suggestion gate can't disagree with the actual mutation.

## Label autocomplete

`BinLabelField` replaces the plain label input with a predictive combobox
(design-system `Combobox`). Suggestions come from `labelSuggest/getLabelSuggestions`,
a pure function of the current layout — fully on-device, no network. It blends five
signals: numeric **sequence** continuation (`M3`/`M4` → `M5`), reuse of an existing
label, co-occurrence with **edge-adjacent or same-category** neighbors, vocabulary
**domain** affinity, and text match (prefix / substring / cross-language alias /
typo-tolerant fuzzy). The top prediction is offered as inline **ghost text**
(Tab/→ to accept) on desktop; ghost is disabled on touch. Each row carries a muted
reason tag. Accepts fire a hashed `label_suggestion_accepted` PostHog event (no raw
text) for future model training. Ordering weights + the ghost confidence floor live
in `labelSuggest/getLabelSuggestions.ts`.

## Size suggestion (Labs)

`SingleBinInspector` renders the `bin-recommender` `BinSizeSuggestion` under the label field, gated on the `bin_recommender` Labs flag (the lazy chunk isn't fetched when off). It wires `onApply={applySuggestedSize}` and `canFit={canApplySuggestedSize}`.

## Constraints

| Field        | Limit                                   |
| ------------ | --------------------------------------- |
| Label        | 24 chars                                |
| Notes        | 256 chars                               |
| Custom props | 50 max, key: 32 chars, value: 256 chars |

## Gotchas

1. **Multi-select shows summary only** - can't edit dimensions of multiple bins
2. **Reserved property keys** - bin field names (`id`, `layerId`, `x`, `y`, `width`, `depth`, `height`, `clearanceHeight`, `category`, `label`, etc.) blocked from custom props
3. **Height validation** - must fit in layer + drawer height
4. **Rotation with relocation** - bins can be rotated in place or auto-repositioned to nearest valid spot if blocked
