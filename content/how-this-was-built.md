---
title: How This Gridfinity Tool Was Built
description: 1,000 releases in 213 days by one engineer and AI tooling. The stack, the gates that made the pace survivable, and what it actually cost.
keywords: gridfinity layout tool, built with ai, ai assisted development, solo developer, release engineering, open source 3d printing software, claude code, agpl
schema: Article
breadcrumbs:
  - name: Home
    url: https://gridfinitylayouttool.com/
  - name: How This Was Built
    url: https://gridfinitylayouttool.com/how-this-was-built
navCta:
  label: Try the Tool
  href: /
---

# How This Gridfinity Tool Was Built

On 8 August 2026, release number 1,000 of this tool went out. The first commit landed on 7 January of the same year, which puts 213 days between them.

That is 4.7 releases a day, sustained, for seven months. Including the days I did not open the laptop.

I want to write down how that happened, because the number on its own is meaningless and I would rather give you the useful version.

## The numbers, as of release #1,000

Every figure below is frozen at 8 August 2026. They will be wrong tomorrow, which is sort of the point.

|                         |                            |
| ----------------------- | -------------------------- |
| Releases                | 1,001                      |
| Days since first commit | 213                        |
| Commits                 | 3,437                      |
| Pull requests merged    | 3,345                      |
| Feature commits         | 703                        |
| Fix commits             | 789                        |
| Reverts                 | 4                          |
| TypeScript files        | ~4,000                     |
| Test files              | 1,580                      |
| Lines of TypeScript     | ~634,000                   |
| Languages supported     | 16                         |
| Busiest month           | July 2026, 219 releases    |
| Busiest day             | 23 releases, 2 August 2026 |
| License                 | AGPL-3.0                   |

The one I would point at is not the release count. It is **four reverts in 1,001 releases**.

## What "release" means here, so the number is not a lie

It would be trivial to inflate this. `git tag` is free and nobody audits it.

