---
name: quality-gates
description: Every commit gate and its legitimate unblock — .husky/pre-commit scripts, .claude/hooks PreToolUse blockers, custom ESLint rules (no-init-time-imported-call, React.lazy ban, GRID_SIZE arithmetic ban), pnpm quality, size-limit budgets. Load when a `git commit` is blocked ("switch on X missing cases", "without justification", "VIOLATION features/A → features/B", "must be in a named folder"), when pnpm run size fails, or before pushing.
---

# Quality Gates

## When to use

- A `git commit` was just blocked and you need the legitimate fix (never `--no-verify`).
- You are about to push and want to know what pre-commit did NOT check.
- ESLint rejects code with a project-specific rule (`local/no-init-time-imported-call`, React.lazy ban, GRIDFINITY arithmetic ban).
- `pnpm run size` / CI `size:check` fails a bundle budget.

## Mental model

Four independent gate layers; each catches things the others miss:

| Layer                      | Trigger                    | Source of truth                                                                                                                                                                                                                                            |
| -------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. lint-staged             | any `git commit`           | `package.json` `lint-staged` block (eslint --fix + prettier on staged files)                                                                                                                                                                               |
| 2. Husky scripts           | any `git commit`           | `.husky/pre-commit` — boundaries:staged, design-system:staged, 3× i18n (+ i18n:unused only if `src/i18n/` staged), exhaustiveness (staged), component-structure; warn-only: missing-tests, readme-reminders                                                |
| 3. Claude PreToolUse hooks | Claude typing `git commit` | `.claude/settings.json` — blockers (exit 2): `a11y-check.sh`, `suppression-guard.sh`, `dangerous-patterns.sh`, `result-exhaustion-check.sh`, `union-exhaustiveness-check.sh`; warn-only: `coverage-check.sh`, `pre-pr-review.sh` (fires on `gh pr create`) |
| 4. CI                      | push/PR                    | `.github/workflows/ci.yml` — see the release-and-ci skill                                                                                                                                                                                                  |

Facts that drive everything else:

- **Pre-commit runs neither tsc nor vitest** (`test:affected` is commented out in `.husky/pre-commit`). **knip runs nowhere in CI.** So "hooks passed" ≠ "CI will pass". Before pushing, always run `pnpm run quality` (typecheck + lint + knip) and `pnpm run test:run`.
- All grep-based gates read `git diff --cached` only. An unstaged fix does not count — `git add` before retrying the commit. One exception: the component-structure sibling-test check looks for the test file on disk, not in the index. Test files (`*.test.*`) are skipped by the hooks and get relaxed ESLint rules.
- There is no pre-push hook. Main is protected; everything lands via PR.
- PostToolUse hooks (`use-shallow-check`, `effect-cleanup-check`, `auto-format`, `geometry-sanity-check`) are informational — they never block, and `post-edit-test.sh` is on disk but not wired, so tests do not auto-run after edits.

## Custom ESLint rules (eslint.config.js)

