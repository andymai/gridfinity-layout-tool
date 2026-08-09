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

Release 1,000 went out on 8 August 2026. The first commit was 7 January, which makes it 213 days, or about 4.7 releases a day if you average it out.

The averaging is doing some work there. Plenty of days had nothing. On 2 August there were 23.

I don't think the number means much on its own, but a few people have asked how the pace was possible, and the answer is mostly infrastructure rather than heroics. So here is the actual mechanism.

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

Accurate as of 8 August 2026, and drifting immediately.

## Where the release count comes from

Worth addressing early, because a release count is easy to inflate and nobody checks. `git tag` is free.

Every release here is cut by [release-please](https://github.com/googleapis/release-please) running as a GitHub Action. Changes reach `main` only through a pull request, since the branch is protected and I haven't exempted myself. Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) spec, checked in CI by a `pr-title` workflow that fails the PR outright if the title doesn't parse. release-please reads those messages, works out patch versus minor versus major, and keeps an open release PR with the version bump and changelog. Merging it cuts the tag.

So the 1,001 figure counts merged, CI-passing pull requests that changed behaviour. The version sits at 4.389.2 for the boring reason that 389 minor releases have happened.

The side effect I didn't plan for is that the changelog became a genuine record. When I say there have been 789 fix commits against 703 feature commits, that isn't modesty, it's just what the tooling counted.

## Why it didn't collapse

Shipping several times a day breaks your ability to review your own work. Not through carelessness. The volume just exceeds the attention available. At three or four merged PRs a day I could hold a change in my head; at sixteen commits a day across a BREP geometry kernel, a React app, serverless endpoints and sixteen locales, I couldn't, and pretending otherwise would have produced a mess fairly quickly.

What I did instead was push the standard into tooling that runs whether I'm paying attention or not.

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

They're shell scripts and small TypeScript programs in `scripts/`, and none of them are sophisticated. `check-missing-tests.sh` does what the name says: touch a component with no `Foo.test.tsx` beside `Foo.tsx` and the commit doesn't happen.

That one is responsible for most of the 1,580 test files. I'd like to claim discipline, but it was a script refusing to let me past.

### Rules written for this codebase specifically

Off-the-shelf linting catches off-the-shelf mistakes, so a few rules here are hand-written.

One is called `no-init-time-imported-call`, and it bans calling an imported function at module initialisation time. It exists because a Zustand store computing its initial state from an imported call creates an import cycle that only surfaces as a blank page in a production build. Never in dev. That took an embarrassing amount of time to track down and is now a lint error.

`React.lazy` is banned in favour of a `lazyWithRetry` wrapper, since a chunk that fails to load after a deploy should retry instead of white-screening. Arithmetic against `GRID_SIZE` is banned too, because half-bin mode makes the obvious grid maths wrong in ways that look fine until someone uses a 0.5 offset.

Each of these started as a bug that shipped. Converting them into rules is most of what I do between features now.

### Keeping the surface area from growing together

The other thing that degrades quickly at volume is structure. Anything in `src/features/X` can import from shared code, core, the design system, or itself, and that's it. Cross-feature imports fail the commit. There's a small allowlist for the handful of legitimate exceptions, written as `source-feature:target-feature` pairs with a note on each, so an integration layer like design linking can reach the bin designer through its barrel and nothing else.

The allowlist matters more than the rule. It's five lines long after seven months, and every entry had to be argued for, which is a much better signal than a dependency graph nobody reads.

Translations get the same treatment, because sixteen locales times 3,693 keys is not something you eyeball. Four separate checks run on every commit: keys present in every locale, no values left identical to the English source, `{{placeholder}}` names matching what the code actually passes, and no orphaned keys once the i18n files themselves are touched. Each check exists because that specific failure shipped once.

Bundle size has hard budgets too, checked in CI rather than pre-commit: 190 kB gzipped for the main bundle, 260 kB for eager initial JS. A budget that fails the build is the only version of a performance goal I've ever seen hold.

### The part that can't be automated

There's a numbered list in `CLAUDE.md` at the repository root. Thirteen entries, all of them traps that are invisible at the call site. It's written for whoever touches the code next, including the model.

One of them, compressed:

> The feet never touch. `buildBaseSocket` sizes each foot 0.5mm narrower than its cell, so adjacent feet stop short of each other, and the continuous floor comes from the box's wall-thickness slab instead. Any base that skips the box has to build that slab itself, or it's one island per cell with a through-slot along every internal grid line.

No gate catches that. You either know it or you reintroduce it.

## Where AI tooling needs the most supervision

Most of this project was built with AI assistance, which I've written about [separately](https://github.com/andymai/gridfinity-layout-tool/blob/main/AI-DISCLOSURE.md). The short version is that it's been very good for the "how" while I've stayed in charge of the "what" and "why".

The area that needs the most watching is 3D geometry.

The generators run on a BREP kernel (`brepjs` 18.120.0, with `brepkit-wasm` 3.0.2 as a second kernel). Geometry code fails in an awkward way: it compiles, it runs, it produces a mesh, and the mesh is quietly the wrong shape. No exception, no type error, no crash. Just a part that doesn't fit.

Two examples from this repository.

### A rotation that only breaks on asymmetric profiles

To stand a 2D elevation upright you rotate about X. `rotate(-90, {axis: [1,0,0]})` maps `(x, y, z)` to `(x, z, -y)`, which flips the drawing's vertical axis. `+90` maps it to `(x, -z, y)`, so the drawing's vertical becomes `+Z`, which is what you actually want.

Get the sign wrong and a profile built upward from a plane comes out built downward from it.

The catch is that this is invisible on a vertically symmetric profile. The lid's scallop cut used `-90` for months without anyone noticing, because upside-down and right-way-up are the same shape there. It only showed up on an asymmetric profile, where a lip dip got cut 3.8mm low, into the wall rather than the lip.

### A defect that passes every assertion you'd think to write

A Gridfinity base is a ring of feet. Build one without the box slab underneath and you get a ring of feet joined at the top by the stacking lip.

Bounding box: correct. Triangle count: plausible. Watertight: passes, because a ring of feet joined by a lip is a closed surface. It's a valid manifold solid that slices and prints, with a through-slot along every internal grid line.

Catching it means probing inside the volume, which is why there are `isSolidThrough` and `sectionHalfWidth` helpers in a `__kernel-tests__` directory. They exist because every obvious assertion came back green.

This generalises past geometry. A model will write you a watertightness check without being asked, and write it well. What it won't know is that watertightness is the specific assertion that fails to fail here.

### The same problem in the API, minus the mesh

Geometry makes this vivid because you can hold the wrong part in your hand, but the pattern shows up anywhere correctness isn't local to the function.

The community gallery lets people publish designs, which means it needs moderation, which is where I got it wrong. Hiding a reported design wrote the moderation state onto that design's record. Reasonable, and wrong: the state belonged to the owner's data, so the owner could shed it. Deleting the account or republishing the same payload dropped the record, the reports and the reasons together, and since the duplicate checks only compared against live designs, the hidden original was invisible to them as well. The takedown undid itself.

The fix was to key takedowns on a hash of the content rather than on the design or the user, with no user identifier in the key so that deleting an account is still a real erasure. Only an admin restore lifts one.

There was a subtler one next to it. Any response that differs between a hidden design and a missing design tells you which is which, and that holds even when both return 200. The unlike endpoint leaked exactly this, because the Lua script toggling the like read the count straight off the record regardless of its moderation status. Two designs, two 200s, one of them returning a number.

Nothing in either case looks wrong at the call site, no test fails, and neither is the kind of thing you notice by reading the diff. They're in `CLAUDE.md` now.

### The CI bill for that

The consequence is a slow test suite running against the real kernel. The generator tests carry roughly 3,700 seconds of WASM CPU, and one export test file takes fourteen minutes by itself and can't be split, since Vitest shards by file path and won't parallelise within a file.

CI splits into six generator shards and three core shards. The asymmetry is deliberate: otherwise the heavy WASM files cluster onto one shard by hash luck and set the wall time for everything else. Some of it now runs on a self-hosted machine, which took the generator suite from 450 seconds to 224.

## What it cost

<!-- ANDY: I invented this entire section. None of it is derivable from git and I have no way to know any of it. Rewrite it in your own words or delete it. -->

I'd be selling something if I implied the pace was free.

The honest version is that I traded depth for breadth. There are parts of this codebase I read carefully once, during review, and haven't opened since. The gates are load-bearing precisely because I'm not always the one holding the standard, and I'm aware that's a different way of working than I'd have defended a few years ago.

Some weeks the tooling made me productive and some weeks it made me busy. Telling those apart while inside them is harder than it sounds, and I got it wrong more than once.

Four reverts across 1,001 releases reads like a quality number. It's also a survivorship number, since it only counts the mistakes bad enough that someone noticed.

<!-- /ANDY -->

## On the AI question

I'd rather state my position than have it inferred.

Most of this was created with AI tooling. I've been a software engineer for a long time, I'm still in control of what gets built and why, and I've handed over a lot of the how. The full statement is in [AI-DISCLOSURE.md](https://github.com/andymai/gridfinity-layout-tool/blob/main/AI-DISCLOSURE.md), written without any AI assistance, and it puts this better than a summary would.

The reason this article is about gates rather than prompts is that the gates are the transferable part. Generating a lot of code isn't the hard problem any more. Deciding what you'll let through is.

## The code

Everything is [on GitHub](https://github.com/andymai/gridfinity-layout-tool) under AGPL-3.0. The tool is free and runs in the browser with no account: layouts stay in local storage unless you sign in to sync them.

If you want the interesting file, it's `CLAUDE.md`. Thirteen entries so far.
