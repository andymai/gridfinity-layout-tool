import {
  test,
  expect,
  waitForAppReady,
  getGridBounds,
  getInspector,
  selectBinAt,
  waitForBinCount,
  clearAllStorage,
  resetViewport,
} from './fixtures';

/**
 * Size lock (#3229): a locked bin still moves, but nothing may resize it.
 *
 * The panel assertions guard the layout as much as the behaviour — the lock
 * toggle shares a row with the mm readout, and the inspector is the narrowest
 * column in the app.
 */
test.describe('Bin size lock', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const bounds = await getGridBounds(page);
    await page.mouse.click(bounds.x + 50, bounds.y + 50);
    await waitForBinCount(page, 1);
    await selectBinAt(page, 50, 50);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);
  });

  test('locking freezes the size controls and marks the bin', async ({ page }) => {
    const inspector = getInspector(page);

    const lock = inspector.getByRole('button', { name: 'Lock size' });
    await expect(lock).toBeVisible();
    await lock.click();

    await expect(inspector.getByRole('button', { name: 'Unlock size' })).toBeVisible();
    await expect(inspector.getByLabel('Width', { exact: true })).toBeDisabled();
    await expect(inspector.getByLabel('Depth', { exact: true })).toBeDisabled();
    await expect(inspector.getByLabel('Bin height', { exact: true })).toBeDisabled();
    await expect(inspector.getByLabel('Swap width and depth')).toBeDisabled();
    await expect(inspector.getByText('Size locked. Unlock to resize this bin.')).toBeVisible();

    // The canvas badge is the only cue once the panel is closed.
    await expect(page.locator('[data-bin-id] svg[aria-label="Size locked"]')).toBeVisible();
  });

  test('unlocking restores them', async ({ page }) => {
    const inspector = getInspector(page);

    await inspector.getByRole('button', { name: 'Lock size' }).click();
    await inspector.getByRole('button', { name: 'Unlock size' }).click();

    await expect(inspector.getByLabel('Width', { exact: true })).toBeEnabled();
    await expect(inspector.getByLabel('Swap width and depth')).toBeEnabled();
    await expect(inspector.getByText('Size locked. Unlock to resize this bin.')).toBeHidden();
    await expect(page.locator('[data-bin-id] svg[aria-label="Size locked"]')).toHaveCount(0);
  });

  test('the inspector never scrolls sideways, at any panel width', async ({ page }) => {
    await getInspector(page).getByRole('button', { name: 'Lock size' }).click();

    for (const width of [1280, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });

      // The panel is a bottom sheet below the desktop breakpoint; either way the
      // row that carries the lock must fit the column it sits in.
      const panel = getInspector(page);
      if ((await panel.count()) === 0 || !(await panel.first().isVisible())) continue;

      const overflow = await panel.first().evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `inspector overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
});
