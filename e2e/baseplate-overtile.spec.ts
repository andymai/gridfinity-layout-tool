/**
 * Visual verification for baseplate over-tile mode (#1641).
 *
 * Enabling over-tile replaces the solid padding margin with clipped grid tiles,
 * which must change the rendered baseplate. The `/baseplate` route is reachable
 * directly (only the sidebar entry button is labs-gated). A single (unsplit)
 * plate keeps the assertion simple, but over-tile applies to split plates too.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

test.use({
  launchOptions: { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] },
});

/** Poll until the 3D canvas stops changing (generation settled). */
async function settledCanvas(page: Page): Promise<Buffer> {
  const canvas = page.locator('canvas').first();
  let prev = await canvas.screenshot();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(400);
    const next = await canvas.screenshot();
    if (next.equals(prev)) return next;
    prev = next;
  }
  return prev;
}

test.describe('Baseplate over-tile — visual', () => {
  test('over-tile replaces padding with grid on an unsplit plate', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/baseplate');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120_000 });

    // Shrink to a single (unsplit) plate so over-tile applies: 160mm → 3×3 grid
    // + ~17mm padding per side (handleDimensionCommit floors the grid).
    await page.getByRole('button', { name: /Edit baseplate dimensions/i }).click();
    await page.getByRole('spinbutton', { name: /Baseplate width in mm/i }).fill('160');
    await page.getByRole('spinbutton', { name: /Baseplate depth in mm/i }).fill('160');
    await page.keyboard.press('Enter');

    const before = await settledCanvas(page);

    // The over-tile toggle (a switch) is gated on having padding to convert.
    const overTile = page.getByRole('switch', { name: /Fill padding with grid/i });
    await expect(overTile).toBeVisible({ timeout: 10_000 });
    await overTile.click();

    const after = await settledCanvas(page);
    expect(before.equals(after)).toBe(false);

    await test.info().attach('padding.png', { body: before, contentType: 'image/png' });
    await test.info().attach('overtile.png', { body: after, contentType: 'image/png' });
  });
});
