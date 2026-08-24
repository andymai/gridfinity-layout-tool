#!/bin/bash
# Vercel Ignored Build Step
# https://vercel.com/docs/projects/overview#ignored-build-step
#
# Batches production deploys onto the release cadence. Every aliased deploy
# makes all active clients re-fetch sw.js plus every precache entry whose
# chunk hash changed, so deploy count, not traffic, sets the edge-request
# usage; per-merge deploys multiply it by the day's merge count.
#
# Exit codes:
#   0 = Skip build
#   1 = Proceed with build

set -e

# Skip release-please branches — they only bump version/changelog and
# frequently force-push, causing Vercel to build stale commits that no longer exist.
if [[ "$VERCEL_GIT_COMMIT_REF" == release-please--* ]]; then
  echo "Release-please branch. Skipping build."
  exit 0
fi

# Main deploys only on release merges, plus an explicit escape hatch.
# A release-please merge is the batch point: it lands after the feature
# commits it versions, so the build it triggers ships everything since the
# last release, with the deployed bundle matching package.json. For anything
# that cannot wait for a release (hotfix, config-only change), put [deploy]
# in the squash commit message.
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  if [[ "$VERCEL_GIT_COMMIT_MESSAGE" == "chore(main): release "* ]]; then
    echo "Release merge. Proceeding with build."
    exit 1
  fi

  if [[ "$VERCEL_GIT_COMMIT_MESSAGE" == *"[deploy]"* ]]; then
    echo "Commit requests [deploy]. Proceeding with build."
    exit 1
  fi

  echo "Not a release merge. Skipping build; changes ship with the next release."
  echo "To deploy now: add [deploy] to the commit message, or merge the release PR."
  exit 0
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
