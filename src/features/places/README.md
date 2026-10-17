# Places

Find what a bin holds across every layout, behind the `places` labs flag.

## Key files

- `find/matchBins.ts`: word matching over item names, labels and notes (prefixes, a trailing plural, the label vocabulary's canonical terms)
- `find/findIndex.ts`: per-session search records for stored layouts, re-read when a library entry's `modifiedAt` changes
- `hooks/useFindBins.ts`: results with their folder, layout and layer path; the active layout is read live
- `hooks/useFocusBin.ts`: opens the bin's layout and selects it on its layer
- `components/`: `PlacesFindGroup` (command palette), `PlacesFindList` (mobile layouts sheet), `PlacePath` (header)

## Gotchas

- The command palette cannot import this slice; the shell's `usePlacesFindResults` passes `PlacesFindGroup` through `extraResults`. Invariants: the `places` skill.
- Selecting is the highlight. `setActiveLayer` clears the selection, so focus sets the layer before selecting.
