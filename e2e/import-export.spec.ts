import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import {
  test,
  expect,
  waitForAppReady,
  waitForDialog,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
  drawBinOnGrid,
  waitForBinCount,
  openLayoutManager,
  waitForSavedLayout,
} from './fixtures';

const validLayout = JSON.stringify({
  version: '1.0',
  name: 'Test Layout',
  drawer: { width: 5, depth: 5, height: 10 },
  bins: [],
  layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
  categories: [{ id: 'cat1', name: 'Default', color: '#6b7280' }],
  gridUnitMm: 42,
  heightUnitMm: 7,
  printBedSize: 256,
});

async function openImport(page: Page) {
  await openLayoutManager(page);
  await waitForDialog(page);
  const dialog = getActiveDialog(page);
  await dialog.getByRole('button', { name: 'Import', exact: true }).click();
  return dialog;
}

test.describe('Import/Export Workflows', () => {
  // The header share button and the Layouts dialog are the desktop surfaces.
  const isDesktop = ({ viewport }: { viewport: { width: number } | null }): boolean =>
    (viewport?.width ?? 0) >= 900;
  test.skip(({ viewport }) => !isDesktop({ viewport }), 'desktop layout only');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  // Hooks run for a skipped test too, on a page that never left about:blank.
  test.afterEach(async ({ page, viewport }) => {
    if (!isDesktop({ viewport })) return;
    await clearAllStorage(page);
    await resetViewport(page);

    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test.describe('Share dialog', () => {
    // Creating the link needs the share API, which the Vite dev server lacks.
    test('opens from the header and closes with Escape', async ({ page }) => {
      await page.getByRole('banner').getByRole('button', { name: 'Share layout' }).click();
      const createLink = page.getByRole('button', { name: 'Create share link' });
      await expect(createLink).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(createLink).not.toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Import', () => {
    test('offers a file and a paste field', async ({ page }) => {
      const dialog = await openImport(page);

      await expect(dialog.getByText('Or paste JSON')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Browse files' })).toBeVisible();
    });

    test('shows a validation error for invalid JSON', async ({ page }) => {
      const dialog = await openImport(page);

      await dialog.locator('textarea').fill('{ invalid json }');

      await expect(dialog.getByText('Validation errors')).toBeVisible({ timeout: 3000 });
      await expect(dialog.getByText('Invalid JSON format')).toBeVisible();
    });

    test('names the missing fields', async ({ page }) => {
      const dialog = await openImport(page);

      await dialog.locator('textarea').fill('{"bins": [], "layers": []}');

      await expect(dialog.getByText('Validation errors')).toBeVisible({ timeout: 3000 });
      await expect(dialog.getByText(/Invalid drawer/)).toBeVisible();
    });

    test('previews a valid layout', async ({ page }) => {
      const dialog = await openImport(page);

      await dialog.locator('textarea').fill(validLayout);

      await expect(dialog.getByText('Ready to import')).toBeVisible({ timeout: 3000 });
      await expect(dialog.getByText('Test Layout', { exact: true })).toBeVisible();
      await expect(dialog.getByText('5×5×10')).toBeVisible();
    });

    test('previews a layout file chosen in the file picker', async ({ page }) => {
      const dialog = await openImport(page);

      await dialog.locator('input[type="file"]').setInputFiles({
        name: 'test-layout.json',
        mimeType: 'application/json',
        buffer: Buffer.from(validLayout),
      });

      await expect(dialog.getByText('Ready to import')).toBeVisible({ timeout: 3000 });
      await expect(dialog.getByText('5×5×10')).toBeVisible();
    });
  });

  test.describe('Download and re-import', () => {
    test('downloads a layout file that imports back with its bins', async ({ page }) => {
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
      await waitForSavedLayout(page, { binCount: 1 });

      await openLayoutManager(page);
      await waitForDialog(page);
      const dialog = getActiveDialog(page);
      const downloading = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Download Untitled layout' }).click();
      const download = await downloading;
      const name = download.suggestedFilename();
      expect(name).toMatch(/\.json$/);
      // Playwright saves the download without its name, and the import reads the name.
      const buffer = await readFile(await download.path());

      await dialog.getByRole('button', { name: 'Import', exact: true }).click();
      await dialog
        .locator('input[type="file"]')
        .setInputFiles({ name, mimeType: 'application/json', buffer });

      await expect(dialog.getByText('Ready to import')).toBeVisible({ timeout: 3000 });
      await expect(dialog.getByText('Untitled layout', { exact: true })).toBeVisible();
      const binsValue = dialog
        .getByText('bins', { exact: true })
        .locator('xpath=following-sibling::div[1]');
      await expect(binsValue).toHaveText('1');
    });
  });
});
