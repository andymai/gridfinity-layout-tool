#!/bin/bash
# Vercel Build Command
#
# Source maps must be produced and uploaded by the deployed build. Vercel inlines
# VITE_PUBLIC_POSTHOG_KEY and VITE_LIVEBLOCKS_PUBLIC_KEY at build time, and Vite
# propagates that content-hash change through every importer, so a build without
# them emits different chunk filenames and its maps key to chunks that production
# never serves.

set -e

pnpm run build

# Previews would publish symbol sets, against the same project as production, for
# bundles that are then discarded.
if [ "$VERCEL_ENV" = "production" ] && [ -n "$POSTHOG_CLI_API_KEY" ] && [ -n "$POSTHOG_CLI_PROJECT_ID" ]; then
  release_args=(--release-name "${VERCEL_GIT_REPO_SLUG:-gridfinity-layout-tool}")
  # Set on every Git-connected deploy; the fallback only covers a manual
  # `vercel deploy`, which must degrade to an unversioned upload.
  release_version="${VERCEL_GIT_COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || true)}"
  if [ -n "$release_version" ]; then
    release_args+=(--release-version "$release_version")
  fi

  # Injection rewrites the emitted assets/*.js. That is safe only because the
  # service worker precaches each of them with revision:null; giving those
  # entries a content revision would let this mutation stale the manifest.
  #
  # Error tracking is not a release gate.
  pnpm dlx @posthog/cli@0.15.0 sourcemap process \
    --directory dist \
    "${release_args[@]}" \
    --delete-after ||
    echo "Source map upload failed. Continuing deploy without symbolication." >&2
else
  echo "Skipping source map upload: not a credentialed production deploy."
fi

# Hidden source maps carry no sourceMappingURL but stay fetchable at their asset
# path, so no branch above may leave one behind.
find dist -name '*.map' -delete
