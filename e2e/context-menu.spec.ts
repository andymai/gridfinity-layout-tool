import {
  test,
  expect,
  waitForAppReady,
  getGridBounds,
  waitForBinCount,
  clearAllStorage,
  resetViewport,
} from './fixtures';

/** Widest label ("Link Existing Design") plus icon and padding sits near 220px. */
const MAX_REASONABLE_MENU_WIDTH = 320;

test.describe('Bin context menu', () => {
  // The container clamps itself to the viewport, so a narrow one hides an oversized
  // menu behind the clamp: on a 393px-wide project the regression measured 323px,
  // barely over the bound. Pin a wide viewport so the width is purely intrinsic.
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await page.keyboard.press('Escape');
    await clearAllStorage(page);
    await resetViewport(page);
  });

  test('sizes to its widest item, not the sum of its items', async ({ page }) => {
    const bounds = await getGridBounds(page);
    await page.mouse.click(bounds.x + 60, bounds.y + 60);
    await waitForBinCount(page, 1);

    await page.mouse.click(bounds.x + 60, bounds.y + 60, { button: 'right' });

    const menu = page.getByRole('menu').first();
    await expect(menu).toBeVisible();

    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeLessThan(MAX_REASONABLE_MENU_WIDTH);
  });
});
