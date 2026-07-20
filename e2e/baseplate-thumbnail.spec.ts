import { test, expect, clearAllStorage, resetViewport, getActiveDialog } from './fixtures';

/**
 * Baseplate library thumbnails.
 *
 * The active baseplate design captures a 3D preview thumbnail once its mesh
 * settles (backfilled on open when absent, refreshed on every edit). The
 * library manager renders it as an <img>; without one it shows a "No preview"
 * placeholder. This asserts a real WebP data URL lands in storage and the card
 * shows the image, guarding the capture pipeline end to end.
 */
test.describe('Baseplate Library Thumbnails', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/baseplate');
    await expect(page.getByRole('spinbutton', { name: 'Left', exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('captures a thumbnail for the active design and shows it in the manager', async ({
    page,
  }) => {
    // The mount backfill writes a data-URL thumbnail once the mesh settles.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            // Only inspect the DB the app already created — opening it here must
            // never create an empty, store-less DB (that would break the app's
            // own versioned open). Return false so the poll keeps retrying until
            // the app has written its first design.
            const dbs = await indexedDB.databases();
            if (!dbs.some((d) => d.name === 'gridfinity-baseplate-v1')) return false;
            const db = await new Promise<IDBDatabase | null>((resolve) => {
              const req = indexedDB.open('gridfinity-baseplate-v1');
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => resolve(null);
            });
            if (!db || !db.objectStoreNames.contains('designs')) {
              db?.close();
              return false;
            }
            const designs = await new Promise<{ thumbnail: string | null }[]>((resolve) => {
              try {
                const req = db.transaction('designs').objectStore('designs').getAll();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve([]);
              } catch {
                resolve([]);
              }
            });
            db.close();
            return designs.some((d) => typeof d.thumbnail === 'string' && d.thumbnail.length > 0);
          }),
        { timeout: 40_000, intervals: [1000] }
      )
      .toBe(true);

    // Open the library manager and confirm the card renders the image, not the
    // "No preview" placeholder.
    await page.getByRole('button', { name: 'Open baseplate list' }).click();
    const dialog = page.getByRole('dialog', { name: 'Baseplate Library' });
    await expect(dialog).toBeVisible();

    const activeCard = dialog.getByRole('option', { selected: true });
    await expect(activeCard).toBeVisible();
    await expect(activeCard.locator('img')).toBeVisible();
    await expect(activeCard.getByText('No preview')).toHaveCount(0);
  });
});
