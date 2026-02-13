# Print Export

Print list generation with bin splitting and filament estimates.

```mermaid
graph TB
    PM[PrintModal] --> UPL[usePrintList]
    UPL --> LAY[(layout store)]
    UPL --> SPL[split.ts] -->|recursive| PLR[PrintListRow]
    PLR --> PE[printEstimates] --> EST[Estimates]
    SET[(settings)] --> SPL & PE
```

## Key Files

**Components:**

- `components/PrintModal.tsx` — main print list dialog with settings
- `components/PrintLayout.tsx` — renders print preview layout
- `components/PrintBin.tsx` — individual bin display in print view
- `components/PrintListSummary.tsx` — summary stats display
- `components/PrintListEmpty.tsx` — empty state
- `components/SortOrderConfig.tsx` — sort configuration UI
- `components/printBinLayout.ts` — CSS grid calculations for bin positioning

**Hooks:**

- `hooks/usePrintList.ts` — aggregates bins into print rows, filtering/sorting

**Utils:**

- `utils/split.ts` — recursive bin splitting for print bed constraints
- `utils/printEstimates.ts` — filament/time/cost calculations
- `utils/printListOperations.ts` — filter, sort, and group operations
- `utils/printLayout.ts` — bin/layer filtering and formatting for print

## Split Algorithm

```
splitBinSize(w, d, maxUnits):
  if (w <= max && d <= max) return pieces
  split larger dimension in half
  recurse
```

## Print Estimates

| Metric       | Formula                          |
| ------------ | -------------------------------- |
| Filament (g) | shell volume × 1.24 g/cm³ + base |
| Time (min)   | proportional to filament weight  |
| Cost         | filament × $/gram setting        |
| Spool %      | total / spool size               |

## Settings Dependencies

- `printBedSize` - max bin size in mm
- `filamentCostPerGram`
- `spoolSize`

## Gotchas

1. **Dividers not counted** - estimate may undercount filament
2. **Staging bins excluded** - only placed bins in print list
3. **Category grouping optional** - toggle in UI
