---
name: feature-slices
description: Anatomy of a src/features/ slice and the UI layer rules — adding a new slice, module boundaries (check-module-boundaries.sh, eslint boundaries), design-system-only primitives (check-design-system-usage.sh), lazyWithRetry, and the three responsive shell trees in App.tsx. Load when creating a feature/panel/modal, when a commit is blocked by VIOLATION/design-system/component-structure checks, or when a feature works on desktop but is missing on mobile/tablet.
---

# Feature Slices, Shell, and Design System

## When to use

- Adding a new feature slice, panel, modal, or other UI surface.
- Commit blocked by `check-module-boundaries.sh`, `check-design-system-usage.sh`, or `check-component-structure.sh`.
- A feature renders on desktop but is unreachable on a phone or tablet.
- Deciding where code belongs: `features/` vs `shared/` vs `shell/` vs `design-system/`.

## Mental model

1. **Layer rules are enforced twice**: `eslint-plugin-boundaries` in `eslint.config.js` (sees static AND dynamic imports) plus the faster bash mirror `scripts/check-module-boundaries.sh` (pre-commit; only matches single-line `from '@/features/...'` static imports). Treat the eslint config as ground truth. Features never import other features; `core/` never imports `feature`/`shell`; `design-system/` imports nothing app-level (not even `@/i18n` or `@/shared` — primitives take translated strings via props). Cross-feature exceptions exist only for `design-linking → bin-designer` (barrel-only, listed in `ALLOWED_CROSS_FEATURE` in the bash script) and `bin-inspector → design-linking` (dynamic import, eslint-only). Adding a new exception means editing both places — and is almost always the wrong fix; move shared code to `@/shared/` or invert the dependency via props.
2. **App.tsx renders THREE separate JSX trees** — mobile (<768px), tablet (768–899px), desktop (>=900px) — switched by `useResponsive()` from `src/shared/hooks/useResponsive.ts`. `isMobile`/`isTablet`/`isDesktop` are mutually exclusive; breakpoints come only from `BREAKPOINTS` in `src/core/constants.ts` (MD=768, LG=900) — never hardcode pixels. Anything added to one tree does not exist in the others. Tablet reuses desktop's `Sidebar`/`RightPanel` inside `TabletPanelOverlay` (`src/shell/Tablet/`); mobile has its own thin `Mobile*` wrappers in `src/shell/Mobile/`.
3. **Raw `<button>`, `<select>`, `<input type="checkbox">` are banned** outside `src/design-system/`. Import `Button`, `IconButton`, `Select`, `Checkbox`, `Input`, `Dialog`, `cn` from `@/design-system`. Raw text `<input>` slips past the script (its header claims coverage the detection loop doesn't have) — it is still against convention; use `<Input>` from `@/design-system`. `scripts/design-system-allowlist.txt` is intentionally empty (migration complete) — do not re-grow it.
4. **`React.lazy` is banned repo-wide.** Use `lazyWithRetry()` + `namedExport()` from `@/shared/utils/lazyWithRetry` (retries chunk loads, survives PWA stale-chunk deploys).
5. **Cross-tree/global actions use window CustomEvents**, not stores: `'open-command-palette'`, `'open-help-modal'`, `'open-settings-modal'`, `'switch-to-designer'`, `'download-layout'` — dispatched/handled in `src/App.tsx` (except `'open-settings-modal'`, whose listener is in `src/shell/Sidebar/Sidebar.tsx`). Follow this pattern for new global affordances.
6. **Boot order matters**: `src/main.tsx` hydrates stores from IndexedDB (`initializeLayoutLibrary()`) BEFORE `createRoot`, via an ordered if/else chain (smoke → migration → scan → normal). Code added to the normal branch never runs in the other paths; code above the chain runs in ALL of them. StrictMode is deliberately off (react-three-fiber breaks under double-mount) — never re-enable it.

## Recipe: add a new feature slice

1. Create `src/features/<slice>/` with `index.ts` (barrel), `README.md`, `components/`, `hooks/`, `utils/`. Mirror `src/features/staging/` (minimal) or `src/features/layers/` (has helpEntries).
2. Every component: `components/<Name>/<Name>.tsx` + sibling `<Name>.test.tsx` + `index.ts`. Bare `components/Foo.tsx` and missing tests both block the commit. Lowercase filenames (`panelUtils.ts`) are exempt utilities.
3. Barrel: `export * from './components'; export * from './hooks';`. If the slice adds discoverable UI, also `export { helpEntries } from './helpEntries'` (copy `src/features/layers/helpEntries.ts`; each entry's `target.controlId` must match a `data-help-target` attribute in your DOM, `target.surface` routes the jump — see `src/shared/help/helpJumpDispatcher.ts`; the global HelpModal aggregates these).
4. Import only from `@/core`, `@/shared`, `@/design-system`, `@/i18n`, and same-slice paths. All user-facing strings via `useTranslation()` — for key workflow see the **i18n-changes** skill.
5. Wire into `src/App.tsx` at module scope alongside the existing dozen:

```tsx
const X = lazyWithRetry(() => import('@/features/<slice>/components/X').then(namedExport('X')));
```

Render inside `<Suspense>` gated by a boolean so the chunk fetches on demand (see `CommandPalette` in App.tsx). If it mutates layout data it must work under both providers `wrapWithMutations()` can choose (CollabProvider vs LocalMutationsProvider). 6. Decide mobile/tablet exposure explicitly (next recipe) — desktop-only is a decision, not a default you fell into. 7. Write the slice README (the readme-reminder hook will nudge you; every one of the 20 slices has one). Keep it to key files and gotchas; link, don't duplicate. 8. knip runs in `pnpm run quality`: a barrel export nothing imports fails the gate — wire the consumer in the same PR or drop the export.

## Recipe: expose a surface on mobile (new mobile panel)

1. Add the panel ID to the `MobilePanel` union in `src/core/store/mobile.ts` (currently `'layers' | 'inspector' | 'categories' | 'print' | 'settings' | 'layouts' | 'participants' | null`). No gate catches a missed switch: `check:exhaustiveness` only checks the hardcoded `UNION_TYPES` map in `scripts/check-union-exhaustiveness.sh`, which omits `MobilePanel`, and both switches below have `default` cases (`MobilePanelContent` even types `panel` as plain `string`). Steps 3–4 are manual — skip one and the panel opens as an empty `BottomSheet` with no title and no error. Alternatively, add `MobilePanel` to `UNION_TYPES`.
2. Create `src/shell/Mobile/<MobileXPanel>/` as a thin wrapper around the existing feature component — never duplicate feature logic (see `MobileLayersPanel` as the pattern). Named folder + sibling test rules apply.
3. Add a title case to `getPanelTitle` in `src/shell/Mobile/panelUtils.ts`; export from `src/shell/Mobile/index.ts`.
4. Mount in `src/shell/layouts/MobileLayout.tsx`: add a case to the `MobilePanelContent` switch — the `BottomSheet` renders it keyed by `activeMobilePanel`; open via `toggleMobilePanel`/`setActiveMobilePanel`. Extend `BottomNavBar` only if it deserves a tab.
5. Tablet is usually free — confirm the feature is reachable via `Sidebar`/`RightPanel` inside the `TabletPanelOverlay` blocks in App.tsx's tablet branch.

## Recipe: add a design-system primitive

1. `src/design-system/<Component>/<Component>.tsx` + `<Component>.test.tsx` + `index.ts`; re-export from `src/design-system/index.ts`.
2. Style with CVA using shared configs from `src/design-system/variants.ts` (`Size`/`Variant`/`Intent` types); merge classes with `cn()`. Compound components (`Dialog.Root/Header/Body/Footer`) are the pattern for complex primitives.
3. English default labels are allowed here (i18n lint off for `src/design-system/**`) but always expose a prop for consumers to pass translated text. No imports from `@/shared`, `@/core`, `@/i18n`, features, or shell — eslint boundaries blocks them.
4. Update `src/design-system/docs/COMPONENTS.md`. Migrate feature call sites in the same PR.

## Verification

```bash
pnpm run check:boundaries
pnpm run check:design-system
pnpm run check:component-structure
pnpm run test:run src/features/<slice>
pnpm run test:run src/shell/AppShell.scenario.accessibility.test.tsx
pnpm run quality
pnpm run size
```

`check:component-structure` only inspects **staged** files — stage your changes or it reports nothing. Manually verify responsive behavior in `pnpm run dev` at <768px, 768–899px, and >=900px widths. For what each gate failure means and its legitimate unblock, see the **quality-gates** skill.

## Traps

| Symptom                                                             | Cause                                                                                                           | Fix                                                                                                                                                                                         |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commit blocked: `VIOLATION ... features/A → features/B`             | Cross-feature import                                                                                            | Move shared code to `@/shared/`, or pass the component/function as a prop. Allowlisting is a last resort and needs both `scripts/check-module-boundaries.sh` and `eslint.config.js` edited. |
| Panel works on desktop, missing on phone/tablet                     | Only wired into the desktop tree in App.tsx                                                                     | Follow the mobile-panel recipe; check the tablet branch's overlays.                                                                                                                         |
| ESLint: use `lazyWithRetry()` instead of `React.lazy()`             | Direct `lazy` import or `React.lazy(...)` call                                                                  | `lazyWithRetry(() => import('...').then(namedExport('X')))`.                                                                                                                                |
| ESLint `local/no-init-time-imported-call` at a top-level const      | `const x = fn(importedY)` at module init — under chunk import cycles the import can be undefined                | Lazy singleton: `let cached; function getX() { return (cached ??= fn(importedY)); }` (see `eslint-rules/no-init-time-imported-call.js`).                                                    |
| `quality` fails in knip after adding a barrel export                | Export has no consumer yet                                                                                      | Wire the consumer in the same PR or remove the export.                                                                                                                                      |
| Tests find an unexpected extra `[role=dialog]`, or print CSS breaks | `PrintModal` is always mounted (print CSS needs the portal in DOM) and the Labs drawer always has `role=dialog` | Scope dialog queries; see gotchas in `src/shell/README.md`.                                                                                                                                 |
| Entrance animation replays on remount after refactor                | `hasRenderedInitialLayout` in App.tsx is a module-level flag on purpose (once per page load)                    | Do not convert it to state.                                                                                                                                                                 |
| 3D preview/WebGL errors after main.tsx cleanup                      | StrictMode re-enabled                                                                                           | Keep StrictMode off in `src/main.tsx`.                                                                                                                                                      |

Boundary of this skill: PostHog events and labs flag gating → **analytics-and-labs**; translation key lifecycle and the four i18n checks → **i18n-changes**; gate internals and unblocks → **quality-gates**; test setup and fixtures → **testing**.
