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

# Always build on main branch, but check if SPA source changed
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  echo "Main branch: checking for SPA changes..."

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
    index.html \
    package.json \
    package-lock.json \
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

# Always build preview deployments for PRs
if [ -n "$VERCEL_GIT_PULL_REQUEST_ID" ]; then
  echo "PR preview deployment. Proceeding with build."
  exit 1
fi

# Skip other branch deploys (feature branches without PRs)
echo "Non-main branch without PR. Skipping build."
exit 0
