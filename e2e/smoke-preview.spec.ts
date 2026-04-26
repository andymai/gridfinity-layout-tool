import { test, expect } from '@playwright/test';

// Boot smoke for the Vercel preview deployment of a PR.
//
// What this catches: any class of bug that prevents the SPA from mounting —
// uncaught exceptions during initial chunk evaluation (e.g. issue #1466's
// circular-import / undefined-binding TypeError), missing assets, MIME-type
// regressions, etc. Runs only against PR previews to gate merges to main.
//
// Intentionally narrow: assertions are limited to "no boot-time errors" and
// "React actually mounted something". UI-text or interaction assertions belong
// in the broader e2e suite, not in the deploy gate.
test('production preview boots without errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => {
    pageErrors.push(`${e.name}: ${e.message}`);
  });

  await page.goto('/', { waitUntil: 'load' });

  // Give the React tree a moment to mount past Suspense boundaries.
  await page.waitForTimeout(2000);

  expect(pageErrors, `boot-time JS errors detected:\n${pageErrors.join('\n')}`).toHaveLength(0);

  const rootChildCount = await page.evaluate(
    () => document.getElementById('root')?.children.length ?? 0
  );
  expect(rootChildCount, 'expected #root to have at least one child after mount').toBeGreaterThan(
    0
  );
});
