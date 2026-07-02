---
name: testing
description: Write and run tests — Vitest three-project routing (unit/dom/generators), src/test/ utilities (resetAllStores, createTestLayout, expectOk), real-WASM geometry scenario tests and triangleCount snapshot updates, __kernel-tests__ profile config, Playwright e2e/smoke/visual, benchmarks. Load for "document is not defined", "Cannot pass deleted object", tests passing alone but failing in the full run, flaky e2e, coverage-threshold failures, or updating scenario snapshots.
---

# Testing

## When to use

- Adding or fixing any Vitest test (store logic, component, geometry scenario) or Playwright test (e2e, smoke, visual).
- A test fails with an environment error, kernel error, or only fails when run with other tests.
- You changed generator code and scenario snapshots diff, or `pnpm run test:coverage` fails thresholds.
- For interpreting WHAT a geometry failure means (NaN, manifold, parity), see the geometry-debugging skill. For pre-commit/CI gates around tests, see the quality-gates skill.

## Mental model

1. **Routing is glob-based.** `vitest.config.ts` defines three inline projects (there is no `vitest.workspace.ts`); a test's file path decides its project. A `// @vitest-environment jsdom` docblock does switch the environment for one file, but it does NOT load the dom project's setup files (`src/test/setup-dom.ts`: jest-dom matchers, RTL auto-cleanup, WebGL context stub) — the test runs subtly broken. Never fix env errors with a docblock; place the file to match `domIncludes` instead.

   | project      | env                   | claims                                                                                                                                                                                        |
   | ------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `dom`        | jsdom                 | all `src/**/*.test.tsx`; `.test.ts` under `src/shared/{components,help,hooks,webgl}/`, `src/features/**/{components,hooks}/`, `src/design-system/`, `src/shell/` (the `domIncludes` constant) |
   | `generators` | node + real occt-wasm | `src/features/generation/worker/generators/**/*.test.ts`                                                                                                                                      |
   | `unit`       | node                  | everything else (stores, `api/`, `scripts/`, `packages/`)                                                                                                                                     |

   The `unit` project excludes `domIncludes`/`generatorIncludes` via shared constants at the top of `vitest.config.ts` — extend those constants, never hand-edit one project's list, or tests run twice.

2. **The `__kernel-tests__` directory is invisible to the root config.** Diagnostic/parity/perf kernel tests only run via `vitest.profile.config.ts` (forks pool, 1 worker, 600s timeout). They will silently not run in `pnpm run test:coverage` or CI unit shards.
3. **The real-deps rule bifurcates.** Generator tests run the real occt-wasm WASM kernel (init via `src/test/initTestKernel.ts` or `__kernel-tests__/wasmInit.ts` in `beforeAll`) — never mock brepjs or worker geometry. jsdom component tests MAY stub `'three'` (`mockThree()` from `src/test/mocks/three.ts` or inline `vi.mock`); that is rendering, not geometry.
4. **`src/test/setup.ts` runs for ALL projects**: fake-indexeddb plus a global `vi.mock('@/i18n')` that serves real English strings from `en.ts` with `{var}` interpolation. Assert on English text (`'5 bins deleted'`), never on i18n keys, and never wrap components in a LocaleProvider.
5. **Store reset is manual.** Setup files do RTL cleanup only. Any test touching Zustand stores needs `resetAllStores()` (or a targeted `reset*Store()`) from `@/test/testUtils` in `beforeEach`, or state leaks silently into later tests. `resetAllStores()` is a hand-maintained list in `src/test/testUtils.ts` — when adding a new Zustand store, register its reset there or it leaks into every subsequent store test.
6. **E2E retries are 0 by policy** (`playwright.config.ts`, 6 projects: chromium/firefox/webkit/mobile-chrome/mobile-safari/tablet). A flake must be root-caused; known-unfixable interactions get `test.skip()` plus unit coverage, never retries or sleeps.

Deeper docs: `src/test/README.md` and `e2e/README.md` — but its coverage numbers are stale; the enforced source of truth is the `thresholds` block in `vitest.config.ts` (lines 76 / branches 68 / functions 74 / statements 75). Also: despite CLAUDE.md, `scripts/check-missing-tests.sh` always exits 0 (warn-only) and `test:affected` is commented out of `.husky/pre-commit` — tests are NOT run at commit time; CI is the gate.

