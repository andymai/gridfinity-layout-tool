#!/bin/bash
# Vercel Ignored Build Step
# https://vercel.com/docs/projects/overview#ignored-build-step
#
# Skips deployment when only non-SPA files changed (README, CI config, etc.)
# This prevents unnecessary service worker updates for users.
#
# Exit codes:
#   0 = Skip build (no relevant changes)
#   1 = Proceed with build

set -e

# Skip release-please branches — they only bump version/changelog and
# frequently force-push, causing Vercel to build stale commits that no longer exist.
if [[ "$VERCEL_GIT_COMMIT_REF" == release-please--* ]]; then
  echo "Release-please branch. Skipping build."
  exit 0
fi

# Always build on main branch, but check if SPA source changed
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  echo "Main branch: checking for SPA changes..."

  # A release-please merge bumps only the version and changelog, but it touches
  # package.json, which the watch list below counts as a real change. Those
  # merges are ~40% of main's commits. The bumped version ships with the next
  # source commit.
  if [[ "$VERCEL_GIT_COMMIT_MESSAGE" == "chore(main): release "* ]]; then
    non_release_files="$(git diff --name-only HEAD^ HEAD |
      grep -vE '^(package\.json|CHANGELOG\.md|\.release-please-manifest\.json)$' || true)"
    if [ -z "$non_release_files" ]; then
      echo "Release-only commit (version + changelog). Skipping build."
      exit 0
    fi
  fi

  # Check if any SPA-related files changed compared to previous commit
  # If git diff --quiet exits 0, no changes were found (skip build)
  # If git diff --quiet exits 1, changes were found (proceed with build)
  #
  # Note: vercel.json is intentionally excluded. It controls deployment
  # config (headers, rewrites) but doesn't change the SPA bundle.
  # Config-only changes can be deployed manually if needed.
  if git diff --quiet HEAD^ HEAD -- \
    src/ \
    public/ \
    content/ \
    scripts/build-content.ts \
    index.html \
    package.json \
    pnpm-lock.yaml \
    vite.config.ts \
    tsconfig.json \
    tsconfig.app.json \
    tsconfig.node.json \
    api/
  then
    echo "No SPA changes detected. Skipping build."
    exit 0
  else
    echo "SPA changes detected. Proceeding with build."
    exit 1
  fi
fi

# PR previews are opt-in. Most PRs never need one, and every preview build
# costs a full deploy. Request one either way:
#   - branch the work as `preview/<name>`, or
#   - put `[preview]` anywhere in the head commit message.
#
# Note: the PWA smoke spec (.github/workflows/smoke-preview.yml) can only run
# against a real preview URL. Without one it exits success with a warning, so
# opting out also opts out of deploy-time smoke coverage — precache breakage,
# missing assets, asset-hash mismatches. Use `[preview]` on anything touching
# the service worker, build output, or public/ assets.
if [ -n "$VERCEL_GIT_PULL_REQUEST_ID" ]; then
  if [[ "$VERCEL_GIT_COMMIT_REF" == preview/* ]]; then
    echo "PR on a preview/* branch. Proceeding with build."
    exit 1
  fi

  if [[ "$VERCEL_GIT_COMMIT_MESSAGE" == *"[preview]"* ]]; then
    echo "PR head commit requests [preview]. Proceeding with build."
    exit 1
  fi

  echo "PR preview not requested. Skipping build."
  echo "To get one: branch as preview/<name>, or add [preview] to the commit message."
  exit 0
fi

# Skip other branch deploys (feature branches without PRs)
echo "Non-main branch without PR. Skipping build."
exit 0
