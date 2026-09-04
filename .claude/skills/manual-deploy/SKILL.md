---
name: manual-deploy
description: Push the current main to production outside the normal batched cadence — trigger a release now, force a one-off deploy, or verify/roll back one. Use when the user says "deploy now", "manual deploy", "ship it", "push to prod", or a merged change must go live before the next scheduled release.
---

# Manual deploy

## Background: deploys are batched onto releases

Vercel builds `main` only when the commit message is `chore(main): release …`
or contains `[deploy]` (`scripts/vercel-ignore.sh`). Ordinary feature merges are
skipped and ride the next scheduled release (≤3×/day) to keep edge-request cost
down and CHANGELOG / What's New coherent — so a just-merged change is NOT live
until a release deploy. Its Vercel deployment shows **Canceled (~5s)**, which is
the ignore step working, not a failure. Full pipeline, smoke gates, and skew
protection live in the `release-and-ci` skill.

## The assistant cannot run the deploy itself

`vercel …` and deploy-triggering commands are blocked by the auto-mode
permission classifier. Propose the command and have the user run it with
`! <command>` (output lands in-session), or have them approve the permission.
Never try to work around the block.

## Ways to deploy now — pick one

### 1. Trigger a release (recommended: the full, guarded path)

release-please cuts and auto-merges the `chore(main): release` PR; the release
merge deploys, with sourcemaps, post-promote smoke, CHANGELOG and What's New.
Ships everything merged since the last release.

```bash
gh workflow run release.yml
# if a release PR already exists, just merge it:
gh pr list --search 'chore(main): release' --state open
gh pr merge <n> --squash
```

### 2. `[deploy]` in the squash commit (one specific PR, immediately)

For a change that cannot wait for the scheduled release, or a `vercel.json`-only
change that bumps no version: put `[deploy]` in the squash commit message so the
ignore step builds it.

```bash
gh pr merge <n> --squash --subject "type(scope): summary [deploy]"
```

### 3. One-off CLI deploy (out of band, last resort)

Deploys the current `main` HEAD directly. A plain `vercel --prod` is usually
canceled by the ignore step (it sees `main` + a non-`[deploy]` commit), and this
path skips the preview smoke gate and ships unversioned sourcemaps — prefer 1 or 2. If you must, build locally and deploy the prebuilt output, which skips the
remote build (and its ignore gate):

```bash
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

## Verify

```bash
vercel ls --prod                                         # newest = ● Ready, not Canceled
curl -s https://gridfinitylayouttool.com/version.json    # gitSha matches the deployed commit
```

`.github/workflows/smoke-postpromote.yml` smokes production after every release
deploy and rolls back on failure.

The Docker image publishes from the same release event. If it did not, run
`.github/workflows/docker.yml` via workflow_dispatch with the full release tag.

## Roll back

`npx vercel rollback --yes` (mirrors `smoke-postpromote.yml`), or Vercel
dashboard → Deployments → previous good deploy → Instant Rollback. See
`release-and-ci` for the incident flow.
