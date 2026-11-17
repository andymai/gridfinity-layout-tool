# Labels

Paper labels for label makers: a list typed or pasted in, drawn as one PNG per label at the printer's own dots. Opened from Print, the command palette and What's New through `labelsOpen` in the view store, and mounted at App level so it opens on every route.

## Key files

- `utils/planLabel.ts`: the name and an optional detail line, set with the shared `planTypeBlock` in the 3D label faces
- `utils/labelMedia.ts`: printers, their media and dots across the tape, with sources
- `utils/parseLabelList.ts` and `utils/partNumbers.ts`: pasted rows to labels; supplier patterns only split text, nothing looks a part up
- `utils/labelPng.ts`: canvas raster, black-and-white threshold, `pHYs` resolution
- `store/labelListStore.ts`: the list and printer choice, in localStorage

## Gotchas

- The list is not layout data: no sync, undo or share.
- `planTypeBlock` wraps a line only when it cannot fit, so `planLabel` tries one to three balanced lines itself and keeps the largest size.
- The preview and the PNG draw the same `labelPaths`. The PNG needs a canvas, so tests cover the plan and the bytes, not the raster.
