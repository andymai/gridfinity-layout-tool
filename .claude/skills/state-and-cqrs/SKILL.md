---
name: state-and-cqrs
description: 'Zustand stores (src/core/store/) and the CQRS v2 pipeline (src/core/cqrs/) — adding a command/event end-to-end with defineCommand and its hand-maintained registries, undo capture and batch(), event versioning/migrations, persistence (localStorage/IndexedDB/useAutoSave), the init-time-literal store rule (#1466), useShallow. Symptoms: "No handler registered for command type", undo toast shows generic "Undid: Action", Ctrl+Z not reverting, "Maximum update depth exceeded", "Missing migration".'
---

# State & CQRS

## When to use

- Adding or changing a domain command/event, undo behavior, or middleware in `src/core/cqrs/`.
- Adding a Zustand store or store selector in `src/core/store/`.
- Persistence bugs (state lost on reload) or event versioning/migration work.
- Any of the symptoms in the traps table below.

## Mental model

- Flow: component calls `useMutations()` (`src/shared/contexts/MutationsContext.tsx`) → `createCqrsMutations` (`src/core/cqrs/integration/mutationsAdapter.ts`) → `commandBus.dispatch` → middleware pipeline, fixed order in `src/core/cqrs/middleware/index.ts` `getDefaultPipeline()`: validation → undoCapture → analytics → logging → handler. The bus publishes the returned events only after the handler returns ok — handlers never publish directly.
- Zustand stores are the source of truth. The IndexedDB event log (`gridfinity-events-db`, `src/core/cqrs/store/eventStore.ts`) is best-effort observability: retry queue drops after 3 attempts, 10,000-events-per-aggregate eviction. Command success must never depend on it.
- Every local layout mutation must stamp `lastEditSource = 'local'`: v2 commands get it from `applyToDraft` (`src/core/cqrs/v2/runtime.ts`); direct layout-store actions must go through the `setLocal` wrapper (`src/core/store/layout/index.ts`), never raw `set`. Collab push (`src/core/sync/triggers/useDebouncedPush.ts`), cloud-share dirty tracking (`useOwnedShareSync`), and ML telemetry fire only on `'local'`. `importLayout` takes an explicit source (remote applies pass `'remote'` so they don't echo back); `restoreLayout` stamps `'local'` deliberately.
- v2 core invariant (`src/core/cqrs/v2/runtime.ts`): `handle(payload, ctx)` reads a frozen aggregate snapshot and may not mutate; `apply(event, draft)` is a deterministic Immer-draft write, and the event payload alone must reproduce the state change. Generate IDs and computed placement inside `handle()` and put them IN the event payload — `src/core/cqrs/v2/domain/bin/addBin.ts` is the canonical example.
- Undo is snapshot-based, not event replay: `undoCapture.ts` `structuredClone`s the layout plus a selection snapshot BEFORE the handler, pushes only on ok (max 100, `src/core/cqrs/undo/historyStore.ts`). Undo/redo re-enter the bus as `layout.restore` with the `restore` profile (validation=false, undo=false), handled by v1 `src/core/cqrs/handlers/restoreHandlers.ts`.
- The v2 `defineCommand` fields `payload`, `middleware`, `descriptionKey`, `schemaVersion` are NOT consumed by the runtime. Real behavior comes from four separate registries (table below). Editing only the v2 def silently changes nothing.
- Docs are stale in two ways: `src/core/cqrs/README.md`'s directory map still lists deleted v1 handler files (domain handlers live under `v2/domain/`; see `git show 2b0c11b`), and both it and CLAUDE.md say undo capture is behind a Labs flag — it runs unconditionally for every `domain`-profile command. `designer.save` and `layout.restore` stay v1 by design; the `designer` aggregate is not wired and throws in `v2/runtime.ts`.

## Recipe: add a domain command + event (v2)

1. Create `src/core/cqrs/v2/domain/<aggregate>/<name>.ts` copying `addBin.ts`: brand IDs/units at the boundary (`layerId()`, `gridUnits()` from `@/core/types`), validate against `ctx.aggregate`, return `ok({ value, event: { payload } })`; keep `apply()` a dumb draft write. Aggregate is `'layout'` or `'library'` only.
2. Add the command type + union member in `src/core/cqrs/commands/<domain>Commands.ts`, the event in `src/core/cqrs/events/<domain>Events.ts`, and re-export through `commands/index.ts`, `events/index.ts`, and `src/core/cqrs/index.ts`.
3. Work through every row of this table. Only two rows are compile-enforced; the rest fail silently.

| Registration                                                                                   | File                                                                                         | If missed                                                                      |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `v2HandlerOverrides` AND `v2Commands`                                                          | `src/core/cqrs/v2/registry.ts`                                                               | runtime throw "No handler registered for command type" at first dispatch       |
| `COMMAND_PROFILES` entry (`'domain'` = validated + undoable, `'library'` = validated, no undo) | `src/core/cqrs/middleware/middlewareConfig.ts`                                               | compile error (exhaustive Record)                                              |
| `CURRENT_EVENT_VERSIONS` entry                                                                 | `src/core/cqrs/versioning/eventVersions.ts`                                                  | compile error (exhaustive Record)                                              |
| Zod schema in `COMMAND_SCHEMAS` + type in `ALL_COMMAND_TYPES`                                  | `src/core/cqrs/validation/schemas.ts`, `validation/schemas.test.ts`                          | silent — `COMMAND_SCHEMAS` is Partial, unvalidated payloads reach the handler  |
| `DESCRIPTIONS` entry + i18n key                                                                | `src/core/cqrs/commandDescriptions.ts`, `src/i18n/locales/en.ts` then every locale JSON      | silent — undo toast falls back to "↩ Undid: Action" (key `undo.unknownAction`) |
| `applyEvent` case                                                                              | `src/core/cqrs/projection/replay.ts`                                                         | silent — debug replay drops the event                                          |
| Mutations method                                                                               | `src/shared/contexts/MutationsContext.tsx` + `src/core/cqrs/integration/mutationsAdapter.ts` | command unreachable from components                                            |

4. Write colocated tests for the v2 file (pre-commit blocks files without a sibling test — see the testing skill).

## Recipe: multi-command single undo step

1. Import `batch` from `@/core/cqrs`. Wrap dispatches: `batch(() => { mutations.deleteBin(a); mutations.deleteBin(b); })`.
2. The callback MUST be synchronous — async escapes the `isBatching` scope and later dispatches get their own undo entries. Nesting is safe; the outer batch owns the snapshot. Undo description uses the first command type dispatched inside; the snapshot is pushed even if the callback throws.
3. Test that `useHistoryStore.getState().past` grows by exactly 1; reset with `_resetUndoCaptureState` from `@/core/cqrs` between tests.

## Recipe: change a persisted event's payload shape

1. Change the event type in `src/core/cqrs/events/<domain>Events.ts` and the emitting command's `handle`/`apply`.
2. Bump the version in `versioning/eventVersions.ts`; `registerMigration('<event>', 1, 2, fn)` in `versioning/migrations.ts`. Migrations must be pure, must default new fields, must never remove fields. Chains walk v1→v2→v3 automatically, but a gap makes `migrateEvent` log and return the ORIGINAL unmigrated event — register every v→v+1 step and test the chain.
3. Update `projection/replay.ts`; keep tolerance for `schemaVersion !== current` (events without `schemaVersion` are treated as v1).

## Recipe: add a Zustand store

1. Create `src/core/store/<name>.ts`. Initial state MUST be a pure literal with zero imported function calls — Zustand creators run at module init and chunk-level static-import cycles leave imported bindings undefined (#1466; enforced partially by eslint `local/no-init-time-imported-call`). Cast branded literals directly; hydrate real data from `src/main.tsx` like `initLibrary`/`importLayout`. Model: `PLACEHOLDER_LAYOUT` in `src/core/store/layout/index.ts`.
2. Export `use<Name>Store` plus an `INITIAL_<NAME>_STATE` constant for test resets (see `src/core/store/selection.ts`); re-export from `src/core/store/index.ts`. There is no `zustand/persist` anywhere — persist manually (localStorage like `settings.ts`, or IndexedDB via storage facade).
3. Wrap object-returning selectors in `useShallow`; put shared derived hooks in `src/core/store/selectors.ts` only when used 3+ times (guidelines in its header).

## Verification

```bash
pnpm run test:run src/core/cqrs/     # after any CQRS change
pnpm run test:run src/core/store/    # after store changes (scenario tests cover displacement/half-grid/multi-bin)
pnpm run typecheck                      # exhaustive Records surface missing registrations
pnpm run check:i18n                     # after adding undo-description keys
pnpm run quality                        # before commit
```

A missing exhaustive-Record entry fails typecheck with "Property '<type>' is missing" pointing at `middlewareConfig.ts` / `eventVersions.ts`. The silent registrations surface only at runtime or via `validation/schemas.test.ts`.

## Traps

| Symptom                                                         | Cause                                                                                                                                                    | Fix                                                                                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Throw "No handler registered for command type: X"               | v2 file not in `v2HandlerOverrides`/`v2Commands`, or `type` string mismatch with the command union                                                       | register in `src/core/cqrs/v2/registry.ts`; strings must match exactly                                                           |
| Invalid payload reaches handler, no validation error            | schema only in the inert v2 def; validation middleware passes unknown types through                                                                      | add to `COMMAND_SCHEMAS` + `ALL_COMMAND_TYPES`                                                                                   |
| Ctrl+Z doesn't revert (or reverts too much)                     | profile isn't `domain`; or dispatched with source `replay`/`cascade`/`collab`; or inside someone else's `batch()`                                        | fix `COMMAND_PROFILES`; dispatch user actions with default source                                                                |
| Boot crash "undefined is not a function", often production-only | imported function called at store module init (#1466 chunk cycle)                                                                                        | pure-literal placeholder state; defer imported calls                                                                             |
| "Maximum update depth exceeded" / frozen UI                     | selector returns fresh object/array without `useShallow` — Zustand 5 + React 19 makes this an infinite loop, and it's convention-only, not lint-enforced | `useShallow` from `zustand/react/shallow`, or select primitives                                                                  |
| Undo restores layout but selection/active layer jumps           | stale IDs pruned; fallback active layer is `layers[layers.length - 1]` (top in UI — `layers[0]` is bottom)                                               | expected behavior lives in `restoreHandlers.ts`; preserve it                                                                     |
| "[migrations] Missing migration X v1→v2"                        | version bumped without registering every chain step                                                                                                      | `registerMigration` per step; readers tolerate old versions                                                                      |
| cloudShare metadata lost after reload                           | `useAutoSave` (1s debounce, keyed to layout changes, skips `SHARED_PREVIEW_ID`) never fires for library-only mutations                                   | emit an event `src/core/cqrs/subscribers/libraryPersistence.ts` handles, or add a subscription there                             |
| Events missing from `gridfinity-events-db`                      | by design: retry exhaustion, eviction, or mutation bypassed the bus (Liveblocks collab applies via `importLayout`, no events/analytics)                  | never treat the event store as truth; guaranteed persistence goes through `saveLayoutWithMetadata`                               |
| Undo history bleeds across layouts                              | a layout-activation path skipped `clearHistory()`                                                                                                        | use `src/shared/hooks/useLayoutActivation.ts`: importLayout → clearSelection → setActiveLayer → setActiveCategory → clearHistory |

Also: never add per-frame/per-pointer-move dispatches — `structuredClone` of the full layout runs per domain command; interactions batch final state into one command (see the grid-editor skill). New middleware must check `getMiddlewareFlags` first or it will also see `layout.restore` with a full Layout payload. `event.meta.version` is a per-session in-memory counter (`handlers/shared.ts`) — order persisted events by timestamp, never by version. `selectionPruning.ts` (live deletes) and `restoreHandlers.ts` (undo) are two separate selection-consistency mechanisms; keep both. In `eventStore.ts` `append`, keep all IDB reads in one up-front `Promise.all` — interleaved awaits let WebKit auto-commit the transaction mid-loop. Undo toasts use `getStaticTranslation` (English-only, noted in `historyStore.ts`).

For test setup and the real-deps rule, see the testing skill. For methodology (reproduce-first, fix-all-layers), see the debugging-playbook skill.
