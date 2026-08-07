# Design: sliding tray

Status: proposal, no code written.

Requested via Ko-fi:

> One thing I'd love to do is have a cut out to be able to slide gridfinity inserts across different inserts (so you have 2 base, say, 5u height bins, and another on top that slides between them.

A second storey for a drawer. Tall bins hold the bulk; a shallow tray rides above them on rails and slides aside to reach what is underneath. Two variants are in scope:

- **Spanning** — the tray bridges the gap between two separate tall bins, riding on a rail carried by each.
- **Internal** — the tray rides on ledges inside a single wide bin.

They share a rail profile and a tolerance model. They differ in who owns the rail and, critically, in what determines the tray's width.

---

## Why this is the expensive one

A sliding fit is a **paired-tolerance** feature. Nothing in the current model expresses "this part's groove must match that part's rail, forever". Every existing multi-part feature is either self-contained (a bin's own cutouts) or generated as a matched set in one pass from one `BinParams` (a lid and its bin, dividers and their bin).

The spanning variant breaks a boundary the designer does not currently cross: the tray's width is a property of **the layout** (how far apart the two host bins sit), not of any one design. The bin designer edits one `BinParams` with no knowledge of where the bin is placed. This is the single most important design decision below.

---

## Precedent worth copying

| Existing thing                       | Where                                                             | What to take from it                                                                                                                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LidClickRails`                      | `src/features/bin-designer/types/lid.ts`                          | Per-side independent boolean flags, so a user can rail left+right only. Exactly the shape a rail config needs.                                                                                                        |
| `LidAttachment`                      | same file                                                         | The "exactly one of friction / clickRails / magnetic" mode union, with migration deriving the mode from legacy per-side flags. A tray's retention (free-sliding vs detented vs end-stopped) wants the same treatment. |
| `lidClickRail.ts`                    | `src/features/generation/worker/generators/`                      | An existing rail solid swept along a chosen wall. The closest geometry to a slide rail.                                                                                                                               |
| `CLEARANCE` (`GRIDFINITY.TOLERANCE`) | `src/features/generation/worker/generators/generatorConstants.ts` | 0.5mm, the bin-to-baseplate seating clearance. Read it for the order of magnitude, but a sliding fit needs its OWN parameter rather than borrowing a spec value with a different job.                                 |
| `design-linking`                     | `src/features/design-linking/`                                    | Machinery for keeping related designs in sync, including `useBinResizedListener` and the blocked-resize dialog. The natural home for "these two designs are a sliding pair".                                          |
| Size lock (`locked: true`)           | gotcha 11 in CLAUDE.md                                            | `bin.update` is the only enforcement point for refusing a resize. A sliding pair needs the same discipline.                                                                                                           |

---

## The decision that gates everything

**Where does the tray's width come from?**

### Option A — the tray is a layout-level part

The tray spans a gap the layout defines. Its width is derived from the two host bins' positions.

- Correct for what was asked.
- Requires a part whose dimensions are computed from layout state, which the bin designer has no concept of. Either the designer gains a "sized by layout" mode, or the tray becomes a new kind of object owned by the layout rather than by a design.
- Moving either host bin silently invalidates the tray, and **a move is not a resize**. `design-linking` today reacts to dimension changes; dragging a bin across the grid changes the span without changing any design at all. Tracking placement, not just size, is a requirement of this option rather than a detail of it.

### Option B — the tray is a normal design, the user sets its width

The tray is an ordinary bin with a `slideProfile` on its left and right walls. The user is responsible for making it match the gap.

- Fits the existing model with no new concepts.
- Puts a tolerance-critical measurement on the user, which is exactly the kind of thing this tool exists to avoid.

### Option C (recommended) — pair the designs, derive the width

The tray is a normal design, but it is **linked** to its host design(s) through `design-linking`. The link stores the rail geometry and the span; the tray's width is derived and re-derived when a host changes, and a host resize that would break the pair is blocked the way a locked bin's resize is blocked today.

- Keeps the tray inside the bin designer.
- Reuses machinery that already exists for exactly this class of problem.
- The internal variant is then the degenerate case where host and tray are the same design.

**Open question for the requester:** in their drawer, are the two tall bins the same design placed twice, or two different designs? If they are the same design, the span is `2 * binWidth + gap` and the derivation is trivial. Worth asking before building.

---

## Geometry

### Rail profile

A rail is a shelf plus a lip, swept along the host wall's top region, with the mating groove cut into the tray's wall.

```
   host wall            tray wall
   ┌──────┐             ┌─────────┐
   │      │  ◄─ slideClearance ─►  │
   │   ┌──┴──┐       ┌──┴──┐       │
   │   │ rail│       │groove       │   the groove is the rail
   │   └──┬──┘       └──┬──┘       │   grown by slideClearance
   │      │             │          │   on every face
```

Parameters:

| Name             | Meaning                                | Notes                                                                                                                                                                                                                                                                                                                              |
| ---------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `railHeightMm`   | shelf thickness                        | Must clear the host's stacking lip. See below.                                                                                                                                                                                                                                                                                     |
| `railDepthMm`    | how far the shelf protrudes inward     | Bounded by the host's wall thickness and its cavity.                                                                                                                                                                                                                                                                               |
| `slideClearance` | per-face gap                           | New parameter. Do NOT reuse `CLEARANCE`: it is 0.5mm and it describes the bin-to-baseplate seating fit, not a general tolerance, so borrowing it couples a sliding surface to an unrelated spec value that may change. Start around 0.4-0.5mm per face and expose it, since it is the number users will actually tune per printer. |
| `railZ`          | height of the rail above the bin floor | For the spanning variant this must be identical on both hosts.                                                                                                                                                                                                                                                                     |

### The stacking-lip collision

This is the trap most likely to produce a broken part.

Per gotcha 10 in `CLAUDE.md`, `buildTopShapeLoft` extends the lip `LIP_TAPER_WIDTH` **below** its own base plane for the angled support blending it into the wall. A rail placed near the top of a host wall lands inside that taper region. Two failure modes:

1. The rail fuses into the lip taper and back-fills it, so the host no longer stacks or seats.
2. The rail is cut away by the lip geometry and silently comes out thinner than specified, which a bounding-box or watertight check cannot see.

A rail must therefore either sit clear of `LIP_HEIGHT + LIP_TAPER_WIDTH` from the rim, or the lip must be locally suppressed along that wall the way the cutout editor now clears it (#3281 did exactly this for cutouts and is the pattern to follow).

### Wall pattern clipping

Gotcha 5: any feature cutting through a wall needs matching border clipping in `src/features/generation/worker/generators/wallPatternBuilder.ts`. A rail and its groove both qualify. Without it, hex prisms will bleed into the rail and produce a jagged sliding surface, which is worse here than cosmetically, because it is the bearing face.

### Print orientation

A rail's underside and a groove's roof are both horizontal overhangs. At typical rail depths this bridges fine, but it should be checked with the existing overhang audit rather than assumed. A chamfered rail underside (45°) avoids supports entirely and is probably the right default.

---

## Data model sketch

```ts
export type SlideRole = 'host' | 'tray';
export type SlideSide = 'left' | 'right';

export interface SlideProfile {
  readonly enabled: boolean;
  readonly role: SlideRole;
  /** Independent per side, mirroring LidClickRails. */
  readonly sides: Record<SlideSide, boolean>;
  readonly railHeightMm: number;
  readonly railDepthMm: number;
  /** Rail top measured from the bin floor. Must match across a pair. */
  readonly railZMm: number;
  readonly clearanceMm: number;
  /** Stops the tray sliding out. */
  readonly endStop: 'none' | 'front' | 'back' | 'both';
}
```

Hangs off `BinParams` as `slide`. Migration: absent means disabled, so old designs are untouched.

---

## Work breakdown

Each row is a reviewable PR.

| #   | Scope                                                                                                                   | Notes                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `SlideProfile` type, defaults, migration, `api/lib/designerValidation.ts` mirror                                        | Server rejects unknown params, so the mirror is not optional.                                                                                                                   |
| 2   | Rail + groove geometry in the worker, with lip suppression                                                              | The real work. Needs `__kernel-tests__` probes for the lip interaction, since it is invisible to standard assertions.                                                           |
| 3   | Wall pattern border clipping for rail and groove                                                                        | Gotcha 5.                                                                                                                                                                       |
| 4   | Panel UI, ghost overlay, i18n across 15 locales                                                                         | Ghost overlay matters: users need to see where the rail sits before printing.                                                                                                   |
| 5   | Design pairing via `src/features/design-linking/`, derived tray width, blocked-resize guard, and **placement tracking** | Option C. The part that makes it trustworthy. Placement is the easy thing to forget: a host dragged one cell sideways changes the span while every design stays byte-identical. |
| 6   | Fit-test coupon                                                                                                         | A short rail + groove pair users print to tune `clearanceMm` before committing to a full set. Precedent: the existing calibration coupons.                                      |

Items 1–4 deliver the internal variant. 5 adds the spanning variant.

---

## What to verify, and how

Standard assertions will not catch the failure modes here.

- **Rail thinned by the lip taper** — invisible to bounding box, triangle count and watertightness. Probe the volume with `isSolidThrough` / `sectionHalfWidth` from `src/features/generation/worker/generators/__kernel-tests__/meshAssertions.ts`, the same approach that caught the foot and lip defects in gotcha 10.
- **The pair actually slides** — assert `groove − rail ≥ 2 × clearanceMm` on every face analytically, from the same parameters that drive both solids. This is the equivalent of the plate/transform agreement test in the project-file work: two independently generated things that must agree, pinned by one shared derivation.
- **Rail heights match across a pair** — a scenario building both host and tray from a linked pair and comparing `railZMm`.
- **Overhang** — run the existing stack-print overhang audit over a railed bin.

---

## Recommendation

Build items 1–4 for the internal variant first. It is self-contained, needs no new layout concepts, and produces the rail geometry, the lip interaction and the tolerance model that the spanning variant also needs. Ship it, get real print feedback on `clearanceMm`, then do 5.

Before any of it, ask the requester whether their two tall bins are one design placed twice. It changes how much of item 5 is needed.
