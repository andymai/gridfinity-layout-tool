# Print Export

Print list generation with bin splitting and filament estimates.

## Key Files

| File                              | Purpose                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `hooks/usePrintList.ts`           | Core hook: generates split print list from layout        |
| `components/PrintModal.tsx`       | Full-screen print list view                              |
| `components/PrintListSummary.tsx` | Aggregated stats (total bins, filament, time)            |
| `utils/split.ts`                  | `splitBinSize()` - recursive bin splitting for print bed |
| `utils/printEstimates.ts`         | Filament weight, time, cost calculations                 |
| `utils/printLayout.ts`            | Print bed arrangement visualization                      |

## Core Concepts

- **Print list**: Bins split to fit print bed, grouped by size
- **Split algorithm**: Recursively halves oversized bins until they fit
- **Estimates**: PLA density (1.24 g/cm3), configurable cost/gram

## Data Flow

```
Layout bins → splitBinSize(maxSize) → PrintListRow[]
  → group by (width, depth, height)
  → calculate filament per unique size
  → sum totals for summary
```

## Split Algorithm

```typescript
splitBinSize(w, d, h, maxUnits):
  if (w <= max && d <= max) return [{ w, d, h, count: 1 }]
  if (w > d) split width in half
  else split depth in half
  recurse and combine results
```

## Print Estimates

| Metric       | Formula                              |
| ------------ | ------------------------------------ |
| Filament (g) | shell volume × density + base weight |
| Time (min)   | proportional to filament weight      |
| Cost         | filament × $/gram setting            |
| Spool %      | total filament / spool size          |

## Gotchas

1. **Max print size in mm** - converted from `printBedSize` setting
2. **Dividers not counted** - estimate may undercount filament
3. **Staging bins excluded** - only placed bins in print list
4. **Category grouping optional** - toggle in UI

## Integration

- **settings**: `printBedSize`, `filamentCostPerGram`, `spoolSize`
- **bin-list modal**: Uses same `usePrintList` data
- **export**: TSV/CSV/JSON download via `useBinList`
