#!/usr/bin/env -S npx tsx
/* eslint-disable no-console */
/**
 * Upload Source Maps to PostHog
 *
 * Uploads source maps from the dist/assets directory to PostHog for
 * improved error stack traces in exception tracking.
 *
 * Prerequisites:
 * - POSTHOG_PERSONAL_API_KEY environment variable
 * - POSTHOG_PROJECT_ID environment variable
 * - Build artifacts in dist/assets/
 *
 * Usage:
 *   npm run sourcemaps:upload
 *
 * @see https://posthog.com/docs/error-tracking/source-maps
 */

import * as fs from 'fs';
import * as path from 'path';

const POSTHOG_HOST = 'https://us.posthog.com';
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const DIST_DIR = path.join(process.cwd(), 'dist', 'assets');

// Get release version from git or package.json
function getRelease(): string {
  // Try git commit hash first
  try {
    const { execSync } = require('child_process');
    const hash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    return hash.slice(0, 8);
  } catch {
    // Fallback to package version
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    return pkg.version || 'unknown';
  }
}

async function uploadSourceMap(
  jsFile: string,
  mapFile: string,
  release: string
): Promise<boolean> {
  const jsUrl = `https://www.gridfinitylayouttool.com/assets/${path.basename(jsFile)}`;

  const formData = new FormData();
  formData.append('release', release);
  formData.append('minified_url', jsUrl);
  formData.append('source_map', new Blob([fs.readFileSync(mapFile)]));

  try {
    const response = await fetch(
      `${POSTHOG_HOST}/api/projects/${PROJECT_ID}/source_maps/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`  ❌ Failed to upload ${path.basename(mapFile)}: ${response.status} ${text}`);
      return false;
    }

    console.log(`  ✅ Uploaded: ${path.basename(mapFile)}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error uploading ${path.basename(mapFile)}:`, error);
    return false;
  }
}

async function main() {
  console.log('📦 PostHog Source Map Upload');
  console.log('============================\n');

  if (!API_KEY) {
    console.error('❌ Missing POSTHOG_PERSONAL_API_KEY environment variable');
    process.exit(1);
  }

  if (!PROJECT_ID) {
    console.error('❌ Missing POSTHOG_PROJECT_ID environment variable');
    process.exit(1);
  }

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ Build directory not found: ${DIST_DIR}`);
    console.error('   Run "npm run build" first');
    process.exit(1);
  }

  const release = getRelease();
  console.log(`Release: ${release}`);
  console.log(`Project ID: ${PROJECT_ID}\n`);

  // Find all .js files with corresponding .js.map files
  const files = fs.readdirSync(DIST_DIR);
  const jsFiles = files.filter(
    (f) => f.endsWith('.js') && files.includes(`${f}.map`)
  );

  if (jsFiles.length === 0) {
    console.log('No source maps found in dist/assets/');
    console.log('Make sure vite is configured to generate source maps.');
    process.exit(0);
  }

  console.log(`Found ${jsFiles.length} source maps to upload:\n`);

  let successCount = 0;
  for (const jsFile of jsFiles) {
    const jsPath = path.join(DIST_DIR, jsFile);
    const mapPath = path.join(DIST_DIR, `${jsFile}.map`);

    const success = await uploadSourceMap(jsPath, mapPath, release);
    if (success) successCount++;

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n✅ Uploaded ${successCount}/${jsFiles.length} source maps`);

  if (successCount < jsFiles.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
