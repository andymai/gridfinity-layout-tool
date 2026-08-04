import { test, expect, clearAllStorage, resetViewport } from './fixtures';

/**
 * Custom split lines (issue #3115).
 *
 * The mini-map only appears once the plate splits, so each test first grows the
 * grid past the default print bed. The seam lanes are the editor: clicking one
 * switches the plate to a user-drawn plan.
 */
test.describe('Baseplate custom split lines', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/baseplate');
    await expect(page.getByRole('spinbutton', { name: 'Left', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    // The grid steppers are disabled while synced to the layout drawer, so size
    // the plate through the mm editor: 504mm = 12 units, comfortably split.
    await page.getByRole('button', { name: /Edit baseplate dimensions/i }).click();
    await page.getByRole('spinbutton', { name: /Baseplate width in mm/i }).fill('504');
    await page.getByRole('spinbutton', { name: /Baseplate depth in mm/i }).fill('504');
    await page.keyboard.press('Enter');
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);
  });

  test('renders seam lanes on both axes for a split plate', async ({ page }) => {
    const vertical = page.getByRole('button', { name: /Vertical split at column/ });
    const horizontal = page.getByRole('button', { name: /Horizontal split at row/ });
    await expect(vertical.first()).toBeAttached({ timeout: 15_000 });
    // 12 units per axis leaves 11 interior boundaries.
    expect(await vertical.count()).toBe(11);
    expect(await horizontal.count()).toBe(11);
  });

  test('clicking a lane switches the plate to a custom plan and adds a piece', async ({ page }) => {
    const pieces = page.getByRole('button', { name: /^Piece [A-Z]\d+$/ });
    await expect(pieces.first()).toBeAttached({ timeout: 15_000 });
    const before = await pieces.count();

    // The automatic plan halves a 12-unit axis, so column 3 is a fresh cut.
    await page.getByRole('button', { name: 'Vertical split at column 3' }).click();

    await expect(page.getByText('Custom split')).toBeVisible();
    await expect.poll(async () => await pieces.count()).toBeGreaterThan(before);
  });

  test('reset returns the plate to the automatic plan', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Vertical split at column/ }).first()
    ).toBeAttached({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Vertical split at column 3' }).click();
    await expect(page.getByText('Custom split')).toBeVisible();

    await page.getByRole('button', { name: 'Reset to automatic' }).click();
    await expect(page.getByText('Custom split')).toBeHidden();
    await expect(page.getByText(/Split to fit/)).toBeVisible();
  });

  test('an over-bed piece warns and disables export', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Vertical split at column/ }).first()
    ).toBeAttached({ timeout: 15_000 });
    // Merge every vertical seam so one 12-unit column (504mm) spans the plate,
    // far past the default bed.
    for (const lane of await page.getByRole('button', { name: /Vertical split at column/ }).all()) {
      if ((await lane.getAttribute('aria-pressed')) === 'true') await lane.click();
    }

    await expect(page.getByRole('alert')).toContainText("won't fit the print bed");
    await expect(page.getByRole('button', { name: /^Export/ })).toBeDisabled();
  });
});
