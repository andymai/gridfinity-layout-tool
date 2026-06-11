# Compartment Sizing UX — Design

**Date:** 2026-06-11
**Feature area:** `src/features/bin-designer` — `CompartmentEditor`
**Status:** Implemented (see revision below)

## Revision (2026-06-11, post-review)

After seeing the size-led panel, the direction changed: **the Columns/Rows
steppers are the primary control, and manual mm sizing is an advanced opt-in.**
The fit-guarantee model and the single-source-of-truth principle below still
hold — only the hierarchy changed:

- Primary view: Columns/Rows `StepperControl`s with visible labels.
- "Set by size" is a collapsible disclosure (collapsed by default). Expanding it
  reveals the mm Width/Depth fields (same solver-snap behavior). Keeping them out
  of the DOM by default also avoids an accessible-name collision with the bin's
  own Width/Depth controls (`CompartmentEditor` renders inside `ParameterPanel`) —
  the size fields use `(mm)`-suffixed labels so they're unambiguous when expanded.
- Divider height returns to the wall-thickness section (its original home).

## Problem

The recently shipped "compartment dimensions in mm" feature (#2101) added a
`Layout: [By count] [By size]` mode toggle. In **By size** mode the user types a
target width/depth and the grid packs as many compartments as fit while keeping
every one at least that size (fit-guarantee). The achieved size is shown as
`≥ 32.1 mm (+2.1)`.

Confirmed pain points (from the user):

1. **The `≥ X mm (+2.1)` notation is cryptic** — the signed delta is hard to
   decode at a glance.
2. **It's not obvious the value you type is a _minimum_, not the size you get.**

The two-mode toggle also hides the relationship between count and size: switching
modes swaps which control is visible, so count and size never appear together.

## Goal

Replace the two-mode toggle with a **single, size-led panel** that:

- keeps the existing fit-guarantee semantics (primary use case: "my object is
  30 mm — every compartment must be at least that big"),
- makes "what you get" legible without signed-delta math, and
- never shows two on-screen numbers that disagree.

Non-goals: changing the solver/cavity math, changing the generator/geometry,
folding compartment **height** into this tool.

## Key decision: single source of truth

The stored state is already `cols × rows` on the compartment config. Both the
size fields and the grid steppers are **views of that same value**:

- The **size fields display the exact _smallest_ (worst-case interior) opening**,
  always mirroring reality. There is no separate "typed target" stored.
- Typing a number means _"make compartments at least this big"_: it runs the
  existing `solveCountForMinCavity`, the count snaps, and the field updates to
  the real achieved value.
- Nudging the grid steppers re-derives the size fields live.

Because both controls derive from one value, the panel can never display a stale
or contradictory number. This single decision resolves three review findings at
once: the stale-field problem, the default/empty-state ambiguity, and the
"min vs up to" wording clash.

## Panel design

```
Smallest opening (mm)
  Width   [ 32.1 ]      Depth   [ 47.6 ]
Grid      [−] 4 [+]  ×  [−] 3 [+]
Rounds up to tile the bin evenly · edge compartments are wider
```

### Controls

| Control            | Type                        | Behavior                                                                                               |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Width / Depth (mm) | Text entry, **no spinner**  | Value = current smallest opening. On commit (blur/Enter), interpreted as "≥ this"; solver snaps count. |
| Grid (cols × rows) | `StepperControl` (typeable) | Direct count control; 1→12 in one keystroke. Adjusting re-derives the size fields.                     |

- **Width/Depth** are type-to-set only (no `onStep` spinner) because size→count
  is discrete; a 1 mm spinner would jump counts unpredictably. Two steppers
  fighting over one value is also the clutter the unification is meant to remove.
- **Grid** keeps the full `StepperControl` (nudge **and** typeable), so power
  users aren't forced to tap 1→12.

### Readout / framing

- No separate readout line — the achieved size already lives in the fields.
- The label frames the number as **cavity geometry, not a fit promise**:
  "Smallest opening (mm)". We do **not** say "fits objects up to X" because that
  ignores print tolerance and height and would overpromise.
- Caption: **"Rounds up to tile the bin evenly · edge compartments are wider"** —
  explains _why_ you don't get exactly what you typed, and discloses the
  edge/interior asymmetry (worst-case interior value is what's shown).

### Edge cases

- **Grid cap (12):** when `solveCountForMinCavity` clamps at `MAX_COMPARTMENT_GRID`
  and the achieved size therefore exceeds what a smaller entry implied, show a
  hint (e.g. "Max 12 across") so a too-small entry isn't a silent surprise.
- **Non-uniform (merged) layouts:** fields show the smallest compartment; typing
  a size resets to a uniform grid (current `setCompartmentGrid` behavior,
  unchanged). The 2D drag-to-merge/split editor is untouched.
- **First open:** fields show the current achieved min; grid shows the current
  count. No placeholder/fake-value ambiguity (a consequence of "field =
  achieved").

### Height

`DividerHeightControl` stays its own control with no functional change, but is
relocated/relabeled to sit directly under this panel so the W×D×H story reads
together. (Currently it renders inside the by-size branch only.)

### Accessibility

- The caption (and any cap hint) live in an `aria-live="polite"` region so screen
  readers announce changes as the user nudges the grid.
- Grid steppers carry explicit aria-labels (already provided via `StepperControl`
  `ariaLabel`).

## Affected code

- **`CompartmentEditor.tsx`**
  - Remove local state `sizeMode`, `targetW`, `targetD`, `GRID_MODES`, the mode
    toggle, `enterSizeMode`, `fitNote`/`fitNoteW`/`fitNoteD`.
  - Render the unified panel: always-visible Width/Depth (type-only, value =
    `minUniformCavity(...)`) + Grid steppers (existing `handleColsChange/Step`,
    `handleRowsChange/Step`).
  - `applyTargetWidth`/`applyTargetDepth` keep their solver call but no longer
    store a target — they just snap the count. Add the cap-reached hint.
  - Move `DividerHeightControl` to render under the panel unconditionally
    (when `compartmentCount > 1`).
- **`compartmentDimensions.ts`** — reused **unchanged** (`minUniformCavity`,
  `solveCountForMinCavity`, `formatCompactMm`).
- **i18n (all 7 locales: en, de, es, fr, nb, nl, pt-BR)**
  - Remove: `binDesigner.compartmentEditor.gridMode`, `gridModeCount`,
    `gridModeSize`, `targetWidth`, `targetDepth`, `fitActual`.
  - Add (new keys, clearly named): a "Smallest opening (mm)" group label,
    `width`/`depth` sub-labels, the tile-evenly caption, and the grid-cap hint.
    Do not repurpose the removed `targetWidth`/`targetDepth` keys — the wording
    changed, so old keys are deleted and new ones added.
  - Update the i18n allowlist entries for removed/added keys; run
    `pnpm run check:i18n`.
- **Tests** — update `CompartmentEditor` tests for the removed toggle and the
  new always-on panel; assert solver snap-on-commit and the field-mirrors-count
  behavior. Solver unit tests in `compartmentDimensions.test.ts` stay as-is.

## Testing strategy

- Unit (Vitest + jsdom, `createTestLayout`):
  - Typing a min width snaps `cols` via the solver and the field reflects the
    achieved value (not the typed value when they differ).
  - Nudging the grid updates the displayed size; no stale field.
  - Grid-cap hint appears when the solver clamps at 12.
  - Non-uniform layout shows the smallest compartment.
- Verify no `console.log`, no `any`, `import type` for types, `@/` alias,
  `useShallow` retained for the multi-select store read.
- `pnpm run quality` (typecheck + lint + knip) and `pnpm run check:i18n`.

## Open risk

`StepperControl` is currently used for the size fields _with_ a spinner. The
type-only variant may need a prop (e.g. omit `onStep`) or a fallback to a plain
`Input`. Confirm `StepperControl` degrades cleanly without `onStep` during
implementation; if not, use the design-system `Input` for the size fields.
