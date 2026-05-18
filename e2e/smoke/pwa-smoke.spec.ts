import { test, expect, type ConsoleMessage } from '@playwright/test';

/**
 * PWA update smoke test. Asserts a deployed bundle:
 * - Boots the `?smoke=1` fixture path without console errors.
 * - Renders the grid (proves the React tree mounted).
 * - Serves a parseable `/version.json` whose hash matches the one the runtime
 *   reports — catches the wwwMigration-class bug where the SW precache and the
 *   deployed asset graph disagree.
 * - Drives one bin-creation click through the live command bus — catches
 *   chunk-init capture bugs (#1466 pattern, #1558) where a singleton like
 *   `commandBus` is `undefined` when a closure captured it during module-init.
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
  // CSP-Report-Only violations are by design surfaced (not enforced) so the
  // soak window can collect signal. They show up as console errors but are
  // not actual bugs. Enforced-CSP violations (without "report-only") are
  // still caught by this assertion.
  /report-only Content Security Policy/i,
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

  // Build the per-request bypass header for direct API calls — same-origin only.
  // We avoid Playwright's `extraHTTPHeaders` because that would pollute every
  // outgoing request, including third-party (fonts.gstatic.com), where CORS
  // preflight rejects unknown headers and breaks asset loading.
  const bypass = process.env.VERCEL_BYPASS_SECRET ?? '';
  const apiHeaders: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (bypass) apiHeaders['x-vercel-protection-bypass'] = bypass;

  // /version.json must be reachable and parseable. Bypass any service worker by
  // requesting from the API context. 30s tolerates Vercel cold-start after a
  // promote-to-prod, which can take 12-15s before /version.json responds.
  const versionRes = await page.request.get(`${baseURL ?? ''}/version.json`, {
    headers: apiHeaders,
    timeout: 30_000,
  });
  expect(versionRes.status()).toBe(200);
  const versionJson = (await versionRes.json()) as VersionJson;
  expect(versionJson.version).toBeTruthy();
  expect(versionJson.gitSha).toBeTruthy();
  expect(versionJson.buildTime).toBeTruthy();

  // Boot the smoke fixture. When the preview is gated by Vercel deployment
  // protection, attach the bypass secret as a query string with
  // `x-vercel-set-bypass-cookie=true` — Vercel responds with a same-origin
  // cookie that grants access for the rest of the session WITHOUT polluting
  // third-party requests with a bypass header.
  // https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
  const sep = '?smoke=1';
  const bootUrl = bypass
    ? `${sep}&x-vercel-protection-bypass=${encodeURIComponent(bypass)}&x-vercel-set-bypass-cookie=true`
    : sep;
  await page.goto(bootUrl, { waitUntil: 'domcontentloaded' });

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

  // Click on the grid to dispatch bin.add through the live command bus.
  // The smoke layout has 1 layer + 1 category, so this is a happy-path draw.
  // A chunk-init capture bug (commandBus undefined inside cqrsMutations)
  // surfaces here as a `pageerror`.
  const grid = page.locator('[role="application"]');
  const gridBox = await grid.boundingBox();
  expect(gridBox, 'grid bounding box not measurable').toBeTruthy();
  if (gridBox) {
    await page.mouse.click(gridBox.x + 50, gridBox.y + gridBox.height - 50);
    // Assert errors before bin-count so a runtime exception (the very bug
    // class this assertion guards against) shows up in the failure message
    // instead of being masked by a "no [data-bin-id] within 5s" timeout.
    expect(errors, `bin-add dispatch raised: ${errors.join('\n')}`).toHaveLength(0);
    await expect(page.locator('[data-bin-id]')).toHaveCount(1, { timeout: 5_000 });
  }

  // Console must be clean (excluding ignored patterns).
  expect(errors, `unexpected console errors: ${errors.join('\n')}`).toHaveLength(0);
});