## Recipes

### Add or modify a geometry scenario test

1. Add/extend the `ScenarioCase` in `src/features/generation/worker/generators/scenarios/<domain>.ts`. Params are partial — `buildParams()` in `__kernel-tests__/scenarioTypes.ts` fills defaults. Pick snapshot assertion (triangleCount) or structural validation.
2. New domain: create `scenarios/<domain>.ts`, export it from `scenarios/index.ts` (adds it to `ALL_SCENARIOS`, which `binGenerator.scenarioCoverage.test.ts` checks), then create a sibling runner file containing only (pattern: `binGenerator.scenario.cutoutOffset.test.ts`):

   ```ts
   // @vitest-environment node
   import { runScenarios } from './__kernel-tests__/scenarioRunner';
   import { myDomain } from './scenarios/myDomain';

   runScenarios(myDomain);
   ```

   One file per domain is deliberate — Vitest parallelizes per file; a consolidated file used to take ~370s. Do not merge them.

3. Run just that domain: `pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.<domain>` (first run pays seconds of WASM init in `beforeAll`).
4. Only after verifying the geometry change is correct, update snapshots with `-u` on the same command. Check triangleCount deltas are plausible first — see the geometry-debugging skill.

### Write a store/logic unit test (node)

1. Sibling file `foo.test.ts` next to `foo.ts`.
2. Import from `@/test/testUtils`: `resetAllStores`, `createTestLayout`, `createTestBin`, `expectOk`/`expectErr`/`getBinId`. Factories use deterministic IDs (`cat1`, `layer1`, `test-bin`) — `createDefaultLayout()` from `@/core/constants` generates random IDs, so ID assertions must use the factories.
3. `beforeEach(() => resetAllStores())`, drive the store via `useLayoutStore.getState().addBin(...)`, unwrap `Result` values with `expectOk(result)`.
4. For time-dependent code use `setupFakeTimers()` from `@/test/testUtils` and its `advanceTime(ms)` — raw `vi.advanceTimersByTime` does not advance `Date.now()` here, giving non-deterministic timestamps.
5. Run: `pnpm run test:run <path-substring>` (add `-t "test name"` to narrow).

### Write a React component test (jsdom)

1. Name it `.test.tsx`, or place `.test.ts` under a `components/`/`hooks/` directory matching `domIncludes` — wrong placement means node env and `document is not defined`.
2. Assert on English strings (global i18n mock). If the component touches Three.js/R3F, stub `'three'` via `mockThree()` from `@/test/mocks/three` or an inline `vi.mock`. WebGL detection passes by default (`src/test/setup-dom.ts` stubs a minimal context); to test the unavailable path, spy on `getContext` locally — the cached detection result is already reset in `afterEach` via `resetWebGLDetectionCacheForTests()`.
3. `resetAllStores()` in `beforeEach` if the component reads stores; RTL cleanup is automatic.

### Add or fix a Playwright e2e test

1. Spec in `e2e/<feature>.spec.ts`. Import `test`, `expect`, and helpers from `./fixtures` (it re-exports `clearAllStorage`, `resetViewport`, `getBinByIndex`, `getNewestBin`, `waitForAutoSave` from `e2e/test-utils.ts`).
2. Scaffold (see `e2e/add-bins.spec.ts`): `beforeEach` → `page.goto('/')` + `waitForAppReady(page)`; `afterEach` → `clearAllStorage(page)` + `resetViewport(page)` + close lingering dialogs via `getActiveDialog(page)`.
3. Interact via helpers, never sleeps: `drawBinOnGrid`, `waitForBinCount`, `waitForToast`, `waitForAutoSave` (polls localStorage instead of sleeping past the save debounce), `waitForPaintModeExited`, `waitForCanvas`. Mouse coords come from `getGridBounds(page)` — grid (0,0) is bottom-left but mouse coords are screen top-left. Drags need `{ steps: 5 }`; single-step moves fire too few pointermove events.
4. Run one file on one browser: `pnpm run test:e2e e2e/<feature>.spec.ts --project=chromium` (no `--` — pnpm forwards it to Playwright, which then treats `--project` as a test filter) (dev server auto-starts on 5173; CI uses preview on 4173). Debug: `pnpm run test:e2e:ui`.

