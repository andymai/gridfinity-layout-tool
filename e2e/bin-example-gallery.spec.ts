import { test, expect, clearAllStorage } from './fixtures';
import type { Page, Locator } from '@playwright/test';

function getGalleryDialog(page: Page): Locator {
  return page.locator('[role="dialog"][aria-labelledby="example-gallery-title"]');
}

function getPreviewOverlay(page: Page): Locator {
  return page.locator('[role="dialog"][aria-labelledby="example-preview-title"]');
}

async function openGallery(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Browse examples' }).first().click();
  const dialog = getGalleryDialog(page);
  await expect(dialog).toBeVisible({ timeout: 5000 });
  return dialog;
}

test.describe('Bin Example Gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/designer');
    await expect(page.getByRole('button', { name: 'Browse examples' }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  test('opens from the designer header and shows example cards', async ({ page }) => {
    const dialog = await openGallery(page);

    const cards = dialog.locator('[data-example-card]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);

    // Each card renders a thumbnail image.
    await expect(dialog.locator('[data-example-card] img').first()).toBeVisible();
  });

  test('previewing a card and using it creates a design and closes the gallery', async ({
    page,
  }) => {
    const dialog = await openGallery(page);

    await dialog.locator('[data-example-card]').first().click();

    const preview = getPreviewOverlay(page);
    await expect(preview).toBeVisible({ timeout: 5000 });

    await preview.getByRole('button', { name: 'Use as new design' }).click();

    // Success toast confirms the design was created from the example.
    await expect(page.getByText('Created a new design from the example.')).toBeVisible({
      timeout: 5000,
    });

    // The gallery (and its preview) close after creating the design.
    await expect(getGalleryDialog(page)).not.toBeVisible({ timeout: 5000 });
    await expect(preview).not.toBeVisible();
  });

  test('favoriting an example persists across reopen and filters with favorites-only', async ({
    page,
  }) => {
    let dialog = await openGallery(page);

    // Favorite the first card and remember its accessible name.
    const firstCard = dialog.locator('[data-example-card]').first();
    const favoritedName = await firstCard.getAttribute('aria-label');
    expect(favoritedName).toBeTruthy();

    await firstCard.getByRole('button', { name: 'Add to favorites' }).click();
    await expect(firstCard.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();

    // Close the gallery, then reopen — favorite state is persisted.
    await page.keyboard.press('Escape');
    await expect(getGalleryDialog(page)).not.toBeVisible({ timeout: 5000 });

    dialog = await openGallery(page);

    // Toggle favorites-only; only the favorited example should remain.
    await dialog.getByRole('button', { name: 'Show favorites only' }).click();

    const remaining = dialog.locator('[data-example-card]');
    await expect(remaining).toHaveCount(1);
    await expect(remaining.first()).toHaveAttribute('aria-label', favoritedName ?? '');
  });
});
