import { test, expect, type ConsoleMessage } from '@playwright/test';

/**
 * PWA update smoke test. Asserts a deployed bundle:
 * - Boots the `?smoke=1` fixture path without console errors.
 * - Renders the grid (proves the React tree mounted).
 * - Serves a parseable `/version.json` whose hash matches the one the runtime
 *   reports — catches the wwwMigration-class bug where the SW precache and the
 *   deployed asset graph disagree.
 *
 * Runs under `playwright.smoke.config.ts`, single chromium project, against
 * `PLAYWRIGHT_TEST_BASE_URL`. Used by both PR-preview and post-promote workflows.
 */

interface VersionJson {
  version: string;
  gitSha: string;
  buildTime: string;
}

const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  // Vercel Analytics in dev/preview
  /vercel.*analytics/i,
  // PostHog blocked or not configured (smoke mode skips init)
  /posthog/i,
  // React DevTools nag
  /Download the React DevTools/i,
];

test('boots ?smoke=1 fixture and exposes a fresh /version.json', async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  // /version.json must be reachable and parseable. Bypass any service worker by
  // requesting from the API context.
  const versionRes = await page.request.get(`${baseURL ?? ''}/version.json`, {
    headers: { 'Cache-Control': 'no-store' },
  });
  expect(versionRes.status()).toBe(200);
  const versionJson = (await versionRes.json()) as VersionJson;
  expect(versionJson.version).toBeTruthy();
  expect(versionJson.gitSha).toBeTruthy();
  expect(versionJson.buildTime).toBeTruthy();

  // Boot the smoke fixture.
  await page.goto('/?smoke=1', { waitUntil: 'domcontentloaded' });

  // Mirror waitForAppReady from e2e/fixtures.ts but tighter — the smoke harness
  // mounts the same App tree, so the same selectors apply.
  await page.waitForSelector('header', { timeout: 10_000 });
  await page.waitForSelector('[role="application"]', { timeout: 10_000 });

  // smokeBoot.tsx sets window.__SMOKE_BUILD_INFO__ from the compile-time defines.
  // If the runtime hash differs from /version.json, the SW is serving stale assets.
  const runtimeVersion = await page.evaluate(() => {
    const w = window as unknown as {
      __SMOKE_BUILD_INFO__?: { version: string; gitSha: string; buildTime: string };
    };
    return w.__SMOKE_BUILD_INFO__;
  });
  expect(runtimeVersion, 'smoke harness did not expose __SMOKE_BUILD_INFO__').toBeTruthy();
  expect(runtimeVersion?.version).toBe(versionJson.version);
  expect(runtimeVersion?.gitSha).toBe(versionJson.gitSha);

  // Console must be clean (excluding ignored patterns).
  expect(errors, `unexpected console errors: ${errors.join('\n')}`).toHaveLength(0);
});
