---
name: analytics-and-labs
description: 'PostHog event conventions (trackEvent, snake_case names, #1466 import-cycle rule), ML telemetry pipeline (/api/ml-telemetry, label hashing), labs feature flags (FEATURE_FLAGS, useFeatureFlag, graduate/remove), and shared-hook traps (stale closures, cross-tab sync, auto-save races). Load when adding/renaming analytics events, adding or removing a labs flag, debugging "event never appears", "flag toggle does nothing", or "blank page in production build".'
---

# Analytics & Labs

## When to use

- Adding, renaming, or debugging a PostHog event or person property.
- Adding, graduating, or removing a labs feature flag, or gating code behind one.
- Touching ML telemetry (`src/shared/analytics/mlTelemetry/`) or `api/ml-telemetry.ts`.
- Production build boots to a blank page after an analytics change; a labs toggle "does nothing".

## Mental model

1. **Two pipelines, identical function names.** `src/shared/analytics/posthog/` sends product events to PostHog; `src/shared/analytics/mlTelemetry/` batches training data to `/api/ml-telemetry` via sendBeacon. Both export `trackLayoutSnapshot` and `trackFillOperation` with different signatures. The root barrel `src/shared/analytics/index.ts` deliberately re-exports only mlTelemetry + label utilities — import PostHog helpers from `@/shared/analytics/posthog`, ML trackers from `@/shared/analytics` or `@/shared/analytics/mlTelemetry`. Auto-import picking the wrong twin compiles fine and sends data to the wrong pipeline. ML telemetry gets the layout store injected via `setLayoutStoreRef()` (called in `main.tsx`; `mlTelemetry/init.ts` avoids circular deps this way), counts only edits with `lastEditSource === 'local'` as edit activity — collab/remote edits don't — and its buffer flushes at 20 events or a 30s timer, force-flushing on `visibilitychange`/`pagehide`.
2. **The #1466 cycle rule.** `src/shared/analytics/posthog/metrics.ts` imports `useLabsStore`, so any module a Zustand store imports (especially `src/core/store/labs.ts`) must deep-import from `@/shared/analytics/posthog/trackEvent` (leaf), never the barrel or `./events`/`./metrics`. Violation crashes production boot only (chunk-level static-import cycle → blank page; dev is fine). Nothing mechanical checks this — the constraint lives in the header of `trackEvent.ts`.
3. **Analytics never throws, and never runs in dev.** Every tracker try/catches and fails silently; `posthog/init.ts`, `mlTelemetry/init.ts`, and `useAnalytics.ts` all early-return on `import.meta.env.DEV`. You cannot verify events with `pnpm run dev` — use unit tests, or `pnpm run build && pnpm run preview` with `VITE_PUBLIC_POSTHOG_KEY` set.
4. **One flag resolver.** `resolveFeatureEnabled` in `src/core/store/labs.ts` answers whether a flag is on: the stored preference (`gridfinity-labs-v1`), else off. `useFeatureFlag`, `isFeatureEnabled` and the store's write paths all go through it.
5. **Fire-once state lives in localStorage `gridfinity-analytics-v1`** (`posthog/identity.ts`): userId, milestones, `designsCreated`, feature-adoption flags (`markFeatureUsed` in `eventsPerson.ts`). Clearing it re-fires milestones and skews funnels; the module-level cache means tests must reset it (`pruneAnalyticsData`). Two milestone ladders in `eventsCore.ts`: `first_bin`/`engaged` on bins drawn, and `first_design`/`designs_4`/`designs_8` on distinct designs created, counted from the create branch of `saveDesign`. Bin counts above five do not separate outcomes, which is why the old `substantial`/`power_user` rungs were retired rather than rethresholded — reusing their names would have left a redefined metric still answering.
6. **Privacy:** ML telemetry never sends raw bin labels — only 8-char non-reversible hashes via `processLabel` (`src/shared/analytics/labelVocabulary/normalize.ts`). New trackers touching user text must hash or truncate (see `sanitizeQuery` in `posthog/events.ts`). Both pipelines respect `settings.analyticsEnabled` (`isEnabled()` in `mlTelemetry/trackersHelpers.ts`).
7. **PWA install measurement** lives in `posthog/pwaEvents.ts`. Every event carries a `display_mode` property (`standalone` is the installed app), set per event in `before_send` (`init.ts`). Not `register_for_session`: PostHog clears it when its session rotates after 30 idle minutes. Not `register`: a tab and the app window share localStorage. The funnel is `pwa_install_available` (once a day per browser), then `pwa_installed`. The `uses_installed_app` person property marks browsers that launched the installed app. Compare installers with non-installers only before and after the install, because installers self-select.

## Recipes

### Add a PostHog event

Traps, not steps. There is no CQRS analytics middleware, so a command emits
nothing on its own; every event is an explicit `trackXxx()` call in
`src/shared/analytics/posthog/`.

- Props are `string|number|boolean|null` only, and `device_type` is attached
  automatically. Arrays and objects need the lower-level `capture()` from
  `./init` (see `layout_snapshot` in `eventsCore.ts`).
