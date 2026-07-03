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

    // The margin-fill toggle is gated on having padding to convert.
    const fillSwitch = page.getByRole('switch', { name: /Fill padding with grid tiles/i });
    await expect(fillSwitch).toBeVisible({ timeout: 10_000 });
    await fillSwitch.click();

    const after = await settledCanvas(page);
    expect(before.equals(after)).toBe(false);

    await test.info().attach('padding.png', { body: before, contentType: 'image/png' });
    await test.info().attach('overtile.png', { body: after, contentType: 'image/png' });

    // Half-grid only diverges from plain over-tile once a margin reaches 21mm:
    // auto-fit padding is always < 21mm/side, so widen the left edge explicitly.
    const leftPad = page.getByRole('spinbutton', { name: 'Left', exact: true });
    await leftPad.fill('30');
    await leftPad.blur();
    const wideTile = await settledCanvas(page);
    // Guard: the wider padding must have committed and re-rendered.
    expect(wideTile.equals(after)).toBe(false);

    // Now half-grid packs a true 21mm cell + a 9mm leftover, so it must differ.
    await page.getByRole('checkbox', { name: /Prefer half-grid cells/i }).click();
    const halfGrid = await settledCanvas(page);
    expect(halfGrid.equals(wideTile)).toBe(false);
    await test.info().attach('halfgrid.png', { body: halfGrid, contentType: 'image/png' });

    // Switching the leftover to solid drops the sub-21mm pocket (#2397), so the
    // 30mm edge's 9mm remainder becomes solid plastic — the plate must change.
    await page.getByRole('radio', { name: 'Solid', exact: true }).click();
    const solidLeftover = await settledCanvas(page);
    expect(solidLeftover.equals(halfGrid)).toBe(false);
    await test.info().attach('halfgrid-solid-leftover.png', {
      body: solidLeftover,
      contentType: 'image/png',
    });
  });
});
