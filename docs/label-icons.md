# Contributing a label plate icon

Label plates can carry a small hardware icon beside their text. Icons are stored
as SVG path data in [`src/shared/constants/labelIconPaths.ts`](../src/shared/constants/labelIconPaths.ts)
and turned into printed geometry by the generation worker, so contributing one
means sending a path — no CAD, no knowledge of the geometry kernel.

## What an icon has to be

An icon is a **solid filled silhouette**, the way a road sign is: one shape,
optionally with holes punched in it. It is not line art. Curves are welcome —
what has to go is the stroke.

That constraint comes from the plate. The readable band is **7.8 mm tall**, an
icon may be at most **11.5 mm wide**, and it stands **0.4 mm** proud of the
plate. At that size a stroke-based drawing — a schematic resistor, an outline
style icon — either disappears or prints as a smear. Look at the existing
fasteners for the register: chunky, closed, high-contrast.

| Constraint | Value   | Where it comes from                                                     |
| ---------- | ------- | ----------------------------------------------------------------------- |
| Height     | 7.8 mm  | `TEXT_BAND_MM` — plate height minus the latch flange margins            |
| Max width  | 11.5 mm | `ICON_MAX_WIDTH_MM` — wider icons shrink rather than crowd the text     |
| Relief     | 0.4 mm  | `LABEL_PLATE_TEXT_DEPTH_MAX_MM` — the filament-swap two-colour contract |

## The format

```ts
hexSocketCap: {
  outline: 'M -5 3.2 L -2.2 3.2 L -2.2 1.35 L 5 1.35 L 5 -1.35 L -2.2 -1.35 L -2.2 -3.2 L -5 -3.2 Z',
  holes: ['M -4.3 1.6 L -3.0 1.6 L -3.0 -1.6 L -4.3 -1.6 Z'],
},
```

**`outline`** — one closed subpath for the outer boundary.
**`holes`** — each fully-interior opening as its own closed subpath.

Rules, all enforced by `labelIconPaths.test.ts` so a mistake fails fast:

- **One subpath per string.** Exactly one `M`. Don't put the holes inside
  `outline` as extra subpaths (see below for why).
- **Absolute commands only.** Uppercase `M L H V C S Q T A Z`. Lowercase
  relative commands are rejected.
- **Explicitly closed.** Every path ends in `Z`.
- **No transforms, strokes, groups, or styles.** Only the `d` attribute travels;
  a `transform` on the element is silently lost, so bake it in.
- **Holes must be strictly inside the outline.** A shape that crosses the
  boundary corrupts the plate boolean.

Anything the SVG path grammar supports works, including arcs and Béziers. Arcs
stay **analytic** rather than being flattened to line segments — a full circle
extrudes to π·r²·h to double precision — so curves print smooth.

Two exceptions worth knowing, both discovered the hard way:

- **No zero-length segments.** Repeating the current point (a `L` to where the
  pen already is) is invisible in a browser but fails the kernel outright with
  `makeLineEdge: construction failed`.
- **Arcs that meet a straight edge tangentially can collapse.** The horseshoe
  magnet's outer arc runs into its leg edges at a tangent; built as a true arc
  the wire loses roughly half its enclosed area while keeping the correct
  bounding box. That icon uses a polyline arch instead. If a curved boundary
  runs tangent into a line, check the area, and fall back to a polyline if it
  is wrong.

### The frame doesn't matter

Author in a 24×24 viewBox, a ±5 box, or whatever your tool emits. Each
silhouette is scaled from **its own bounding box** into the readable band, so
the frame is irrelevant. (The existing icons happen to use ±5 because they were
ported from hand-written code.)

Y points **down**, as in every SVG. The importer flips to the kernel's Y-up
convention, so paths land the right way up without you doing anything.

## Why holes are listed separately

The obvious thing — one compound path relying on SVG's nonzero fill rule — does
not work reliably here. The importer flattens every subpath into a single
boundary set and lets the geometry kernel infer containment. It honours winding
for polygon loops but **unions arc loops regardless of direction**: a
compound-path washer comes out as a solid disc with a raised boss where its bore
should be.

Worse, that failure is invisible to almost every check. The bounding box is
identical, and the plate gains _more_ material, not less. Listing holes
explicitly makes the intent unambiguous, and the worker cuts them in 3D after
extrusion where the boolean has no such gap.

## Submitting one

1. Draw the silhouette in any vector editor. Convert strokes to fills, flatten
   transforms, and union everything into a single outer shape.
2. Copy the `d` attribute for the outline and for each hole.
3. Open a pull request adding the entry to `LABEL_ICON_PATHS` (with a
   `domain`, which is the group it appears under in the picker), the id to
   `LABEL_PLATE_ICONS` in [`labelPlates.ts`](../src/shared/constants/labelPlates.ts),
   the same id to `VALID_LABEL_PLATE_ICONS` in
   [`designerValidationConstants.ts`](../api/lib/designerValidationConstants.ts),
   and a display name to `binDesigner.plateIcon.<id>` in
   [`src/i18n/locales/en.ts`](../src/i18n/locales/en.ts). Miss the server list
   and the picker offers an icon that makes the whole design 400 on sync.
   Translations for the other locales can follow separately — say so in the PR
   and we'll handle them.

Or just post the path data on
[discussion #2877](https://github.com/andymai/gridfinity-layout-tool/discussions/2877)
and we'll wire it up.

## Checking your work

```bash
# Format and structure — fast, no geometry kernel
pnpm exec vitest run src/shared/constants/labelIconPaths.test.ts

# Real geometry: imports, sizes, bores actually cut
pnpm exec vitest run src/features/generation/worker/generators/labelPlateIcons.test.ts

# Builds onto an actual plate in both emboss and deboss
pnpm exec vitest run src/features/generation/worker/generators/labelPlateIcons.plate.test.ts
```

If your icon has holes, confirm the volume assertions cover it — a bore that
silently fails to cut is the one defect the bounding-box checks cannot see.
