# Places

Find what a bin holds across every layout, behind the `places` labs flag.

## Key files

- `find/matchBins.ts`: word matching over item names, labels and notes (prefixes, a trailing plural, the label vocabulary's canonical terms)
- `find/findIndex.ts`: per-session search records for stored layouts, re-read when a library entry's `modifiedAt` changes
- `hooks/useFindBins.ts`: results with their folder, layout and layer path; the active layout is read live from the store
- `hooks/useFocusBin.ts`: opens the bin's layout and selects it on its layer
- `components/PlacesFindGroup/`: the bin group the shell hands the command palette

## Gotchas

- The command palette cannot import this slice; `App.tsx` passes `PlacesFindGroup` in through the palette's `extraResults` prop.
- Selecting is the highlight. `setActiveLayer` clears the selection, so focus sets the layer before selecting.
