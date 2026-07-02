---
name: release-and-ci
description: 'PR-to-production pipeline — failed CI checks (Build, Unit Tests Complete, Quality, PWA Smoke Test, Conventional Commit), bundle-size (size-limit) failures, PR title rules, release-please version bumps, stuck "chore(main): release" PRs, Vercel deploy/skip logic, production rollback, "Production smoke failed" issues, editing .github/workflows/*.'
---

# Release and CI

## When to use

- A PR check is red and you need to diagnose or reproduce it locally.
- Shipping a change: PR title, merge, release, deploy questions.
- Releases stopped flowing, a version bump is wrong, or production needs a rollback.
- Adding or editing anything under `.github/workflows/` or the Vercel config.

## Mental model

1. Everything squash-merges to `main`. The **PR title** (validated by `.github/workflows/pr-title.yml` as a conventional commit, lowercase subject) becomes the main commit, the CHANGELOG line, and the version-bump signal. fix/perf → patch, feat → minor, `!`/breaking footer → major. Types refactor/chore/test/docs/style are hidden from the CHANGELOG and bump nothing (`release-please-config.json`).
2. On every main push, `.github/workflows/release.yml` runs release-please, which maintains a `chore(main): release gridfinity-layout-tool x.y.z` PR and auto-approves + auto-merges it (GitHub App token, 6 merge retries). No human touches releases. `CHANGELOG.md`, `.release-please-manifest.json`, and the `version` in `package.json` are machine-owned — never hand-edit; the manifest and package.json version must move in lockstep.
3. Vercel deploys **every merge to main that touches SPA paths** (the list in `scripts/vercel-ignore.sh`: `src/`, `public/`, `index.html`, `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig*`, `api/`) — deploys are not tied to releases. `vercel.json` is deliberately NOT on that list: a headers/CSP/rewrites-only change needs a manual Vercel deploy or a ride-along SPA change.
4. Two smoke layers, one spec (`e2e/smoke/pwa-smoke.spec.ts` via `playwright.smoke.config.ts`): `smoke-preview.yml` polls the GitHub deployments API for the Vercel preview URL on PRs; `smoke-postpromote.yml` smokes `https://gridfinitylayouttool.com` after each production deploy and on failure runs `vercel rollback` and files a `priority: critical` issue.
5. CI is stricter on main than on PRs: PRs run 6 sharded test jobs (3 `generators`, 3 `core`); main runs the full suite **with coverage thresholds** plus the fail-closed OSV scan and PostHog source-map upload. A PR can merge green and still break main.
6. Every CI job carries `if: !startsWith(github.head_ref, 'release-please--')`. Any new required workflow MUST copy this guard, or the release PR waits forever on a check that never runs and all releases silently stall. Branch protection requires the aggregate `Unit Tests Complete` (`test-gate` job in `ci.yml`), not shard names — change shard counts freely, never rename that job.

The workflow files themselves (`ci.yml`, `release.yml`, `smoke-*.yml`, `vite.config.ts`) carry incident-history comments — read them before editing; they explain traps this file only indexes.

## Recipe: diagnose a failed PR check

1. `gh pr checks <pr-number>` — identify the failing context.
2. **Conventional Commit** → the PR _title_ is wrong (bad type or uppercase subject). Edit the title on GitHub; it re-validates on edit, no push needed. Allowed types are listed in `pr-title.yml`.
3. **Quality** → the red step is only an aggregator; every real check runs with `continue-on-error`. Run `gh run view <run-id> --log-failed` and find the earlier step with the failure annotation. A "skipped" check counts as failure and means `pnpm install` died (usually lockfile drift under `--frozen-lockfile`). For what each check enforces and its legitimate unblock, see the **quality-gates** skill.
4. **Unit Tests (shard) / Unit Tests Complete** → reproduce locally:
   ```bash
   pnpm run build:en-locale
   pnpm vitest run --project=generators        # generators shard
   pnpm vitest run --project=unit --project=dom  # core shard
   ```
   `build:en-locale` is mandatory first — `en.json` is generated and gitignored. CI runs vitest with `-u`, so snapshot mismatches can NEVER fail CI; rule them out. See the **testing** skill for the project layout.
5. **Build** at "Check bundle size" → bundle-budget recipe below.
6. **PWA Smoke Test** timeout ("Timed out waiting for Vercel preview") → check the Vercel dashboard for a failed preview build; if the PR is infra-only and should skip, confirm its paths are absent from `scripts/vercel-ignore.sh`. For real test failures, download the trace artifact, or run locally:
   ```bash
   PLAYWRIGHT_TEST_BASE_URL=<preview-url> pnpm exec playwright test --config=playwright.smoke.config.ts
   ```

## Recipe: fix a bundle-size failure

1. Reproduce: `pnpm run build && pnpm run size:check`.
2. Budgets live in the `size-limit` array in `package.json`: Main bundle 190 kB gzip, Eager initial JS 260 kB (main + react-vendor + state + core-foundation), Total JS 2000 kB.
3. Open `bundle-analysis.html` (repo root, emitted by the build) to see what grew.
4. Preferred fix: keep the weight out of eager chunks — dynamic-import it, or check the `advancedChunks` rules in `vite.config.ts` (~lines 246–290) still route it to a lazy chunk. Raising a limit in `package.json` is a last resort and needs justification in the PR.
5. If you rename/add a chunk in `vite.config.ts`, update the matching `size-limit` path glob in `package.json` in the same PR — the globs match chunk file names and drift silently otherwise.

