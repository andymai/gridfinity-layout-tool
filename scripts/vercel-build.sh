#!/bin/bash
# Vercel Build Command
#
# Source maps must be produced and uploaded by the deployed build. Vercel inlines
# VITE_PUBLIC_POSTHOG_KEY and VITE_LIVEBLOCKS_PUBLIC_KEY at build time, and Vite
# propagates that content-hash change through every importer, so a build without
# them emits different chunk filenames and its maps key to chunks that production
# never serves.

set -e

# scripts/vite-plugin-posthog-sourcemaps.ts injects chunk ids into every chunk,
# workers too, and uploads the main bundle's maps, for the production deploy only.
pnpm run build

# Vite bundles workers without writing them, so the plugin never uploads their
# maps. Its upload deleted the main bundle's maps, so the ones left here are the
# workers'. Error tracking is not a release gate.
if [ "$VERCEL_ENV" = "production" ] && [ -n "$POSTHOG_API_KEY" ] && [ -n "$POSTHOG_PROJECT_ID" ]; then
  export POSTHOG_CLI_API_KEY="$POSTHOG_API_KEY" POSTHOG_CLI_PROJECT_ID="$POSTHOG_PROJECT_ID"
  if [ -n "$POSTHOG_HOST" ]; then export POSTHOG_CLI_HOST="$POSTHOG_HOST"; fi
  release_args=(--release-name "${VERCEL_GIT_REPO_SLUG:-gridfinity-layout-tool}")
  if [ -n "$VERCEL_GIT_COMMIT_SHA" ]; then
    release_args+=(--release-version "$VERCEL_GIT_COMMIT_SHA")
  fi
  pnpm exec posthog-cli sourcemap upload --directory dist "${release_args[@]}" ||
    echo "Worker source map upload failed. Continuing deploy without symbolication." >&2
else
  echo "Skipping worker source map upload: not a production deploy with POSTHOG_API_KEY and POSTHOG_PROJECT_ID."
fi

# Hidden source maps carry no sourceMappingURL but stay fetchable at their asset
# path, so no deploy may serve one.
find dist -name '*.map' -delete
