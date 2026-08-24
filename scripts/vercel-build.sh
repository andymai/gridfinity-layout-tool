#!/bin/bash
# Vercel Build Command
#
# Wraps the build so PostHog source maps are uploaded from the deployed build.
# They cannot come from anywhere else. Vercel inlines VITE_PUBLIC_POSTHOG_KEY
# and VITE_LIVEBLOCKS_PUBLIC_KEY at build time, and Vite propagates that
# content-hash change through every importer, so a build without those values
# names roughly half its chunks differently. Maps uploaded from such a build key
# to filenames production never serves.

set -e

pnpm run build

# Previews are excluded: they would publish symbol sets for bundles that are
# thrown away, against the same project as production.
if [ "$VERCEL_ENV" = "production" ] && [ -n "$POSTHOG_CLI_API_KEY" ] && [ -n "$POSTHOG_CLI_PROJECT_ID" ]; then
  # Injection rewrites the emitted assets/*.js. That is safe only because the
  # service worker precaches every one of them with revision:null and leans on
  # the filename hash instead; giving those entries a content revision would
  # make this post-build mutation stale the precache manifest.
  #
  # Error tracking is not a release gate, so a failed upload must not fail the
  # deploy.
  pnpm dlx @posthog/cli@0.15.0 sourcemap process \
    --directory dist \
    --release-name "${VERCEL_GIT_REPO_SLUG:-gridfinity-layout-tool}" \
    --release-version "${VERCEL_GIT_COMMIT_SHA:-$(git rev-parse HEAD)}" \
    --delete-after ||
    echo "Source map upload failed. Continuing deploy without symbolication." >&2
else
  echo "Skipping source map upload: not a credentialed production deploy."
fi

# Hidden source maps carry no sourceMappingURL, but they stay fetchable at their
# asset path, so no path above may leave one in the output.
find dist -name '*.map' -delete
