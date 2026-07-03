---
name: debugging-playbook
description: Cross-cutting debugging method for any bug report or regression — git archaeology on fix commits, reproduce-first, fixing every layer — plus an index of the trap classes that recur in git history. Load when a symptom has no obvious owning subsystem, when a fix "works" but you cannot explain why, or for symptoms like silent bounding-box fallbacks, preview-vs-export divergence, half-grid crashes, wedged workers, "undefined (reading dispatch)", or a slicer rejecting a 3MF.
---

# Debugging Playbook

## When to use

- You have a bug report or regression and do not yet know which subsystem owns it.
- A symptom matches nothing in CLAUDE.md's Debugging section.
- Your fix silences the visible symptom but you cannot state the invariant it restores.
- You are about to declare a fix done and want the recurrence checklist.

## Git archaeology first

Fix commits in this repo have unusually detailed bodies: root-cause analysis, upstream
references (slicer C++ internals, brepjs issues), and verification notes. Most trap
classes in the index below were fixed 2–5 separate times; the previous fix commit
usually states the exact invariant the new bug re-violates. Search history before
reading code:

```bash
git log --format='%h %s' -i --grep='<symptom keyword>'
git log --follow --format='%h %s' -- <suspect file>
git show <hash>
```

Read `git show <hash>` bodies, not just diffs. Two exemplars worth reading in full:
`git show 9c12e6b68` (wedged worker recovery) and `git show bf18724ad` (chunk-cycle
singleton, third recurrence of its class).

## Mental model

1. **This codebase fails silently in known places.** "Looks correct" is not evidence.
   The proven silent failures: the worker catches OCCT wire errors and returns a plain
   `box()` (`src/features/generation/worker/generators/cutoutBuilder.ts`), so bad paths
   render as rectangles with no error; the editor's earclip triangulation bails to an
   empty fill (documented at `dropCoincidentPoints` in `src/shared/utils/polyline.ts`;
   the earclip itself is in `src/features/bin-designer/components/panel/CutoutsSection/pathGeometryTriangulation.ts`),
   so a degenerate path still looks fine in 2D; a degrees-magnitude angular tolerance
   silently disables edge refinement (must be radians — `EDGE_ANGULAR_TOLERANCE_RAD` in
   `src/shared/constants/tessellation.ts`); and a stale export cache
   (`isLastSolidExportQuality` in `src/features/generation/worker/generators/shapeCache.ts`,
   checked by `binExporter.ts`) can make an entire scenario matrix pass vacuously.
2. **Multiple geometry paths exist in parallel per bin**: WASM-free direct mesh, Manifold
   draft, and the OCCT BREP export pipeline (`src/features/generation/worker/generators/`)
   — the geometry-generation skill has the three-path breakdown. A fix in one does not
   fix the others; several history bugs were preview-only or export-only.
3. **The layer chain is UI → CQRS command/handler → Zustand store → generation worker
   (BREP) → draft mesh → export encoder.** "Fix all layers" concretely means: after
   fixing the causal layer, walk the chain in both directions and grep for sibling
   implementations of whatever you touched (e.g. `dropCoincidentPoints` in
   `src/shared/utils/polyline.ts` must be the single dedup used by both the 2D editor
   and the worker).
4. **Geometry regressions cluster on four parameter axes**: overhang (symmetric and
   asymmetric), half-grid fractional sizes (x.5), magnet/screw bases, and split/oversized
   bins. Reproduce and re-verify across these — the geometry-debugging skill has the
   test matrix.
5. **Every merge to main auto-releases** via release-please; a `fix:` title becomes a
   public changelog entry. See the release-and-ci skill before merging.

## Method

1. Reproduce with a failing test before changing code. Fast loop:
   `pnpm test:affected`; single file: `pnpm test:run <path>`. For geometry symptoms use
   the scenario/export-integrity harness — see the geometry-debugging skill.
2. Run the archaeology commands above and match the symptom against the trap index
   below; load the owning skill before editing.
3. Fix at the causal layer, then check every other layer in the chain (mental model 3)
   and the parallel geometry path (mental model 2).
4. Re-run the reproduction test, then `pnpm test:run` and `pnpm quality`. Never bypass
   a failing gate — the quality-gates skill lists the legitimate unblock per failure.
5. Write the fix commit body like the ones you just read: root cause, invariant
   restored, how it was verified.

## Trap-class index

Match the symptom, then load the owning skill — it has the recipe; do not improvise.

| Symptom                                                                                      | Trap class                                                                                                       | Owning skill        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------- |
| Multi-color 3MF shows wrong colors in BambuStudio, or OrcaSlicer rejects the file            | Undocumented slicer validators: missing per-triangle `paint_color`, vendor identity claims, extruder-mode config | print-export        |
| Exported STL non-manifold / slicer repair warnings on feature-combo bins                     | Fuse ordering (socket must fuse last) + near-degenerate profiles                                                 | geometry-generation |
| Interior features cramped or overlapping a wall when overhang is set                         | Consumer used nominal dims instead of `innerW/innerD/innerOffsetX/Y` from `deriveDimensions`                     | geometry-generation |
| Crash `a[e] is undefined` or wrong output at x.5 (half-grid) sizes                           | Integer assumptions on fractional dims; dropped half-grid fields in derived params                               | geometry-debugging  |
| One slow generation wedges the app; every later request times out                            | Worker stuck in synchronous WASM op; CANCEL can never arrive — must terminate+respawn                            | geometry-debugging  |
| Big bin times out but geometry is fine                                                       | Footprint-aware timeout budgets (re-tuned 5+ times) — suspect budget math first                                  | geometry-debugging  |
| `Cannot pass deleted object as a pointer of type OcctKernel*`, or kernel fails on Safari/iOS | WASM kernel lifecycle: wrapper GC'd, Vite pre-bundling, Safari build target                                      | geometry-generation |
| Sporadic `Cannot read properties of undefined (reading 'dispatch')` right after a deploy     | Chunk-cycle race: singleton snapshotted a module binding instead of re-reading it live                           | state-and-cqrs      |
| Path cutout correct in 2D editor, plain rectangle in 3D                                      | Duplicate consecutive vertices → OCCT throws → silent `box()` fallback                                           | geometry-debugging  |
| Jagged wall cutouts, hex-pattern bleed, openings blocked by dividers/lip                     | Wall-border rule: patterns, dividers, and stacking lip each need a matching cut                                  | geometry-generation |
| Preview wrong but export fine, or the reverse                                                | Dual-kernel parity: feature exists in only one of the two geometry paths                                         | geometry-debugging  |
| Curved edges render coarse despite tolerance plumbing                                        | Degrees passed where brepkit expects radians — silent no-op                                                      | geometry-generation |
| Scenario tests all green but the bug reproduces in the app                                   | Vacuous matrix: last-solid cache not reset per scenario                                                          | geometry-debugging  |
| CI blocks merge on i18n for an unrelated change                                              | Identical-value check / hardcoded strings outside `t()`                                                          | i18n-changes        |