## Recipe: ship end-to-end

1. Branch off main (protected; PRs only). Pre-commit (`.husky/pre-commit`) does NOT run tests — run `pnpm run test:run` and `pnpm run quality` yourself before pushing.
2. Title the PR as a conventional commit, lowercase subject, scope = the touched slice (recent scopes: baseplate, bin-designer, generation, scan, design-system, deps, ci, api, shared). This exact string ships in the CHANGELOG.
3. Wait for checks (smoke-preview adds ~5 min for the Vercel preview), squash-merge.
4. If SPA paths changed, production deploys immediately; post-promote smoke guards it. release.yml then updates/merges the release PR unattended. Users see the new version (`version.json` / `__APP_VERSION__`, emitted by `scripts/vite-plugin-version.ts`) after the release-merge deploy.
5. Verify production: `curl -s https://gridfinitylayouttool.com/version.json` — `gitSha` should match the deployed commit (the file is no-store by `vercel.json` design).

## Recipe: unstick a stalled release

Symptom: a `chore(main): release gridfinity-layout-tool x.y.z` PR sits open; no versions ship.

1. `gh pr list --search "chore(main): release"` to find it; check the latest release.yml run: `gh run list --workflow=release.yml`, then `gh run view <id> --log-failed`.
2. Two usual causes: expired/rotated GitHub App credentials (APP_ID / APP_PRIVATE_KEY secrets — the 6-attempt merge loop errors out), or a newly added required check missing the `release-please--` skip guard so it never runs on the release branch.
3. Unblock now by merging the release PR manually (squash); fix the root cause after.

## Recipe: roll back production

1. If post-promote smoke failed, rollback already ran — look for a "Production smoke failed: <sha>" issue and verify the alias in the Vercel dashboard first.
2. Manual: Vercel dashboard → Deployments → previous good deploy → Instant Rollback, or `npx vercel rollback --token $VERCEL_TOKEN --scope $VERCEL_ORG_ID --yes` (mirrors `smoke-postpromote.yml`).
3. Rollback only moves the alias. Users' installed service workers keep the bad precache until a NEW deploy's SW passes the client-side smoke gate (`src/shared/pwa/smokeGate.ts`). Always fix forward with a new merge to main.
4. Verify with `curl -s https://gridfinitylayouttool.com/version.json`.

## PWA/deploy invariants (do not "simplify" these)

| Setting                                                               | Where                        | Why it must stay                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerType: 'prompt'`, `skipWaiting: false`, `clientsClaim: false` | `vite.config.ts` VitePWA     | `smokeGate.ts` activates the waiting SW (SKIP_WAITING), then smokes the new bundle in a hidden iframe served by the now-active SW; on failure the caller unregisters + purges the precache. `autoUpdate` would skip the gate and ship broken bundles straight into users' service workers |
| `globIgnores`: `wwwMigration-*`, `smokeBoot-*`, `version.json`        | `vite.config.ts` workbox     | Precaching one-shot chunks caused SW install failures on hash mismatch — the old SW stays in control and no fix can ever reach users                                                                                                                                                      |
| `/sw.js` must-revalidate, `/version.json` no-store                    | `vercel.json` headers        | The smoke gate fetches version.json to detect fresh deploys; caching it strands users on stale versions                                                                                                                                                                                   |
| No `extraHTTPHeaders` bypass token                                    | `playwright.smoke.config.ts` | Playwright sends extra headers to every origin (fonts.gstatic.com etc.), breaking CORS preflights; the spec sets a same-origin cookie via query string instead                                                                                                                            |
| No `actions/checkout` in `pr-title.yml` / `labeler.yml`               | those workflows              | They use `pull_request_target` (secrets in base-branch context); checking out PR code there is a documented pwn-request vector                                                                                                                                                            |

## Traps

| Symptom                                                     | Cause                                                                                       | Fix                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Main CI red right after a green PR merged                   | Coverage thresholds and fail-closed OSV run only on main                                    | Coverage step → add tests; OSV → bump/override the vulnerable dep. Not snapshots (CI passes `-u`)       |
| Deploy didn't happen after merging a config change          | `scripts/vercel-ignore.sh` skipped it (vercel.json / docs / CI paths excluded)              | Manual deploy from Vercel dashboard, or ride along with an SPA change                                   |
| `pnpm install` can't resolve a version visible on npm       | `minimumReleaseAge: 10080` in `pnpm-workspace.yaml` (7-day supply-chain cooldown)           | Wait, pin the previous version, or add to `minimumReleaseAgeExclude` with justification per SECURITY.md |
| CHANGELOG entry / version bump missing for a merged PR      | PR title used a hidden type (chore/refactor/etc.)                                           | Titles are baked in at squash; land a follow-up correctly-typed commit if a bump is needed              |
| Green "PWA Smoke Test" but no preview was actually tested   | Vercel legitimately ignored the build (docs/CI-only PR) or Dependabot PR (no bypass secret) | Expected; the job passes with a warning by design                                                       |
| Unminified production stack traces in PostHog lag a deploy  | Source-map upload runs only on main pushes (POSTHOG_API_KEY / POSTHOG_PROJECT_ID)           | Check that step in the main-branch CI run                                                               |
| Fresh clone: bare `pnpm vitest` fails with lazy-load errors | `en.json` is generated and gitignored                                                       | `pnpm run build:en-locale` first                                                                        |

For share/collab runtime env vars on Vercel, see the **share-api-collab** skill. For pre-commit gate internals and unblocks, see **quality-gates**.
