# Sliding tray

A shallow tray that rides a rail on the bin and slides aside to reach what is underneath. Requested via Ko-fi:

> One thing I'd love to do is have a cut out to be able to slide gridfinity inserts across different inserts (so you have 2 base, say, 5u height bins, and another on top that slides between them.

The geometry is built and verified. What remains is the panel: nothing exposes `slide.enabled`, so today the feature is only reachable through a design payload that sets it directly.

---

## How it works

`SlideConfig` on `BinParams` (`src/features/bin-designer/types/slide.ts`). The rail runs along the FRONT and BACK walls, so the tray travels in X.

`railMount` decides where the rail sits, which is what decides whether a tray can leave its own bin at all:

```
railMount: 'interior'        railMount: 'rim'

  ┌─┐         ┌─┐          ┌─┐        ┌─┐
  │ │ ▄▄▄▄▄▄▄ │ │          │ ├────────┤ │
  │ ├─┘     └─┤ │          │ │ ▄▄▄▄▄▄ │ │
  │ │  tray   │ │          │ │        │ │
  │ │         │ │          │ │  bin   │ │
  └─┘         └─┘          └─┘        └─┘

  drops inside one bin     rides over the rim,
  (the default)            crosses to the next bin
```

Both mounts are the **same L-section rail** at two heights: a shelf to carry the tray, a guide outboard of it to locate the tray in Y. Both hold the same bearing overlap, `railProtrusionMm - clearanceMm`. Neither uses a tongue-and-groove — the tray's own floor is the runner, which means fewer mating faces to get wrong and nothing that needs support material.

`interior` needs no end stop (the bin's own side walls bound the travel). `rim` gets one at each end of the track.

### The multi-bin case needs no layout awareness

A rail spanning a bin's full length meets its neighbour's when two railed bins sit side by side, so the track is continuous on its own. Adjacent bins are a known `CLEARANCE` apart plus two corner radii — an ~8mm interruption any tray wider than a unit bridges.

That is why `trayWidthUnits` is an ordinary number rather than something derived from placement. **Spanning is an emergent property of placing railed bins next to each other, not a feature.** An earlier draft of this document proposed design pairing and placement tracking to derive the tray's width; none of it was needed.

---

## Where it does not apply

Each returns a typed `SlideRejection` so the panel can explain a bin that produces nothing:

| rejection           | why                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `no-cavity`         | A solid bin has nowhere for a tray to sit.                                                                                                             |
| `slot-conflict`     | `slotBuilder` cuts divider slots into the front/back walls — the rail's walls — and cuts apply after fuses, so the slots would notch the bearing face. |
| `unsupported-shape` | Custom-shape (cellMask) bins have no polygon-edge mapping yet.                                                                                         |
| `no-bearing`        | A shelf reaching in less than the clearance carries nothing; the tray passes it.                                                                       |
| `rail-below-floor`  | The drop puts the ledge in the floor slab. A 3u bin cannot give the default 21mm drop.                                                                 |

---

## Clearance

`clearanceMm` defaults to **0.25mm per side**, the same per-side gap Gridfinity itself uses (a 41.5mm foot in a 42mm cell is 0.5mm total), so a printer already calibrated to seat bins in a baseplate needs no retuning. It is deliberately looser than the usual FDM sliding fit (0.1–0.2mm per side) because the tray can be 250mm long, where binding is a worse failure than a little play.

It is NOT the shared `CLEARANCE` constant: that is measured across a whole cell rather than per face, so borrowing it would apply double the intended gap.

`slideFitSample.ts` builds a coupon that sweeps the clearance across five rail stubs with one tray stub that runs in all of them, so a maker can find their number without printing a whole bin.

---

## Traps, all found by measuring the generated mesh

Every one of these passed watertight, 2-manifold and bounding-box checks while being wrong.

**A wall pattern deleted the rail entirely.** The pipeline runs fuse → cut → patternCut, so hex prisms carved through the already-fused rail: 0 of 23 sample points survived. Fixed with a keep-out band (gotcha 5), inflated by `max(CUTOUT_BORDER_WIDTH, shapeRadius)`. Kumiko has its own clipping call site and needed the same, including in its `hasClips` guard — a bin whose only clip is the rail keep-out was skipping the clipping pass entirely.

**A rim strip floated above the lip.** The lip's peak is filleted ~0.1mm below `wallHeight + LIP_HEIGHT`, so a strip at the nominal height fused as a **disconnected island** — watertight, right bounding box, falls off the print. Strips now sink 0.5mm into the lip.

**An interior rail against the rim lands inside the lip taper**, which reaches `LIP_TAPER_WIDTH` below its own base plane. It either back-fills the taper (the foot stops seating in a baseplate) or comes out silently thinner than asked for. `interiorRailCeiling` clamps it.

**A square shelf is a 90° cantilever** running the bin's whole length: 486.8mm² of support-needing area on a 3-wide bin. Chamfering the underside 45° back to its wall drops that to 3.1mm², and the rail now costs 0–4mm² across every wall thickness, half-grid and non-square grid.

**End stops must interpenetrate exactly one solid.** Resting them on the shelf gave 2 non-manifold edges; letting them also touch the guide gave 6. They now sit on the shelf's exposed top and bite down into it.

**The tray must rest on real material.** A first `rim` design put the strips outboard of the tray, so the tray was narrower than the opening it was meant to bridge: it rested on nothing and dropped onto the lip's taper. The bearing check now runs against both mounts from one assertion.

---

## What is left

- Panel UI, i18n, and surfacing `rejection` — a 3u bin silently produces nothing today.
- A button for the fit coupon (`exportSlideFitSample` exists; nothing calls it).
- Polygon bins, if wanted: `resolvePolygonSideGeometry` already maps wall cutouts onto polygon edges.
- Nobody has printed one. The clearance default is reasoned, not measured.