| Rule                                                                                        | Intent                                                                                                            | Unblock                                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `local/no-init-time-imported-call` (`eslint-rules/no-init-time-imported-call.js`)           | Top-level `const x = fn(importedY)` can capture `undefined` under chunk-level static-import cycles (#1466, #1558) | Lazy singleton: `let cached; export function getX() { return (cached ??= fn(importedY)); }`                                                                |
| React.lazy ban (`no-restricted-syntax` + `no-restricted-imports`)                           | Raw `lazy()` leaks chunk-load failures to PostHog as unhandled rejections                                         | Use `lazyWithRetry()` from `src/shared/utils/lazyWithRetry.ts`                                                                                             |
| `GRIDFINITY.GRID_SIZE` / `GRIDFINITY_SPEC.GRID_SIZE` arithmetic ban                         | Direct math locks to 42mm, ignoring user-configured `gridUnitMm`                                                  | Thread params through `src/features/bin-designer/utils/binDimensions.ts`                                                                                   |
| `i18next/no-literal-string` (jsx-only, also `title`/`aria-label`/`placeholder`/`alt` attrs) | User-facing strings must go through `t()`                                                                         | Add a key (see i18n-changes skill); legit literals (units, brand names, shortcuts) go in the `words.exclude` list in `eslint.config.js`, not a suppression |
| `boundaries/dependencies`                                                                   | Feature slices must not import each other                                                                         | See boundary trap below; details in the feature-slices skill                                                                                               |

ESLint flat config **replaces** per-rule values instead of merging: the React.lazy guard is deliberately duplicated into every override block that redefines `no-restricted-syntax`/`no-restricted-imports`. If you edit one copy, edit them all.

## Unblock playbook (symptom → fix)

**"switch on `<Type>` missing cases: ..."** — `scripts/check-union-exhaustiveness.sh` (husky) or `.claude/hooks/union-exhaustiveness-check.sh` tracks hardcoded members of `ValidationReason`, `ToastType`, `LayerViewMode`, `DropTarget`, `EditSource`, `MobileLayersTab`. Add the missing `case`s, or a `default`, or an exhaustive check (the grep accepts `assertNever`, `exhaustive`, or `: never` in the switch body). Adding a new union member? Follow the recipe below — the member lists live in TWO files.

**"Use @ts-expect-error instead of @ts-ignore" / "without justification"** — `.claude/hooks/suppression-guard.sh`. `@ts-ignore` and `@ts-nocheck` are banned outright. Every `@ts-expect-error` / `eslint-disable*` needs a justification matching `TECH-DEBT:`, `#123`, `GH-123`, `TODO(name):`, or `-- reason`. Prefer fixing the error; otherwise: `// @ts-expect-error TECH-DEBT: reason` or `// eslint-disable-next-line rule -- TECH-DEBT: reason`.

**"VIOLATION features/A → features/B"** — `scripts/check-module-boundaries.sh --staged`. Move the shared code to `@/shared`, invert the dependency via props, or load the target lazily. The bash script and ESLint disagree: bash allowlists only `design-linking:bin-designer` (barrel import only), while ESLint additionally allows `bin-inspector → design-linking` — that edge works today only because it is a dynamic import, invisible to the bash grep. A static import there passes lint but blocks at commit. A genuinely new integration edge needs BOTH `ALLOWED_CROSS_FEATURE` in `scripts/check-module-boundaries.sh` and the matching rule in `eslint.config.js`.

**"must be in a named folder" / missing sibling test** — `scripts/check-component-structure.sh` (blocking, exit 1): any staged uppercase-named `.tsx`/`.ts` under `src/**/components/` must live at `components/<Name>/<Name>.tsx` with a sibling `components/<Name>/<Name>.test.ts(x)` existing on disk when you commit (create it alongside the component — conventionally in the same commit). Lowercase basenames, `index`/`types`/`constants`, and `__tests__/` are exempt.

**Raw `<button>` / `<select>` / checkbox blocked** — `scripts/check-design-system-usage.sh`. Import `{ Button, IconButton, Select, Input, Checkbox }` from `@/design-system`. `scripts/design-system-allowlist.txt` exists for temporary exceptions but is empty — migration is complete; do not repopulate it casually.

**a11y / dangerous-pattern / Result findings from Claude hooks** — `.claude/hooks/a11y-check.sh` (tabIndex without role, onClick on div/span without role/tabIndex, empty aria-label), `dangerous-patterns.sh` (unguarded `JSON.parse`/`localStorage`, `innerHTML=`, `eval`, `new Function`, hardcoded 32+-char secrets, sync XHR, mock/stub declarations in production code), `result-exhaustion-check.sh` (calls to layout-store functions like `addBin`/`updateBin`/`deleteBin`/`loadLayout` whose `Result` is never passed to `isOk`/`isErr`). Fix the flagged line: add role + keyboard handling, wrap parse in try/catch or use `src/core/storage`, check the Result. These are greps and can false-positive — restructure so the pattern no longer matches; never bypass.

**i18n check fails** — see the i18n-changes skill for the four checks and their exact unblocks. One layering fact belongs here: `check:i18n:unused` runs only when `src/i18n/` files changed (both pre-commit and CI gate on that), so a deleted `t()` call can leave an orphan key that only fails some later i18n PR. Also, `src/i18n/locales/` has more locale JSONs on disk than CLAUDE.md lists — iterate the directory, not the doc.

## Recipe: add a member to a tracked union type

1. Add the member to the union type definition.
2. Update the `UNION_TYPES` array in `scripts/check-union-exhaustiveness.sh`.
3. Update the duplicate `UNION_TYPES` array in `.claude/hooks/union-exhaustiveness-check.sh` — skipping this leaves the Claude-hook gate checking a stale list.
4. Find every now-incomplete switch: `pnpm run check:exhaustiveness --all` (pre-commit only checks staged files; CI runs `--all`). No `--` before `--all` — pnpm forwards the literal `--` and the script silently falls back to staged-only mode.
5. `pnpm run typecheck` — the compiler catches typed exhaustiveness the greps miss.

## Recipe: fix a failing bundle budget

1. `pnpm run build && pnpm run size` — size-limit reads `dist/assets/*.js`, so a stale or missing `dist/` gives garbage; CI runs `size:check` right after build.
2. Budgets are in the `size-limit` block of `package.json`: main 190 kB gzip, eager-initial set 260 kB, total JS 2000 kB. Open `bundle-analysis.html` at the repo root for a treemap.
3. Split heavy code out of eager chunks with `lazyWithRetry()`; when restructuring module-level singletons, watch for `local/no-init-time-imported-call` (use the `cached ??=` getter pattern).
4. Re-run step 1 until green. Raising a limit is a last resort and belongs in its own reviewed change.

## Verification

```bash
pnpm run quality                              # tsc -b --noEmit + eslint + knip (the only place knip runs)
pnpm run test:run                             # pre-commit never runs tests; see the testing skill
pnpm run check:exhaustiveness --all           # what CI's Quality job runs
pnpm run check:boundaries                     # full scan (pre-commit uses --staged)
pnpm run check:component-structure
pnpm run build && pnpm run size               # bundle budgets
```

Run `pnpm run lint`, never raw `eslint` — the script bakes in `NODE_OPTIONS=--max-old-space-size=8192` and caching; raw invocations can OOM. Note `lint-staged` runs `eslint --fix` per staged file first; anything it cannot autofix aborts the commit before the other gates even run.

## Traps

- Hooks green, CI red on type errors → tsc runs nowhere pre-commit → `pnpm run quality` before every push.
- `knip` findings appear only locally → it is absent from CI → run `pnpm run quality`; delete dead code, or for true false positives adjust `knip.json` (tests and `**/index.ts` are already ignored, export-level findings excluded).
- New Result-returning store API silently unguarded → `RESULT_FUNCTIONS` in `.claude/hooks/result-exhaustion-check.sh` is a hardcoded pipe-list → add the new function name there when you add the API.
- Geometry file edits print a reminder to run the binGenerator scenario tests → `geometry-sanity-check.sh` never blocks, so actually run them — see the geometry-debugging skill.
- For what CI runs versus these local gates, see the release-and-ci skill.
