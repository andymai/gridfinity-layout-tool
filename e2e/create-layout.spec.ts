import {
  test,
  expect,
  waitForAppReady,
  waitForDialog,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
  renameActiveLayout,
  waitForSavedLayout,
} from './fixtures';

const switcher = (name: string) => `Switch layout (current: ${name})`;

test.describe('Create Layout Flow', () => {
  // Phones and tablets have their own header and panels.
  const isDesktop = ({ viewport }: { viewport: { width: number } | null }): boolean =>
    (viewport?.width ?? 0) >= 900;
  test.skip(({ viewport }) => !isDesktop({ viewport }), 'desktop header only');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  // Hooks run for a skipped test too, on a page that never left about:blank.
  test.afterEach(async ({ page, viewport }) => {
    if (!isDesktop({ viewport })) return;
    await clearAllStorage(page);
    await resetViewport(page);

    // Close any lingering dialogs
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('shows default layout on first load', async ({ page }) => {
    await expect(page.getByRole('button', { name: switcher('Untitled layout') })).toBeVisible();

    // Should have the header with undo/redo buttons
    await expect(page.getByRole('button', { name: /undo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /redo/i })).toBeVisible();

    // Should have the Tools sidebar
    await expect(page.getByRole('heading', { name: 'Tools' })).toBeVisible();
  });

  test('can edit layout name', async ({ page }) => {
    await renameActiveLayout(page, 'My Drawer Layout');

    await expect(page.getByRole('button', { name: switcher('My Drawer Layout') })).toBeVisible();
  });

  test('shows help modal with keyboard shortcut', async ({ page }) => {
    // Press ? key to open help (Shift+/ on US keyboard)
    await page.keyboard.press('?');

    // Wait for help modal with title "Keyboard Shortcuts"
    await waitForDialog(page);
    const modal = page.locator('[role="dialog"]').filter({
      has: page.getByRole('heading', { name: /keyboard shortcuts/i }),
    });
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Close modal by pressing Escape
    await page.keyboard.press('Escape');

    // Modal should be hidden
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('persists the layout name across a reload', async ({ page }) => {
    await renameActiveLayout(page, 'Persisted Layout');
    await waitForSavedLayout(page, { name: 'Persisted Layout' });

    await page.reload();
    await waitForAppReady(page);

    await expect(page.getByRole('button', { name: switcher('Persisted Layout') })).toBeVisible({
      timeout: 5000,
    });
  });
});