That is not what happened. Every release in that count is produced by [release-please](https://github.com/googleapis/release-please), wired into the repository as a GitHub Action. The mechanism is boring and that is its value:

1. Every change reaches `main` through a pull request. The branch is protected, so there is no other route, including for me.
2. Every commit message is a [Conventional Commit](https://www.conventionalcommits.org/), enforced in CI by a dedicated `pr-title` workflow that fails the PR if the title does not parse.
3. release-please reads those messages, works out whether the change is a `fix` (patch), a `feat` (minor), or breaking (major), and maintains a release pull request with the version bump and generated changelog.
4. Merging that release PR cuts the tag and publishes the release.

So the 1,001 figure is a count of merged, conventionally-described, CI-passing pull requests that changed shipped behaviour. It is an artifact of a gate, not of enthusiasm with a tagging command. The version number reached 4.389.2 by arithmetic, not by ambition.

This also means the release history is a genuine record. `789` fix commits is not me being modest. It is what the tooling counted.

## Why it did not fall apart

Here is the thing nobody tells you about shipping five times a day: **you stop being able to review your own work.**

Not because you get lazy. Because the volume exceeds the attention. At three or four merged PRs a day you can hold the whole change in your head. At sixteen commits a day, across a 3D geometry kernel, a React app, a serverless API, and sixteen translation files, you cannot. Something has to hold the standard when you are not holding it.

The answer I landed on was to make the machine refuse.

### The pre-commit gate

Ten checks run before a commit is allowed to exist:

```
lint-staged
check:boundaries:staged      module boundary violations
check:design-system:staged   raw elements where a primitive exists
check:i18n                   key parity across all 16 locales
check:i18n:values            untranslated strings
check:i18n:interpolation     mismatched {{placeholders}}
check:i18n:unused            orphaned keys (only when i18n files are staged)
check:exhaustiveness         switch statements missing union cases
check:component-structure    component file layout
check:missing-tests          a component without a sibling test
check:readme-reminders       docs that drift from the code they describe
```

Most of these are shell scripts and small TypeScript programs in `scripts/`. None of them are clever. `check:missing-tests` is exactly what it sounds like: if you touched a component and there is no `Foo.test.tsx` next to `Foo.tsx`, the commit does not happen.

That last one deserves emphasis, because it is the single highest-leverage rule in the repository. It is the reason there are 1,580 test files. Not discipline. A script that says no.

### The custom lint rules

Generic linting catches generic mistakes. The interesting failures are project-specific, so some rules are hand-written for this codebase:

- **`no-init-time-imported-call`**: bans calling an imported function at module initialisation time. This exists because a Zustand store that computes its initial state from an imported call creates an import cycle that only manifests as a blank page in a production build, never in dev. It cost a real outage to learn and now it is a lint error.
- **A ban on `React.lazy`** in favour of a `lazyWithRetry` wrapper, because a chunk load failure after a deploy should retry rather than white-screen.
- **A ban on arithmetic against `GRID_SIZE`**, because half-bin mode makes naive grid maths silently wrong.

Each of these is a bug that happened once, converted into a bug that cannot happen again. That conversion is the entire methodology.

### The one that is not automatable

`CLAUDE.md` in the repository root carries a numbered list of thirteen gotchas. It is not documentation in the usual sense. It is a list of traps that are invisible at the call site, written for whoever (or whatever) touches the code next.

A representative entry, lightly compressed:

> **The feet never touch, and a stacking lip is not self-contained.** `buildBaseSocket` sizes each foot 0.5mm narrower than its cell, so adjacent feet stop short of each other. The continuous floor comes from the box's wall-thickness slab, never from the feet. Any base that skips the box must build that slab itself or it is one island per cell with a through-slot along every internal grid line.

The list exists because that class of defect cannot be caught by a gate. It can only be known.

## The part where AI is genuinely bad at this

Most of this project was built with AI assistance. I have written [a separate disclosure](https://github.com/andymai/gridfinity-layout-tool/blob/main/AI-DISCLOSURE.md) about that, and I would rather be straightforward about where it works and where it does not.

Where it does not: **3D geometry.**

The bin and baseplate generators are built on a BREP kernel (`brepjs` 18.120.0, with `brepkit-wasm` 3.0.2 running as a second kernel). Geometry code has a property that makes it uniquely hostile to confident code generation: **it compiles, it runs, it produces a mesh, and the mesh is wrong.** There is no exception. There is no type error. There is a shape, and the shape is subtly not the shape you asked for.

Two worked examples from this repository.

### The rotation that hides on symmetric profiles

To stand a 2D elevation upright you rotate it about the X axis. `rotate(-90, {axis: [1,0,0]})` maps `(x, y, z)` to `(x, z, -y)`, which inverts the drawing's vertical axis. `rotate(+90, ...)` maps it to `(x, -z, y)`, which is what you actually want: the drawing's vertical becomes `+Z`.

Use the wrong sign and a profile built upward from a plane comes out built downward from it.

Now the part that makes it nasty. **The bug is invisible on any vertically symmetric profile.** The lid's scallop cut tolerated `-90` indefinitely, because upside-down and right-way-up are the same shape. It only surfaced on an asymmetric profile, where a lip dip was cut 3.8mm low, into the wall instead of into the lip. Correct-looking code, passing tests, shipped geometry, wrong part.

### The defect that every reasonable assertion misses

A Gridfinity base is a ring of feet. If you build one without the box slab underneath, you get a ring of feet joined by a stacking lip.

Ask yourself what that fails. Bounding box? Correct. Triangle count? Plausible. Watertight? **Yes, it passes.** A ring of feet joined by a lip is a closed surface. It is a perfectly valid, manifold, exportable solid with a through-slot along every internal grid line, and it will slice, print, and fail in the drawer.

The only way to catch it is to probe inside the volume. This repository has `isSolidThrough` and `sectionHalfWidth` helpers in a `__kernel-tests__` directory for exactly this, and they exist because the obvious assertions all returned green.

The general lesson, which applies well beyond geometry: **the test that catches your real bug is rarely the test you would write by default.** AI is extremely good at writing the default test. It will produce a watertightness assertion without being asked. It will not know that watertightness is the assertion that fails to fail.

### What that costs in CI

The consequence is a large, slow, real-kernel test suite. The generator tests carry roughly 3,700 seconds of WASM CPU. One export test file runs for fourteen minutes on its own and cannot be split, because Vitest shards by file path and never parallelises within a file.

So CI splits into six generator shards and three core shards, sized deliberately rather than evenly, because the heavy WASM files would otherwise cluster onto one shard by hash luck and dominate wall time. Some of that now runs on a self-hosted machine, which took the generator suite from 450 seconds to 224.

None of this is glamorous. All of it is the price of letting a machine write geometry code.

## What it actually cost

<!-- ANDY: everything in this section is my invention. Rewrite in your own words or cut it entirely. I have no way to know any of this. -->

The honest accounting is that this pace is not free, and I would be selling you something if I implied otherwise.

The volume of merged changes went up. My confidence in any individual change went down. I traded deep familiarity with each line for broad familiarity with the shape of the system, and that trade is real: there are corners of this codebase I have read carefully once, in review, and not since. The gates are load-bearing precisely because I am not.

There were weeks where the tooling made me productive and weeks where it made me busy, and telling those apart in the moment is harder than it sounds. Four reverts in 1,001 releases looks like a quality metric. It is also a survivorship metric, because it only counts the mistakes that were bad enough to notice.

What I would not trade is the thing the disclosure already says: this let me build something substantial without giving up the evenings. That was the whole point, and it worked.

<!-- /ANDY -->

## On the AI question

I would rather state my position than let you infer it.

Most of this project was created with AI tooling. I am a software engineer with decades of experience, and I remain firmly in control of the "what" and the "why" while delegating a great deal of the "how". The full statement lives in [AI-DISCLOSURE.md](https://github.com/andymai/gridfinity-layout-tool/blob/main/AI-DISCLOSURE.md), written without AI assistance, and it says this better than a summary can.

The reason I put the gates in this article rather than the prompts is that the gates are the transferable part. Anyone can generate a lot of code now. The question that decides whether that produces a product or a mess is what you are willing to let the machine refuse to accept from you.

## Where the code is

Everything is [on GitHub](https://github.com/andymai/gridfinity-layout-tool) under AGPL-3.0. The tool itself is free, runs entirely in your browser, and needs no account: layouts live in local storage unless you choose to sign in and sync them.

If you want to see the traps, `CLAUDE.md` is the most interesting file in the repository, and it is thirteen entries long for now.

Here is to the next thousand.