## Verification commands

| command                                                                                                                      | when                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm run test:run <path-substring>`                                                                                         | one file/pattern; `-t "name"` for one test, `-u` to update snapshots                                              |
| `pnpm exec vitest run --project unit` (or `dom`, `generators`)                                                               | one workspace project                                                                                             |
| `pnpm run test:coverage`                                                                                                     | full run with thresholds 76/68/74/75 — only meaningful as a full run                                              |
| `pnpm run test:affected`                                                                                                     | vitest `related` on staged files (falls back to full suite above 15 files), no coverage                           |
| `pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/<name>`                                             | kernel diagnostic/parity tests — only way they run                                                                |
| `pnpm run test:visual` / `pnpm run test:visual:update`                                                                       | design-system `*.visual.tsx` snapshots (`playwright-ct.config.ts`, chromium only)                                 |
| `pnpm run bench:json` then `pnpm exec tsx benchmarks/compare.ts benchmarks/baseline-opencascade.json benchmarks/latest.json` | benchmark vs stored baseline                                                                                      |
| `pnpm run test:profile`                                                                                                      | rank test files by duration when hunting slow tests                                                               |
| `BREPJS_KERNEL=brepkit pnpm run test:run binGenerator.scenario`                                                              | rerun scenarios on the Rust kernel for parity (`wasmInit.ts`; values: `wasm`, `brepkit`, `occt-wasm`, `manifold`) |

## Traps

| symptom                                                          | cause                                                                                                                     | fix                                                                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document is not defined` in a `.test.ts`                        | path missed `domIncludes` globs, ran in node                                                                              | rename to `.test.tsx` or move under a `components/`/`hooks/` dir; if a new dir legitimately needs jsdom, add its glob to `domIncludes` in `vitest.config.ts`                 |
| passes alone, fails in full run (leftover bins/selection/toasts) | store state leaked                                                                                                        | `resetAllStores()` in `beforeEach`; for localStorage tests use `createIsolatedLocalStorageMock()` + its `cleanup()` in `afterEach`                                           |
| `Cannot pass deleted object` mid geometry test                   | kernel wrapper GC'd — adapter only borrowed the raw kernel                                                                | init via `initTestKernel()` or `wasmInit.ts`'s `initBrepjs()` in `beforeAll`; they use `OcctWasmAdapter.fromKernel`, which retains it                                        |
| desktop e2e fails with mobile selectors after a mobile spec      | viewport persists per worker                                                                                              | `await resetViewport(page)` in `afterEach` of every viewport-changing test                                                                                                   |
| e2e grabs wrong bin or wrong dialog                              | bin DOM order non-deterministic under parallel workers; Labs drawer is ALWAYS mounted with `role="dialog"`                | `getBinByIndex()`/`getNewestBin()` instead of `.first()`/`.last()`; `getActiveDialog()` instead of raw `[role="dialog"]`                                                     |
| many scenario snapshots diff after a generator change            | geometry output changed — intended, or a border-clipping regression                                                       | inspect deltas for plausibility before `-u`; large unexplained jumps → geometry-debugging skill                                                                              |
| snapshots orphaned after renaming a scenario category            | snapshot keys are `<category> > <name>` per `scenarioRunner.ts`                                                           | keep category names stable; if renaming, regenerate and delete stale entries in `__snapshots__/` in the same PR                                                              |
| coverage fails after adding well-tested code                     | thresholds are global; untested sibling files elsewhere drag averages                                                     | check the text summary for files you touched, add missing sibling tests — never lower thresholds                                                                             |
| smoke tests fail loading fonts with CORS errors                  | Vercel bypass token added as `extraHTTPHeaders` — Playwright sends it to every origin, third parties reject the preflight | pass it as a same-origin bypass cookie via query string (`x-vercel-set-bypass-cookie` pattern in `e2e/smoke/pwa-smoke.spec.ts`); header only on direct same-origin API calls |
| kernel/perf test "passes" in CI but never ran                    | `__kernel-tests__/**` excluded from root config                                                                           | run explicitly with `vitest.profile.config.ts`; keep `maxWorkers` at 1 — WASM instances are heavy                                                                            |