- **If the caller is a store, or anything a store imports**, deep-import
  `@/shared/analytics/posthog/trackEvent`. The barrel forms an import cycle
  (mental model #2), and the symptom is a blank page in a production build.
- Re-export from `posthog/events.ts` and `posthog/index.ts` **and wire the call
  site in the same PR**: knip in `pnpm run quality` fails on an
  exported-but-uncalled tracker.
- Once-only person properties need the two-arg form
  `setPersonProperties({}, onceProps)`. The one-arg form lets mutable values
  overwrite first-touch attribution.

Naming: snake_case, past-tense or noun_action (`bin_created`,
`labs_feature_toggle`), with a domain prefix for families (`labs_*`, `help_*`,
`bin_export_*`).

### Add a labs flag and gate a feature

Append to `FEATURE_FLAGS` in `src/core/labs/features.ts`; `LabsTab` renders
every entry except the kernel flag `EngineSelector` owns, so there is no wiring
step. The traps:

- `FeatureId` picks up the id automatically, but `getFeature(id)` accepts any
  string and silently returns undefined. Pass `FeatureId`-typed values.
- Gate non-React code with `useLabsStore.getState().isFeatureEnabled(...)`
  **called at decision time**. Caching at module or mount scope gives a value
  that never updates on toggle.
- A flag read once at worker spawn (kernel selection, the `brepkit_kernel`
  pattern) needs a warning that says to reload.
- `FeatureCard` only shows `warning` on medium or high risk flags.
- A flag whose side effect runs just by being on (the `spacemouse` driver probe)
  can't graduate to always on. It needs a real preference.

Toggling already emits `labs_feature_toggle` from the store; no extra analytics.

### Graduate or remove a labs flag

- **Graduate:** delete the entry from `FEATURE_FLAGS` and every gate the compiler
  then flags, in one PR, and add a what's-new entry. Older what's-new entries that
  name the flag in `labs` lose that field. If it should still read as new, keep an
  Experimental marker where it is chosen (Slant precedent).
- **Remove:** same, plus the feature code.
- A stale key left in `gridfinity-labs-v1` is harmless: only ids in the registry
  are ever read.
- Update `src/features/labs/README.md` either way.

### Copy the shared-hook safety patterns

- Stale closures in `[]`-dep effects: read fresh state via `useStore.getState()` at call time (`useAnalytics.ts`, `useAutoSave.ts`) or `useLatestRef` for non-React listeners.
- Async save/mutation hooks: copy the `useAutoSave.ts` guard — capture `savingLayoutId` before the await, re-read `useLayoutStore.getState().activeLayoutId` after, discard the update on mismatch. Otherwise a quick layout switch mid-save corrupts the wrong layout's metadata.
- Cross-tab labs sync uses the window `storage` event (`useCrossTabSync.ts`, keyed on `LABS_STORAGE_KEY`); StorageEvents fire only in OTHER tabs, so same-tab localStorage writes in tests never trigger the listener.

## Verification

```bash
pnpm run test:run src/shared/analytics
pnpm run test:run src/core/labs src/core/store/labs.test.ts src/shared/hooks
pnpm run typecheck        # safety net for FeatureId changes
pnpm run quality          # knip catches exported-but-uncalled trackers
pnpm run check:boundaries # after new shared/ <-> features/ imports
pnpm run build && pnpm run preview  # only real repro for #1466 blank-page cycles
```

## Traps

| Symptom                                                               | Cause                                                                                             | Fix                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prod build blank page, dev fine, after adding tracking to a store     | Store → posthog barrel → `metrics.ts` → `useLabsStore` cycle (#1466)                              | Deep-import `@/shared/analytics/posthog/trackEvent`; repro with build+preview                                                                                                                                                                                                        |
| Event never appears while testing locally                             | DEV early-return in `init.ts`; also needs `VITE_PUBLIC_POSTHOG_KEY` + `settings.analyticsEnabled` | Assert via unit test mocking the leaf; live-verify on a production build                                                                                                                                                                                                             |
| Flag toggle has no visible effect                                     | Read once at worker spawn, or consumer cached `isFeatureEnabled()` non-reactively                 | Reload / use `useFeatureFlag` in components / call `getState().isFeatureEnabled()` at decision time                                                                                                                                                                                  |
| Milestone fires again for an existing user                            | `gridfinity-analytics-v1` cleared or identity cache reset                                         | Treat that key as durable identity; never clear it in migrations                                                                                                                                                                                                                     |
| Data lands in the wrong pipeline despite compiling                    | Wrong twin: `trackLayoutSnapshot`/`trackFillOperation` exist in both posthog and mlTelemetry      | Import from `@/shared/analytics/posthog` vs `@/shared/analytics/mlTelemetry` explicitly                                                                                                                                                                                              |
| PostHog floods with junk errors, or one error splits into many issues | Extension noise through global handlers; multi-mount-site errors lack a fingerprint               | Add regex to `IGNORED_MESSAGE_PATTERNS`/`IGNORED_SOURCE_PATTERNS` in `posthog/errorFilters.ts`; pin an `$exception_fingerprint` like `WEBGL_CONTEXT_FINGERPRINT` in `errorFilters.ts` (its match, `webglFailureReason` in `detectWebGL.ts`, is shared with `WebGLErrorBoundary.tsx`) |

For module-boundary rules and slice anatomy (why `shared/` re-export barrels exist), see the **feature-slices** skill. For sibling-test and knip gate details, see **quality-gates**; for vitest project layout, see **testing**.
