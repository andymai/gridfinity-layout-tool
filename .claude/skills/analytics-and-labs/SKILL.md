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
4. **Flag gating precedence** is duplicated on purpose in `src/shared/hooks/useFeatureFlag.ts` (reactive) and `isFeatureEnabled` in `src/core/store/labs.ts` (getState path): `graduated` → always true, `deprecated` → always false, `comingSoon` → always false, else the localStorage preference (`gridfinity-labs-v1`). A new status value must be handled in both.
5. **Fire-once state lives in localStorage `gridfinity-analytics-v1`** (`posthog/identity.ts`): userId, milestones (`first_bin`/`engaged`/`substantial`/`power_user` in `eventsCore.ts`), feature-adoption flags (`markFeatureUsed` in `eventsPerson.ts`). Clearing it re-fires milestones and skews funnels; the module-level cache means tests must reset it.
6. **Privacy:** ML telemetry never sends raw bin labels — only 8-char non-reversible hashes via `processLabel` (`src/shared/analytics/labelVocabulary/normalize.ts`). New trackers touching user text must hash or truncate (see `sanitizeQuery` in `posthog/events.ts`). Both pipelines respect `settings.analyticsEnabled` (`isEnabled()` in `mlTelemetry/trackersHelpers.ts`).

## Recipes

### Add a PostHog event

1. Check the catalog first: `rg "trackEvent\('" src/shared/analytics`. `src/core/cqrs/middleware/analytics.ts` already fires `cqrs_command_executed` for every successful command — only add a bespoke event for context the command lacks.
2. Name it snake*case, past-tense or noun_action (`bin_created`, `labs_feature_toggle`), snake_case props, domain prefix for families (`labs*_`, `help\__`, `bin*export*\*`).
3. Add a `trackXxx()` wrapper in the right module under `src/shared/analytics/posthog/`: `eventsCore.ts` (layout/bin), `eventsPerformance.ts` (timing/kernel), `eventsErrors.ts` (failures), `binExportEvents.ts` (export), `eventsPerson.ts` (person props). Use `trackEvent(name, props)` — props are `string|number|boolean|null` only and `device_type` is attached automatically. Arrays/objects need the lower-level `capture()` from `./init` (see `layout_snapshot` in `eventsCore.ts`).
4. If the caller is a store or anything a store imports, deep-import `@/shared/analytics/posthog/trackEvent` (mental model #2).
5. Re-export from `src/shared/analytics/posthog/events.ts` and `posthog/index.ts`, and wire the call site in the same PR — knip in `pnpm run quality` fails on exported-but-uncalled trackers.
6. Add a sibling test mocking the leaf, copying the `vi.mock('./trackEvent', ...)` pattern from `eventsPerformance.test.ts` (pre-commit `check-missing-tests.sh` warns on files without sibling tests; repo convention still requires one).
7. Once-only person properties (first-touch attribution) must use the two-arg form `setPersonProperties({}, onceProps)` in `eventsPerson.ts` — the one-arg form lets mutable values overwrite first-touch data.

### Add a labs flag and gate a feature

1. Append to `FEATURE_FLAGS` in `src/core/labs/features.ts`: snake_case `id`, user-facing `name`/`description` (rendered verbatim in the Labs drawer), `status: 'experimental'`, `risk`, `addedAt: 'YYYY-MM'`, `requiresRefresh`. The `FeatureId` type picks up the id automatically — pass only `FeatureId`-typed values; `getFeature(id)` accepts any string and silently returns undefined.
2. Gate React UI with `useFeatureFlag('my_flag')` from `@/shared/hooks/useFeatureFlag`. Gate non-React code (workers, managers) with `useLabsStore.getState().isFeatureEnabled('my_flag')` **called at decision time** — caching the result at module or mount scope gives a value that never updates on toggle.
3. No drawer wiring needed: `LabsDrawer.tsx` (`src/features/labs/components/LabsDrawer/`) renders everything from `getToggleableFeatures()`. `comingSoon: true` shows it unclickable, and toggles no-op returning OK.
4. If the flag is read once at worker spawn (kernel selection — `brepkit_kernel` pattern), set `requiresRefresh: true` and say so in the flag's warning text.
5. Update `src/core/labs/features.test.ts` and the flag table in `src/features/labs/README.md` (pre-commit `check-readme-reminders.sh` nags otherwise). Toggling already emits `labs_feature_toggle` via the store — no extra analytics needed.

### Graduate or remove a labs flag

- **Graduate:** set `status: 'graduated'` + `graduatedAt: 'YYYY-MM'` in `features.ts`. Keep the id and every runtime check — graduated short-circuits to true in both gate implementations (`manifold_preview` precedent). The drawer moves it to its graduated section automatically.
- **Remove:** delete the array entry, leave a tombstone comment (see the `cqrs_undo` / `occt_wasm_kernel` lines in `features.ts`), fix every `FeatureId` usage the compiler flags, and add `delete prefs.enabledFeatures.<id>;` to `loadPreferences()` in `src/core/store/labs.ts` (see the `handle_ledges`/`angled_dividers` lines) — otherwise the orphaned localStorage key inflates `computeLabsMetrics()` forever.
- Update `features.test.ts` and `src/features/labs/README.md` either way.

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

| Symptom                                                               | Cause                                                                                                               | Fix                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prod build blank page, dev fine, after adding tracking to a store     | Store → posthog barrel → `metrics.ts` → `useLabsStore` cycle (#1466)                                                | Deep-import `@/shared/analytics/posthog/trackEvent`; repro with build+preview                                                                                                                                                                                                                |
| Event never appears while testing locally                             | DEV early-return in `init.ts`; also needs `VITE_PUBLIC_POSTHOG_KEY` + `settings.analyticsEnabled`                   | Assert via unit test mocking the leaf; live-verify on a production build                                                                                                                                                                                                                     |
| Flag toggle has no visible effect                                     | `requiresRefresh: true`, or `comingSoon` (toggle no-ops OK), or consumer cached `isFeatureEnabled()` non-reactively | Reload / use `useFeatureFlag` in components / call `getState().isFeatureEnabled()` at decision time                                                                                                                                                                                          |
| `computeLabsMetrics` counts flags that no longer exist                | Removed flag's key persists in `gridfinity-labs-v1`                                                                 | `delete prefs.enabledFeatures.<id>` in `loadPreferences()`                                                                                                                                                                                                                                   |
| Milestone fires again for an existing user                            | `gridfinity-analytics-v1` cleared or identity cache reset                                                           | Treat that key as durable identity; never clear it in migrations                                                                                                                                                                                                                             |
| Data lands in the wrong pipeline despite compiling                    | Wrong twin: `trackLayoutSnapshot`/`trackFillOperation` exist in both posthog and mlTelemetry                        | Import from `@/shared/analytics/posthog` vs `@/shared/analytics/mlTelemetry` explicitly                                                                                                                                                                                                      |
| PostHog floods with junk errors, or one error splits into many issues | Extension noise through global handlers; multi-mount-site errors lack a fingerprint                                 | Add regex to `IGNORED_MESSAGE_PATTERNS`/`IGNORED_SOURCE_PATTERNS` in `posthog/errorFilters.ts`; pin an `$exception_fingerprint` like `WEBGL_CONTEXT_FINGERPRINT` in `errorFilters.ts` (its matching `WEBGL_CONTEXT_ERROR` message substring must stay in sync with `WebGLErrorBoundary.tsx`) |

For module-boundary rules and slice anatomy (why `shared/` re-export barrels exist), see the **feature-slices** skill. For sibling-test and knip gate details, see **quality-gates**; for vitest project layout, see **testing**.
