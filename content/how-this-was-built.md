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

# How this Gridfinity tool was built

Release 1,000 went out on 8 August 2026. The first commit was 7 January, which makes it 213 days, or about 4.7 releases a day averaged out. Plenty of days had nothing and 2 August had 23.

A few people have asked how that pace was possible. The answer is mostly tooling, so here is what the tooling does.

## The numbers, frozen at release 1,000

|                         |          |
| ----------------------- | -------- |
| Releases                | 1,001    |
| Days since first commit | 213      |
| Commits                 | 3,437    |
| Pull requests merged    | 3,345    |
| Feature commits         | 703      |
| Fix commits             | 789      |
| Reverts                 | 4        |
| TypeScript files        | ~4,000   |
| Test files              | 1,580    |
| Lines of TypeScript     | ~634,000 |
| Languages supported     | 16       |
| License                 | AGPL-3.0 |

Accurate as of 8 August 2026.

## Where the release count comes from

Every release is cut by [release-please](https://github.com/googleapis/release-please) running as a GitHub Action. Changes reach `main` only through a pull request, since the branch is protected and I haven't exempted myself. Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) spec, checked in CI by a `pr-title` workflow that fails the PR if the title doesn't parse. release-please reads those messages, works out patch versus minor versus major, and keeps an open release PR with the version bump and changelog. Merging it cuts the tag.

So the 1,001 figure counts merged, CI-passing pull requests that changed behaviour. The version is at 4.389.2 because 389 minor releases have happened.

One side effect is that the changelog is an accurate record rather than something I maintain by hand. The 789 fix commits against 703 feature commits is just what the tooling counted.

## Why it didn't collapse

Shipping several times a day breaks your ability to review your own work, because the volume exceeds the attention available. At three or four merged PRs a day I could hold a change in my head. At sixteen commits a day across a BREP geometry kernel, a React app, serverless endpoints and sixteen locales, I couldn't.

So the standard lives in tooling that runs whether I'm paying attention or not.

### The pre-commit gate

Ten checks run before a commit is allowed to exist:

```
lint-staged
check:boundaries:staged      cross-feature imports
check:design-system:staged   raw elements where a primitive exists
check:i18n                   key parity across all 16 locales
check:i18n:values            untranslated strings
check:i18n:interpolation     mismatched {{placeholders}}
check:i18n:unused            orphaned keys
check:exhaustiveness         switch statements missing union cases
check:component-structure    component file layout
check:missing-tests          components without a sibling test
check:readme-reminders       docs that drift from the code
```

They're shell scripts and small TypeScript programs in `scripts/`. `check-missing-tests.sh` does what the name says: touch a component with no `Foo.test.tsx` beside `Foo.tsx` and the commit doesn't happen. That check is responsible for most of the 1,580 test files.

### Rules written for this codebase specifically

Off-the-shelf linting catches off-the-shelf mistakes, so a few rules here are hand-written.

`no-init-time-imported-call` bans calling an imported function at module initialisation time. A Zustand store computing its initial state from an imported call creates an import cycle that only surfaces as a blank page in a production build, never in dev, which took a long time to track down the first time.

`React.lazy` is banned in favour of a `lazyWithRetry` wrapper, so a chunk that fails to load after a deploy retries instead of white-screening. Arithmetic against `GRID_SIZE` is banned because half-bin mode makes the obvious grid maths wrong once someone uses a 0.5 offset.

Each of these started as a bug that shipped.

### Keeping the surface area from growing together

Anything in `src/features/X` can import from shared code, core, the design system, or itself. Cross-feature imports fail the commit. There are three sanctioned exceptions, written as `source-feature:target-feature` pairs with a note on each: design linking reaches the bin designer through its barrel, and the bin inspector lazily loads the linked-design and size-suggestion sections. Deep static imports stay violations even for those.

Translations get the same treatment, since sixteen locales times 3,693 keys isn't something you can eyeball. Four checks run on every commit: keys present in every locale, no values left identical to the English source, `{{placeholder}}` names matching what the code passes, and no orphaned keys once the i18n files themselves are touched.

Bundle size has budgets checked in CI: 190 kB gzipped for the main bundle, 260 kB for eager initial JS.

### The part that can't be automated

There's a numbered list in `CLAUDE.md` at the repository root. Thirteen entries, all of them traps that are invisible at the call site. It's written for whoever touches the code next, including the model.

One of them, compressed:

> The feet never touch. `buildBaseSocket` sizes each foot 0.5mm narrower than its cell, so adjacent feet stop short of each other, and the continuous floor comes from the box's wall-thickness slab instead. Any base that skips the box has to build that slab itself, or it's one island per cell with a through-slot along every internal grid line.

No gate catches that one.

## Where AI tooling needs the most supervision

Most of this project was built with AI assistance, which I've written about [separately](https://github.com/andymai/gridfinity-layout-tool/blob/main/AI-DISCLOSURE.md). It's been good for the "how" while I've stayed in charge of the "what" and "why".

The area that needs the most watching is 3D geometry. Geometry code compiles, runs, produces a mesh, and the mesh can still be the wrong shape, with no exception and no type error along the way. Two examples from this repository.

### A rotation that only breaks on asymmetric profiles

To stand a 2D elevation upright you rotate about X. `rotate(-90, {axis: [1,0,0]})` maps `(x, y, z)` to `(x, z, -y)`, which flips the drawing's vertical axis. `+90` maps it to `(x, -z, y)`, so the drawing's vertical becomes `+Z`.

Get the sign wrong and a profile built upward from a plane comes out built downward from it.

This is invisible on a vertically symmetric profile. The lid's scallop cut used `-90` for months without anyone noticing, because upside-down and right-way-up are the same shape there. It only showed up on an asymmetric profile, where a lip dip got cut 3.8mm low, into the wall rather than the lip.

### A defect that passes the obvious assertions

A Gridfinity base is a ring of feet. Build one without the box slab underneath and you get a ring of feet joined at the top by the stacking lip.

The bounding box is correct and the triangle count is plausible. A watertightness check passes too, because a ring of feet joined by a lip is a closed surface. It's a valid manifold solid that slices and prints, with a through-slot along every internal grid line.

Catching it means probing inside the volume, which is why there are `isSolidThrough` and `sectionHalfWidth` helpers in a `__kernel-tests__` directory.

A model will write you a watertightness check without being asked, and write it correctly. What it won't know is that watertightness is the wrong question here.

### The same problem in the API

The community gallery lets people publish designs, so it needs moderation. Hiding a reported design wrote the moderation state onto that design's record, which meant the state belonged to the owner's data and the owner could shed it. Deleting the account or republishing the same payload dropped the record, the reports and the reasons together, and the duplicate checks only compared against live designs, so the hidden original was invisible to those too.

Takedowns are now keyed on a hash of the content rather than on the design or the user, with no user identifier in the key so deleting an account is still a real erasure. Only an admin restore lifts one.

There was a related problem next to it. Any response that differs between a hidden design and a missing design reveals which is which, and that holds even when both return 200. The unlike endpoint leaked exactly that, because the Lua script toggling the like read the count off the record regardless of its moderation status.

Neither of those looks wrong at the call site and no test failed on either.

### The CI cost

The test suite runs against the real kernel and it's slow. The generator tests carry roughly 3,700 seconds of WASM CPU, and one export test file takes fourteen minutes by itself and can't be split, since Vitest shards by file path and won't parallelise within a file.

CI splits into six generator shards and three core shards. The asymmetry is deliberate, because otherwise the heavy WASM files cluster onto one shard by hash luck and set the wall time for everything else. Some of it now runs on a self-hosted machine, which took the generator suite from 450 seconds to 224.

## What it cost

<!-- ANDY: I invented this entire section. None of it is derivable from git and I have no way to know any of it. Rewrite it in your own words or delete it. -->

The pace wasn't free.

I traded depth for breadth. There are parts of this codebase I read carefully once, during review, and haven't opened since. The gates are load-bearing because I'm not always the one holding the standard.

Some weeks the tooling made me productive and some weeks it made me busy, and telling those apart while inside them is harder than it sounds.

Four reverts across 1,001 releases only counts the mistakes that someone noticed.

<!-- /ANDY -->

## On the AI question

Most of this was created with AI tooling. I've been a software engineer for a long time, I'm still in control of what gets built and why, and I've handed over a lot of the how. The full statement is in [AI-DISCLOSURE.md](https://github.com/andymai/gridfinity-layout-tool/blob/main/AI-DISCLOSURE.md), written without any AI assistance.

This article is about the gates rather than the prompts because the gates are the part that transfers.

## The code

Everything is [on GitHub](https://github.com/andymai/gridfinity-layout-tool) under AGPL-3.0. The tool is free and runs in the browser with no account: layouts stay in local storage unless you sign in to sync them.

`CLAUDE.md` is the file worth reading if you want the traps.
