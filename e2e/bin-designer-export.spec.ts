import { test, expect, clearAllStorage, getActiveDialog } from './fixtures';

/**
 * E2E coverage for the hardened single-bin export pipeline. We:
 * 1. Land on the designer page,
 * 2. Tweak one parameter so the cached generation is invalidated,
 * 3. Open the export dialog, click Download STL, and assert a download fires.
 *
 * The download is a real STL (the worker actually runs), so the test exercises
 * the full timeout/resilience stack — if export is wedged or never completes
 * we fail with the standard download timeout.
 */
test.describe('Bin Designer — STL export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/designer');
    // The Shape grid is the canonical "designer is mounted" signal.
    const grid = page.getByRole('grid', { name: /bin shape editor/i });
    await expect(grid).toBeVisible({ timeout: 15000 });
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('changes a parameter and downloads STL', async ({ page }) => {
    // Mutate a parameter so the export path doesn't hit a stale dedup cache.
    // The L preset clears the bottom-right quadrant — predictable and visible.
    await page.getByRole('button', { name: /^L$/ }).click();

    // Open the export dialog. The action label varies by viewport (mobile
    // shows an icon, desktop a labelled button) — both expose an aria-label
    // that contains "export".
    await page
      .getByRole('button', { name: /^export/i })
      .first()
      .click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Pre-arm the download listener BEFORE the click so we don't miss the
    // event on fast WASM init.
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });

    // Wait for the engine to be ready — the button switches from
    // "Preparing engine…" to "Download STL" once the bridge subscribes.
    const downloadButton = dialog.getByRole('button', { name: /download stl/i });
    await expect(downloadButton).toBeEnabled({ timeout: 60_000 });
    await downloadButton.click();

    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.stl$|\.zip$/i);
  });
});
